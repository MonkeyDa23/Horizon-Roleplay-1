// discord-bot/src/index.ts
/**
 * Vixel Roleplay - Discord Bot Backend (v2.0)
 *
 * This bot serves as the crucial link between the website and the Discord API.
 * It provides an authenticated REST API for the website (via Supabase Edge Functions)
 * to fetch real-time Discord data and send notifications.
 * It also serves a web-based control panel at its root URL.
 */
// FIX: Use default express import and qualified types to avoid collision with global DOM types for Request and Response.
import express from 'express';
import cors from 'cors';
import {
    Client,
    GatewayIntentBits,
    Partials,
    Events,
    PermissionsBitField,
    PresenceStatusData,
    DiscordAPIError,
    TextChannel,
    EmbedBuilder,
    ActivityType
} from 'discord.js';
import { REST } from '@discordjs/rest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { BotConfig } from './types.js';
import { CONTROL_PANEL_HTML } from './controlPanel.js';

// =============================================
// LOGGER UTILITY
// =============================================
const logger = (level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL', message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    const colorMap = {
        DEBUG: '\x1b[36m', // Cyan
        INFO: '\x1b[32m',  // Green
        WARN: '\x1b[33m',  // Yellow
        ERROR: '\x1b[31m', // Red
        FATAL: '\x1b[41m\x1b[37m', // White on Red BG
        RESET: '\x1b[0m'
    };
    const color = colorMap[level];
    console.log(`${color}${logMessage}${colorMap.RESET}`);
    if (data && (level === 'ERROR' || level === 'FATAL' || level === 'DEBUG')) {
        console.error(data);
    }
};

// =============================================
// CONFIGURATION LOADER
// =============================================
const loadConfig = (): BotConfig => {
    logger('INFO', 'Loading configuration...');
    try {
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const configPath = path.resolve(__dirname, '..', 'config.json');

        if (!fs.existsSync(configPath)) {
            throw new Error(`config.json not found at ${configPath}. Please copy config.example.json to config.json and fill it out.`);
        }

        const config: BotConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

        if (!config.DISCORD_BOT_TOKEN || !config.DISCORD_GUILD_ID || !config.API_SECRET_KEY) {
            throw new Error('One or more required fields are missing from config.json (DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, API_SECRET_KEY).');
        }
        logger('INFO', '✅ Configuration loaded and validated successfully.');
        return config;
    } catch (error) {
        logger('FATAL', 'Failed to load or parse config.json.', error);
        process.exit(1);
    }
};

// =============================================
// MAIN APPLICATION
// =============================================
const main = async () => {
    const config = loadConfig();
    const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
        partials: [Partials.Channel],
    });

    client.once(Events.ClientReady, async c => {
        logger('INFO', `✅ Discord Client Ready! Logged in as ${c.user.tag}`);
        try {
            const guild = await c.guilds.fetch(config.DISCORD_GUILD_ID);
            logger('INFO', `✅ Successfully connected to Guild: "${guild.name}"`);
            await registerCommands(c.user.id);
        } catch (error) {
            handleGuildFetchError(error);
        }
    });

    const registerCommands = async (clientId: string) => {
        const setStatusCommand = {
            name: 'setstatus',
            description: "Sets the bot's status and activity.",
            default_member_permissions: String(PermissionsBitField.Flags.Administrator), 
            options: [
                { name: 'status', description: "Bot's status.", type: 3 /* STRING */, required: true, choices: [{ name: 'Online', value: 'online' }, { name: 'Idle', value: 'idle' }, { name: 'Do Not Disturb', value: 'dnd' }] },
                { name: 'activity_type', description: "Bot's activity type.", type: 3, required: true, choices: [{ name: 'Playing', value: 'Playing' }, { name: 'Watching', value: 'Watching' }, { name: 'Listening to', value: 'Listening' }, { name: 'Competing in', value: 'Competing' }] },
                { name: 'activity_name', description: "Bot's activity name.", type: 3, required: true }
            ],
        };

        logger('INFO', `Attempting to register slash commands for guild ${config.DISCORD_GUILD_ID}...`);
        const rest = new REST().setToken(config.DISCORD_BOT_TOKEN);
        try {
            await rest.put(`/applications/${clientId}/guilds/${config.DISCORD_GUILD_ID}/commands`, { body: [setStatusCommand] });
            logger('INFO', '✅ Slash commands registered/updated successfully.');
        } catch (error) {
            logger('ERROR', 'Failed to register slash commands. ADVICE: Ensure the bot was invited with both `bot` and `applications.commands` scopes.', error);
        }
    };

    const handleGuildFetchError = (error: any) => {
        logger('FATAL', `Could not fetch guild with ID ${config.DISCORD_GUILD_ID}.`);
        if (error instanceof DiscordAPIError) {
            if (error.code === 50001) {
                logger('FATAL', `ADVICE: The bot is missing 'Access' to the guild. It might not be in the server.`);
            } else {
                logger('FATAL', `ADVICE: Ensure the 'DISCORD_GUILD_ID' in config.json is correct and the bot has been invited to that server.`);
            }
        } else {
            logger('FATAL', `ADVICE: Ensure the 'DISCORD_GUILD_ID' in config.json is correct and the bot has been invited to that server.`);
        }
        logger('FATAL', `ADVICE: Also, ensure the 'SERVER MEMBERS INTENT' is enabled in the Discord Developer Portal.`);
        process.exit(1);
    }

    client.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'setstatus') return;
        if (!interaction.inGuild() || !interaction.guild) return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });

        logger('INFO', `Received /setstatus command from user ${interaction.user.tag} (${interaction.user.id})`);
        try {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (!member) throw new Error('Could not fetch member.');
            
            const hasAdminPerm = member.permissions.has(PermissionsBitField.Flags.Administrator);
            const hasRole = (config.PRESENCE_COMMAND_ROLE_IDS || []).some(id => member.roles.cache.has(id));

            if (!hasAdminPerm && !hasRole) {
                logger('WARN', `User ${interaction.user.tag} was denied access to /setstatus.`);
                return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            }

            const status = interaction.options.getString('status', true) as PresenceStatusData;
            const activityType = interaction.options.getString('activity_type', true);
            const activityName = interaction.options.getString('activity_name', true);
            const activityTypeMap: { [key: string]: ActivityType } = { 'Playing': ActivityType.Playing, 'Watching': ActivityType.Watching, 'Listening': ActivityType.Listening, 'Competing': ActivityType.Competing };
            
            client.user?.setPresence({ status, activities: [{ name: activityName, type: activityTypeMap[activityType] }] });
            logger('INFO', 'Bot presence updated successfully.');
            interaction.reply({ content: 'Status updated successfully!', ephemeral: true });
        } catch (error) {
            logger('ERROR', 'Error handling /setstatus command:', error);
            if (!interaction.replied) await interaction.reply({ content: 'An unexpected error occurred.', ephemeral: true });
        }
    });

    const app = express();
    const PORT = Number(process.env.PORT) || 14355;
    
    app.use(cors());
    app.use(express.json());

    const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const receivedKey = (req.headers.authorization || '').substring(7);
        if (receivedKey && receivedKey === config.API_SECRET_KEY) {
            return next();
        }
        logger('WARN', `[AUTH_FAIL] Unauthorized request to ${req.path}. Ensure API keys match.`);
        res.status(401).send({ error: 'Authentication failed.' });
    };

    app.get('/', (req: express.Request, res: express.Response) => res.setHeader('Content-Type', 'text/html').send(CONTROL_PANEL_HTML));
    app.get('/health', (req: express.Request, res: express.Response) => res.status(200).send({ status: 'ok' }));
    
    app.get('/api/status', authenticate, async (req: express.Request, res: express.Response) => {
        if (!client.isReady() || !client.user) return res.status(503).json({ error: 'Bot is not ready' });
        const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
        res.json({ username: client.user.username, avatar: client.user.displayAvatarURL(), guildName: guild.name, memberCount: guild.memberCount });
    });

    app.post('/api/set-presence', authenticate, (req: express.Request, res: express.Response) => {
        const { status, activityType, activityName } = req.body;
        if (!status || !activityType || !activityName) return res.status(400).json({ error: 'Missing required fields' });
        try {
            const activityTypeMap: { [key: string]: ActivityType } = { 'Playing': ActivityType.Playing, 'Watching': ActivityType.Watching, 'Listening': ActivityType.Listening, 'Competing': ActivityType.Competing };
            client.user?.setPresence({ status: status as PresenceStatusData, activities: [{ name: activityName, type: activityTypeMap[activityType] }] });
            res.json({ success: true, message: 'Presence updated.' });
        } catch (error) { res.status(500).json({ error: 'Failed to update presence.' }); }
    });
    
    app.get('/api/roles', authenticate, async (req: express.Request, res: express.Response) => {
        try {
            const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
            const roles = (await guild.roles.fetch()).map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position })).sort((a, b) => b.position - a.position);
            res.json(roles);
        } catch (error) { res.status(500).json({ error: 'Failed to fetch roles.' }); }
    });

    app.get('/api/user/:id', authenticate, async (req: express.Request, res: express.Response) => {
        try {
            const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
            const member = await guild.members.fetch(req.params.id);
            if (!member) return res.status(404).json({ error: 'User not found in guild.' });
            const roles = member.roles.cache.filter(r => r.name !== '@everyone').map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position })).sort((a, b) => b.position - a.position);
            res.json({ username: member.user.globalName || member.user.username, avatar: member.user.displayAvatarURL({ extension: 'png', size: 256 }), roles, highest_role: roles[0] || null });
        } catch (error) {
            if (error instanceof DiscordAPIError && (error.code === 10007 || error.code === 10013)) return res.status(404).json({ error: 'User not found in guild.' });
            if (error instanceof DiscordAPIError && String(error.message).includes("Members Intent")) return res.status(503).json({ error: "Bot is missing SERVER_MEMBERS_INTENT." });
            res.status(500).json({ error: 'An internal error occurred.' });
        }
    });

    app.post('/api/dm', authenticate, async (req: express.Request, res: express.Response) => {
        const { userId, embed } = req.body;
        logger('INFO', `Received DM request for user: ${userId}`);
        try {
            if (!userId || !embed) throw new Error("Missing 'userId' or 'embed'.");
            const user = await client.users.fetch(userId);
            const finalEmbed = new EmbedBuilder(embed);
            await user.send({ embeds: [finalEmbed] });
            logger('INFO', `✅ Sent DM to user ${user.tag}.`);
            res.status(200).json({ message: 'DM sent successfully.' });
        } catch (error) {
            let errorMessage = (error instanceof Error) ? error.message : "An unknown error occurred.";
            logger('ERROR', `Failed to process DM. Error: ${errorMessage}`, error);
            if (error instanceof DiscordAPIError && error.code === 50007) errorMessage = "Cannot send DMs to this user (they may have DMs disabled or have blocked the bot).";
            res.status(500).json({ error: 'Failed to send DM.', details: errorMessage });
        }
    });

    app.post('/api/send-test-message', authenticate, async(req: express.Request, res: express.Response) => {
        const { channelId, message } = req.body;
        try {
            const channel = await client.channels.fetch(channelId) as TextChannel;
            await channel.send(message);
            res.json({ message: 'Message sent successfully' });
        } catch(error) {
            res.status(500).json({ error: (error as Error).message });
        }
    });

    app.post('/api/send-dm', authenticate, async(req: express.Request, res: express.Response) => {
        const { userId, message } = req.body;
        try {
            const user = await client.users.fetch(userId);
            await user.send(message);
            res.json({ message: 'DM sent successfully' });
        } catch(error) {
            res.status(500).json({ error: (error as Error).message });
        }
    })

    try {
        await client.login(config.DISCORD_BOT_TOKEN);
        app.listen(PORT, '0.0.0.0', () => logger('INFO', `✅ Express server is listening on http://0.0.0.0:${PORT}`));
    } catch (error) {
        logger('FATAL', 'Failed to log in to Discord. Is the token in config.json correct?', error);
        process.exit(1);
    }
};

main().catch(error => logger('FATAL', 'Unhandled exception in main function.', error));
