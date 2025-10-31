// discord-bot/src/index.ts
/**
 * Vixel Roleplay - Discord Bot Backend
 * 
 * This bot serves as the crucial link between the website and the Discord API.
 * It provides an authenticated REST API for the website (via Supabase Edge Functions)
 * to fetch real-time Discord data and send notifications.
 */

// FIX: Corrected express import and type usage to resolve type conflicts.
// The previous import `import express from 'express'` and using `express.Request` was incorrect.
// The correct way is to import types like `Request` and `Response` as named imports.
// FIX: Reverted the previous fix as it caused type conflicts. Using a default import for express and qualified type names (e.g., express.Request) is safer and resolves the errors.
// FIX: Changed import to bring in Request, Response, and NextFunction types directly. This resolves numerous TypeScript errors about missing properties on req and res objects.
// FIX: Import Request, Response, and NextFunction types directly from express to resolve type errors.
import express, { Request, Response, NextFunction } from 'express';
// FIX: Import 'process' module to provide types for process.exit.
import process from 'process';
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
    REST,
    GuildMember,
    EmbedBuilder,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { BotConfig, NotifyPayload } from './types.js';

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
    console.log(`${colorMap[level]}${logMessage}${colorMap[level] === colorMap.FATAL ? '' : colorMap[level] === colorMap.RESET}`);
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
        const setStatusCommand = new SlashCommandBuilder()
            .setName('setstatus')
            .setDescription("Sets the bot's status and activity.")
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addStringOption(o => o.setName('status').setDescription("Bot's status.").setRequired(true).addChoices({ name: 'Online', value: 'online' }, { name: 'Idle', value: 'idle' }, { name: 'Do Not Disturb', value: 'dnd' }))
            .addStringOption(o => o.setName('activity_type').setDescription("Bot's activity type.").setRequired(true).addChoices({ name: 'Playing', value: 'Playing' }, { name: 'Watching', value: 'Watching' }, { name: 'Listening to', value: 'Listening' }, { name: 'Competing in', value: 'Competing' }))
            .addStringOption(o => o.setName('activity_name').setDescription("Bot's activity name.").setRequired(true));
            
        logger('INFO', `Attempting to register slash commands for guild ${config.DISCORD_GUILD_ID}...`);
        const rest = new REST().setToken(config.DISCORD_BOT_TOKEN);
        try {
            await rest.put(`/applications/${clientId}/guilds/${config.DISCORD_GUILD_ID}/commands`, { body: [setStatusCommand.toJSON()] });
            logger('INFO', '✅ Slash commands registered/updated successfully.');
        } catch(error) {
            logger('ERROR', 'Failed to register slash commands. ADVICE: Ensure the bot was invited with both `bot` and `applications.commands` scopes.', error);
        }
    };

    const handleGuildFetchError = (error: unknown) => {
        logger('FATAL', `Could not fetch guild with ID ${config.DISCORD_GUILD_ID}.`);
        if (error instanceof DiscordAPIError) {
            if (error.code === 50001) {
                logger('FATAL', `ADVICE: The bot is missing 'Access' to the guild. It might not be in the server.`);
            } else {
                 logger('FATAL', `ADVICE: Ensure the 'DISCORD_GUILD_ID' in config.json is correct and the bot has been invited to that server.`);
                 logger('FATAL', `ADVICE: Also, ensure the 'SERVER MEMBERS INTENT' is enabled in the Discord Developer Portal.`);
            }
        } else {
             logger('FATAL', `ADVICE: Ensure the 'DISCORD_GUILD_ID' in config.json is correct and the bot has been invited to that server.`);
             logger('FATAL', `ADVICE: Also, ensure the 'SERVER MEMBERS INTENT' is enabled in the Discord Developer Portal.`);
        }
        process.exit(1);
    }

    client.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'setstatus') return;
    
        if (!interaction.inGuild() || !interaction.guild) {
            return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        }
        
        logger('INFO', `Received /setstatus command from user ${interaction.user.tag} (${interaction.user.id})`);
    
        try {
            // Force-fetch the member to get the most up-to-date roles, bypassing potential cache issues.
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (!member) {
                 logger('ERROR', `Could not fetch member for user ${interaction.user.tag}.`);
                 return interaction.reply({ content: 'An error occurred while checking your permissions.', ephemeral: true });
            }
    
            const hasAdminPerm = member.permissions.has(PermissionFlagsBits.Administrator);
            const hasRole = config.PRESENCE_COMMAND_ROLE_IDS.some(id => member.roles.cache.has(id));
            
            logger('DEBUG', `Permission check for ${member.user.tag}: Has Admin Permission? ${hasAdminPerm}, Has specific role? ${hasRole}`);
            logger('DEBUG', `User Roles: [${Array.from(member.roles.cache.keys()).join(', ')}]`);
            logger('DEBUG', `Required Roles: [${config.PRESENCE_COMMAND_ROLE_IDS.join(', ')}]`);
    
            if (!hasAdminPerm && !hasRole) {
                logger('WARN', `User ${interaction.user.tag} was denied access to /setstatus.`);
                return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            }
            
            const status = interaction.options.getString('status', true) as PresenceStatusData;
            const activityType = ActivityType[interaction.options.getString('activity_type', true) as keyof typeof ActivityType];
            const activityName = interaction.options.getString('activity_name', true);
            client.user?.setPresence({ status, activities: [{ name: activityName, type: activityType }] });
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
    app.use(express.json());

    // FIX: Replaced express.Request/Response/NextFunction with imported types.
    const authenticate = (req: Request, res: Response, next: NextFunction) => {
        if (req.headers.authorization === `Bearer ${config.API_SECRET_KEY}`) {
            logger('DEBUG', `[AUTH] Successful authentication from ${req.ip}. Path: ${req.path}`);
            return next();
        }
        logger('WARN', `[AUTH] Failed authentication attempt from ${req.ip}. Path: ${req.path}. ADVICE: Check that API_SECRET_KEY in config.json matches the VITE_DISCORD_BOT_API_KEY secret in Supabase.`);
        res.status(401).send({ error: 'Authentication failed.' });
    };

    // FIX: Replaced express.Request/Response with imported types.
    app.get('/health', (req: Request, res: Response) => {
        if (!client.isReady()) return res.status(503).send({ status: 'error', message: 'Discord Client not ready.' });
        const guild = client.guilds.cache.get(config.DISCORD_GUILD_ID);
        if (!guild) return res.status(500).send({ status: 'error', message: 'Guild not found in cache.' });
        res.send({ status: 'ok', details: { guildName: guild.name, memberCount: guild.memberCount } });
    });
    
    // FIX: Replaced express.Request/Response with imported types.
    app.get('/api/roles', authenticate, async (req: Request, res: Response) => {
        try {
            const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
            const roles = (await guild.roles.fetch()).map(role => ({ id: role.id, name: role.name, color: role.color, position: role.position }));
            const sortedRoles = roles.sort((a, b) => b.position - a.position);
            res.json(sortedRoles);
        } catch (error) {
             logger('ERROR', 'Failed to fetch guild roles for /api/roles.', error);
             res.status(500).json({ error: 'Failed to fetch roles.' });
        }
    });

    // FIX: Replaced express.Request/Response with imported types.
    app.get('/api/user/:id', authenticate, async (req: Request, res: Response) => {
        try {
            const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
            const member = await guild.members.fetch(req.params.id);
            if (!member) return res.status(404).json({ error: 'User not found in guild.' });
            
            const roles = member.roles.cache
                .filter(role => role.name !== '@everyone')
                .map(role => ({ id: role.id, name: role.name, color: role.color, position: role.position }))
                .sort((a, b) => b.position - a.position);

            const highestRole = roles[0] || null;
            const avatar = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            
            res.json({ username: member.user.globalName || member.user.username, avatar, roles, highest_role: highestRole });
        } catch (error) {
            if (error instanceof DiscordAPIError && (error.code === 10007 || error.code === 10013)) { // Unknown Member or User
                return res.status(404).json({ error: 'User not found in guild.' });
            }
             if (error instanceof DiscordAPIError && error.code === 50035 && error.message.includes("SERVER_MEMBERS")) {
                logger('ERROR', "SERVER_MEMBERS_INTENT is likely disabled! Failed to fetch user.", error);
                return res.status(503).json({ error: "Bot is missing SERVER_MEMBERS_INTENT." });
            }
            logger('ERROR', `Failed to fetch user ${req.params.id}.`, error);
            res.status(500).json({ error: 'An internal error occurred.' });
        }
    });
    
    // FIX: Replaced express.Request/Response with imported types.
    app.post('/api/notify', authenticate, async (req: Request, res: Response) => {
        const body: NotifyPayload = req.body;
        logger('INFO', `Received notification request of type: ${body.type}`);
        logger('DEBUG', 'Full notification payload:', body.payload);
        
        try {
            const embedData = body.payload.embed;
            if (!embedData) throw new Error("Notification payload is missing 'embed' object.");
            
            const embed = new EmbedBuilder();
            if (embedData.title) embed.setTitle(embedData.title);
            if (embedData.description) embed.setDescription(embedData.description);
            if (typeof embedData.color === 'number') embed.setColor(embedData.color);
            if (embedData.timestamp) embed.setTimestamp(new Date(embedData.timestamp));
            if (embedData.footer && embedData.footer.text) embed.setFooter(embedData.footer);
            if (embedData.thumbnail && embedData.thumbnail.url) embed.setThumbnail(embedData.thumbnail.url);
            if (embedData.author && embedData.author.name) embed.setAuthor(embedData.author);
            if (embedData.fields && Array.isArray(embedData.fields)) {
                const validFields = embedData.fields.filter(f => f.name && f.value);
                if (validFields.length > 0) embed.addFields(validFields);
            }
            logger('DEBUG', 'Constructed Embed:', embed.toJSON());

            if (body.type === 'submission_result' || body.type === 'submission_receipt') {
                const user = await client.users.fetch(body.payload.userId);
                await user.send({ embeds: [embed] });
                logger('INFO', `↳ Sent DM to user ${user.tag}.`);
            } else {
                const channel = await client.channels.fetch(body.payload.channelId) as TextChannel;
                if (!channel) throw new Error(`Target channel with ID ${body.payload.channelId} not found or not a text channel.`);
                
                const messagePayload: { content?: string, embeds: EmbedBuilder[] } = { embeds: [embed] };
                if (body.payload.content) {
                    messagePayload.content = body.payload.content;
                }
                
                await channel.send(messagePayload);
                logger('INFO', `↳ Sent embed to channel #${channel.name}.`);
            }
            res.status(200).json({ message: 'Notification sent successfully.' });
        } catch(error) {
            let errorMessage = 'Failed to process notification.';
            if (error instanceof DiscordAPIError) {
                errorMessage = `Discord API Error (${error.code}): ${error.message}`;
                const channelId = 'payload' in body && 'channelId' in body.payload ? body.payload.channelId : 'N/A';
                const userId = 'payload' in body && 'userId' in body.payload ? body.payload.userId : 'N/A';
    
                if (error.code === 50007) { // Cannot send messages to this user
                    errorMessage += ` - ADVICE: The bot could not DM the user (${userId}). They may have DMs disabled for non-friends, or they may have blocked the bot.`;
                } else if (error.code === 50001) { // Missing Access
                     errorMessage += ` - ADVICE: The bot lacks permissions for the target channel (${channelId}). Ensure the bot's role has 'View Channel', 'Send Messages', and 'Embed Links' permissions in that specific channel.`;
                } else if (error.code === 10003) { // Unknown Channel
                    errorMessage += ` - ADVICE: The channel ID (${channelId}) is incorrect or the channel was deleted. Check the channel ID in your Admin Panel -> Appearance settings.`;
                } else if (error.code === 10013) { // Unknown User
                    errorMessage += ` - ADVICE: The user ID (${userId}) is incorrect or the user does not exist.`;
                }
            } else if (error instanceof Error) {
                errorMessage = error.message;
            }
            logger('ERROR', `Failed to process notification of type ${body.type}. Error: ${errorMessage}`, error);
            res.status(500).json({ error: 'Failed to send notification.', details: errorMessage });
        }
    });

    try {
        await client.login(config.DISCORD_BOT_TOKEN);
        app.listen(PORT, '0.0.0.0', () => {
            logger('INFO', `✅ Express server is listening on http://0.0.0.0:${PORT}`);
        });
    } catch(error) {
        logger('FATAL', 'Failed to log in to Discord. Is the token in config.json correct?', error);
        process.exit(1);
    }
};

main().catch(error => logger('FATAL', 'Unhandled exception in main function.', error));