// discord-bot/src/index.ts
/**
 * Vixel Roleplay - Discord Bot Backend
 * 
 * This bot serves as the crucial link between the website and the Discord API.
 * It provides an authenticated REST API for the website (via Supabase Edge Functions)
 * to fetch real-time Discord data and send notifications.
 * 
 * Main responsibilities:
 * - Fetching user profiles, roles, and guild information.
 * - Receiving and processing notification requests (e.g., new submissions, admin actions).
 * - Providing a slash command for admins to update the bot's presence.
 * - Ensuring all communication is secure and authenticated.
 */

// =============================================
// IMPORTS
// =============================================
// FIX: Imported Request, Response, and NextFunction types from express to correctly type middleware and handlers.
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import {
    Client,
    GatewayIntentBits,
    Partials,
    Events,
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActivityType,
    PresenceStatusData,
    DiscordAPIError,
    TextChannel,
    REST
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { BotConfig, DiscordRole, NotifyPayload } from './types.js';

// =============================================
// LOGGER UTILITY
// =============================================
const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4 };
type LogLevel = keyof typeof LOG_LEVELS;

const logger = (level: LogLevel, message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    
    switch(level) {
        case 'DEBUG': console.debug(logMessage); break;
        case 'INFO': console.info(logMessage); break;
        case 'WARN': console.warn(`\x1b[33m${logMessage}\x1b[0m`); break; // Yellow for WARN
        case 'ERROR': console.error(`\x1b[31m${logMessage}\x1b[0m`); break; // Red for ERROR
        case 'FATAL': console.error(`\x1b[41m\x1b[37m${logMessage}\x1b[0m`); break; // Red background for FATAL
        default: console.log(logMessage);
    }

    if (data) {
        if (LOG_LEVELS[level] >= LOG_LEVELS.ERROR || process.env.NODE_ENV === 'development') {
            console.log(JSON.stringify(data, null, 2));
        }
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
        
        const rawConfig = fs.readFileSync(configPath, 'utf-8');
        const config: BotConfig = JSON.parse(rawConfig);

        // --- Configuration Validation ---
        if (!config.DISCORD_BOT_TOKEN) throw new Error('DISCORD_BOT_TOKEN is missing.');
        if (!config.DISCORD_GUILD_ID) throw new Error('DISCORD_GUILD_ID is missing.');
        if (!config.API_SECRET_KEY) throw new Error('API_SECRET_KEY is missing.');
        if (!Array.isArray(config.PRESENCE_COMMAND_ROLE_IDS)) {
            logger('WARN', 'PRESENCE_COMMAND_ROLE_IDS is missing or not an array. Defaulting to an empty array.');
            config.PRESENCE_COMMAND_ROLE_IDS = [];
        }

        logger('INFO', '✅ Configuration loaded and validated successfully.');
        return config;
    } catch (error) {
        logger('FATAL', 'Failed to load or parse config.json.', error);
        // Re-throw the error to be handled by the top-level catch block.
        // This resolves the TypeScript error "Function lacks ending return statement".
        throw error;
    }
};

// =============================================
// MAIN APPLICATION LOGIC
// =============================================
const main = async () => {
    const config = loadConfig();
    const maskedToken = `${config.DISCORD_BOT_TOKEN.substring(0, 5)}...${config.DISCORD_BOT_TOKEN.substring(config.DISCORD_BOT_TOKEN.length - 5)}`;
    logger('INFO', `Using Guild ID: ${config.DISCORD_GUILD_ID}`);
    logger('DEBUG', `Using Bot Token: ${maskedToken}`);
    
    // --- Discord Client Setup ---
    logger('INFO', 'Initializing Discord Client...');
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers, // CRITICAL: This intent is required for fetching member roles.
        ],
        partials: [Partials.Channel], // Necessary for DMs
    });

    client.once(Events.ClientReady, async (readyClient) => {
        logger('INFO', `✅ Discord Client Ready! Logged in as ${readyClient.user.tag}`);
        try {
            const guild = await readyClient.guilds.fetch(config.DISCORD_GUILD_ID);
            logger('INFO', `✅ Successfully connected to Guild: "${guild.name}"`);

            const setStatusCommand = new SlashCommandBuilder()
                .setName('setstatus')
                .setDescription("Sets the bot's status and activity.")
                .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
                .addStringOption(option => option.setName('status').setDescription("The bot's status.").setRequired(true).addChoices({ name: 'Online', value: 'online' }, { name: 'Idle', value: 'idle' }, { name: 'Do Not Disturb', value: 'dnd' }, { name: 'Invisible', value: 'invisible' }))
                .addStringOption(option => option.setName('activity_type').setDescription("The bot's activity type.").setRequired(true).addChoices({ name: 'Playing', value: 'Playing' }, { name: 'Watching', value: 'Watching' }, { name: 'Listening to', value: 'Listening' }, { name: 'Competing in', value: 'Competing' }))
                .addStringOption(option => option.setName('activity_name').setDescription("The bot's activity name.").setRequired(true));
            
            logger('INFO', 'Attempting to register slash commands...');
            const rest = new REST().setToken(config.DISCORD_BOT_TOKEN);
            await rest.put(
                `/applications/${readyClient.user.id}/guilds/${config.DISCORD_GUILD_ID}/commands`,
                { body: [setStatusCommand.toJSON()] },
            );

            logger('INFO', '✅ Slash commands registered/updated successfully.');

        } catch (error) {
            logger('FATAL', `Could not fetch guild with ID ${config.DISCORD_GUILD_ID}.`);
            logger('FATAL', `ADVICE: Ensure the 'DISCORD_GUILD_ID' in config.json is correct and the bot has been invited to that server.`);
            if (error instanceof DiscordAPIError) {
                logger('ERROR', `Discord API Error Code: ${error.code} - ${error.message}`);
                if (error.code === 50001) {
                     logger('FATAL', `ADVICE: The bot is missing 'Access' to the guild. It might not be in the server.`);
                }
            } else {
                logger('ERROR', 'Full Error Details:', error);
            }
            // FIX: Cast `process` to `any` to access `exit` due to missing Node.js types.
            (process as any).exit(1);
        }
    });

    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand() || !interaction.inGuild() || interaction.commandName !== 'setstatus') return;
    
        // Destructure guild and user, then guard to help TypeScript's control flow analysis.
        const { guild, user } = interaction;
        if (!guild) {
            // This should technically be unreachable due to inGuild() check, but it satisfies the compiler.
            return;
        }
    
        logger('INFO', `Received /setstatus command from ${user.tag}.`);
    
        try {
            const member = await guild.members.fetch(user.id);
            const isOwner = guild.ownerId === member.id;
            const hasRole = member.roles.cache.some((role) => config.PRESENCE_COMMAND_ROLE_IDS.includes(role.id));
    
            if (!isOwner && !hasRole) {
                logger('WARN', `↳ Denied /setstatus for ${user.tag} (missing permissions).`);
                await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
                return;
            }
    
            const status = interaction.options.getString('status', true) as PresenceStatusData;
            const activityTypeStr = interaction.options.getString('activity_type', true);
            const activityName = interaction.options.getString('activity_name', true);
    
            const activityTypeMap: { [key: string]: ActivityType } = { 'Playing': ActivityType.Playing, 'Watching': ActivityType.Watching, 'Listening': ActivityType.Listening, 'Competing': ActivityType.Competing };
            const activityType = activityTypeMap[activityTypeStr];
            
            interaction.client.user?.setPresence({ status, activities: [{ name: activityName, type: activityType }] });
    
            logger('INFO', `↳ Successfully updated presence for ${user.tag}.`);
            await interaction.reply({ content: 'Status updated successfully!', ephemeral: true });
    
        } catch (error) {
            logger('ERROR', "Error handling /setstatus command:", error);
            if (!interaction.replied) {
                await interaction.reply({ content: 'An error occurred while processing this command.', ephemeral: true }).catch(() => {});
            }
        }
    });
    
    // --- Express Server Setup ---
    logger('INFO', 'Initializing Express server...');
    const app = express();
    // FIX: Ensure PORT is a number to satisfy the `app.listen` overload.
    const PORT = Number(process.env.PORT) || 12857;

    app.use(cors());
    app.use(express.json());

    // FIX: Use types imported directly from express.
    const authenticate = (req: Request, res: Response, next: NextFunction) => {
        const authHeader = req.headers.authorization;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        
        if (authHeader && authHeader === `Bearer ${config.API_SECRET_KEY}`) {
            logger('DEBUG', `[${req.method} ${req.path}] ✅ Authenticated from IP: ${ip}`);
            next();
        } else {
            logger('WARN', `[${req.method} ${req.path}] ❌ Authentication failed from IP: ${ip}. Incorrect API Key.`);
            res.status(401).json({ error: 'Unauthorized' });
        }
    };
    
    app.get('/', (req: Request, res: Response) => res.status(200).send('Vixel Roleplay Bot is alive!'));

    app.get('/health', authenticate, async (req: Request, res: Response, next: NextFunction) => {
        try {
            const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
            await guild.members.fetch({ limit: 1 }); // Test member fetching ability
            res.status(200).json({ status: 'ok', details: { guildName: guild.name, memberCount: guild.memberCount } });
        } catch (e) {
            logger('ERROR', `[API /health] Health check failed: ${(e as Error).message}`);
            next(e);
        }
    });

    app.get('/api/roles', authenticate, async (req: Request, res: Response, next: NextFunction) => {
        try {
            const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
            const roles = (await guild.roles.fetch())
                .map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position }))
                .sort((a, b) => b.position - a.position);
            logger('INFO', `[API /api/roles] Fetched ${roles.length} roles.`);
            res.status(200).json(roles);
        } catch (error) {
            logger('ERROR', '[API /api/roles] Could not fetch guild roles.', error);
            next(error);
        }
    });

    app.get('/api/user/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
        const { id } = req.params;
        try {
            const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
            const member = await guild.members.fetch(id);

            const roles: DiscordRole[] = member.roles.cache
                .filter(r => r.id !== guild.id)
                .map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position }))
                .sort((a, b) => b.position - a.position);
            
            logger('INFO', `[API /user] Fetched member ${member.user.tag}. Role count: ${roles.length}.`);
            if (roles.length === 0) {
                logger('WARN', `[API /user] Fetched 0 roles for ${member.user.tag}.`);
                logger('WARN', `[API /user] THIS IS THE #1 CAUSE OF LOGIN ISSUES. IT ALMOST ALWAYS MEANS THE 'SERVER MEMBERS INTENT' IS DISABLED IN THE DISCORD DEVELOPER PORTAL!`);
            }
            
            res.status(200).json({
                username: member.user.globalName || member.user.username,
                avatar: member.displayAvatarURL({ extension: 'png', size: 256 }),
                roles,
                highest_role: roles[0] || null
            });
        } catch (error) {
            logger('ERROR', `[API /user/${id}] Failed to fetch user.`, error);
            if (error instanceof DiscordAPIError && error.code === 10007) { // Unknown Member
                return res.status(404).json({ error: 'User not found in guild.' });
            }
            next(error);
        }
    });

    app.post('/api/notify', authenticate, async (req: Request, res: Response, next: NextFunction) => {
        try {
            const body: NotifyPayload = req.body;
            logger('INFO', `[API /notify] Received notification request. Type: ${body.type}`);
            logger('DEBUG', `[API /notify] Payload:`, body.payload);
            
            switch (body.type) {
                case 'new_submission':
                case 'audit_log': {
                    logger('INFO', `↳ Handling channel notification for channel ID: ${body.payload.channelId}`);
                    const channel = await client.channels.fetch(body.payload.channelId);
                    if (!channel?.isTextBased() || channel.isDMBased()) {
                        throw new Error(`Channel ${body.payload.channelId} is not a valid text channel.`);
                    }
                    logger('DEBUG', `↳ Successfully fetched channel #${(channel as TextChannel).name}.`);
                    await (channel as TextChannel).send({ embeds: [body.payload.embed] });
                    logger('INFO', `↳ ✅ Message sent successfully to #${(channel as TextChannel).name}.`);
                    break;
                }
                case 'submission_result':
                case 'submission_receipt': {
                    logger('INFO', `↳ Handling DM notification for user ID: ${body.payload.userId}`);
                    const user = await client.users.fetch(body.payload.userId);
                    logger('DEBUG', `↳ Successfully fetched user ${user.tag}.`);
                    await user.send({ embeds: [body.payload.embed] });
                    logger('INFO', `↳ ✅ DM sent successfully to ${user.tag}.`);
                    break;
                }
                default:
                    // @ts-ignore
                    throw new Error(`Invalid notification type: ${body.type}`);
            }
            res.status(200).json({ success: true, message: 'Notification processed.' });
        } catch (error) {
            logger('ERROR', `[API /notify] ❌ FAILED to process notification.`, error);
            if (error instanceof DiscordAPIError) {
                 let advice = "Check bot permissions or the ID validity.";
                 if(error.code === 50007) advice = "Cannot send DMs to this user (DMs disabled or bot blocked).";
                 else if (error.code === 50013) advice = "Missing Permissions (e.g., Send Messages, View Channel).";
                 else if (error.code === 10003) advice = "Unknown Channel. The Channel ID is incorrect.";
                 else if (error.code === 10013) advice = "Unknown User. The User ID is incorrect.";
                 logger('ERROR', `↳ DISCORD ERROR CODE: ${error.code}`);
                 logger('ERROR', `↳ ADVICE: ${advice}`);
            }
            next(error);
        }
    });

    // FIX: Use types imported directly from express.
    app.use((req: Request, res: Response) => {
        res.status(404).json({ error: 'Not Found' });
    });
    
    // FIX: Use types imported directly from express.
    // FIX: Explicitly cast `err` to access `status` property after `instanceof` check to satisfy type checker.
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        logger('ERROR', `[Express Error] An error occurred on ${req.method} ${req.path}`, err);
        const status = err instanceof DiscordAPIError ? (err as DiscordAPIError).status : 500;
        res.status(status).json({ error: err.message || 'An internal server error occurred.' });
    });

    app.listen(PORT, '0.0.0.0', () => {
        logger('INFO', `🚀 API server is listening on 0.0.0.0:${PORT}`);
    });
    
    logger('INFO', 'Logging into Discord...');
    await client.login(config.DISCORD_BOT_TOKEN);
};

// --- Process-wide Error Handling ---
// FIX: Cast `process` to `any` to access `on` due to missing Node.js types.
(process as any).on('unhandledRejection', (reason: any, promise: any) => {
    logger('FATAL', 'Unhandled Rejection at:', promise);
    logger('FATAL', 'Reason:', reason);
});

// FIX: Cast `process` to `any` to access `on` due to missing Node.js types.
(process as any).on('uncaughtException', (error: Error) => {
    logger('FATAL', 'Uncaught Exception:', error);
    // FIX: Cast `process` to `any` to access `exit` due to missing Node.js types.
    (process as any).exit(1);
});

main().catch(error => {
    logger('FATAL', 'A critical error occurred during bot startup.', error);
    // FIX: Cast `process` to `any` to access `exit` due to missing Node.js types.
    (process as any).exit(1);
});