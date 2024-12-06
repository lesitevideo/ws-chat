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
            socket: {
                id: userData.socketId
            }, // Reconstruire l'objet `socket` avec `id`
            userData: {
                username: userData.username,
                user_id: userData.user_id,
                user_uai: userData.user_uai,
                user_ips: userData.user_ips,
                user_genre: userData.user_genre,
                user_avatar: userData.user_avatar,
            },
        });
        this.uais.add(String(userData.user_uai));
        return true;
    }

    addMemberFreeUAI(userData) {
        if (this.isFull()) {
            return false;
        }
        this.members.push({
            socket: {
                id: userData.socketId
            }, // Reconstruire l'objet `socket` avec `id`
            userData: {
                username: userData.username,
                user_id: userData.user_id,
                user_uai: userData.user_uai,
                user_ips: userData.user_ips,
                user_genre: userData.user_genre,
                user_avatar: userData.user_avatar,
            },
        });
        this.uais.add(String(userData.user_uai));
        return true;
    }

    isExistedUAI(userUAI) {
        return this.uais.has(userUAI)
    }

    isFull() {
        return this.members.length >= 4; // MAX_TEAM_SIZE
    }

    getRoomId() {
        return this.roomId;
    }

    getMemberCount() {
        return this.members.length;
    }

    getMembers() {
        return this.members;
    }

    getDrawUserMembers() {
        return this.members.reduce((groups, user) => {
            groups.push({
                socketId: user.socket.id,
                username: user.userData.username,
                user_id: user.userData.user_id,
                user_uai: user.userData.user_uai,
                user_ips: user.userData.user_ips,
                user_genre: user.userData.user_genre,
                user_avatar: user.userData.user_avatar,
            })
            return groups;
        }, []);
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

    removeMemberByID(userData) {
        const removedMember = this.members.find(item => item.userData.user_id === userData.user_id);
        if (!(Object.keys(removedMember).length === 0)) {
            this.uais.delete(removedMember.userData.user_uai);
            const newMembers = this.members.filter(item => item.userData.user_id !== userData.user_id);
            this.members = newMembers
        }
    }
}

export default Team;
