const cluster = require('cluster');
const http = require('http');
const os = require('os');
const express = require('express');
const socketIo = require('socket.io');
const socketRedis = require('socket.io-redis');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const numCPUs = os.cpus().length;

if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);

    // Lancer des workers
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    // Si un worker se termine, en relancer un autre
    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died`);
        cluster.fork();
    });

} else {
    const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
    const app = express();
    const server = http.createServer(app);
    const io = socketIo(server);

    // Adapter Redis
    io.adapter(socketRedis({ host: 'localhost', port: 6379 }));

    app.use(express.static(__dirname));

    let waitingUsers = [];
    const rooms = [];
    const monitors = new Set();
    const userRooms = {};
    const { startTime, roomSize, port } = config;

    const startDateTime = new Date(startTime);

    // Interval pour affectation des rooms
    const interval = setInterval(() => {
        const now = new Date();
        if (now >= startDateTime) {
            assignRooms();
            clearInterval(interval);
        }
    }, 1000);

    function assignRooms() {
        if (waitingUsers.length === 0) return;

        io.emit('assigningRoom');

        const shuffledUsers = [...waitingUsers].sort(() => Math.random() - 0.5);

        while (shuffledUsers.length > 0) {
            const usersInRoom = shuffledUsers.splice(0, roomSize);
            const roomId = uuidv4();

            usersInRoom.forEach(socket => {
                socket.join(roomId);
                userRooms[socket.id] = roomId;
                socket.emit('roomAssigned', { roomId });
                console.log(`Utilisateur ${socket.id} affecté à la room ${roomId}`);
            });

            rooms.push({ roomId, users: usersInRoom.map(socket => socket.id) });
        }

        waitingUsers = [];
        io.emit('serverStatus', {
            status: 'Rooms assignées',
            rooms: rooms,
            monitors: Array.from(monitors).map(socket => socket.id)
        });
    }

    io.on('connection', (socket) => {
        console.log(`Nouvelle connexion : ${socket.id} to worker ${process.pid}`);

        const roomId = userRooms[socket.id];
        if (roomId) {
            socket.emit('roomAssigned', { roomId });
        }

        socket.emit('waiting');

        socket.on('joinMonitor', (data) => {
            if (data.id === 'monitor_client') {
                monitors.add(socket);
                socket.emit('serverStatus', {
                    status: 'En attente de l\'affectation des rooms',
                    rooms: rooms,
                    monitors: Array.from(monitors).map(socket => socket.id)
                });
            }
        });

        setTimeout(() => {
            if (!monitors.has(socket)) {
                waitingUsers.push(socket);
            }
        }, 50);

        socket.on('joinRoom', (room) => {
            socket.join(room);
            console.log(`Utilisateur ${socket.id} a rejoint la room ${room}`);
        });

        socket.on('chat message', (data) => {
            const { room, message } = data;
            console.log(`Message de ${socket.id} dans la room ${room}: ${message}`);
            io.to(room).emit('chat message', { user: socket.id, message });
        });

        socket.on('disconnectAllUsers', () => {
            console.log("Déconnecter tous les utilisateurs et rediriger vers index.html");

            io.emit('redirect', 'index.html');
            rooms.splice(0, rooms.length);
            Object.keys(userRooms).forEach((userId) => delete userRooms[userId]);

            io.emit('serverStatus', {
                status: 'Tous les utilisateurs ont été déconnectés et redirigés',
                rooms: rooms,
                monitors: Array.from(monitors).map(socket => socket.id)
            });
        });

        socket.on('disconnect', () => {
            console.log(`Utilisateur ${socket.id} déconnecté`);
            const index = waitingUsers.indexOf(socket);
            if (index !== -1) waitingUsers.splice(index, 1);
            monitors.delete(socket);
            delete userRooms[socket.id];
        });
    });

    server.listen(port, () => {
        console.log(`Worker ${process.pid} listening on port ${port}`);
    });
}
