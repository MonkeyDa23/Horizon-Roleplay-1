// discord-bot/src/index.ts
/**
 * Vixel Roleplay - Discord Bot Backend (v3.0 - Bot-Centric)
 *
 * This bot serves as the crucial link between the website and the Discord API.
 * It provides an authenticated REST API for the website (via Supabase Edge Functions)
 * to fetch real-time Discord data and send all notifications.
 */
import express from 'express';
import process from 'process';
import cors from 'cors';
import {
    Client, GatewayIntentBits, Partials, Events, PermissionFlagsBits, ActivityType, PresenceStatusData,
    DiscordAPIError, TextChannel, SlashCommandBuilder, EmbedBuilder, Colors
} from 'discord.js';
import { REST } from '@discordjs/rest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { BotConfig, NotifyPayload, NewSubmissionPayload, AuditLogPayload, DmPayload } from './types.js';
import { CONTROL_PANEL_HTML } from './controlPanel.js';

// =============================================
// LOGGER UTILITY
// =============================================
const logger = (level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL', message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    const colorMap = {
        DEBUG: '\x1b[36m', INFO: '\x1b[32m', WARN: '\x1b[33m',
        ERROR: '\x1b[31m', FATAL: '\x1b[41m\x1b[37m', RESET: '\x1b[0m'
    };
    console.log(`${colorMap[level]}${logMessage}${colorMap.RESET}`);
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
        if (!fs.existsSync(configPath)) throw new Error(`config.json not found.`);
        const config: BotConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (!config.DISCORD_BOT_TOKEN || !config.DISCORD_GUILD_ID || !config.API_SECRET_KEY) {
            throw new Error('Required fields missing from config.json: DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, API_SECRET_KEY.');
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
    // Store translations fetched from the website (a small cache)
    let translations: Record<string, { en: string; ar: string }> = {};

    client.once(Events.ClientReady, async c => {
        logger('INFO', `✅ Discord Client Ready! Logged in as ${c.user.tag}`);
        try {
            const guild = await c.guilds.fetch(config.DISCORD_GUILD_ID);
            logger('INFO', `✅ Successfully connected to Guild: "${guild.name}"`);
            await registerCommands(c.user.id);
        } catch (error) {
            logger('FATAL', `Could not fetch guild with ID ${config.DISCORD_GUILD_ID}. Is the bot in the server? Is the ID correct?`, error);
            process.exit(1);
        }
    });

    const registerCommands = async (clientId: string) => {
        const setStatusCommand = new SlashCommandBuilder()
            .setName('setstatus').setDescription("Sets the bot's status and activity.")
            .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
            .addStringOption(o => o.setName('status').setDescription("Bot's status.").setRequired(true).addChoices({ name: 'Online', value: 'online' }, { name: 'Idle', value: 'idle' }, { name: 'Do Not Disturb', value: 'dnd' }))
            .addStringOption(o => o.setName('activity_type').setDescription("Bot's activity type.").setRequired(true).addChoices({ name: 'Playing', value: 'Playing' }, { name: 'Watching', value: 'Watching' }, { name: 'Listening to', value: 'Listening' }, { name: 'Competing in', value: 'Competing' }))
            .addStringOption(o => o.setName('activity_name').setDescription("Bot's activity name.").setRequired(true));
        const rest = new REST().setToken(config.DISCORD_BOT_TOKEN);
        try {
            await rest.put(`/applications/${clientId}/guilds/${config.DISCORD_GUILD_ID}/commands`, { body: [setStatusCommand.toJSON()] });
            logger('INFO', '✅ Slash commands registered/updated successfully.');
        } catch (error) {
            logger('ERROR', 'Failed to register slash commands. ADVICE: Ensure the bot was invited with both `bot` and `applications.commands` scopes.', error);
        }
    };

    client.on(Events.InteractionCreate, async interaction => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'setstatus') return;
        if (!interaction.inGuild() || !interaction.guild) return;
        try {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const hasAdminPerm = member.permissions.has(PermissionFlagsBits.Administrator);
            const hasRole = (config.PRESENCE_COMMAND_ROLE_IDS || []).some(id => member.roles.cache.has(id));
            if (!hasAdminPerm && !hasRole) {
                return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            }
            const status = interaction.options.getString('status', true) as PresenceStatusData;
            const activityType = ActivityType[interaction.options.getString('activity_type', true) as keyof typeof ActivityType];
            const activityName = interaction.options.getString('activity_name', true);
            client.user?.setPresence({ status, activities: [{ name: activityName, type: activityType }] });
            interaction.reply({ content: 'Status updated successfully!', ephemeral: true });
        } catch (error) {
            logger('ERROR', 'Error handling /setstatus command:', error);
        }
    });

    const app = express();
    app.use(cors());
    app.use(express.json());

    const authenticate = (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const receivedKey = (req.headers.authorization || '').substring(7);
        if (receivedKey && receivedKey === config.API_SECRET_KEY) return next();
        logger('WARN', `[AUTH] FAILED: Authentication failed for path ${req.path}. Check API keys.`);
        res.status(401).send({ error: 'Authentication failed.' });
    };

    // ========== PUBLIC & CONTROL PANEL ENDPOINTS ==========
    app.get('/', (req, res) => res.send(CONTROL_PANEL_HTML));
    app.get('/health', (req, res) => {
        if (!client.isReady()) return res.status(503).send({ status: 'error', message: 'Discord Client not ready.' });
        res.status(200).send({ status: 'ok' });
    });
    
    // ========== AUTHENTICATED API ENDPOINTS ==========
    app.get('/api/status', authenticate, async (req, res) => {
        const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
        res.json({ username: client.user?.username, guildName: guild.name, memberCount: guild.memberCount });
    });
    
    app.post('/api/set-presence', authenticate, (req, res) => {
      // Logic for web control panel presence update
    });

    app.get('/api/roles', authenticate, async (req, res) => {
        const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
        const roles = (await guild.roles.fetch()).map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position })).sort((a,b) => b.position - a.position);
        res.json(roles);
    });

    app.get('/api/user/:id', authenticate, async (req, res) => {
        try {
            const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
            const member = await guild.members.fetch(req.params.id);
            const roles = member.roles.cache.filter(r => r.name !== '@everyone').map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position })).sort((a, b) => b.position - a.position);
            res.json({ username: member.user.globalName || member.user.username, avatar: member.displayAvatarURL(), roles, highest_role: roles[0] || null });
        } catch (error) {
            if (error instanceof DiscordAPIError && String(error.message).includes("Members Intent")) {
                logger('ERROR', "SERVER_MEMBERS_INTENT is likely disabled! Failed to fetch user.", error);
                return res.status(503).json({ error: "Bot is missing SERVER_MEMBERS_INTENT." });
            }
            logger('ERROR', `Failed to fetch user ${req.params.id}.`, error);
            res.status(404).json({ error: 'User not found in guild.' });
        }
    });

    // The new unified notification endpoint
    app.post('/api/notify', authenticate, async (req, res) => {
        const { type, payload } = req.body as NotifyPayload;
        logger('INFO', `Received notification request of type: ${type}`);

        try {
            switch (type) {
                case 'new_submission': await handleNewSubmission(payload as NewSubmissionPayload); break;
                case 'audit_log': await handleAuditLog(payload as AuditLogPayload); break;
                case 'submission_receipt':
                case 'submission_result': await handleDm(payload as DmPayload); break;
                default: throw new Error(`Unknown notification type: ${type}`);
            }
            res.status(200).json({ message: 'Notification processed successfully.' });
        } catch (error) {
            logger('ERROR', `Failed to process notification of type ${type}.`, error);
            res.status(500).json({ error: 'Failed to send notification.', details: (error as Error).message });
        }
    });
    
    // =============================================
    // NOTIFICATION HANDLERS
    // =============================================

    async function handleNewSubmission(payload: NewSubmissionPayload) {
        const channelId = config.CHANNELS.SUBMISSIONS;
        const mentionRoleId = config.MENTION_ROLES.SUBMISSIONS;
        if (!channelId) return logger('WARN', 'Skipping new submission notification: SUBMISSIONS channel ID not set in config.');
        
        const embed = new EmbedBuilder()
            .setColor(Colors.Orange)
            .setAuthor({ name: payload.username, iconURL: payload.avatarUrl })
            .setTitle(`📝 تقديم جديد: ${payload.quizTitle}`)
            .setDescription('**تم استلام تقديم جديد وهو جاهز للمراجعة من قبل الإدارة.**')
            .addFields(
                { name: 'المتقدم', value: `<@${payload.discordId}>`, inline: true },
                { name: 'أعلى رتبة', value: payload.userHighestRole || 'Member', inline: true }
            )
            .setTimestamp(new Date(payload.submittedAt))
            .setFooter({ text: 'Vixel Roleplay' });
            
        const content = mentionRoleId ? `<@&${mentionRoleId}>` : undefined;
        await sendToChannel(channelId, { content, embeds: [embed] });
    }

    async function handleAuditLog(payload: AuditLogPayload) {
        const logTypeMap = {
            submission: 'SUBMISSIONS',
            ban: 'BANS',
            admin: 'ADMIN',
            general: 'GENERAL'
        } as const;
        const channelKey = `AUDIT_LOG_${logTypeMap[payload.log_type]}`;
        const channelId = config.CHANNELS[channelKey as keyof typeof config.CHANNELS];
        if (!channelId) return logger('WARN', `Skipping audit log notification: ${channelKey} channel ID not set.`);

        const embed = new EmbedBuilder()
            .setColor(Colors.Blue)
            .setAuthor({ name: `👤 ${payload.adminUsername}`})
            .setDescription(payload.action)
            .setTimestamp(new Date(payload.timestamp));
            
        await sendToChannel(channelId, { embeds: [embed] });
    }

    async function handleDm(payload: DmPayload) {
        // Fetch translations from website if needed (not implemented in this example)
        // For simplicity, we'll construct a basic embed from keys. In a real scenario, you'd fetch the text.
        const isAccepted = payload.embed.titleKey.includes('accepted');
        const isRefused = payload.embed.titleKey.includes('refused');
        const replacements = payload.embed.replacements;

        let body = `Your application for **${replacements.quizTitle}** has been updated.`;
        if (isAccepted) body = `Congratulations! Your application for **${replacements.quizTitle}** has been **ACCEPTED** by **${replacements.adminUsername}**.`;
        if (isRefused) body = `Your application for **${replacements.quizTitle}** has been reviewed by **${replacements.adminUsername}** and was unfortunately **REFUSED**.`;
        if (replacements.reason) body += `\n\n**Reason:**\n*${replacements.reason}*`;

        const embed = new EmbedBuilder()
            .setTitle(isAccepted ? '🎉 تم قبول تقديمك!' : isRefused ? '📑 تحديث بخصوص تقديمك' : '📬 تم استلام تقديمك!')
            .setDescription(body)
            .setColor(isAccepted ? Colors.Green : isRefused ? Colors.Red : Colors.Blue)
            .setTimestamp()
            .setFooter({ text: 'Vixel Roleplay' });

        const user = await client.users.fetch(payload.userId);
        await user.send({ embeds: [embed] });
        logger('INFO', `Sent DM of type ${payload.embed.titleKey} to ${user.tag}`);
    }

    async function sendToChannel(channelId: string, options: { content?: string, embeds: EmbedBuilder[] }) {
        const channel = await client.channels.fetch(channelId);
        if (!channel || !(channel instanceof TextChannel)) throw new Error(`Channel ${channelId} not found or not a text channel.`);
        await channel.send(options);
        logger('INFO', `Sent message to channel #${channel.name}.`);
    }

    try {
        await client.login(config.DISCORD_BOT_TOKEN);
        const PORT = Number(process.env.PORT) || 14355;
        app.listen(PORT, '0.0.0.0', () => logger('INFO', `✅ Express server is listening on http://0.0.0.0:${PORT}`));
    } catch (error) {
        logger('FATAL', 'Failed to log in to Discord. Is the token in config.json correct?', error);
        process.exit(1);
    }
};

main().catch(error => logger('FATAL', 'Unhandled exception in main function.', error));