// src/lib/mockData.ts
// This file is now deprecated for most data, as the backend (api/index.js)
// now serves as the single source of truth for quizzes, submissions, rules, etc.
// It can be kept for future frontend-only mock data or removed entirely.

// The getMtaServerStatus mock can remain if a real MTA API is not yet implemented.
import { CONFIG } from './config';

export const getMtaServerStatus = async () => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    if (Math.random() < 0.1) {
        return Promise.reject(new Error("Server is offline"));
    }
    const players = 80 + Math.floor(Math.random() * 40);
    const maxPlayers = 200;
    return {
        name: `${CONFIG.COMMUNITY_NAME} Roleplay | Your Story Begins`,
        players,
        maxPlayers,
    };
}
