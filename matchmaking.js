import {
    v4 as uuidv4
} from 'uuid';
import Team from './models/Team.js';

function groupUsersByUAI(users) {
    const totalIPS = users.reduce((sum, user) => sum + user.user_ips, 0);
    const averageIPS = totalIPS / users.length;

    return users.reduce((groups, user) => {
        const [highIPSMale, highIPSFemale, lowIPSMale, lowIPSFemale] = groups;

        if (!highIPSMale[user.user_uai]) {
            highIPSMale[user.user_uai] = [];
        }
        if (!highIPSFemale[user.user_uai]) {
            highIPSFemale[user.user_uai] = [];
        }
        if (!lowIPSMale[user.user_uai]) {
            lowIPSMale[user.user_uai] = [];
        }
        if (!lowIPSFemale[user.user_uai]) {
            lowIPSFemale[user.user_uai] = [];
        }

        if (user.user_ips >= averageIPS) {
            if (user.user_genre == 'h') {
                highIPSMale[user.user_uai].push(user);
            } else {
                highIPSFemale[user.user_uai].push(user);
            }
        } else {
            if (user.user_genre == 'h') {
                lowIPSMale[user.user_uai].push(user);
            } else {
                lowIPSFemale[user.user_uai].push(user);
            }
        }
        groups = [highIPSMale, highIPSFemale, lowIPSMale, lowIPSFemale];
        return groups;
    }, [{},
        {},
        {},
        {}
    ]);
}

function createRooms(highIPSMale, highIPSFemale, lowIPSMale, lowIPSFemale, unassignedUserSum, teams, teamSize) {

    let isAbleCreateTeam = true;
    while (isAbleCreateTeam) {
        const roomId = uuidv4();
        const team = new Team(roomId);
        let highIPSMaleUsers = [],
            highIPSFemaleUsers = [],
            lowIPSMaleUsers = [],
            lowIPSFemaleUsers = [];


        //balance gender and ips
        if (team.getMemberCount() < teamSize) {
            highIPSMaleUsers.push(...matchingUAIUsers(highIPSMale, team, 1));
        }

        if (team.getMemberCount() < teamSize) {
            highIPSFemaleUsers.push(...matchingUAIUsers(highIPSFemale, team, 1));
        }

        if (team.getMemberCount() < teamSize) {
            lowIPSMaleUsers.push(...matchingUAIUsers(lowIPSMale, team, 1));
        }

        if (team.getMemberCount() < teamSize) {
            lowIPSFemaleUsers.push(...matchingUAIUsers(lowIPSFemale, team, 1));
        }

        //fill up by gender and ips
        if (team.getMemberCount() < teamSize && highIPSMaleUsers.length > 0) {
            highIPSMaleUsers.push(...matchingUAIUsers(highIPSMale, team, teamSize - team.getMemberCount()));
        }

        if (team.getMemberCount() < teamSize && highIPSFemaleUsers.length > 0) {
            highIPSFemaleUsers.push(...matchingUAIUsers(highIPSFemale, team, teamSize - team.getMemberCount()));
        }

        if (team.getMemberCount() < teamSize && lowIPSMaleUsers.length > 0) {
            lowIPSMaleUsers.push(...matchingUAIUsers(lowIPSMale, team, teamSize - team.getMemberCount()));
        }

        if (team.getMemberCount() < teamSize && lowIPSFemaleUsers.length > 0) {
            lowIPSFemaleUsers.push(...matchingUAIUsers(lowIPSFemale, team, teamSize - team.getMemberCount()));
        }

        if (team.getMemberCount() == teamSize) {
            unassignedUserSum -= teamSize;
            teams.push(team);
        } else {
            isAbleCreateTeam = false;
            highIPSMaleUsers.forEach(user => {
                highIPSMale[user.user_uai].push(user);
            });
            highIPSFemaleUsers.forEach(user => {
                highIPSFemale[user.user_uai].push(user);
            });
            lowIPSMaleUsers.forEach(user => {
                lowIPSMale[user.user_uai].push(user);
            });
            lowIPSFemaleUsers.forEach(user => {
                lowIPSFemale[user.user_uai].push(user);
            });
        }

    }
    return unassignedUserSum;

}

function matchingUAIUsers(input, team, noUser) {
    let result = [];
    for (const userUAI in input) {
        if (input.hasOwnProperty(userUAI) && input[userUAI].length > 0) {
            const foundUAI = team.isExistedUAI(userUAI);
            if (!foundUAI) {
                let user = input[userUAI].pop();
                result.push(user);
                team.addMember(user);
            }
            if (result.length == noUser) {
                break;
            }
        }
    }
    return result;
}

function matchmakingWithConditions(highIPSMale, highIPSFemale, lowIPSMale, lowIPSFemale, unassignedUserSum, teams) {
    console.log("matchmakingWithConditions---------------------");

    if (unassignedUserSum > 0) {
        unassignedUserSum = createRooms(highIPSMale, highIPSFemale, lowIPSMale, lowIPSFemale, unassignedUserSum, teams, MAX_TEAM_SIZE);
    }
    if (unassignedUserSum > 0) {
        unassignedUserSum = createRooms(highIPSMale, highIPSFemale, lowIPSMale, lowIPSFemale, unassignedUserSum, teams, MIN_TEAM_SIZE);
    }
    if (unassignedUserSum > 0) {
        unassignedUserSum = createRooms(highIPSMale, highIPSFemale, lowIPSMale, lowIPSFemale, unassignedUserSum, teams, MIN_TEAM_SIZE - 1);
    }

    const smallTeams = teams.filter(team => team.getMemberCount() < MIN_TEAM_SIZE);
    const largeTeams = teams.filter(team => team.getMemberCount() === MAX_TEAM_SIZE);

    for (const smallTeam of smallTeams) {
        let largeTeamIndex = 0
        while (smallTeam.getMemberCount() < MIN_TEAM_SIZE && largeTeamIndex < largeTeams.length) {
            if (largeTeams[largeTeamIndex].getMemberCount() == MAX_TEAM_SIZE) {
                const switchUser = [];
                const [highIPSMaleLargeTeam, highIPSFemaleLargeTeam, lowIPSMaleLargeTeam, lowIPSFemaleLargeTeam] = groupUsersByUAI(largeTeams[largeTeamIndex].getDrawUserMembers());
                if (smallTeam.getMemberCount() < MIN_TEAM_SIZE) {
                    switchUser.push(...matchingUAIUsers(highIPSMaleLargeTeam, smallTeam, 1));
                }
                if (smallTeam.getMemberCount() < MIN_TEAM_SIZE) {
                    switchUser.push(...matchingUAIUsers(highIPSFemaleLargeTeam, smallTeam, 1));
                }
                if (smallTeam.getMemberCount() < MIN_TEAM_SIZE) {
                    switchUser.push(...matchingUAIUsers(lowIPSMaleLargeTeam, smallTeam, 1));
                }
                if (smallTeam.getMemberCount() < MIN_TEAM_SIZE) {
                    switchUser.push(...matchingUAIUsers(lowIPSFemaleLargeTeam, smallTeam, 1));
                }

                if (switchUser.length > 0 && smallTeam.getMemberCount() == MIN_TEAM_SIZE) {
                    largeTeams[largeTeamIndex].removeMemberByID(switchUser[0]);
                }
            }

            largeTeamIndex++;
        }
    }
    return unassignedUserSum;
}

function matchmakingUnCondition(unassignedUsers, teams) {
    console.log("matchmakingUnCondition---------------------");

    while (unassignedUsers.length >= MAX_TEAM_SIZE) {
        const roomId = uuidv4();
        const team = new Team(roomId);

        for (let i = 0; i < MAX_TEAM_SIZE; i++) {
            const user = unassignedUsers.pop();
            team.addMemberFreeUAI(user);

        }
        teams.push(team);
    }

    while (unassignedUsers.length >= MIN_TEAM_SIZE) {
        const roomId = uuidv4();
        const team = new Team(roomId);

        while (team.getMemberCount() < MIN_TEAM_SIZE && unassignedUsers.length > 0) {
            const user = unassignedUsers.pop();
            team.addMemberFreeUAI(user);
        }

        teams.push(team);
    }


    const minTeams = teams.filter(team => team.getMemberCount() === MIN_TEAM_SIZE);
    while (unassignedUsers.length > 0 && minTeams.length > 0) {
        const user = unassignedUsers.pop();
        minTeams[0].addMemberFreeUAI(user);
        minTeams.shift();
    }


    while (unassignedUsers.length > 0) {
        const roomId = uuidv4();
        const team = new Team(roomId);

        while (team.getMemberCount() < MIN_TEAM_SIZE && unassignedUsers.length > 0) {
            const user = unassignedUsers.pop();
            team.addMemberFreeUAI(user);
        }

        teams.push(team);
    }
    console.log(`matchmakingUnCondition end-------------- unassignedUsers: ${JSON.stringify(unassignedUsers)}`);
    console.log(`matchmakingUnCondition end-------------- unassignedUsers len: ${JSON.stringify(unassignedUsers.length)}`);

}

export const MAX_TEAM_SIZE = 4;
export const MIN_TEAM_SIZE = 3;

export function matchmakingProgress(unassignedUsers) {
    try {
        console.log("matchmakingProgress---------------------");

        if (unassignedUsers.length === 0) {
            console.log("There is no user for matchmaking");
            return [];
        }

        let teams = [];

        const [highIPSMale, highIPSFemale, lowIPSMale, lowIPSFemale] = groupUsersByUAI(unassignedUsers);
        matchmakingWithConditions(highIPSMale, highIPSFemale, lowIPSMale, lowIPSFemale, unassignedUsers.length, teams);

        const [reAssignUsers, filterTeams] = teams.reduce((groups, team) => {
            const [users, matchedTeams] = groups;
            if (team.getMemberCount() < MIN_TEAM_SIZE) {
                users.push(...team.getDrawUserMembers());
            } else {
                matchedTeams.push(team);
            }
            groups = [users, matchedTeams];
            return groups;
        }, [
            [],
            []
        ]);
        teams = filterTeams;

        for (const userUAI in highIPSMale) {
            if (highIPSMale[userUAI].length > 0) {
                reAssignUsers.push(...highIPSMale[userUAI]);
            }
        }
        for (const userUAI in highIPSFemale) {
            if (highIPSFemale[userUAI].length > 0) {
                reAssignUsers.push(...highIPSFemale[userUAI]);
            }
        }
        for (const userUAI in lowIPSMale) {
            if (lowIPSMale[userUAI].length > 0) {
                reAssignUsers.push(...lowIPSMale[userUAI]);
            }
        }
        for (const userUAI in lowIPSFemale) {
            if (lowIPSFemale[userUAI].length > 0) {
                reAssignUsers.push(...lowIPSFemale[userUAI]);
            }
        }

        if (reAssignUsers.length > 0) {
            matchmakingUnCondition(reAssignUsers, teams);
        }
        console.log(`teams end----------------: ${JSON.stringify(teams)}`);
        console.log(`teams len----------------: ${JSON.stringify(teams.length)}`);

        return teams;
    } catch (error) {
        return error;
    }
}