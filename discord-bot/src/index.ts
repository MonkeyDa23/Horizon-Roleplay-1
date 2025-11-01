// discord-bot/src/index.ts
/**
 * Vixel Roleplay - Discord Bot Backend (v2.0)
 *
 * This bot serves as the crucial link between the website and the Discord API.
 * It provides an authenticated REST API for the website (via Supabase Edge Functions)
 * to fetch real-time Discord data and send notifications.
 * It also serves a web-based control panel at its root URL.
 */
import express, { Request, Response, NextFunction } from 'express';
import process from 'process';
import cors from 'cors';
// FIX: Updated discord.js imports for v14 compatibility.
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
import type { BotConfig, NotifyPayload } from './types.js';
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
        // FIX: Use GatewayIntentBits for discord.js v14 compatibility.
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
        // FIX: Manually define the command JSON to avoid SlashCommandBuilder dependency issues.
        const setStatusCommand = {
            name: 'setstatus',
            description: "Sets the bot's status and activity.",
            // FIX: Use bitfield value for Administrator permission ('8') for v14 compatibility.
            default_member_permissions: '8', 
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

        if (!interaction.inGuild() || !interaction.guild) {
            return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        }

        logger('INFO', `Received /setstatus command from user ${interaction.user.tag} (${interaction.user.id})`);

        try {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (!member) {
                logger('ERROR', `Could not fetch member for user ${interaction.user.tag}.`);
                return interaction.reply({ content: 'An error occurred while checking your permissions.', ephemeral: true });
            }

            // FIX: Use PermissionsBitField.Flags for v14 compatibility.
            const hasAdminPerm = member.permissions.has(PermissionsBitField.Flags.Administrator);
            const hasRole = (config.PRESENCE_COMMAND_ROLE_IDS || []).some(id => member.roles.cache.has(id));

            logger('DEBUG', `Permission check for ${member.user.tag}: Has Admin Permission? ${hasAdminPerm}, Has specific role? ${hasRole}`);

            if (!hasAdminPerm && !hasRole) {
                logger('WARN', `User ${interaction.user.tag} was denied access to /setstatus.`);
                return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            }

            const status = interaction.options.getString('status', true) as PresenceStatusData;
            const activityType = interaction.options.getString('activity_type', true);
            const activityName = interaction.options.getString('activity_name', true);
            // FIX: Use ActivityType enum for v14 compatibility.
            const activityTypeMap: { [key: string]: ActivityType } = {
                'Playing': ActivityType.Playing,
                'Watching': ActivityType.Watching,
                'Listening': ActivityType.Listening,
                'Competing': ActivityType.Competing,
            };
            const mappedActivityType = activityTypeMap[activityType];

            client.user?.setPresence({ status, activities: [{ name: activityName, type: mappedActivityType }] });
            logger('INFO', 'Bot presence updated successfully.');
            interaction.reply({ content: 'Status updated successfully!', ephemeral: true });
        } catch (error) {
            logger('ERROR', 'Error handling /setstatus command:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'An unexpected error occurred while running the command.', ephemeral: true }).catch(e => logger('ERROR', 'Failed to send error reply for interaction.', e));
            }
        }
    });

    const app = express();
    const PORT = Number(process.env.PORT) || 14355;
    app.use(cors());
    app.use(express.json() as any);

    const authenticate = (req: Request, res: Response, next: NextFunction) => {
        // FIX: Cast req to any to bypass typing issues with express properties.
        const receivedAuthHeader = (req as any).headers.authorization;
    
        // FIX: Cast req to any to bypass typing issues with express properties.
        logger('DEBUG', `[AUTH] Request on path: ${(req as any).path} from ${(req as any).ip}.`);
    
        if (receivedAuthHeader && receivedAuthHeader.startsWith('Bearer ')) {
            const receivedKey = receivedAuthHeader.substring(7);
            
            if (receivedKey.trim() === config.API_SECRET_KEY.trim()) {
                logger('DEBUG', `[AUTH] SUCCESS: Authentication successful for path ${(req as any).path}.`);
                // FIX: Cast next to any to bypass typing issues.
                return (next as any)(); // Success
            }
        }
    
        // FIX: Cast req to any to bypass typing issues with express properties.
        logger('WARN', `[AUTH] FAILED: Authentication failed for path ${(req as any).path}.`);

        const maskKey = (key: string): string => {
            if (!key) return '(empty)';
            if (key.length <= 8) return '****';
            return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
        }

        let receivedKeyForLog = '(not provided)';
        if (receivedAuthHeader && receivedAuthHeader.startsWith('Bearer ')) {
            receivedKeyForLog = receivedAuthHeader.substring(7).trim();
        }
        
        logger('WARN', `[AUTH] Received Key (masked): ${maskKey(receivedKeyForLog)}`);
        logger('WARN', `[AUTH] Expected Key (masked): ${maskKey(config.API_SECRET_KEY.trim())}`);
        logger('WARN', `ADVICE: Check that VITE_DISCORD_BOT_API_KEY secret in Supabase EXACTLY matches API_SECRET_KEY in the bot's config.json.`);
        
        // FIX: Cast res to any to bypass typing issues.
        (res as any).status(401).send({ error: 'Authentication failed.' });
    };

    // ========== PUBLIC & CONTROL PANEL ENDPOINTS ==========

    app.get('/', (req: Request, res: Response) => {
        // FIX: Cast res to any to bypass typing issues.
        (res as any).setHeader('Content-Type', 'text/html');
        // FIX: Cast res to any to bypass typing issues.
        (res as any).send(CONTROL_PANEL_HTML);
    });

    app.get('/health', (req: Request, res: Response) => {
        if (!client.isReady()) return (res as any).status(503).send({ status: 'error', message: 'Discord Client not ready.' });
        const guild = client.guilds.cache.get(config.DISCORD_GUILD_ID);
        if (!guild) return (res as any).status(500).send({ status: 'error', message: 'Guild not found in cache.' });
        (res as any).status(200).send({ status: 'ok', details: { guildName: guild.name, memberCount: guild.memberCount } });
    });
    
    // ========== AUTHENTICATED API ENDPOINTS ==========
    
    app.get('/api/status', authenticate, async (req: Request, res: Response) => {
        if (!client.isReady() || !client.user) return (res as any).status(503).json({ error: 'Bot is not ready' });
        const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
        // FIX: Cast res to any to bypass typing issues.
        (res as any).json({
            username: client.user.username,
            avatar: client.user.displayAvatarURL(),
            guildName: guild.name,
            memberCount: guild.memberCount,
        });
    });

    app.post('/api/set-presence', authenticate, (req: Request, res: Response) => {
        // FIX: Cast req to any to bypass typing issues with express properties.
        const { status, activityType, activityName } = (req as any).body;
        if (!status || !activityType || !activityName) {
            return (res as any).status(400).json({ error: 'Missing required fields: status, activityType, activityName' });
        }
        try {
            // FIX: Use ActivityType enum for v14 compatibility.
            const activityTypeMap: { [key: string]: ActivityType } = {
                'Playing': ActivityType.Playing,
                'Watching': ActivityType.Watching,
                'Listening': ActivityType.Listening,
                'Competing': ActivityType.Competing,
            };
            const mappedActivityType = activityTypeMap[activityType];
            client.user?.setPresence({ status: status as PresenceStatusData, activities: [{ name: activityName, type: mappedActivityType }] });
            logger('INFO', `Presence updated via control panel.`);
            (res as any).json({ success: true, message: 'Presence updated.' });
        } catch (error) {
            logger('ERROR', 'Failed to set presence via control panel.', error);
            (res as any).status(500).json({ error: 'Failed to update presence.' });
        }
    });

    app.post('/api/send-test-message', authenticate, async (req: Request, res: Response) => {
        // FIX: Cast req to any to bypass typing issues with express properties.
        const { channelId, message } = (req as any).body;
        if (!channelId || !message) return (res as any).status(400).json({ error: 'Missing channelId or message.' });
        try {
            const channel = await client.channels.fetch(channelId);
            if (!channel || !(channel instanceof TextChannel)) {
                return (res as any).status(404).json({ error: 'Channel not found or is not a text channel.' });
            }
            await channel.send(message);
            logger('INFO', `Sent test message to #${channel.name} via control panel.`);
            (res as any).json({ success: true, message: `Message sent to #${channel.name}` });
        } catch (error) {
             logger('ERROR', 'Failed to send test message via control panel.', error);
             (res as any).status(500).json({ error: 'Failed to send message.', details: (error as Error).message });
        }
    });

    app.post('/api/send-dm', authenticate, async (req: Request, res: Response) => {
        // FIX: Cast req to any to bypass typing issues with express properties.
        const { userId, message } = (req as any).body;
        if (!userId || !message) {
            return (res as any).status(400).json({ error: 'Missing userId or message.' });
        }
        try {
            const user = await client.users.fetch(userId);
            await user.send(message);
            logger('INFO', `Sent DM to ${user.tag} via control panel.`);
            (res as any).json({ success: true, message: `DM sent to ${user.tag}` });
        } catch (error) {
             logger('ERROR', 'Failed to send DM via control panel.', error);
             if (error instanceof DiscordAPIError && error.code === 50007) { // Cannot send messages to this user
                return (res as any).status(403).json({ error: 'Failed to send DM.', details: 'Cannot send messages to this user. They may have DMs disabled or have blocked the bot.' });
             }
             (res as any).status(500).json({ error: 'Failed to send DM.', details: (error as Error).message });
        }
    });

    app.get('/api/roles', authenticate, async (req: Request, res: Response) => {
        try {
            const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
            const roles = (await guild.roles.fetch()).map(role => ({ id: role.id, name: role.name, color: role.color, position: role.position }));
            const sortedRoles = roles.sort((a, b) => b.position - a.position);
            (res as any).json(sortedRoles);
        } catch (error) {
            logger('ERROR', 'Failed to fetch guild roles for /api/roles.', error);
            (res as any).status(500).json({ error: 'Failed to fetch roles.' });
        }
    });

    app.get('/api/user/:id', authenticate, async (req: Request, res: Response) => {
        try {
            const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
            // FIX: Cast req to any to bypass typing issues with express properties.
            const member = await guild.members.fetch((req as any).params.id);
            if (!member) return (res as any).status(404).json({ error: 'User not found in guild.' });

            const roles = member.roles.cache
                .filter(role => role.name !== '@everyone')
                .map(role => ({ id: role.id, name: role.name, color: role.color, position: role.position }))
                .sort((a, b) => b.position - a.position);

            const highestRole = roles[0] || null;
            const avatar = member.user.displayAvatarURL({ extension: 'png', size: 256 });

            (res as any).json({ username: member.user.globalName || member.user.username, avatar, roles, highest_role: highestRole });
        } catch (error) {
            if (error instanceof DiscordAPIError && (error.code === 10007 || error.code === 10013)) { // Unknown Member or User
                return (res as any).status(404).json({ error: 'User not found in guild.' });
            }
            if (error instanceof DiscordAPIError && String((error as any).message).includes("Members Intent")) {
                logger('ERROR', "SERVER_MEMBERS_INTENT is likely disabled! Failed to fetch user.", error);
                return (res as any).status(503).json({ error: "Bot is missing SERVER_MEMBERS_INTENT." });
            }
            // FIX: Cast req to any to bypass typing issues with express properties.
            logger('ERROR', `Failed to fetch user ${(req as any).params.id}.`, error);
            (res as any).status(500).json({ error: 'An internal error occurred.' });
        }
    });

    app.post('/api/notify', authenticate, async (req: Request, res: Response) => {
        // FIX: Cast req to any to bypass typing issues with express properties.
        const body: NotifyPayload = (req as any).body;
        logger('INFO', `Received notification request of type: ${body.type}`);
        logger('DEBUG', 'Full notification payload:', body.payload);

        try {
            const embedData = body.payload.embed;
            if (!embedData) throw new Error("Notification payload is missing 'embed' object.");

            // FIX: Use EmbedBuilder for v14 compatibility.
            const embed = new EmbedBuilder();
            if (embedData.title) embed.setTitle(embedData.title);
            if (embedData.description) embed.setDescription(embedData.description);
            if (typeof embedData.color === 'number') embed.setColor(embedData.color);
            if (embedData.timestamp) embed.setTimestamp(new Date(embedData.timestamp));
            if (embedData.footer && embedData.footer.text) embed.setFooter(embedData.footer);
            if (embedData.thumbnail && embedData.thumbnail.url) embed.setThumbnail(embedData.thumbnail.url);
            if (embedData.author && embedData.author.name) embed.setAuthor(embedData.author);
            if (embedData.fields && Array.isArray(embedData.fields)) {
                const validFields = embedData.fields.filter((f: any) => f.name && f.value);
                if (validFields.length > 0) embed.addFields(validFields);
            }

            if ('userId' in body.payload) { // DM Notification
                const userId = body.payload.userId;
                logger('DEBUG', `Attempting to send DM to user ID: ${userId}`);
                try {
                    const user = await client.users.fetch(userId);
                    await user.send({ embeds: [embed] });
                    logger('INFO', `✅ Sent DM to user ${user.tag}.`);
                } catch (dmError) {
                    if (dmError instanceof DiscordAPIError && dmError.code === 50007) {
                        logger('WARN', `Could not DM user ${userId}. They likely have DMs disabled or have blocked the bot.`);
                        return (res as any).status(200).json({ message: 'Could not DM user, but request was processed.' });
                    }
                    throw dmError;
                }
            } else { // Channel Notification
                const channelId = body.payload.channelId;
                logger('DEBUG', `Attempting to send message to channel ID: ${channelId}`);
                const channel = await client.channels.fetch(channelId);

                if (!channel || !(channel instanceof TextChannel)) {
                    throw new Error(`Target channel with ID ${channelId} not found or is not a text-based channel.`);
                }
                
                const messagePayload: { content?: string, embeds: EmbedBuilder[] } = { embeds: [embed] };
                if (body.payload.content) messagePayload.content = body.payload.content;
                
                await channel.send(messagePayload);
                logger('INFO', `✅ Sent embed to channel #${channel.name}.`);
            }
            (res as any).status(200).json({ message: 'Notification sent successfully.' });
        } catch (error) {
            let errorMessage = 'Failed to process notification.';
            const channelId = 'channelId' in body.payload ? body.payload.channelId : 'N/A';
            const userId = 'userId' in body.payload ? body.payload.userId : 'N/A';

            if (error instanceof DiscordAPIError) {
                errorMessage = `Discord API Error (${error.code}): ${(error as any).message}`;
                if (error.code === 50001) {
                    errorMessage += ` - ADVICE: The bot lacks permissions for the target channel (${channelId}). Check 'View Channel', 'Send Messages', and 'Embed Links' permissions.`;
                }
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }
            logger('ERROR', `Failed to process notification of type ${body.type}. Error: ${errorMessage}`, error);
            (res as any).status(500).json({ error: 'Failed to send notification.', details: errorMessage });
        }
    });

    try {
        await client.login(config.DISCORD_BOT_TOKEN);
        app.listen(PORT, '0.0.0.0', () => {
            logger('INFO', `✅ Express server is listening on http://0.0.0.0:${PORT}`);
        });
    } catch (error) {
        logger('FATAL', 'Failed to log in to Discord. Is the token in config.json correct?', error);
        process.exit(1);
    }
};

main().catch(error => logger('FATAL', 'Unhandled exception in main function.', error));
