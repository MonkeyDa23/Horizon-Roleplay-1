
// discord-bot/src/index.ts
// FIX: Changed import to explicitly include Request, Response, and NextFunction types to resolve TS errors.
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
    GuildMember,
    TextChannel,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import type { BotConfig, DiscordRole } from './types.js';

// =============================================
// LOGGER UTILITY
// =============================================
const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4 };
type LogLevel = keyof typeof LOG_LEVELS;
const logger = (level: LogLevel, message: string, data?: any) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`);
    if (data) {
        console.log(JSON.stringify(data, null, 2));
    }
};

// =============================================
// CONFIGURATION & SETUP
// =============================================
logger('INFO', 'Starting Vixel Roleplay Bot...');
let config: BotConfig;

try {
  const configPath = path.resolve(process.cwd(), 'config.json');
  if (!fs.existsSync(configPath)) {
      throw new Error(`config.json not found at ${configPath}. Please ensure it is in the root of the 'discord-bot' directory.`);
  }
  const rawConfig = fs.readFileSync(configPath, 'utf-8');
  config = JSON.parse(rawConfig);
  // Basic validation
  if (!config.DISCORD_BOT_TOKEN || !config.DISCORD_GUILD_ID || !config.API_SECRET_KEY) {
      throw new Error('One or more required fields (DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, API_SECRET_KEY) are missing from config.json.');
  }
  logger('INFO', '✅ Configuration loaded successfully.');
} catch (error) {
  logger('FATAL', `Failed to load or parse config.json: ${(error as Error).message}`);
  process.exit(1);
}

// =============================================
// EXPRESS SERVER
// =============================================
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

// Authentication Middleware
// FIX: Replaced express.Request, express.Response, express.NextFunction with imported types.
const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  logger('DEBUG', `[${req.method} ${req.path}] Request from IP: ${ip}`);

  if (authHeader && authHeader === `Bearer ${config.API_SECRET_KEY}`) {
    logger('DEBUG', `[${req.method} ${req.path}] ✅ Authenticated successfully.`);
    next();
  } else {
    logger('WARN', `[${req.method} ${req.path}] ❌ Authentication failed. Incorrect API Key. IP: ${ip}`);
    res.status(401).json({ error: 'Unauthorized' });
  }
};

// =============================================
// DISCORD CLIENT
// =============================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel], // Necessary for DMs
});

client.once(Events.ClientReady, async (readyClient) => {
  logger('INFO', `✅ Discord Client Ready! Logged in as ${readyClient.user.tag}`);
  try {
    const guild = await readyClient.guilds.fetch(config.DISCORD_GUILD_ID);
    logger('INFO', `✅ Successfully connected to Guild: "${guild.name}"`);

    // Register Slash Command
    const setStatusCommand = new SlashCommandBuilder()
      .setName('setstatus')
      .setDescription("Sets the bot's status and activity.")
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(option => option.setName('status').setDescription("The bot's status.").setRequired(true).addChoices({ name: 'Online', value: 'online' }, { name: 'Idle', value: 'idle' }, { name: 'Do Not Disturb', value: 'dnd' }, { name: 'Invisible', value: 'invisible' }))
      .addStringOption(option => option.setName('activity_type').setDescription("The bot's activity type.").setRequired(true).addChoices({ name: 'Playing', value: 'Playing' }, { name: 'Watching', value: 'Watching' }, { name: 'Listening to', value: 'Listening' }, { name: 'Competing in', value: 'Competing' }))
      .addStringOption(option => option.setName('activity_name').setDescription("The bot's activity name.").setRequired(true));

    await guild.commands.set([setStatusCommand]);
    logger('INFO', '✅ Slash commands registered/updated successfully.');

  } catch (error) {
    logger('FATAL', `Could not fetch guild with ID ${config.DISCORD_GUILD_ID}.`);
    logger('ERROR', `ADVICE: Ensure the 'DISCORD_GUILD_ID' in config.json is correct and the bot has been invited to that server.`);
    if (error instanceof DiscordAPIError) {
        logger('ERROR', `Discord API Error Code: ${error.code} - ${error.message}`);
    } else {
        logger('ERROR', `Full Error Details:`, error);
    }
    process.exit(1);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.inGuild() || interaction.commandName !== 'setstatus') return;

    logger('INFO', `Received /setstatus command from ${interaction.user.tag} in guild ${interaction.guild.name}.`);

    try {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const isOwner = interaction.guild.ownerId === member.id;
        const hasRole = member.roles.cache.some(role => config.PRESENCE_COMMAND_ROLE_IDS.includes(role.id));

        if (!isOwner && !hasRole) {
            logger('WARN', `↳ Denied /setstatus for ${interaction.user.tag} (missing permissions).`);
            await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            return;
        }

        const status = interaction.options.getString('status', true) as PresenceStatusData;
        const activityTypeStr = interaction.options.getString('activity_type', true);
        const activityName = interaction.options.getString('activity_name', true);

        const activityTypeMap: { [key: string]: ActivityType } = { 'Playing': ActivityType.Playing, 'Watching': ActivityType.Watching, 'Listening': ActivityType.Listening, 'Competing': ActivityType.Competing };
        const activityType = activityTypeMap[activityTypeStr];
        
        client.user?.setPresence({ status, activities: [{ name: activityName, type: activityType }] });

        logger('INFO', `↳ Successfully updated presence for ${interaction.user.tag}.`);
        await interaction.reply({ content: 'Status updated successfully!', ephemeral: true });

    } catch (error) {
        logger('ERROR', "Error handling /setstatus command:", error);
        await interaction.reply({ content: 'An error occurred.', ephemeral: true }).catch(() => {});
    }
});

// =============================================
// API ROUTES
// =============================================
app.get('/', (req, res) => res.send('Vixel Roleplay Bot is alive!'));

app.get('/health', authenticate, async (req, res) => {
    try {
        const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
        await guild.members.fetch({ limit: 1 });
        res.json({ status: 'ok', details: { guildName: guild.name, memberCount: guild.memberCount } });
    } catch (e) {
        logger('ERROR', `[API /health] Health check failed: ${(e as Error).message}`);
        res.status(503).json({ status: 'error', message: (e as Error).message });
    }
});

app.get('/api/roles', authenticate, async (req, res) => {
    try {
        const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
        const roles = (await guild.roles.fetch()).map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position })).sort((a, b) => b.position - a.position);
        logger('INFO', `[API /api/roles] Fetched ${roles.length} roles.`);
        res.json(roles);
    } catch (error) {
        logger('ERROR', '[API /api/roles] Could not fetch guild roles.', error);
        res.status(500).json({ error: 'Could not fetch guild roles.' });
    }
});

app.get('/api/user/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    try {
        const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
        const member = await guild.members.fetch(id);
        const roles: DiscordRole[] = member.roles.cache.filter(r => r.id !== guild.id).map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position })).sort((a, b) => b.position - a.position);
        logger('INFO', `[API /api/user] Fetched member ${member.user.tag}. Role count: ${roles.length}.`);
        if (roles.length === 0) {
            logger('WARN', `[API /api/user] Fetched 0 roles for ${member.user.tag}. This might indicate a 'Server Members Intent' issue.`);
        }
        res.json({
            username: member.user.globalName || member.user.username,
            avatar: member.displayAvatarURL({ extension: 'png', size: 256 }),
            roles,
            highest_role: roles[0] || null
        });
    } catch (error) {
        logger('ERROR', `[API /api/user/${id}] Failed to fetch user.`, error);
        if (error instanceof DiscordAPIError && error.code === 10007) {
            return res.status(404).json({ error: 'User not found in guild.' });
        }
        res.status(500).json({ error: 'Could not fetch user data.' });
    }
});

app.post('/api/notify', authenticate, async (req, res) => {
    const { type, payload } = req.body;
    logger('INFO', `[API /api/notify] Received notification request. Type: ${type}`);
    logger('DEBUG', `[API /api/notify] Payload:`, payload);

    try {
        if (!type || !payload) throw new Error("Missing 'type' or 'payload'.");

        switch (type) {
            case 'new_submission':
            case 'audit_log': {
                if (!payload.channelId) throw new Error("Missing 'channelId'.");
                const channel = await client.channels.fetch(payload.channelId);
                if (!channel || !channel.isTextBased() || channel.isDMBased()) throw new Error(`Channel ${payload.channelId} is not a valid text channel.`);
                await (channel as TextChannel).send({ embeds: [payload.embed] });
                logger('INFO', `↳ Successfully sent embed to channel #${(channel as TextChannel).name} (${payload.channelId}).`);
                break;
            }
            case 'submission_result':
            case 'submission_receipt': {
                if (!payload.userId) throw new Error("Missing 'userId'.");
                const user = await client.users.fetch(payload.userId);
                await user.send({ embeds: [payload.embed] });
                logger('INFO', `↳ Successfully sent DM to user ${user.tag} (${payload.userId}).`);
                break;
            }
            default:
                throw new Error(`Invalid notification type: ${type}`);
        }
        res.status(200).json({ success: true });
    } catch (error) {
        logger('ERROR', `[API /api/notify] FAILED to process notification. Type: ${type}`, error);
        if (error instanceof DiscordAPIError) {
             let advice = "Check bot permissions or the ID validity.";
             if(error.code === 50007) advice = "Cannot send DMs to this user (DMs disabled or bot blocked).";
             else if (error.code === 50013) advice = "Missing Permissions (e.g., Send Messages, View Channel).";
             else if (error.code === 10003) advice = "Unknown Channel. The Channel ID is incorrect.";
             logger('ERROR', `↳ ADVICE: ${advice}`);
        }
        res.status(500).json({ success: false, error: (error as Error).message });
    }
});

// =============================================
// STARTUP SEQUENCE
// =============================================
try {
    logger('INFO', 'Logging into Discord...');
    client.login(config.DISCORD_BOT_TOKEN);
    app.listen(PORT, () => {
        logger('INFO', `🚀 API server is listening on http://localhost:${PORT}`);
    });
} catch (e) {
    logger('FATAL', 'A critical error occurred during startup.', e);
    process.exit(1);
}
