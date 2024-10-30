const http = require('http');
const https = require('https');
const express = require('express');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');


// Charger la configuration depuis config.json
const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));

// Chemins vers le certificat et la clé
const keyPath = '/Users/kinoki/mykey.pem'; // Chemin vers votre clé privée
const certPath = '/Users/kinoki/mycert.pem'; // Chemin vers votre certificat

const options = {
  //key: fs.readFileSync(keyPath),
  //cert: fs.readFileSync(certPath),
};


const app = express();
const server = http.createServer(options,app);
const io = socketIo(server);

app.use(express.static(__dirname)); // Servir les fichiers statiques dans le même dossier

let waitingUsers = []; // Liste temporaire des utilisateurs en attente d'affectation
const rooms = []; // Liste des rooms et des utilisateurs affectés
const monitors = new Set(); // Ensemble des sockets de monitoring
const userRooms = {}; // Association des utilisateurs et leur roomId
const { startTime, roomSize, port } = config; // Charger les paramètres depuis config.json

// Convertir l'heure de début en objet Date
const startDateTime = new Date(startTime);

const interval = setInterval(() => {
    const now = new Date();
    if (now >= startDateTime) {
        assignRooms();
        clearInterval(interval);
    }
}, 1000);

function assignRooms() {
    if (waitingUsers.length === 0) return; // Ne rien faire si aucun utilisateur n'attend

    io.emit('assigningRoom'); // Informer que l'affectation commence

    const shuffledUsers = [...waitingUsers].sort(() => Math.random() - 0.5); // Mélanger la liste

    while (shuffledUsers.length > 0) {
        const usersInRoom = shuffledUsers.splice(0, roomSize);

        // Générer un ID unique pour chaque room
        const roomId = uuidv4(); // Utiliser un UUID pour chaque room

        // Associer chaque utilisateur à la room et stocker son ID
        usersInRoom.forEach(socket => {
            socket.join(roomId);
            userRooms[socket.id] = roomId; // Associer l'utilisateur à sa room
            socket.emit('roomAssigned', { roomId }); // Envoyer le roomId à chaque utilisateur
            console.log(`Utilisateur ${socket.id} affecté à la room ${roomId}`);
        });

        rooms.push({ roomId, users: usersInRoom.map(socket => socket.id) });
    }

    // Réinitialiser waitingUsers après l'affectation
    waitingUsers = [];

    io.emit('serverStatus', {
        status: 'Rooms assignées',
        rooms: rooms,
        monitors: Array.from(monitors).map(socket => socket.id)
    });
}

io.on('connection', (socket) => {
    console.log(`Nouvelle connexion : ${socket.id} to worker ${process.pid}`);

    // Envoyer le roomId au moment de la connexion de l'utilisateur
    const roomId = userRooms[socket.id];
    if (roomId) {
        socket.emit('roomAssigned', { roomId });
    }

    socket.emit('waiting'); // Envoyer un message d'attente

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

    // Gestion des messages de chat dans la room
    socket.on('chat message', (data) => {
        const { room, message } = data;
        console.log(`Message de ${socket.id} dans la room ${room}: ${message}`);
        io.to(room).emit('chat message', { user: socket.id, message });
    });

    // Écouter l'événement de déconnexion pour rediriger tous les utilisateurs
    socket.on('disconnectAllUsers', () => {
        console.log("Déconnecter tous les utilisateurs et rediriger vers index.html");

        io.emit('redirect', 'index.html'); // Rediriger tous les utilisateurs vers index.html

        // Vider toutes les rooms et les utilisateurs
        rooms.splice(0, rooms.length);
        Object.keys(userRooms).forEach((userId) => delete userRooms[userId]);

        // Mise à jour du statut
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
        delete userRooms[socket.id]; // Supprimer l'association utilisateur-room
    });
});

server.listen(port, () => {
    console.log(`Serveur en écoute sur le port ${port}`);
}); 