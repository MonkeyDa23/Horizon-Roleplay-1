require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const cors = require('cors');
const helmet = require('helmet');

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3001;
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const API_SECRET = process.env.API_SECRET_KEY;

// --- LOGGING UTILS ---
const log = (context, message) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS
    console.log(`[${timestamp}] [${context.toUpperCase()}] ${message}`);
};

// --- DISCORD CLIENT SETUP ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Channel, Partials.GuildMember, Partials.User]
});

// --- EXPRESS APP SETUP ---
const app = express();

// Security & Middleware
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json());

// Middleware: API Key Authentication
const authenticate = (req, res, next) => {
    if (req.path === '/' || req.path === '/health') return next();

    const providedKey = req.headers.authorization;
    if (!providedKey || providedKey !== API_SECRET) {
        log('AUTH', `Blocked unauthorized request from ${req.ip}`);
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing API Key.' });
    }
    next();
};

app.use(authenticate);

// --- ROUTES ---

// 1. Root Status Page
app.get('/', (req, res) => {
    res.send('Vixel Bot is Running.');
});

// 2. Health Check
app.get('/health', (req, res) => {
    if (!client.isReady()) {
        return res.status(503).json({ status: 'initializing', message: 'Bot is still starting up.' });
    }
    const guild = client.guilds.cache.get(GUILD_ID);
    res.json({
        status: 'online',
        botName: client.user.tag,
        ping: client.ws.ping,
        guild: guild ? { name: guild.name, id: guild.id, memberCount: guild.memberCount } : 'Guild Not Found (Check ID)'
    });
});

// 3. User Sync
app.post('/sync-user/:discordId', async (req, res) => {
    const { discordId } = req.params;
    log('SYNC', `Sync request for User ID: ${discordId}`);

    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) {
            return res.status(500).json({ error: 'Server Configuration Error', message: 'Bot is not in the target guild.' });
        }

        let member;
        try {
            member = await guild.members.fetch(discordId);
        } catch (e) {
            return res.status(404).json({ error: 'User Not Found', message: 'User is not a member of the Discord server.' });
        }

        const roles = member.roles.cache
            .filter(r => r.name !== '@everyone')
            .map(r => ({
                id: r.id,
                name: r.name,
                color: r.color,
                position: r.position
            }))
            .sort((a, b) => b.position - a.position);

        const highestRole = roles.length > 0 ? roles[0] : null;

        const responseData = {
            discordId: member.id,
            username: member.user.username,
            avatar: member.user.displayAvatarURL({ dynamic: true, size: 256 }),
            roles: roles,
            highestRole: highestRole
        };

        res.json(responseData);

    } catch (error) {
        log('ERROR', `Sync failed: ${error.message}`);
        res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
});

// 4. Universal Notification Gateway (Smart Router)
app.post('/notify', async (req, res) => {
    const { targetId, targetType, content, embed } = req.body; // targetType: 'user' | 'channel'

    if (!targetId) return res.status(400).json({ error: 'Missing targetId' });

    try {
        let target;
        
        if (targetType === 'user' || targetType === 'dm') {
            try {
                target = await client.users.fetch(targetId);
            } catch (e) {
                log('NOTIFY', `User ${targetId} not found or DM closed.`);
                return res.status(404).json({ error: 'User not found' });
            }
        } else {
            // Default to channel
            try {
                target = await client.channels.fetch(targetId);
            } catch (e) {
                log('NOTIFY', `Channel ${targetId} not found.`);
                return res.status(404).json({ error: 'Channel not found' });
            }
        }

        const payload = {};
        if (content) payload.content = content;
        if (embed) payload.embeds = [embed];

        await target.send(payload);
        log('NOTIFY', `Sent ${targetType} notification to ${targetId}`);
        res.json({ success: true });

    } catch (error) {
        log('ERROR', `Notification failed: ${error.message}`);
        // Return 200 even if DM fails to prevent blocking the frontend flow
        res.status(200).json({ success: false, error: error.message, warning: 'Failed to send message (DMs might be closed)' });
    }
});

// 5. Guild Roles
app.get('/guild-roles', async (req, res) => {
    try {
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) return res.status(404).json({ error: 'Guild not found' });
        
        await guild.roles.fetch();
        const roles = guild.roles.cache
            .map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position }))
            .sort((a, b) => b.position - a.position);
            
        res.json(roles);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- STARTUP ---
client.once('ready', () => {
    log('DISCORD', `Logged in as ${client.user.tag}`);
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 VIXEL CORE BOT IS ONLINE | PORT: ${PORT}`);
    });
});

client.login(TOKEN);