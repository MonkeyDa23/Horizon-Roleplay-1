
import express from 'express';
import cors from 'cors';
import { formatDiscordUser, formatDiscordRole } from './utils.js';
import GameDig from 'gamedig';
import { EmbedBuilder } from 'discord.js';

export function createApi(client, botState) {
  const app = express();
  
  app.use(cors());
  app.use(express.json());

  // --- AUTH MIDDLEWARE ---
  const checkAuth = (req, res, next) => {
    const apiKey = req.headers.authorization;
    if (apiKey === process.env.API_SECRET_KEY) {
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }
  };

  // --- HELPER: Ensure Bot Ready ---
  const ensureReady = (req, res, next) => {
      if (!botState.ready || !botState.guild) {
          return res.status(503).json({ 
              error: 'Bot is not ready or not connected to guild yet.',
              details: botState.error || 'Initializing... Please wait.'
          });
      }
      next();
  };

  // 1. Health Check (UNPROTECTED & ALWAYS UP)
  // This prevents 502 errors by always returning something, even if unauthorized or initializing.
  app.get('/health', (req, res) => {
    res.json({
      status: botState.ready ? 'online' : 'initializing',
      bot: client.user?.tag || 'Unknown',
      guild: botState.guild?.name || 'Not Linked',
      ping: client.ws?.ping || -1,
      lastError: botState.error
    });
  });

  // Apply Auth to everything else
  app.use(checkAuth);

  // 2. Guild Roles
  app.get('/guild-roles', ensureReady, async (req, res) => {
    try {
      const guild = botState.guild;
      const rolesMap = await guild.roles.fetch(undefined, { force: true });
      const roles = rolesMap
        .filter(r => r.id !== guild.id)
        .sort((a, b) => b.position - a.position)
        .map(formatDiscordRole);
      res.json(roles);
    } catch (error) {
      console.error('Error fetching roles:', error);
      res.status(500).json({ error: 'Failed to fetch roles.' });
    }
  });

  // 3. User Sync
  app.post('/sync-user/:discordId', ensureReady, async (req, res) => {
    const { discordId } = req.params;
    try {
      const member = await botState.guild.members.fetch({ user: discordId, force: true });
      res.json(formatDiscordUser(member));
    } catch (error) {
      if (error.code === 10007) {
        return res.status(404).json({ error: 'User not found in the server.' });
      }
      console.error(`Sync error for ${discordId}:`, error);
      res.status(500).json({ error: 'Internal bot error.' });
    }
  });

  // 4. Notifications
  app.post('/notify', ensureReady, async (req, res) => {
    const { channelId, dmToUserId, content, embed } = req.body;

    try {
      let target;
      
      if (dmToUserId) {
        try {
           target = await client.users.fetch(dmToUserId);
        } catch (e) {
           return res.json({ success: false, reason: 'User not found' }); 
        }
      } else if (channelId) {
        target = await client.channels.fetch(channelId).catch(() => null);
        if (!target) return res.json({ success: false, reason: 'Channel not found' });
      } else {
        return res.status(400).json({ error: 'Missing target' });
      }

      const payload = {};
      if (content) payload.content = content;
      if (embed) payload.embeds = [new EmbedBuilder(embed)];

      await target.send(payload);
      res.json({ success: true });

    } catch (error) {
      if (error.code === 50007) return res.json({ success: false, reason: 'DMs closed' });
      console.error('Notify Error:', error);
      res.status(200).json({ success: false, error: error.message });
    }
  });
  
  // 5. MTA Status
  app.get('/mta-status', async (req, res) => {
    try {
        if (!process.env.MTA_SERVER_IP) throw new Error('No IP');
        const state = await GameDig.query({
            type: 'mtasa',
            host: process.env.MTA_SERVER_IP,
            port: parseInt(process.env.MTA_SERVER_PORT) || 22003
        });
        res.json({
            name: state.name,
            players: state.players.length,
            maxPlayers: state.maxplayers,
            version: state.raw?.version
        });
    } catch (e) {
        res.json({ name: 'Server Offline', players: 0, maxPlayers: 0, version: 'N/A' });
    }
  });
  
  // 6. Announcements
  app.get('/announcements', ensureReady, async (req, res) => {
      const channelId = process.env.ANNOUNCEMENTS_CHANNEL_ID;
      if (!channelId) return res.json([]);
      
      try {
          const channel = await client.channels.fetch(channelId);
          if (!channel?.isTextBased()) return res.json([]);
          const messages = await channel.messages.fetch({ limit: 5 });
          const data = messages.map(m => ({
              id: m.id,
              content: m.content || (m.embeds[0] ? m.embeds[0].description : ''),
              author: { name: m.author.username, avatarUrl: m.author.displayAvatarURL() },
              timestamp: m.createdAt,
              url: m.url
          }));
          res.json(data);
      } catch (e) {
          res.json([]);
      }
  });

  return app;
}