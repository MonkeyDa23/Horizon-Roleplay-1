
// discord-bot/src/index.ts
import express, { Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';
import cors from 'cors';
import * as Discord from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import type { BotConfig, DiscordRole, NotifyPayload } from './types.js';

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

// FIX: Cast cors() to any to resolve middleware type mismatch error.
app.use(cors() as any);
app.use(express.json());

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
      .setDefaultMemberPermissions(Discord.PermissionFlagsBits.Administrator)
      .addStringOption(option =>
        option.setName('status')
          .setDescription("The bot's status.")
          .setRequired(true)
          .addChoices(
            { name: 'Online', value: 'online' },
            { name: 'Idle', value: 'idle' },
            { name: 'Do Not Disturb', value: 'dnd' },
            { name: 'Invisible', value: 'invisible' }
          ))
      .addStringOption(option =>
        option.setName('activity_type')
          .setDescription("The bot's activity type.")
          .setRequired(true)
          .addChoices(
            { name: 'Playing', value: 'Playing' },
            { name: 'Watching', value: 'Watching' },
            { name: 'Listening to', value: 'Listening' },
            { name: 'Competing in', value: 'Competing' }
          ))
      .addStringOption(option =>
        option.setName('activity_name')
          .setDescription("The bot's activity name.")
          .setRequired(true));
          
    await guild.commands.set([setStatusCommand]);
    console.log("✅ Slash commands registered.");

  } catch (error) {
    console.error(`❌ Could not fetch guild with ID ${config.DISCORD_GUILD_ID}. Please check the ID and the bot's permissions.`, error);
  }
});

client.on(Discord.Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'setstatus') return;

    try {
        const member = interaction.member as Discord.GuildMember;
        const isOwner = interaction.guild?.ownerId === member.id;
        const hasRole = member.roles.cache.some(role => config.PRESENCE_COMMAND_ROLE_IDS.includes(role.id));

        if (!isOwner && !hasRole) {
            await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            return;
        }

        const status = interaction.options.getString('status') as Discord.PresenceStatusData;
        const activityType = interaction.options.getString('activity_type');
        const activityName = interaction.options.getString('activity_name');

        const activityTypeMap = {
            'Playing': Discord.ActivityType.Playing,
            'Watching': Discord.ActivityType.Watching,
            'Listening': Discord.ActivityType.Listening,
            'Competing': Discord.ActivityType.Competing,
        };
        const selectedActivityType = activityTypeMap[activityType as keyof typeof activityTypeMap];
        
        client.user?.setPresence({
            status: status,
            activities: [{ name: activityName!, type: selectedActivityType }],
        });

        await interaction.reply({ content: `Status updated successfully!`, ephemeral: true });
    } catch (error) {
        console.error("Error handling /setstatus:", error);
        await interaction.reply({ content: 'An error occurred while setting the status.', ephemeral: true });
    }
});


// =============================================
// API MIDDLEWARE & ROUTES
// =============================================
const authenticate = (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => {
  // FIX: Cast req to any to access headers property.
  const authHeader = (req as any).headers.authorization;
  if (authHeader && authHeader === `Bearer ${config.API_SECRET_KEY}`) {
    next();
  } else {
    // FIX: Cast res to any to access status and json methods.
    (res as any).status(401).json({ error: 'Unauthorized' });
  }
};

app.get('/health', authenticate, async (req: ExpressRequest, res: ExpressResponse) => {
    try {
        const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
        await guild.members.fetch({ limit: 1 }); // Test member fetching
        // FIX: Cast res to any to access json method.
        (res as any).json({ status: 'ok', details: { guildName: guild.name, memberCount: guild.memberCount } });
    } catch (e) {
        console.error("[HEALTH CHECK FAIL]: ", (e as Error).message);
        // FIX: Cast res to any to access status and json methods.
        (res as any).status(503).json({ status: 'error', message: (e as Error).message });
    }
});

app.get('/api/roles', authenticate, async (req: ExpressRequest, res: ExpressResponse) => {
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const roles = (await guild.roles.fetch()).map(role => ({
      id: role.id,
      name: role.name,
      color: role.color,
      position: role.position,
    })).sort((a, b) => b.position - a.position);
    // FIX: Cast res to any to access json method.
    (res as any).json(roles);
  } catch (error) {
    console.error('[API /roles] Error:', error);
    // FIX: Cast res to any to access status and json methods.
    (res as any).status(500).json({ error: 'Could not fetch guild roles.' });
  }
});

app.get('/api/user/:id', authenticate, async (req: ExpressRequest, res: ExpressResponse) => {
  // FIX: Cast req to any to access params property.
  const { id } = (req as any).params;
  try {
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const member = await guild.members.fetch(id);
    
    const roles: DiscordRole[] = member.roles.cache
      .filter(role => role.id !== guild.id) // Exclude @everyone role
      .map(role => ({
        id: role.id, name: role.name, color: role.color, position: role.position
      }))
      .sort((a, b) => b.position - a.position);

    const highestRole = roles[0] || null;

    // FIX: Cast res to any to access json method.
    (res as any).json({
        username: member.user.globalName || member.user.username,
        avatar: member.displayAvatarURL({ extension: 'png', size: 256 }),
        roles: roles,
        highest_role: highestRole
    });
  } catch (error) {
    console.error(`[API /user/${id}] Error:`, error);
    if (error instanceof Discord.DiscordAPIError && error.code === 10007) {
        // FIX: Cast res to any to access status and json methods.
        return (res as any).status(404).json({ error: 'User not found in guild.' });
    }
    // FIX: Cast res to any to access status and json methods.
    (res as any).status(500).json({ error: 'Could not fetch user data.' });
  }
});

app.post('/api/notify', authenticate, async (req: ExpressRequest, res: ExpressResponse) => {
    // FIX: Cast req to any to access body property.
    const { type, payload } = (req as any).body;
    
    try {
        if (type === 'new_submission' || type === 'audit_log') {
            const channelId = type === 'new_submission' ? payload.submissionsChannelId : payload.auditLogChannelId;
            const channel = await client.channels.fetch(channelId);
            if (channel?.isTextBased()) {
                // FIX: Cast channel to TextChannel to ensure .send() method is available.
                await (channel as Discord.TextChannel).send({ embeds: [payload.embed] });
            } else {
                throw new Error(`Channel ${channelId} is not a text-based channel.`);
            }
        } else if (type === 'submission_result') {
            const user = await client.users.fetch(payload.userId);
            await user.send({ embeds: [payload.embed] });
        } else {
            // FIX: Cast res to any to access status and json methods.
            return (res as any).status(400).json({ error: 'Invalid notification type' });
        }
        // FIX: Cast res to any to access status and json methods.
        (res as any).status(200).json({ success: true });
    } catch (error) {
        console.error('[API /notify] Error:', error);
        // FIX: Cast res to any to access status and json methods.
        (res as any).status(500).json({ error: `Failed to send notification: ${(error as Error).message}` });
    }
});


// =============================================
// START SERVER AND BOT
// =============================================
app.listen(PORT, () => {
  console.log(`🚀 API server listening on port ${PORT}`);
});

client.login(config.DISCORD_BOT_TOKEN);
