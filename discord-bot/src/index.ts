import { Client, GatewayIntentBits, Guild } from 'discord.js';
// FIX: Changed Express import to separate runtime from types for better type resolution.
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import type { DiscordRole } from './types';

// --- Environment Variable Validation ---
// Read configuration directly from the environment variables provided by the hosting service.
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const API_SECRET_KEY = process.env.API_SECRET_KEY;
// The hosting environment (e.g., Wispbyte/Pterodactyl) provides the PORT.
// A fallback to 3001 is included for local development.
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// Exit if critical variables are missing.
if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID || !API_SECRET_KEY) {
    console.error("FATAL ERROR: Missing required environment variables. Please set DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, and API_SECRET_KEY in your server's environment settings.");
    process.exit(1);
}

// --- Discord Client Setup ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// In-memory cache for roles. This is the source of truth for the API.
let rolesCache: DiscordRole[] = [];
let isBotReady = false;
let guildName: string | null = null;

const refreshRolesCache = async (): Promise<void> => {
    try {
        const guild: Guild | undefined = await client.guilds.fetch(DISCORD_GUILD_ID).catch(() => undefined);
        if (!guild) {
            console.error(`Could not find guild with ID: ${DISCORD_GUILD_ID}. Please check the ID.`);
            isBotReady = false;
            return;
        }

        await guild.roles.fetch();
        
        rolesCache = guild.roles.cache.map(role => ({
            id: role.id,
            name: role.name,
            color: role.color,
            position: role.position,
        }));
        
        isBotReady = true;
        guildName = guild.name;
        console.log(`✅ Successfully cached ${rolesCache.length} roles from guild "${guildName}".`);
    } catch (error) {
        console.error("❌ Failed to fetch and cache roles:", error);
        isBotReady = false;
    }
};

client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user?.tag}!`);
    refreshRolesCache();
    // Refresh the cache periodically (e.g., every 10 minutes) to catch any changes
    setInterval(refreshRolesCache, 10 * 60 * 1000); 
});

client.login(DISCORD_BOT_TOKEN).catch(error => {
    console.error("❌ Failed to login to Discord. Please check your DISCORD_BOT_TOKEN.", error.message);
    process.exit(1);
});

// --- Express API Server Setup ---
const app = express();
app.use(cors()); // In production, restrict to your website's domain: app.use(cors({ origin: 'https://your-website.com' }));

const authenticate = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Expects "Bearer YOUR_SECRET_KEY"

    if (!token) {
        res.status(401).json({ error: 'Unauthorized: No API key provided.' });
        return;
    }
    if (token !== API_SECRET_KEY) {
        res.status(403).json({ error: 'Forbidden: Invalid API key.' });
        return;
    }
    next();
};

app.get('/', (req: Request, res: Response) => {
    res.json({ 
        status: 'Bot API is running', 
        bot_ready: isBotReady, 
        guild_name: guildName,
        cached_roles_count: rolesCache.length,
        timestamp: new Date().toISOString()
    });
});

app.get('/roles', authenticate, (req: Request, res: Response) => {
    if (!isBotReady || rolesCache.length === 0) {
        return res.status(503).json({ error: 'Service Unavailable: Roles are not cached yet or the bot is not ready.' });
    }
    res.json(rolesCache);
});

// Bind to '0.0.0.0' to ensure the server is accessible within Docker/Pterodactyl environments.
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API server is listening on port ${PORT}`);
});