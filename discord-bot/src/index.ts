
import { Client, GatewayIntentBits, Guild, TextChannel } from 'discord.js';
// To prevent type conflicts with global Request/Response types (from Deno or DOM),
// we use aliased imports for Express types.
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import type { DiscordRole } from './types';
import fs from 'fs';
import path from 'path';
// FIX: Add imports for ESM-compatible path resolution
import { fileURLToPath } from 'url';

// --- Configuration Loading ---
// Prioritize environment variables, but fall back to a local config.json for hosts without variable support.
const config = {
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
    API_SECRET_KEY: process.env.API_SECRET_KEY,
    SUBMISSIONS_CHANNEL_ID: process.env.SUBMISSIONS_CHANNEL_ID,
    AUDIT_LOG_CHANNEL_ID: process.env.AUDIT_LOG_CHANNEL_ID,
    PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
};

// FIX: Define __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, 'config.json');
if (fs.existsSync(configPath)) {
    try {
        const localConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        console.log("✅ Found local config.json. Merging with environment variables.");
        // Only use values from the file if the corresponding environment variable is NOT set.
        config.DISCORD_BOT_TOKEN = config.DISCORD_BOT_TOKEN || localConfig.DISCORD_BOT_TOKEN;
        config.DISCORD_GUILD_ID = config.DISCORD_GUILD_ID || localConfig.DISCORD_GUILD_ID;
        config.API_SECRET_KEY = config.API_SECRET_KEY || localConfig.API_SECRET_KEY;
        config.SUBMISSIONS_CHANNEL_ID = config.SUBMISSIONS_CHANNEL_ID || localConfig.SUBMISSIONS_CHANNEL_ID;
        config.AUDIT_LOG_CHANNEL_ID = config.AUDIT_LOG_CHANNEL_ID || localConfig.AUDIT_LOG_CHANNEL_ID;
    } catch (error) {
        console.error("❌ Error reading or parsing config.json. Please ensure it is valid JSON.", error);
    }
} else {
    console.log("ℹ️ No local config.json found. Relying solely on environment variables.");
}


const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, API_SECRET_KEY, PORT, SUBMISSIONS_CHANNEL_ID, AUDIT_LOG_CHANNEL_ID } = config;


// --- Environment Variable Validation ---
if (!DISCORD_BOT_TOKEN || !DISCORD_GUILD_ID || !API_SECRET_KEY || !SUBMISSIONS_CHANNEL_ID || !AUDIT_LOG_CHANNEL_ID) {
    console.error("FATAL ERROR: Missing required configuration. Please set DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, API_SECRET_KEY, SUBMISSIONS_CHANNEL_ID, and AUDIT_LOG_CHANNEL_ID in your server's environment settings or in a 'src/config.json' file.");
    // FIX: Cast process to any to resolve TypeScript error on 'exit'
    (process as any).exit(1);
}

// --- Discord Client Setup ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

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
    setInterval(refreshRolesCache, 10 * 60 * 1000); 
});

client.login(DISCORD_BOT_TOKEN).catch(error => {
    console.error(`
    ================================================================================
    ❌ DISCORD LOGIN FAILED
    ================================================================================
    Error: ${error.message}

    This is the most common error when setting up the bot.
    The "Invalid Token" message is usually MISLEADING.

    The actual problem is almost always that you have not enabled the
    required "Privileged Gateway Intents" in your Discord Bot settings.

    --- HOW TO FIX IT ---

    1. Go to the Discord Developer Portal:
       https://discord.com/developers/applications

    2. Select your Bot application.

    3. Go to the "Bot" tab on the left menu.

    4. Scroll down to the "Privileged Gateway Intents" section.

    5. ENABLE the "SERVER MEMBERS INTENT" toggle. It MUST be turned on.
       (You should probably enable "MESSAGE CONTENT INTENT" as well).

    6. Click the green "Save Changes" button at the bottom.

    7. RESTART THE BOT.

    Please verify these steps. This will solve the problem.
    ================================================================================
    `);
    // FIX: Cast process to any to resolve TypeScript error on 'exit'
    (process as any).exit(1);
});

// --- Express API Server Setup ---
const app = express();
app.use(express.json({ limit: '10mb' })); // Increase body limit for potential large payloads
app.use(cors());

const authenticate = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

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

app.get('/member/:id', authenticate, async (req: Request, res: Response) => {
    if (!isBotReady) {
        return res.status(503).json({ error: 'Service Unavailable: Bot is not ready.' });
    }
    try {
        const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
        const member = await guild.members.fetch(req.params.id);
        
        if (!member) {
            return res.status(404).json({ error: 'Member not found in guild.' });
        }
        
        const memberData = {
            id: member.user.id,
            username: member.user.username,
            global_name: member.user.globalName,
            nick: member.nickname,
            avatar: member.user.avatar,
            guild_avatar: member.avatar,
            roles: member.roles.cache.map(r => r.id),
            joined_at: member.joinedAt,
        };
        
        res.json(memberData);
    } catch (error: any) {
        if (error.code === 10007) { // Unknown Member
             return res.status(404).json({ error: 'Member not found in guild.' });
        }
        console.error(`Error fetching member ${req.params.id}:`, error);
        res.status(500).json({ error: 'An internal server error occurred while fetching member data.' });
    }
});

app.post('/notify', authenticate, async (req: Request, res: Response) => {
    if (!isBotReady) {
        return res.status(503).json({ error: 'Service Unavailable: Bot is not ready.' });
    }
    const { type, payload } = req.body;
    if (!type || !payload) {
        return res.status(400).json({ error: 'Invalid request body. "type" and "payload" are required.' });
    }

    try {
        switch (type) {
            case 'dm':
                const { userId, embed } = payload;
                if (!userId || !embed) return res.status(400).json({ error: 'Invalid payload for DM. "userId" and "embed" are required.' });
                
                const user = await client.users.fetch(userId);
                await user.send({ embeds: [embed] });
                break;

            case 'submissions':
            case 'audit':
                const { embed: channelEmbed } = payload;
                if (!channelEmbed) return res.status(400).json({ error: 'Invalid payload for channel message. "embed" is required.' });
                
                const channelId = type === 'submissions' ? SUBMISSIONS_CHANNEL_ID : AUDIT_LOG_CHANNEL_ID;
                console.log(`Attempting to send notification to channel ID: ${channelId}`);
                const channel = await client.channels.fetch(channelId!);
                
                if (channel?.isTextBased()) {
                    await (channel as TextChannel).send({ embeds: [channelEmbed] });
                } else {
                    throw new Error(`Channel with ID ${channelId} is not a text channel or was not found. Please ensure the bot is a member of the server containing this channel.`);
                }
                break;

            default:
                return res.status(400).json({ error: 'Invalid notification type.' });
        }
        res.status(200).json({ success: true, message: 'Notification sent.' });
    } catch (error: any) {
        console.error(`Error processing notification type "${type}":`, error);
        if (error.code === 50007) { // Cannot send messages to this user
            return res.status(403).json({ error: `Could not send DM. User ${payload.userId} may have DMs disabled.` });
        }
        if (error.code === 10003) { // Unknown Channel
             return res.status(404).json({ error: `Notification channel not found. Please check the Channel ID and ensure the bot is a member of the server containing this channel.` });
        }
        res.status(500).json({ error: 'An internal server error occurred while sending the notification.' });
    }
});

app.get('/health', authenticate, async (req: Request, res: Response) => {
    if (!isBotReady) {
        return res.status(503).json({
            ok: false,
            message: 'Bot is not ready or not logged in.',
            details: 'The bot has not established a connection with Discord yet. Check the bot logs for login errors.',
        });
    }
    try {
        const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
        if (!guild) {
             return res.status(404).json({
                ok: false,
                message: 'Guild Not Found.',
                details: `The bot successfully logged in, but it cannot find the server with the ID provided (${DISCORD_GUILD_ID}). Please verify the 'DISCORD_GUILD_ID' is correct and the bot has been invited to the server.`,
            });
        }

        const members = await guild.members.fetch();

        const channelChecks = {
            submissions: { id: SUBMISSIONS_CHANNEL_ID, status: '❌ Not Found', name: null, error: null },
            audit: { id: AUDIT_LOG_CHANNEL_ID, status: '❌ Not Found', name: null, error: null }
        };
    
        try {
            const submissionsChannel = await client.channels.fetch(SUBMISSIONS_CHANNEL_ID!);
            if (submissionsChannel && submissionsChannel.isTextBased()) {
                channelChecks.submissions.status = '✅ Found';
                channelChecks.submissions.name = (submissionsChannel as TextChannel).name;
            } else {
                channelChecks.submissions.error = 'Channel is not a text-based channel.';
            }
        } catch (e) {
            channelChecks.submissions.error = 'Channel ID is invalid or bot does not have access.';
        }
    
        try {
            const auditChannel = await client.channels.fetch(AUDIT_LOG_CHANNEL_ID!);
            if (auditChannel && auditChannel.isTextBased()) {
                channelChecks.audit.status = '✅ Found';
                channelChecks.audit.name = (auditChannel as TextChannel).name;
            } else {
                channelChecks.audit.error = 'Channel is not a text-based channel.';
            }
        } catch (e) {
            channelChecks.audit.error = 'Channel ID is invalid or bot does not have access.';
        }
        
        return res.status(200).json({
            ok: true,
            message: 'Bot is connected and configured correctly.',
            details: {
                guildName: guild.name,
                guildId: guild.id,
                memberCount: members.size,
                channels: channelChecks
            }
        });

    } catch (error: any) {
        console.error('Error during health check:', error);
        res.status(500).json({
            ok: false,
            message: 'An internal error occurred during health check.',
            details: error.message,
        });
    }
});


app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 API server is listening on port ${PORT}`);
});
