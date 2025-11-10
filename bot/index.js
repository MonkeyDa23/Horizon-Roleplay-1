// bot/index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');

// --- Configuration ---
const { 
    DISCORD_BOT_TOKEN: TOKEN, 
    DISCORD_GUILD_ID: GUILD_ID, 
    PORT, 
    API_SECRET_KEY 
} = process.env;

// FIX: Trim API key to prevent whitespace issues from .env file.
const trimmedApiKey = API_SECRET_KEY ? API_SECRET_KEY.trim() : undefined;

if (!TOKEN || !GUILD_ID || !PORT || !trimmedApiKey) {
    console.error('CRITICAL ERROR: Missing required environment variables. Please check your .env file.');
    console.error(`TOKEN: ${TOKEN ? 'OK' : 'MISSING'}`);
    console.error(`GUILD_ID: ${GUILD_ID ? 'OK' : 'MISSING'}`);
    console.error(`PORT: ${PORT ? 'OK' : 'MISSING'}`);
    console.error(`API_SECRET_KEY: ${trimmedApiKey ? 'OK' : 'MISSING'}`);
    process.exit(1);
}

// --- Discord Client Setup ---
console.log("Bot is attempting to log in to Discord...");
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // Required for fetching member data
    ],
    partials: [Partials.GuildMember],
});

client.once('ready', () => {
    console.log(`✅ Logged in to Discord as ${client.user.tag}!`);
    console.log(`Bot is ready to serve guild: ${GUILD_ID}`);
});

client.login(TOKEN).catch(error => {
    console.error('CRITICAL ERROR: Failed to log in to Discord. Is the DISCORD_BOT_TOKEN correct?', error);
    process.exit(1);
});

// --- Express API Server ---
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

// --- API Logging Middleware ---
app.use((req, res, next) => {
    console.log(`[API IN] ${req.method} ${req.url} from ${req.ip}`);
    res.on('finish', () => {
        console.log(`[API OUT] ${req.method} ${req.url} - ${res.statusCode}`);
    });
    next();
});

// --- API Authentication Middleware ---
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (authHeader !== `Bearer ${trimmedApiKey}`) {
        console.warn(`[AUTH] FAILED for ${req.url} from ${req.ip}. Invalid API Key provided.`);
        return res.status(403).json({ error: 'Forbidden: Invalid API Key' });
    }
    console.log(`[AUTH] SUCCESS for ${req.url}`);
    next();
};

app.use(authMiddleware);

// --- API Endpoints ---

// Health check endpoint
app.get('/health', (req, res) => {
    if (client.isReady()) {
        res.status(200).json({ status: 'ok', botUser: client.user.tag });
    } else {
        res.status(503).json({ status: 'error', message: 'Bot is not ready or still connecting to Discord.' });
    }
});

// Get all roles from the guild
app.get('/guild-roles', async (req, res) => {
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const roles = await guild.roles.fetch();
        const sortedRoles = roles.map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position })).sort((a, b) => b.position - a.position);
        res.status(200).json(sortedRoles);
    } catch (error) {
        console.error('[ERROR /guild-roles]', error);
        res.status(500).json({ error: 'Failed to fetch guild roles from Discord.' });
    }
});

// Sync a user's profile
app.post('/sync-user/:discordId', async (req, res) => {
    const { discordId } = req.params;
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        const member = await guild.members.fetch(discordId);

        const roles = member.roles.cache
            .map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position }))
            .sort((a, b) => b.position - a.position);

        const userProfile = {
            discordId: member.id,
            username: member.user.globalName || member.user.username,
            avatar: member.displayAvatarURL({ dynamic: true, size: 256 }),
            roles: roles,
            highestRole: member.roles.highest ? { id: member.roles.highest.id, name: member.roles.highest.name, color: member.roles.highest.color, position: member.roles.highest.position } : null,
        };
        res.status(200).json(userProfile);
    } catch (error) {
        console.error(`[ERROR /sync-user/${discordId}]`, error);
        if (error.code === 10007 || error.httpStatus === 404) {
             res.status(404).json({ error: 'User not found in this server.' });
        } else if (error.httpStatus === 403) {
             res.status(503).json({ error: 'Discord API Forbidden. The "Server Members Intent" is likely not enabled in the Discord Developer Portal.' });
        } else {
             res.status(500).json({ error: 'An internal bot error occurred while syncing user profile.' });
        }
    }
});

// General purpose notification endpoint
app.post('/notify', async (req, res) => {
    const { channelId, dmToUserId, embed, content } = req.body;
    const targetLog = dmToUserId ? `DM to user ${dmToUserId}` : `channel ${channelId}`;

    if (!channelId && !dmToUserId) {
        return res.status(400).json({ error: 'A channelId or dmToUserId is required.' });
    }

    try {
        let target;
        if (dmToUserId) {
            target = await client.users.fetch(dmToUserId);
        } else {
            target = await client.channels.fetch(channelId);
        }

        if (!target) {
            return res.status(404).json({ error: 'Target channel or user not found.' });
        }
        
        const messageOptions = {};
        if (content) messageOptions.content = content;
        if (embed) messageOptions.embeds = [new EmbedBuilder(embed)];
        
        await target.send(messageOptions);
        res.status(200).json({ success: true, message: 'Notification sent.' });

    } catch (error) {
        console.error(`[ERROR /notify to ${targetLog}]`, error);
        res.status(500).json({ error: 'Failed to send notification via Discord.' });
    }
});


// Start the server
const { HTTPS_KEY_PATH, HTTPS_CERT_PATH } = process.env;

if (HTTPS_KEY_PATH && HTTPS_CERT_PATH) {
    try {
        const options = {
            key: fs.readFileSync(HTTPS_KEY_PATH),
            cert: fs.readFileSync(HTTPS_CERT_PATH),
        };
        https.createServer(options, app).listen(PORT, () => {
            console.log(`🚀 HTTPS API server is online and listening on https://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('CRITICAL ERROR: Could not start HTTPS server. Check certificate paths in .env.', error);
        console.log('Falling back to HTTP...');
        app.listen(PORT, () => {
            console.log(`🚀 HTTP API server is online and listening on http://localhost:${PORT}`);
        });
    }
} else {
    app.listen(PORT, () => {
        console.log(`🚀 HTTP API server is online and listening on http://localhost:${PORT}`);
    });
}
