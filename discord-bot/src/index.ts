// discord-bot/src/index.ts
// FIX: Changed to a default import for Express to resolve type conflicts. All type annotations will use the `express.` namespace.
import express from 'express';
import cors from 'cors';
import { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  TextChannel, 
  EmbedBuilder, 
  Role,
  SlashCommandBuilder,
  ActivityType,
  PresenceStatusData,
  CacheType,
  Interaction,
  Events
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import type { BotConfig, DiscordRole } from './types.js';

// ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================
// CONFIGURATION & SETUP
// =============================================
const app = express();
const PORT = process.env.PORT || 3000;

// Load config from config.json
let config: BotConfig;
try {
  const configPath = path.join(__dirname, 'config.json');
  const rawConfig = fs.readFileSync(configPath, 'utf-8');
  config = JSON.parse(rawConfig);
  console.log("✅ Configuration loaded successfully.");
} catch (error) {
  console.error("❌ FATAL: Could not load config.json. Please ensure the file exists and is valid JSON.");
  // @ts-ignore
  process.exit(1);
}

// =============================================
// DISCORD CLIENT
// =============================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
  // CRITICAL: Partials.Channel is required for the bot to be able to send DMs.
  partials: [Partials.Channel],
});


client.once(Events.ClientReady, async (readyClient) => {
  console.log(`🟢 Bot logged in as ${readyClient.user.tag}`);
  try {
    // Verify we can fetch the guild on startup.
    const guild = await readyClient.guilds.fetch(config.DISCORD_GUILD_ID);
    console.log(`✅ Guild "${guild.name}" is accessible. Bot is ready.`);

    // Register Slash Command
    const setStatusCommand = new SlashCommandBuilder()
      .setName('setstatus')
      .setDescription("Sets the bot's status and activity.")
      .setDefaultMemberPermissions(0) // Admin only by default
      .addStringOption(option =>
        option.setName('status')
          .setDescription("The bot's status.")
          .setRequired(true)
          .addChoices(
            { name: 'Online', value: 'online' },
            { name: 'Idle', value: 'idle' },
            { name: 'Do Not Disturb', value: 'dnd' },
            { name: 'Invisible', value: 'invisible' },
          ))
      .addStringOption(option =>
        option.setName('activity_type')
          .setDescription('The type of activity.')
          .setRequired(true)
          .addChoices(
            { name: 'Playing', value: 'PLAYING' },
            { name: 'Watching', value: 'WATCHING' },
            { name: 'Listening', value: 'LISTENING' },
            { name: 'Streaming', value: 'STREAMING' },
          ))
      .addStringOption(option =>
        option.setName('activity_text')
          .setDescription('The text to display for the activity.')
          .setRequired(true))
      .addStringOption(option =>
        option.setName('activity_url')
          .setDescription('The stream URL (required for Streaming activity type).')
          .setRequired(false));
          
    await readyClient.application.commands.set([setStatusCommand], config.DISCORD_GUILD_ID);
    console.log('✅ Successfully registered /setstatus command.');

  } catch (error) {
    console.error(`❌ FATAL: Could not fetch guild with ID ${config.DISCORD_GUILD_ID}.`);
    console.error("   Please check that the GUILD_ID is correct and the bot is in the server.");
    // @ts-ignore
    process.exit(1);
  }
});

client.login(config.DISCORD_BOT_TOKEN);


// Interaction Handler
client.on(Events.InteractionCreate, async (interaction: Interaction<CacheType>) => {
  // FIX: Use `isChatInputCommand` to correctly type guard the interaction and ensure `options` property is available.
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guild } = interaction;

  if (commandName === 'setstatus') {
    if (!guild) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
    }
    
    // Permission Check
    const member = await guild.members.fetch(interaction.user.id);
    const isOwner = member.id === guild.ownerId;
    const hasRole = member.roles.cache.some(role => (config.PRESENCE_COMMAND_ROLE_IDS || []).includes(role.id));

    if (!isOwner && !hasRole) {
      await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      return;
    }

    // Defer reply to give the bot time to process
    await interaction.deferReply({ ephemeral: true });

    try {
      const status = interaction.options.getString('status', true) as PresenceStatusData;
      const activityTypeStr = interaction.options.getString('activity_type', true);
      const activityText = interaction.options.getString('activity_text', true);
      const activityUrl = interaction.options.getString('activity_url');

      // Map string to ActivityType enum
      const activityTypeMap: { [key: string]: ActivityType } = {
        'PLAYING': ActivityType.Playing,
        'WATCHING': ActivityType.Watching,
        'LISTENING': ActivityType.Listening,
        'STREAMING': ActivityType.Streaming,
      };
      const activityType = activityTypeMap[activityTypeStr];

      if (activityType === undefined) {
          await interaction.editReply({ content: 'Invalid activity type provided.' });
          return;
      }
      
      if (activityType === ActivityType.Streaming && (!activityUrl || !activityUrl.startsWith('https://www.twitch.tv/'))) {
          await interaction.editReply({ content: 'The "activity_url" must be a valid Twitch URL for the Streaming activity type.' });
          return;
      }

      client.user?.setPresence({
        status: status,
        activities: [{
          name: activityText,
          type: activityType,
          url: activityUrl || undefined,
        }],
      });

      await interaction.editReply({ content: '✅ Bot presence updated successfully!' });
    } catch (error) {
      console.error('Error setting presence:', error);
      await interaction.editReply({ content: 'An error occurred while updating the presence.' });
    }
  }
});


// =============================================
// EXPRESS MIDDLEWARE
// =============================================
app.use(cors());
app.use(express.json());

// Authentication middleware to protect API endpoints
// FIX: Use namespace-qualified express types to avoid conflicts.
const authenticateRequest = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  const token = authHeader.split(' ')[1];
  if (token !== config.API_SECRET_KEY) {
    return res.status(403).json({ error: 'Forbidden: Invalid token' });
  }
  next();
};

// =============================================
// API ROUTES
// =============================================
// FIX: Use namespace-qualified express types to avoid conflicts.
app.get('/health', async (req: express.Request, res: express.Response) => {
  if (!client.isReady()) {
    return res.status(503).json({ status: 'error', message: 'Bot is not ready.' });
  }
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    res.status(200).json({ 
      status: 'ok', 
      details: {
        botUsername: client.user?.tag,
        guildName: guild.name,
        memberCount: guild.memberCount
      } 
    });
  } catch(e) {
     res.status(503).json({ status: 'error', message: 'Could not fetch guild info.' });
  }
});

// GET USER PROFILE
// FIX: Use namespace-qualified express types to avoid conflicts.
app.get('/api/user/:id', authenticateRequest, async (req: express.Request, res: express.Response) => {
  const { id } = req.params;

  try {
    // IMPROVEMENT: Fetch guild on every request to be stateless and more resilient.
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    if (!guild) {
        return res.status(404).json({ error: 'Configured Guild ID not found.' });
    }

    // Use `force: true` to bypass cache and get fresh data from Discord API.
    const member = await guild.members.fetch({ user: id, force: true });
    if (!member) {
      return res.status(404).json({ error: 'User not found in this guild' });
    }
    
    // Diagnostic logging
    console.log(`[API /user] Fetched member ${member.user.tag}. Role count: ${member.roles.cache.size}.`);
    
    const roles = member.roles.cache
      .filter((role: Role) => role.name !== '@everyone')
      .map((role: Role) => ({
        id: role.id,
        name: role.name,
        color: role.color,
        position: role.position,
      }))
      .sort((a: DiscordRole, b: DiscordRole) => b.position - a.position);

    const highestRole = roles[0] || null;
    const isGuildOwner = member.id === guild.ownerId;

    res.json({
      id: member.id,
      username: member.user.globalName || member.user.username,
      avatar: member.displayAvatarURL({ extension: 'png', size: 256 }),
      roles,
      highestRole,
      isGuildOwner,
    });
  } catch (error: any) {
    if (error.code === 10004) { // Unknown Guild
      console.error(`[API /user] FATAL: Could not access Guild with ID "${config.DISCORD_GUILD_ID}". Please check the config.json and ensure the bot is a member of the server.`);
      return res.status(500).json({ error: 'Bot is misconfigured: Cannot access the configured Discord server.' });
    }
    if (error.code === 10013 || error.code === 10007) { // Unknown User or Unknown Member
      return res.status(404).json({ error: 'User not found in this guild' });
    }
    console.error(`Error fetching user ${id}:`, error);
    res.status(500).json({ error: 'Internal server error while fetching user' });
  }
});

// GET ALL GUILD ROLES
// FIX: Use namespace-qualified express types to avoid conflicts.
app.get('/api/roles', authenticateRequest, async (req: express.Request, res: express.Response) => {
  try {
    // IMPROVEMENT: Fetch guild on every request to be stateless and more resilient.
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    if (!guild) {
        return res.status(404).json({ error: 'Configured Guild ID not found.' });
    }

    await guild.roles.fetch();
    // Diagnostic logging
    console.log(`[API /roles] Fetched ${guild.roles.cache.size} roles from guild ${guild.name}.`);

    const roles = guild.roles.cache
      .filter((role: Role) => role.name !== '@everyone')
      .map((role: Role) => ({
        id: role.id,
        name: role.name,
        color: role.color,
        position: role.position,
      }))
      .sort((a: DiscordRole, b: DiscordRole) => b.position - a.position);
    res.json(roles);
  } catch (error: any) {
    if (error.code === 10004) { // Unknown Guild
      console.error(`[API /roles] FATAL: Could not access Guild with ID "${config.DISCORD_GUILD_ID}". Please check the config.json and ensure the bot is a member of the server.`);
      return res.status(500).json({ error: 'Bot is misconfigured: Cannot access the configured Discord server.' });
    }
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Internal server error while fetching roles' });
  }
});

// SEND NOTIFICATION
// FIX: Use namespace-qualified express types to avoid conflicts.
app.post('/api/notify', authenticateRequest, async (req: express.Request, res: express.Response) => {
    const { type, payload } = req.body;
    
    if (!type || !payload) {
        return res.status(400).json({ error: 'Invalid notification payload' });
    }

    try {
        console.log(`Received notification request: type=${type}`);
        if (type === 'new_submission' || type === 'audit_log') {
            const channelId = type === 'new_submission'
                ? payload.submissionsChannelId
                : payload.auditLogChannelId;
            
            if (!channelId) throw new Error(`Channel ID for type '${type}' is not configured.`);

            const channel = await client.channels.fetch(channelId) as TextChannel;
            if (!channel) throw new Error(`Channel with ID ${channelId} not found.`);

            const embed = new EmbedBuilder(payload.embed);
            await channel.send({ embeds: [embed] });
            console.log(`✅ Sent '${type}' embed to channel #${channel.name}`);

        } else if (type === 'submission_result') {
            const user = await client.users.fetch(payload.userId);
            if (!user) throw new Error(`User with ID ${payload.userId} not found for DM.`);
            
            const embed = new EmbedBuilder(payload.embed);
            await user.send({ embeds: [embed] });
            console.log(`✅ Sent '${type}' DM to user ${user.tag}`);
        } else {
            throw new Error(`Unsupported notification type: ${type}`);
        }

        res.status(200).json({ success: true, message: `Notification sent successfully.` });

    } catch (error: any) {
        console.error(`❌ Failed to send notification (type: ${type}):`, error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});


// =============================================
// START SERVER
// =============================================
app.listen(PORT, () => {
  console.log(`🚀 Bot API server is running on http://localhost:${PORT}`);
});