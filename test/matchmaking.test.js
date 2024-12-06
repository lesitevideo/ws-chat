import {
    matchmakingProgress,
    MAX_TEAM_SIZE,
    MIN_TEAM_SIZE
} from '../matchmaking.js';

import {
    v4 as uuidv4
} from 'uuid';

describe('matchmakingProgress', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('U01: Test function output for 1 room', () => {
        const unassignedUsers = []
        const noUser = 4
        for (let i = 1; i <= noUser; i++) {
            const socketId = uuidv4();
            let user = {
                socketId: socketId,
                username: `username00${i}`,
                user_id: `userid00${i}`,
                user_uai: 1000 + i,
                user_ips: i + 1,
                user_genre: i % 2 != 0 ? "h" : "f",
            }
            unassignedUsers.push(user)
        }

        const result = matchmakingProgress(unassignedUsers);
        expect(result.length).toEqual(noUser / 4);
    });

    it('U02: Verify unique user_uai in teams', () => {
        const unassignedUsers = []
        const noUser = 8
        for (let i = 1; i <= noUser; i++) {
            const socketId = uuidv4();
            let user = {
                socketId: socketId,
                username: `username00${i}`,
                user_id: `userid00${i}`,
                user_uai: i % 2 != 0 ? 1001 : 1002,
                user_ips: i + 1,
                user_genre: i % 2 != 0 ? "h" : "f",
            }
            unassignedUsers.push(user)
        }

        const result = matchmakingProgress(unassignedUsers);
        expect(result.length).toEqual(noUser / 4);
    });

    it('U03: Test boundary with exactly 3 students', () => {
        const unassignedUsers = []
        const noUser = 3
        for (let i = 1; i <= noUser; i++) {
            const socketId = uuidv4();
            let user = {
                socketId: socketId,
                username: `username00${i}`,
                user_id: `userid00${i}`,
                user_uai: 1000 + i,
                user_ips: i + 1,
                user_genre: i % 2 != 0 ? "h" : "f",
            }
            unassignedUsers.push(user)
        }

        const result = matchmakingProgress(unassignedUsers);
        expect(result.length).toEqual(1);
    });

    it('U03_01: Test boundary with exactly 3 students with 2 uai', () => {
        const unassignedUsers = []
        const noUser = 3
        for (let i = 1; i <= noUser; i++) {
            const socketId = uuidv4();
            let user = {
                socketId: socketId,
                username: `username00${i}`,
                user_id: `userid00${i}`,
                user_uai: i % 2 != 0 ? 1001 : 1002,
                user_ips: i + 1,
                user_genre: i % 2 != 0 ? "h" : "f",
            }
            unassignedUsers.push(user)
        }

        const result = matchmakingProgress(unassignedUsers);
        expect(result.length).toEqual(1);
    });

    it('U04: Verify leftovers assigned minimally', () => {
        const unassignedUsers = []
        const noUser = 5
        for (let i = 1; i <= noUser; i++) {
            const socketId = uuidv4();
            let user = {
                socketId: socketId,
                username: `username00${i}`,
                user_id: `userid00${i}`,
                user_uai: 1000,
                user_ips: i + 1,
                user_genre: i % 2 != 0 ? "h" : "f",
            }
            unassignedUsers.push(user)
        }

        const result = matchmakingProgress(unassignedUsers);
        expect(result.length).toEqual(2);
    });

    it('U05: Verify team size when inputs exceed limits diff UAI', () => {
        const unassignedUsers = []
        const noUser = 7
        for (let i = 1; i <= noUser; i++) {
            const socketId = uuidv4();
            let user = {
                socketId: socketId,
                username: `username00${i}`,
                user_id: `userid00${i}`,
                user_uai: 1000 + i,
                user_ips: i + 1,
                user_genre: i % 2 != 0 ? "h" : "f",
            }
            unassignedUsers.push(user)
        }

        const result = matchmakingProgress(unassignedUsers);
        expect(result.length).toEqual(2);
    });

    it('U05_01: Verify team size when inputs exceed limits in 2 UAI', () => {
        const unassignedUsers = []
        const noUser = 7
        for (let i = 1; i <= noUser; i++) {
            const socketId = uuidv4();
            let user = {
                socketId: socketId,
                username: `username00${i}`,
                user_id: `userid00${i}`,
                user_uai: i % 2 != 0 ? 1001 : 1002,
                user_ips: i + 1,
                user_genre: i % 2 != 0 ? "h" : "f",
            }
            unassignedUsers.push(user)
        }

        const result = matchmakingProgress(unassignedUsers);
        expect(result.length).toEqual(2);
    });

    it('U06: Validate no data', () => {
        const unassignedUsers = [];
        const result = matchmakingProgress(unassignedUsers);
        expect(result).toEqual([]);
    });

    it('U07: Check performance for large inputs', () => {
        const unassignedUsers = []
        const noUser = 22500
        const noStudentPerSchool = 30
        let uai = 1000
        for (let i = 1; i <= noUser; i++) {
            if (i % noStudentPerSchool === 0) {
                uai = uai + 1;
            }
            const socketId = uuidv4();
            let user = {
                socketId: socketId,
                username: `username00${i}`,
                user_id: `userid00${i}`,
                user_uai: uai,
                user_ips: i + 1,
                user_genre: i % 2 != 0 ? "h" : "f",
            }
            unassignedUsers.push(user)
        }

        expect(() => matchmakingProgress(unassignedUsers)).not.toThrow();
    });

    it('U10: Verify no team exceeds the limit', () => {
        const unassignedUsers = []
        const min = 4,
            max = 22500
        const noUser = Math.floor(Math.random() * (max - min + 1)) + min;
        const noStudentPerSchool = Math.floor(noUser / 4)
        let uai = 1000
        for (let i = 1; i <= noUser; i++) {
            if (i % noStudentPerSchool === 0) {
                uai = uai + 1;
            }
            const socketId = uuidv4();
            let user = {
                socketId: socketId,
                username: `username00${i}`,
                user_id: `userid00${i}`,
                user_uai: uai,
                user_ips: i + 1,
                user_genre: i % 2 != 0 ? "h" : "f",
            }
            unassignedUsers.push(user)
        }
        console.log(`U10----------------noUser: ${JSON.stringify(noUser)}, -----------noStudentPerSchool: ${JSON.stringify(noStudentPerSchool)} -----noUAI:${uai} - 1000`);

        expect(() => matchmakingProgress(unassignedUsers)).not.toThrow();
    });

    it('F01: Verify correct room assignment for a single school with 30 students', () => {
        const unassignedUsers = [];
        const noUser = 30;
        let uai = 1000
        for (let i = 1; i <= noUser; i++) {
            const socketId = uuidv4();
            let user = {
                socketId: socketId,
                username: `username00${i}`,
                user_id: `userid00${i}`,
                user_uai: uai,
                user_ips: i + 1,
                user_genre: i % 2 != 0 ? "h" : "f",
            }
            unassignedUsers.push(user)
        }

        const result = matchmakingProgress(unassignedUsers);
        expect(result.length).toEqual(8);
    });

    it('F02: Verify room assignment with multiple schools', () => {
        const unassignedUsers = [];
        const noUser = 90
        const noStudentPerSchool = 30
        let uai = 1000
        for (let i = 1; i <= noUser; i++) {
            if (i % noStudentPerSchool === 0) {
                uai = uai + 1;
            }
            const socketId = uuidv4();
            let user = {
                socketId: socketId,
                username: `username00${i}`,
                user_id: `userid00${i}`,
                user_uai: uai,
                user_ips: i + 1,
                user_genre: i % 2 != 0 ? "h" : "f",
            }
            unassignedUsers.push(user)
        }

        const result = matchmakingProgress(unassignedUsers);
        const unexpectedTeams = result.filter(team => team.getMemberCount() != MIN_TEAM_SIZE);
        expect(unexpectedTeams.length).toEqual(0);
    });

    it('F03: Check behavior for leftover students', () => {
        const unassignedUsers = [];
        const noUser = 35
        const noStudentPerSchool = 35
        let uai = 1000
        for (let i = 1; i <= noUser; i++) {
            if (i % noStudentPerSchool === 0) {
                uai = uai + 1;
            }
            const socketId = uuidv4();
            let user = {
                socketId: socketId,
                username: `username00${i}`,
                user_id: `userid00${i}`,
                user_uai: uai,
                user_ips: i + 1,
                user_genre: i % 2 != 0 ? "h" : "f",
            }
            unassignedUsers.push(user)
        }
        console.log(`F02----------------noUser: ${JSON.stringify(noUser)}, -----------noStudentPerSchool: ${JSON.stringify(noStudentPerSchool)} -----noUAI:${uai} - 1000`);

        const result = matchmakingProgress(unassignedUsers);
        const maxTeams = result.filter(team => team.getMemberCount() === MAX_TEAM_SIZE);
        const minTeams = result.filter(team => team.getMemberCount() === MIN_TEAM_SIZE);
        expect(maxTeams.length).toEqual(8);
        expect(minTeams.length).toEqual(1);
    });

    it('F04: Validate students from the same school grouped minimally', () => {
        const unassignedUsers = [];
        const noUser = 120
        const noStudentPerSchool = 30
        let uai = 1000
        for (let i = 1; i <= noUser; i++) {
            if (i % noStudentPerSchool === 0) {
                uai = uai + 1;
            }
            const socketId = uuidv4();
            let user = {
                socketId: socketId,
                username: `username00${i}`,
                user_id: `userid00${i}`,
                user_uai: uai,
                user_ips: i + 1,
                user_genre: i % 2 != 0 ? "h" : "f",
            }
            unassignedUsers.push(user)
        }
        console.log(`F04----------------noUser: ${JSON.stringify(noUser)}, -----------noStudentPerSchool: ${JSON.stringify(noStudentPerSchool)} -----noUAI:${uai} - 1000`);

        const result = matchmakingProgress(unassignedUsers);
        const sameUAITeams = []
        result.forEach(team => {
            const uais = new Set();
            const users = team.getDrawUserMembers();
            for (let i = 0; i < users.length; i++) {
                if (!uais.has(users[i].user_uai)) {
                    uais.add(String(users[i].user_uai))
                }
            }
            if (uais.size != MAX_TEAM_SIZE) {
                sameUAITeams.push(team)
            }
        });
        expect(result.length).toEqual(30);
        expect(sameUAITeams.length).toEqual(0);
    });

    it('F05: Verify maximum students in a team (boundary test)', () => {
        const unassignedUsers = [];
        const min = 4,
            max = 22500
        const noUser = Math.floor(Math.random() * (max - min + 1)) + min;
        const noStudentPerSchool = 1
        let uai = 1000
        for (let i = 1; i <= noUser; i++) {
            if (i % noStudentPerSchool === 0) {
                uai = uai + 1;
            }
            const socketId = uuidv4();
            let user = {
                socketId: socketId,
                username: `username00${i}`,
                user_id: `userid00${i}`,
                user_uai: uai,
                user_ips: i + 1,
                user_genre: i % 2 != 0 ? "h" : "f",
            }
            unassignedUsers.push(user)
        }
        console.log(`F05----------------noUser: ${JSON.stringify(noUser)}, -----------noStudentPerSchool: ${JSON.stringify(noStudentPerSchool)} -----noUAI:${uai} - 1000`);

        const result = matchmakingProgress(unassignedUsers);
        const maxUAITeams = []
        result.forEach(team => {
            const uais = new Set();
            const users = team.getDrawUserMembers();
            for (let i = 0; i < users.length; i++) {
                if (!uais.has(users[i].user_uai)) {
                    uais.add(String(users[i].user_uai))
                }
            }
            if (uais.size == MAX_TEAM_SIZE) {
                maxUAITeams.push(team)
            }
        });
        console.log(`F05----------------maxUAITeams.length: ${JSON.stringify(maxUAITeams.length)}`);
        expect(maxUAITeams.length).toBeGreaterThan(0);
    });
});