import cluster from 'cluster';
import os from 'os';
import https from 'https';
import {
    Server
} from 'socket.io';
import fs from 'fs';
import {
    v4 as uuidv4
} from 'uuid';
import Redis from 'ioredis';
import {
    createAdapter
} from '@socket.io/redis-adapter';
import Team from './models/Team.js';
import {
    matchmakingProgress,
    MAX_TEAM_SIZE,
    MIN_TEAM_SIZE
} from './matchmaking.js';

const numCPUs = os.cpus().length;
console.log(`${numCPUs} CPUs sur le serveur`);

if (cluster.isMaster) {
    console.log(`Cluster principal démarré, utilisant ${numCPUs} CPUs.`);

    // Démarrer un worker pour chaque CPU
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    // Log des événements des workers
    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} terminé. Code: ${code}, Signal: ${signal}`);
        console.log('Démarrage d\'un nouveau worker...');
        cluster.fork(); // Remplacer le worker terminé
    });

} else {

    // Options SSL pour le serveur HTTPS
    const options = {
        key: fs.readFileSync('/etc/letsencrypt/live/kinosphere.kinoki.fr/privkey.pem'),
        cert: fs.readFileSync('/etc/letsencrypt/live/kinosphere.kinoki.fr/fullchain.pem'),
        ca: fs.readFileSync('/etc/letsencrypt/live/kinosphere.kinoki.fr/chain.pem')
    };

    // Configuration de Redis
    const redisHost = '127.0.0.1';
    const redisPort = 6379;
    const pubClient = new Redis({
        host: redisHost,
        port: redisPort
    });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
    });

    // Serveur HTTPS
    const server = https.createServer(options);

    // Serveur Socket.IO avec Redis
    const io = new Server(server, {
        cors: {
            origin: '*', // Remplacer par domaine autorisé
            methods: ['GET', 'POST']
        }
    });
    io.adapter(createAdapter(pubClient, subClient));

    const port = 3001;
    let gameStarted = false;

    const monitors = new Set();
    const adminUserIds = [1, 42, 99];

    async function assignRooms() {
        const waitingUsers = (await pubClient.lrange('waitingUsers', 0, -1)).map(JSON.parse);
        if (waitingUsers.length === 0) return;

        await pubClient.del('waitingUsers'); // Supprime les utilisateurs en attente après leur traitement

        // Exclure les administrateurs
        const filteredUsers = waitingUsers.filter(user => !adminUserIds.includes(user.user_id));

        if (filteredUsers.length === 0) {
            console.log("Aucun utilisateur à assigner après le filtrage des administrateurs.");
            return;
        }

        const teams = [];
        let unassignedUsers = [...filteredUsers];

        // Mélanger les utilisateurs
        unassignedUsers.sort(() => Math.random() - 0.5);

        // Créer des équipes complètes (MAX_TEAM_SIZE)
        while (unassignedUsers.length >= MAX_TEAM_SIZE) {
            const roomId = uuidv4();
            const team = new Team(roomId);

            for (let i = 0; i < MAX_TEAM_SIZE; i++) {
                const user = unassignedUsers.pop();
                team.addMember(user);
                io.to(user.socketId).socketsJoin(roomId);
                io.to(user.socketId).emit('roomAssigned', {
                    roomId
                });

                // Sauvegarder l'utilisateur dans Redis pour recherche rapide
                await pubClient.hset('userToRoom', user.user_id, roomId);
            }

            await pubClient.hset(`team:${roomId}`, 'members', JSON.stringify(team.getMembers()));

            teams.push(team);
        }

        // Assigner les utilisateurs restants à des équipes (MIN_TEAM_SIZE)
        while (unassignedUsers.length > 0) {
            const roomId = uuidv4();
            const team = new Team(roomId);

            while (team.getMemberCount() < MIN_TEAM_SIZE && unassignedUsers.length > 0) {
                const user = unassignedUsers.pop();
                team.addMember(user);
                io.to(user.socketId).socketsJoin(roomId);
                io.to(user.socketId).emit('roomAssigned', {
                    roomId
                });
            }

            await pubClient.hset(`team:${roomId}`, 'members', JSON.stringify(team.getMembers()));
            teams.push(team);
        }

        // Redistribuer les joueurs pour respecter MIN_TEAM_SIZE
        const smallTeams = teams.filter(team => team.getMemberCount() < MIN_TEAM_SIZE);
        const largeTeams = teams.filter(team => team.getMemberCount() === MAX_TEAM_SIZE);

        for (const smallTeam of smallTeams) {
            while (smallTeam.getMemberCount() < MIN_TEAM_SIZE && largeTeams.length > 0) {
                const donorTeam = largeTeams[0];
                const removedMember = donorTeam.removeMember();
                if (removedMember) {
                    smallTeam.addMember(removedMember.userData);
                    io.to(removedMember.socket.id).socketsJoin(smallTeam.roomId);
                    io.to(removedMember.socket.id).emit('roomAssigned', {
                        roomId: smallTeam.roomId
                    });
                }

                //io.to(userToTransfer.socket.id).socketsJoin(smallTeam.roomId);
                //io.to(userToTransfer.socket.id).emit('roomAssigned', { roomId: smallTeam.roomId });

                if (donorTeam.getMemberCount() < MAX_TEAM_SIZE) {
                    largeTeams.shift(); // Retirer des grandes équipes si elles ne sont plus "grandes"
                }
            }
        }

        // Mettre à jour les rooms globalement
        const rooms = teams.map(team => ({
            roomId: team.roomId,
            users: team.getMembers().map(member => ({
                id: member.socket.id,
                username: member.userData.username,
                user_id: member.userData.user_id,
                user_uai: member.userData.user_uai,
                user_ips: member.userData.user_ips,
                user_genre: member.userData.user_genre,
                user_avatar: member.userData.user_avatar
            })),
            averageIPS: team.getAverageIPS(),
        }));

        await pubClient.set('rooms', JSON.stringify(rooms));

        io.emit('serverStatus', {
            status: 'Rooms assignées',
            rooms: rooms,
            monitors: Array.from(monitors).map(socket => socket.id),
        });

        // Émet "team members" pour chaque équipe
        for (const team of teams) {
            const teamMembers = team.getMembers().map(member => ({
                username: member.userData.username,
                user_id: member.userData.user_id,
                user_uai: member.userData.user_uai,
                user_ips: member.userData.user_ips,
                user_genre: member.userData.user_genre,
                user_avatar: member.userData.user_avatar
            }));

            for (const member of team.getMembers()) {
                io.to(member.socket.id).emit('team members', {
                    roomId: team.roomId,
                    averageIPS: team.getAverageIPS(),
                    //members: teamMembers.filter(m => m.user_id !== member.userData.user_id), // Exclure le membre lui-même si nécessaire
                    members: teamMembers
                });
            }
        }

        console.log(rooms);
    }

    async function matchmaking() {
        console.log("matchmaking---------------------");
        const waitingUsers = (await pubClient.lrange('waitingUsers', 0, -1)).map(JSON.parse);
        if (waitingUsers.length === 0) return;

        await pubClient.del('waitingUsers');

        // Exclure les administrateurs
        const unassignedUsers = waitingUsers.filter(user => !adminUserIds.includes(user.user_id));

        if (unassignedUsers.length === 0) {
            console.log("Aucun utilisateur à assigner après le filtrage des administrateurs.");
            return;
        }

        let teams = [...matchmakingProgress(unassignedUsers)];

        // optimize: finding better way to batch value to Redis
        for (const team of teams) {
            let roomId = team.getRoomId()
            for (const user of team.getMembers()) {
                io.to(user.socketId).socketsJoin(team.getRoomId());
                io.to(user.socketId).emit('roomAssigned', {
                    roomId
                });

                await pubClient.hset('userToRoom', user.user_id, roomId);
            }
            await pubClient.hset(`team:${roomId}`, 'members', JSON.stringify(team.members));
        }

        const rooms = teams.map(team => ({
            roomId: team.roomId,
            users: team.getMembers().map(member => ({
                id: member.socket.id,
                username: member.userData.username,
                user_id: member.userData.user_id,
                user_uai: member.userData.user_uai,
                user_ips: member.userData.user_ips,
                user_genre: member.userData.user_genre,
                user_avatar: member.userData.user_avatar
            })),
            averageIPS: team.getAverageIPS(),
        }));

        await pubClient.set('rooms', JSON.stringify(rooms));

        io.emit('serverStatus', {
            status: 'Rooms assignées',
            rooms: rooms,
            monitors: Array.from(monitors).map(socket => socket.id),
        });

        for (const team of teams) {
            const teamMembers = team.getMembers().map(member => ({
                username: member.userData.username,
                user_id: member.userData.user_id,
                user_uai: member.userData.user_uai,
                user_ips: member.userData.user_ips,
                user_genre: member.userData.user_genre,
                user_avatar: member.userData.user_avatar
            }));

            for (const member of team.getMembers()) {
                io.to(member.socket.id).emit('team members', {
                    roomId: team.roomId,
                    averageIPS: team.getAverageIPS(),
                    //members: teamMembers.filter(m => m.user_id !== member.userData.user_id), // Exclure le membre lui-même si nécessaire
                    members: teamMembers
                });
            }
        }

        console.log(rooms);
    }

    // io.use((socket, next) => {
    //     const userData = {
    //         username: socket.handshake.query.username,
    //         user_id: parseInt(socket.handshake.query.user_id),
    //         user_uai: socket.handshake.query.user_uai,
    //         user_ips: parseInt(socket.handshake.query.user_ips),
    //         user_genre: socket.handshake.query.user_genre,
    //         user_avatar: socket.handshake.query.user_avatar
    //     };
    //     socket.handshake.auth = userData
    //     next();
    // });

    io.on('connection', async (socket) => {
        const userData = {
            socketId: socket.id,
            username: socket.handshake.auth.username,
            user_id: parseInt(socket.handshake.auth.user_id),
            user_uai: socket.handshake.auth.user_uai,
            user_ips: parseInt(socket.handshake.auth.user_ips),
            user_genre: socket.handshake.auth.user_genre,
            user_avatar: socket.handshake.auth.user_avatar
        };

        console.log(`Nouvelle connexion : ${JSON.stringify(userData)}`);

        try {
            // Vérifier si l'utilisateur appartient déjà à une équipe
            const roomId = await pubClient.hget('userToRoom', userData.user_id);
            if (roomId) {
                console.log(`Utilisateur ${userData.username} réaffecté à la room ${roomId}`);
                socket.join(roomId);
                socket.emit('roomAssigned', {
                    roomId
                });
            } else {
                // Ajouter l'utilisateur à la liste d'attente s'il n'est pas admin
                if (!adminUserIds.includes(userData.user_id)) {
                    await pubClient.rpush('waitingUsers', JSON.stringify(userData));
                }
            }
        } catch (err) {
            console.error('Erreur lors de la connexion utilisateur:', err);
        }

        socket.on('chat message', (data) => {
            const {
                room,
                message
            } = data;
            console.log(`Message de ${socket.id} dans la room ${room}: ${message}`);
            io.to(room).emit('chat message', {
                user: socket.id,
                message
            });
        });

        socket.on('patch picture', (data) => {
            const {
                room,
                message
            } = data;
            console.log(`patch picture de ${socket.id} dans la room ${room}: ${message}`);
            io.to(room).emit('patch picture', {
                user: socket.id,
                message
            });
        });

        socket.on('patch voting', async (data) => {
            const {
                room,
                message
            } = data;
            const {
                user_ID,
                username,
                imageAuthor
            } = message;

            console.log(`Vote reçu de ${socket.id} dans la room ${room}: ${JSON.stringify(message)}`);

            try {
                const roomKey = `votes:${room}`;
                const membersKey = `team:${room}`;
                const votersKey = `voters:${room}`;

                // Ajouter le vote de l'utilisateur
                await pubClient.hincrby(roomKey, imageAuthor, 1);

                // Ajouter l'utilisateur dans la liste des votants
                await pubClient.sadd(votersKey, user_ID);

                // Récupérer tous les membres de la room
                const members = JSON.parse(await pubClient.hget(membersKey, 'members')) || [];
                const totalMembers = members.length;

                // Vérifier le nombre de votants
                const totalVotes = await pubClient.scard(votersKey);

                if (totalVotes === totalMembers) {
                    // Tous les membres ont voté, déterminer le gagnant
                    const votes = await pubClient.hgetall(roomKey);
                    const voteCounts = Object.entries(votes).map(([author, count]) => ({
                        imageAuthor: author,
                        count: parseInt(count, 10)
                    }));

                    // Trouver le score maximal
                    const maxVotes = Math.max(...voteCounts.map(v => v.count));

                    // Trouver tous les candidats avec le score maximal
                    const topCandidates = voteCounts.filter(v => v.count === maxVotes);

                    let winner;

                    if (topCandidates.length > 1) {
                        // Égalité détectée, tirer au sort parmi les égalités
                        winner = topCandidates[Math.floor(Math.random() * topCandidates.length)];
                        console.log(`Égalité dans la room ${room}. Tirage au sort : ${winner.imageAuthor} est le gagnant.`);
                    } else {
                        // Gagnant unique
                        winner = topCandidates[0];
                        console.log(`Gagnant dans la room ${room}: ${JSON.stringify(winner)} avec ${winner.count} votes.`);
                    }

                    // Envoyer le résultat aux participants
                    io.to(room).emit('patch voting result', {
                        result: 'winner',
                        winner: {
                            user_ID: parseInt(winner.imageAuthor),
                            username: winner.imageAuthor
                        },
                        tieResolved: topCandidates.length > 1
                    });

                    // Nettoyer les données après le vote
                    await pubClient.del(roomKey, votersKey);
                } else {
                    console.log(`Votes dans la room ${room}: ${totalVotes}/${totalMembers}`);
                }
            } catch (err) {
                console.error(`Erreur lors du traitement des votes dans la room ${room}:`, err);
                socket.emit('error', 'Erreur lors du traitement des votes.');
            }
        });



        socket.on('joinMonitor', async (data) => {
            if (data.id === 'monitor_client') {
                monitors.add(socket);
                const rooms = JSON.parse(await pubClient.get('rooms') || '[]');
                socket.emit('serverStatus', {
                    status: 'En attente de l\'affectation des rooms',
                    rooms: rooms,
                    monitors: Array.from(monitors).map(socket => socket.id),
                });
            }
        });

        socket.on('startgame', async () => {
            if (gameStarted) {
                socket.emit('error', 'Le jeu a déjà commencé.');
                return;
            }

            if (adminUserIds.includes(userData.user_id)) {
                console.log(`Utilisateur autorisé ${userData.user_id} a déclenché le démarrage du jeu.`);
                gameStarted = true;
                // await assignRooms();                
                await matchmaking();
            } else {
                socket.emit('error', 'Vous n\'êtes pas autorisé à démarrer le jeu.');
            }
        });

        socket.on('get_teams', async () => {
            if (!adminUserIds.includes(userData.user_id)) {
                socket.emit('error', 'Vous n\'êtes pas autorisé à accéder à cette information.');
                return;
            }

            const rooms = JSON.parse(await pubClient.get('rooms') || '[]');
            socket.emit('teams_composition', {
                status: 'success',
                teams: rooms,
            });
        });

        socket.on('disconnect', async () => {
            console.log(`Utilisateur ${socket.id} déconnecté`);
            await pubClient.hdel('userToRoom', socket.id); // Nettoyer Redis
            await pubClient.lrem('waitingUsers', 0, JSON.stringify(userData));
            monitors.delete(socket);
        });
    });

    /*
    const gracefulShutdown = () => {
        console.log('Received kill signal, shutting down gracefully');
        server.close(() => {
            console.log('Closed out remaining connections');
            process.exit(0);
        });

        setTimeout(() => {
            console.error('Could not close connections in time, forcefully shutting down');
            process.exit(1);
        }, 10000);
    };
    */

    const gracefulShutdown = async () => {
        console.log('Received kill signal, shutting down gracefully');

        try {
            // Récupérer les clés correspondant aux motifs
            const patterns = ['userToRoom', 'waitingUsers', 'team:*', 'rooms'];
            let keysToDelete = [];

            for (const pattern of patterns) {
                const keys = await pubClient.keys(pattern); // Récupère les clés pour chaque motif
                keysToDelete = keysToDelete.concat(keys); // Ajoute les clés au tableau
            }

            if (keysToDelete.length > 0) {
                await pubClient.del(...keysToDelete); // Supprime toutes les clés récupérées
                console.log(`Cleared ${keysToDelete.length} keys from Redis:`, keysToDelete);
            } else {
                console.log('No keys found to clear in Redis.');
            }
        } catch (err) {
            console.error('Error clearing keys from Redis:', err);
        }

        server.close(() => {
            console.log('Closed out remaining connections');
            process.exit(0);
        });

        setTimeout(() => {
            console.error('Could not close connections in time, forcefully shutting down');
            process.exit(1);
        }, 10000);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

    server.listen(port, () => {
        console.log(`Serveur en écoute sur le port ${port}`);
    });
}