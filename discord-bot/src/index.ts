// discord-bot/src/index.ts
// FIX: Switched to namespaced express types to avoid conflicts with global DOM types.
import express from 'express';
import cors from 'cors';
import * as Discord from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import type { BotConfig, DiscordRole } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================
// CONFIGURATION & SETUP
// =============================================
const app = express();
const PORT = process.env.PORT || 3000;

let config: BotConfig;
try {
  const configPath = path.join(__dirname, 'config.json');
  const rawConfig = fs.readFileSync(configPath, 'utf-8');
  config = JSON.parse(rawConfig);
  console.log("✅ Configuration loaded successfully.");
} catch (error) {
  console.error("❌ FATAL: Could not load config.json. Please ensure the file exists and is valid JSON.");
  process.exit(1);
}

// =============================================
// DISCORD CLIENT
// =============================================
const client = new Discord.Client({
  intents: [
    Discord.GatewayIntentBits.Guilds,
    Discord.GatewayIntentBits.GuildMembers,
  ],
  partials: [Discord.Partials.Channel],
});


client.once(Discord.Events.ClientReady, async (readyClient) => {
  console.log(`🟢 Bot logged in as ${readyClient.user.tag}`);
  try {
    const guild = await readyClient.guilds.fetch(config.DISCORD_GUILD_ID);
    console.log(`✅ Guild "${guild.name}" is accessible. Bot is ready.`);

    const setStatusCommand = new Discord.SlashCommandBuilder()
      .setName('setstatus')
      .setDescription("Sets the bot's status and activity.")
      .setDefaultMemberPermissions(0)
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
    process.exit(1);
  }
});

client.on(Discord.Events.InteractionCreate, async (interaction: Discord.Interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guild } = interaction;

  if (commandName === 'setstatus') {
    if (!guild) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
    }
    
    const member = await guild.members.fetch(interaction.user.id);
    const isOwner = member.id === guild.ownerId;
    const hasRole = member.roles.cache.some(role => (config.PRESENCE_COMMAND_ROLE_IDS || []).includes(role.id));

    if (!isOwner && !hasRole) {
      await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      const status = interaction.options.getString('status', true) as Discord.PresenceStatusData;
      const activityTypeStr = interaction.options.getString('activity_type', true);
      const activityText = interaction.options.getString('activity_text', true);
      const activityUrl = interaction.options.getString('activity_url');

      const activityTypeMap: { [key: string]: Discord.ActivityType } = {
        'PLAYING': Discord.ActivityType.Playing, 'WATCHING': Discord.ActivityType.Watching,
        'LISTENING': Discord.ActivityType.Listening, 'STREAMING': Discord.ActivityType.Streaming,
      };
      const activityType = activityTypeMap[activityTypeStr];

      if (activityType === undefined) {
          await interaction.editReply({ content: 'Invalid activity type provided.' });
          return;
      }
      
      if (activityType === Discord.ActivityType.Streaming && (!activityUrl || !activityUrl.startsWith('https://www.twitch.tv/'))) {
          await interaction.editReply({ content: 'The "activity_url" must be a valid Twitch URL for the Streaming activity type.' });
          return;
      }

      client.user?.setPresence({
        status: status,
        activities: [{ name: activityText, type: activityType, url: activityUrl || undefined }],
      });

      await interaction.editReply({ content: '✅ Bot presence updated successfully!' });
    } catch (error) {
      console.error('Error setting presence:', error);
      await interaction.editReply({ content: 'An error occurred while updating the presence.' });
    }
  }
});

client.login(config.DISCORD_BOT_TOKEN);

// =============================================
// EXPRESS MIDDLEWARE & SERVER
// =============================================
app.use(cors());
app.use(express.json());

// FIX: Use namespaced express types to avoid conflicts and resolve type errors.
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

// FIX: Use namespaced express types to avoid conflicts and resolve type errors.
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

// FIX: Use namespaced express types to avoid conflicts and resolve type errors.
app.get('/api/user/:id', authenticateRequest, async (req: express.Request, res: express.Response) => {
  const { id } = req.params;
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const member = await guild.members.fetch({ user: id, force: true });
    
    console.log(`[API /user] Fetched member ${member.user.tag}. Role count: ${member.roles.cache.size}.`);
    
    const roles: DiscordRole[] = member.roles.cache
      .filter(role => role.name !== '@everyone')
      .map(role => ({
        id: role.id, name: role.name, color: role.color, position: role.position,
      }))
      .sort((a, b) => b.position - a.position);

    res.json({
      id: member.id,
      username: member.user.globalName || member.user.username,
      avatar: member.displayAvatarURL({ extension: 'png', size: 256 }),
      roles,
      highestRole: roles[0] || null,
      isGuildOwner: member.id === guild.ownerId,
    });
  } catch (error: any) {
    if (error.code === 10004) {
      console.error(`[API /user] FATAL: Could not access Guild with ID "${config.DISCORD_GUILD_ID}".`);
      return res.status(500).json({ error: 'Bot is misconfigured: Cannot access the configured Discord server.' });
    }
    if (error.code === 10013 || error.code === 10007) {
      return res.status(404).json({ error: 'User not found in this guild' });
    }
    console.error(`Error fetching user ${id}:`, error);
    res.status(500).json({ error: 'Internal server error while fetching user' });
  }
});

// FIX: Use namespaced express types to avoid conflicts and resolve type errors.
app.get('/api/roles', authenticateRequest, async (req: express.Request, res: express.Response) => {
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    await guild.roles.fetch();
    console.log(`[API /roles] Fetched ${guild.roles.cache.size} roles from guild ${guild.name}.`);

    const roles: DiscordRole[] = guild.roles.cache
      .filter(role => role.name !== '@everyone')
      .map(role => ({
        id: role.id, name: role.name, color: role.color, position: role.position,
      }))
      .sort((a, b) => b.position - a.position);
    res.json(roles);
  } catch (error: any) {
    if (error.code === 10004) {
      console.error(`[API /roles] FATAL: Could not access Guild with ID "${config.DISCORD_GUILD_ID}".`);
      return res.status(500).json({ error: 'Bot is misconfigured: Cannot access the configured Discord server.' });
    }
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Internal server error while fetching roles' });
  }
});

// FIX: Use namespaced express types to avoid conflicts and resolve type errors.
app.post('/api/notify', authenticateRequest, async (req: express.Request, res: express.Response) => {
    const { type, payload } = req.body;
    if (!type || !payload) {
        return res.status(400).json({ error: 'Invalid notification payload' });
    }

    try {
        console.log(`Received notification request: type=${type}`);
        if (type === 'new_submission' || type === 'audit_log') {
            const channelId = type === 'new_submission' ? payload.submissionsChannelId : payload.auditLogChannelId;
            if (!channelId) throw new Error(`Channel ID for type '${type}' is not configured.`);

            const channel = await client.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) throw new Error(`Channel with ID ${channelId} not found or is not a text channel.`);

            const embed = new Discord.EmbedBuilder(payload.embed);
            // FIX: Cast channel to a more specific TextChannel type. The isTextBased() check makes this safe, and this type guarantees the .send() method exists, resolving the TypeScript error.
            await (channel as Discord.TextChannel).send({ embeds: [embed] });
            console.log(`✅ Sent '${type}' embed to channel #${(channel as Discord.TextChannel).name}`);

        } else if (type === 'submission_result') {
            const user = await client.users.fetch(payload.userId);
            if (!user) throw new Error(`User with ID ${payload.userId} not found for DM.`);
            
            const embed = new Discord.EmbedBuilder(payload.embed);
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

app.listen(PORT, () => {
  console.log(`🚀 Bot API server is running on http://localhost:${PORT}`);
});
