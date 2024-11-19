class Team {
    constructor(roomId) {
        this.roomId = roomId;
        this.members = []; // Contiendra des objets { socket, userData }
        this.uais = new Set();
    }

    addMember(userData) {
        if (this.isFull() || this.uais.has(userData.user_uai)) {
            return false;
        }
        this.members.push({
            socket: { id: userData.socketId }, // Reconstruire l'objet `socket` avec `id`
            userData: {
                username: userData.username,
                user_id: userData.user_id,
                user_uai: userData.user_uai,
                user_ips: userData.user_ips,
                user_genre: userData.user_genre,
            },
        });
        this.uais.add(userData.user_uai);
        return true;
    }

    isFull() {
        return this.members.length >= 4; // MAX_TEAM_SIZE
    }

    getMemberCount() {
        return this.members.length;
    }

    getAverageIPS() {
        if (this.members.length === 0) return 0;
        const sum = this.members.reduce((acc, member) => acc + parseInt(member.userData.user_ips), 0);
        return sum / this.members.length;
    }

    removeMember() {
        const removedMember = this.members.pop();
        if (removedMember) {
            this.uais.delete(removedMember.userData.user_uai);
        }
        return removedMember; // Retourne l'objet complet du membre
    }
}


export default Team;
