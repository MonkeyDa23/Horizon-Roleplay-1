
import { Client, Guild, TextChannel, IntentsBitField } from 'discord.js';
// FIX: Use `import type` to prevent global type conflicts with DOM Request/Response.
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import type { DiscordRole } from './types';
import fs from 'fs';
import path from 'path';

// --- Configuration Loading ---
// This new logic is more robust for finding the config file.
const config = {
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
    API_SECRET_KEY: process.env.API_SECRET_KEY,
    PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
};

// We determine the root path of the bot project. In a typical setup, the compiled
// index.js is in 'dist/', so we go up one level.
const projectRoot = path.resolve(__dirname, '..');
const configPath = path.join(projectRoot, 'src', 'config.json');

let configSource = 'environment variables';

// Add a specific debug log to show the exact path being checked.
console.log(`ℹ️ Debug: Checking for config file at absolute path: ${configPath}`);

if (!config.DISCORD_BOT_TOKEN || !config.DISCORD_GUILD_ID || !config.API_SECRET_KEY) {
    if (fs.existsSync(configPath)) {
        try {
            const localConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            config.DISCORD_BOT_TOKEN = config.DISCORD_BOT_TOKEN || localConfig.DISCORD_BOT_TOKEN;
            config.DISCORD_GUILD_ID = config.DISCORD_GUILD_ID || localConfig.DISCORD_GUILD_ID;
            config.API_SECRET_KEY = config.API_SECRET_KEY || localConfig.API_SECRET_KEY;
            configSource = `local 'src/config.json' file`;
            console.log(`✅ Loaded configuration from ${configSource}.`);
        } catch (error) {
            console.error("❌ Error reading or parsing config.json. Please ensure it is valid JSON.", error);
        }
    } else {
        console.log("ℹ️ Local config.json not found at the path above. Relying solely on environment variables.");
    }
} else {
    console.log("✅ Loaded configuration from environment variables.");
}


// --- Environment Variable Validation ---
const missingVars: string[] = [];
if (!config.DISCORD_BOT_TOKEN) missingVars.push('DISCORD_BOT_TOKEN');
if (!config.DISCORD_GUILD_ID) missingVars.push('DISCORD_GUILD_ID');
if (!config.API_SECRET_KEY) missingVars.push('API_SECRET_KEY');

if (missingVars.length > 0) {
    console.error(`
    ================================================================================
    ❌ FATAL ERROR: Missing required configuration.
    ================================================================================
    The bot cannot start because the following required setting(s) were not found:

${missingVars.map(v => `    - ${v}`).join('\n')}

    Please fix this by doing ONE of the following:

    1. (RECOMMENDED) Set them as "Environment Variables" in your hosting panel's
       "Startup" or "Variables" page.

    2. (ALTERNATIVE) Create a file named 'config.json' inside the 'src' folder
       of the 'discord-bot' and fill it with your keys.

    The bot will now shut down.
    ================================================================================
    `);
    process.exit(1);
}

const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, API_SECRET_KEY, PORT } = config;


// --- Discord Client Setup ---
const client = new Client({ intents: [IntentsBitField.Flags.Guilds, IntentsBitField.Flags.GuildMembers] });

let rolesCache: DiscordRole[] = [];
let isBotReady = false;
let guildName: string | null = null;

const refreshRolesCache = async (): Promise<void> => {
    try {
        const guild: Guild | undefined = await client.guilds.fetch(DISCORD_GUILD_ID!).catch(() => undefined);
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

    The "Invalid Token" message is usually MISLEADING. The actual problem is
    almost always that you have not enabled the required "Privileged Gateway
    Intents" in your Discord Bot settings.

    --- HOW TO FIX IT ---
    1. Go to the Discord Developer Portal: https://discord.com/developers/applications
    2. Select your Bot application.
    3. Go to the "Bot" tab on the left menu.
    4. Scroll down and ENABLE the "SERVER MEMBERS INTENT" toggle.
    5. Click the green "Save Changes" button.
    6. RESTART THE BOT.
    ================================================================================
    `);
    process.exit(1);
});

// --- Express API Server Setup ---
const app = express();
app.use(express.json({ limit: '10mb' }));
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
        const guild = await client.guilds.fetch(DISCORD_GUILD_ID!);
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

            case 'channel_message':
                const { channelId, embed: channelEmbed } = payload;
                if (!channelEmbed || !channelId) return res.status(400).json({ error: 'Invalid payload for channel message. "channelId" and "embed" are required.' });
                
                const channel = await client.channels.fetch(channelId);
                
                if (channel?.isTextBased()) {
                    await (channel as TextChannel).send({ embeds: [channelEmbed] });
                } else {
                    throw new Error(`Channel with ID ${channelId} is not a text channel or was not found.`);
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
             return res.status(404).json({ error: `Notification channel not found. Please check the Channel ID and that the bot is in the server.` });
        }
        res.status(500).json({ error: 'An internal server error occurred while sending the notification.' });
    }
});

app.get('/bot-status', authenticate, async (req: Request, res: Response) => {
    if (!isBotReady) {
        return res.status(503).json({
            ok: false,
            message: 'Bot is not ready or not logged in.',
            details: 'The bot has not established a connection with Discord yet. Check the bot logs for login errors.',
        });
    }
    try {
        const guild = await client.guilds.fetch(DISCORD_GUILD_ID!);
        if (!guild) {
             return res.status(404).json({
                ok: false,
                message: 'Guild Not Found.',
                details: `The bot successfully logged in, but it cannot find the server with the ID provided (${DISCORD_GUILD_ID}). Please verify the 'DISCORD_GUILD_ID' is correct and the bot has been invited to the server.`,
            });
        }

        const members = await guild.members.fetch();
        
        return res.status(200).json({
            ok: true,
            message: 'Bot is connected and configured correctly.',
            details: {
                guildName: guild.name,
                guildId: guild.id,
                memberCount: members.size,
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