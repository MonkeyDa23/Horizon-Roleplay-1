import { Client, GatewayIntentBits, REST, Routes, DiscordAPIError } from 'discord.js';
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { createWelcomeEmbed, createLogEmbed } from './embeds.js';


// --- Environment Variable Validation ---
const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, PORT, API_SECRET_KEY } = process.env;
if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID || !PORT || !API_SECRET_KEY) {
    console.error('Missing essential environment variables. Please check your .env file.');
    process.exit(1);
}

// --- Discord Client Setup ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
    ],
});

client.once('ready', () => {
    console.log(`✅ Logged in as ${client.user.tag}!`);
    console.log(`🔗 Bot is connected to Guild ID: ${DISCORD_GUILD_ID}`);
});

// --- Express API Server Setup ---
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Allow larger payloads for embeds

// --- API Authentication Middleware ---
const authenticate = (req, res, next) => {
    const apiKey = req.headers['authorization'];
    if (apiKey && apiKey === API_SECRET_KEY) {
        next();
    } else {
        console.warn(`[AUTH] Failed auth attempt from ${req.ip}. Key: ${apiKey}`);
        res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }
};

// --- API Routes ---

// Health check endpoint
app.get('/health', authenticate, (req, res) => {
    res.status(200).json({
        status: 'online',
        botUser: client.user.tag,
        guildId: DISCORD_GUILD_ID,
    });
});

// Fetch user profile endpoint
app.post('/sync-user/:discordId', authenticate, async (req, res) => {
    try {
        const { discordId } = req.params;
        if (!/^\d+$/.test(discordId)) {
            return res.status(400).json({ error: 'Invalid Discord ID format.' });
        }
        const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
        const member = await guild.members.fetch(discordId);

        if (!member) {
            return res.status(404).json({ error: 'User not found in this server.' });
        }

        const roles = member.roles.cache
            .filter(role => role.id !== guild.id) // Exclude @everyone role
            .sort((a, b) => b.position - a.position)
            .map(role => ({
                id: role.id,
                name: role.name,
                color: role.color,
                position: role.position,
            }));
        
        const highestRole = member.roles.highest;

        res.status(200).json({
            discordId: member.id,
            username: member.user.globalName || member.user.username,
            avatar: member.displayAvatarURL({ dynamic: true, size: 256 }),
            roles: roles,
            highestRole: {
                id: highestRole.id,
                name: highestRole.name,
                color: highestRole.color,
                position: highestRole.position
            }
        });
    } catch (error) {
        console.error(`[API /sync-user] Error for ID ${req.params.discordId}:`, error.message);
        if (error instanceof DiscordAPIError) {
            if (error.code === 10007 || error.code === 10013) { // Unknown Member, Unknown User
                 return res.status(404).json({ error: 'User not found in this server.' });
            }
        }
        if (error.message.includes('Members Intent')) {
            return res.status(503).json({ error: 'Bot is missing required permissions. The "Server Members Intent" is likely not enabled in the Discord Developer Portal.' });
        }
        res.status(500).json({ error: 'An internal bot error occurred while syncing user.' });
    }
});


// Fetch all guild roles
app.get('/guild-roles', authenticate, async (req, res) => {
    try {
        const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
        const roles = (await guild.roles.fetch())
            .filter(role => role.id !== guild.id)
            .sort((a, b) => b.position - a.position)
            .map(role => ({
                id: role.id,
                name: role.name,
                color: role.color,
                position: role.position,
            }));
        res.status(200).json(roles);
    } catch (error) {
        console.error('[API /guild-roles] Error:', error);
        res.status(500).json({ error: 'Failed to fetch guild roles.' });
    }
});

// Generic notification sender
app.post('/notify', authenticate, async (req, res) => {
    const { channelId, dmToUserId, content, embed } = req.body;

    try {
        let target;
        if (dmToUserId) {
            if (!/^\d+$/.test(dmToUserId)) return res.status(400).json({ error: 'Invalid dmToUserId format.' });
            target = await client.users.fetch(dmToUserId).catch(() => null);
            if (!target) return res.status(404).json({ error: `DM target user with ID ${dmToUserId} not found.` });
        } else if (channelId) {
            if (!/^\d+$/.test(channelId)) return res.status(400).json({ error: 'Invalid channelId format.' });
            target = await client.channels.fetch(channelId).catch(() => null);
            if (!target) return res.status(404).json({ error: `Target channel with ID ${channelId} not found.` });
            if (!target.isTextBased()) return res.status(400).json({ error: 'Target channel is not a text-based channel.' });
        } else {
            return res.status(400).json({ error: 'A channelId or dmToUserId must be provided.' });
        }
        
        await target.send({ content: content, embeds: embed ? [embed] : [] });
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('[API /notify] Error:', error.message);
        if (error instanceof DiscordAPIError) {
             if (error.code === 50001) { // Missing Access
                return res.status(403).json({ error: `Bot is missing permissions to access or send messages in the target channel/DM.` });
            } else if (error.code === 50007) { // Cannot send messages to this user
                return res.status(403).json({ error: `Cannot send DMs to this user. They may have DMs disabled or have blocked the bot.` });
            } else if (error.code === 10003 || error.code === 10013) { // Unknown Channel, Unknown User
                return res.status(404).json({ error: `Target channel/user not found.` });
            }
        }
        res.status(500).json({ error: 'Failed to send notification due to an internal bot error.' });
    }
});


// --- Start Services ---
const startServices = async () => {
    try {
        console.log('Logging into Discord...');
        await client.login(DISCORD_BOT_TOKEN);
        
        app.listen(PORT, () => {
            console.log(`🚀 API server listening on port ${PORT}`);
        });

    } catch (error) {
        console.error('Failed to start services:', error);
        process.exit(1);
    }
};

startServices();