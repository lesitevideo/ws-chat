# ws-chat

1/ users arrive on the webpage. A cookie is used to pass his credentials :
user_ID, username, user_uai, user_ips, user_genre

2/ Users connect to the chat, passing a few auth values (user_ID, username, etc ...)

user_ID = (integer) user unique identifier

username = (string)

user_uai = (string)unique identifier of the school of the user

user_ips = (float) school social range

user_genre = (string) h or f

user_avatar = (string) avatar picture name on the server

=>
<pre><code>
socket = io('https://mywsdomain.tld:3001', {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000,
  auth: {
    user_id: currentUser.user_ID,
    username: currentUser.username,
    user_uai: currentUser.user_uai,
    user_ips: currentUser.user_ips,
    user_genre: currentUser.user_genre,
    user_avatar: currentUser.user_avatar
  },
});
</code></pre>

3/ user with admin iD (line 62 : const adminUserIds = [1, 42, 99];) can launch the game by sending "startgame" :
<pre><code>
        //sending the event client side
        document.getElementById('startGameButton').addEventListener('click', () => {
                // Envoyer le signal 'startgame' au serveur
                socket.emit('startgame');
                console.log('Signal startgame envoyé au serveur');
        });  
  
        //receiving startgame server side
        socket.on('startgame', async () => {
            if (gameStarted) {
                socket.emit('error', 'Le jeu a déjà commencé.');
                return;
            }

            if (adminUserIds.includes(userData.user_id)) {
                console.log(`Utilisateur autorisé ${userData.user_id} a déclenché le démarrage du jeu.`);
                gameStarted = true;
                await assignRooms();
            } else {
                socket.emit('error', 'Vous n\'êtes pas autorisé à démarrer le jeu.');
            }
        });
</code></pre>

4/ startgame lanches teams (chat rooms) creation.

Team creation rules are :

- 4 users MAX per team
- 3 users MIN per team
- each teammate must have a unique user_uai in the room
- try balance genres (ideally 50% males 50% females)
- try balance user_ips (for example avoid 4 users with high IPS, or 4 users with low IPS)

<b>PROBLEMS :</b><br>
- Team creation sometimes fail when there is a lot of users (i tried with 10000), and at the end there are teams with only one user, users that have no teams, or users that are in more than 1 team
- The server should emit a message while teams are created, because if it takes time, users are not aware of what is happening
- REDIS usage is to validate, because it's the first time i do this and i am not familiar with server side stuff




