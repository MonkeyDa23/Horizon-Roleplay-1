// discord-bot/src/index.ts
// FIX: Using explicit type imports for Express to resolve name conflicts with global DOM types.
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  TextChannel, 
  EmbedBuilder, 
  REST, 
  Routes, 
  Role 
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import type { BotConfig, NotifyPayload, DiscordRole } from './types.js';

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

let guildCache: any = null;

client.once('ready', async () => {
  if (!client.user) {
      console.error("❌ FATAL: Bot client user is not available.");
      return;
  }
  console.log(`🟢 Bot logged in as ${client.user.tag}`);
  try {
    guildCache = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    await guildCache.members.fetch(); // Fetch all members to ensure cache is populated
    console.log(`✅ Guild "${guildCache.name}" cached successfully with ${guildCache.members.cache.size} members.`);
  } catch (error) {
    console.error(`❌ FATAL: Could not fetch or cache guild with ID ${config.DISCORD_GUILD_ID}.`);
    console.error("   Please check that the GUILD_ID is correct and the bot is in the server.");
    process.exit(1);
  }
});

client.login(config.DISCORD_BOT_TOKEN);

// =============================================
// EXPRESS MIDDLEWARE
// =============================================
app.use(cors());
app.use(express.json());

// Authentication middleware to protect API endpoints
const authenticateRequest = (req: Request, res: Response, next: NextFunction) => {
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
app.get('/health', (req: Request, res: Response) => {
  if (!client.isReady() || !guildCache) {
    return res.status(503).json({ status: 'error', message: 'Bot is not ready or guild not cached.' });
  }
  res.status(200).json({ 
    status: 'ok', 
    details: {
      botUsername: client.user?.tag,
      guildName: guildCache.name,
      memberCount: guildCache.members.cache.size
    } 
  });
});

// GET USER PROFILE
app.get('/api/user/:id', authenticateRequest, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!guildCache) return res.status(503).json({ error: 'Guild not cached' });

  try {
    const member = await guildCache.members.fetch(id);
    if (!member) {
      return res.status(404).json({ error: 'User not found in this guild' });
    }
    
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
    const isGuildOwner = member.id === guildCache.ownerId;

    res.json({
      id: member.id,
      username: member.user.globalName || member.user.username,
      avatar: member.displayAvatarURL({ extension: 'png', size: 256 }),
      roles,
      highestRole,
      isGuildOwner,
    });
  } catch (error: any) {
    if (error.code === 10013) { // Unknown User
      return res.status(404).json({ error: 'User not found in this guild' });
    }
    console.error(`Error fetching user ${id}:`, error);
    res.status(500).json({ error: 'Internal server error while fetching user' });
  }
});

// GET ALL GUILD ROLES
app.get('/api/roles', authenticateRequest, async (req: Request, res: Response) => {
  if (!guildCache) return res.status(503).json({ error: 'Guild not cached' });
  try {
    await guildCache.roles.fetch();
    const roles = guildCache.roles.cache
      .filter((role: Role) => role.name !== '@everyone')
      .map((role: Role) => ({
        id: role.id,
        name: role.name,
        color: role.color,
        position: role.position,
      }))
      .sort((a: DiscordRole, b: DiscordRole) => b.position - a.position);
    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Internal server error while fetching roles' });
  }
});

// SEND NOTIFICATION
app.post('/api/notify', authenticateRequest, async (req: Request, res: Response) => {
    const { type, payload } = req.body;
    
    if (!type || !payload) {
        return res.status(400).json({ error: 'Invalid notification payload' });
    }

    try {
        console.log(`Received notification request: type=${type}`);
        console.log(`Payload:`, JSON.stringify(payload, null, 2));

        if (type === 'new_submission' || type === 'audit_log') {
            const channelId = type === 'new_submission'
                ? payload.submissionsChannelId
                : payload.auditLogChannelId;
            
            if (!channelId) {
                throw new Error(`Channel ID for type '${type}' is not configured.`);
            }

            const channel = await client.channels.fetch(channelId) as TextChannel;
            if (!channel) {
                throw new Error(`Channel with ID ${channelId} not found.`);
            }

            const embed = new EmbedBuilder(payload.embed);
            await channel.send({ embeds: [embed] });
            console.log(`✅ Sent '${type}' embed to channel #${channel.name}`);

        } else if (type === 'submission_result') {
            const user = await client.users.fetch(payload.userId);
            if (!user) {
                throw new Error(`User with ID ${payload.userId} not found for DM.`);
            }
            const embed = new EmbedBuilder(payload.embed);
            await user.send({ embeds: [embed] });
            console.log(`✅ Sent '${type}' DM to user ${user.tag}`);
        } else {
            throw new Error(`Unsupported notification type: ${type}`);
        }

        res.status(200).json({ success: true, message: `Notification sent successfully.` });

    } catch (error: any) {
        console.error(`❌ Failed to send notification (type: ${type}):`, error.message);
        console.error(`   Payload was:`, JSON.stringify(payload, null, 2));
        res.status(500).json({ success: false, error: error.message });
    }
});


// =============================================
// START SERVER
// =============================================
app.listen(PORT, () => {
  console.log(`🚀 Bot API server is running on http://localhost:${PORT}`);
});