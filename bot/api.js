
import express from 'express';
import cors from 'cors';
import { formatDiscordUser, formatDiscordRole } from './utils.js';
import GameDig from 'gamedig';
import { EmbedBuilder } from 'discord.js';

export function createApi(client, guild) {
  const app = express();
  
  // Allow requests from the frontend
  app.use(cors());
  app.use(express.json());

  // --- SECURITY MIDDLEWARE ---
  app.use((req, res, next) => {
    const apiKey = req.headers.authorization;
    if (apiKey === process.env.API_SECRET_KEY) {
      next();
    } else {
      console.warn(`🔒 Blocked unauthorized access from ${req.ip}`);
      res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }
  });

  // --- ROUTES ---

  // 1. Health Check
  app.get('/health', (req, res) => {
    res.json({
      status: 'online',
      bot: client.user.tag,
      guild: guild.name,
      ping: client.ws.ping
    });
  });

  // 2. Guild Roles (Critical for Admin Panel)
  app.get('/guild-roles', async (req, res) => {
    try {
      // Force fetch from Discord to get the absolute latest roles
      const rolesMap = await guild.roles.fetch(undefined, { force: true });
      const roles = rolesMap
        .filter(r => r.id !== guild.id) // Remove @everyone
        .sort((a, b) => b.position - a.position) // Sort by hierarchy
        .map(formatDiscordRole);
        
      res.json(roles);
    } catch (error) {
      console.error('Error fetching roles:', error);
      res.status(500).json({ error: 'Failed to fetch roles from Discord.' });
    }
  });

  // 3. User Sync (Login Logic)
  app.post('/sync-user/:discordId', async (req, res) => {
    const { discordId } = req.params;
    try {
      const member = await guild.members.fetch({ user: discordId, force: true });
      res.json(formatDiscordUser(member));
    } catch (error) {
      if (error.code === 10007) {
        return res.status(404).json({ error: 'User not found in the server.' });
      }
      console.error(`Sync error for ${discordId}:`, error);
      res.status(500).json({ error: 'Internal bot error during sync.' });
    }
  });

  // 4. The Notification System (DMs & Channels)
  app.post('/notify', async (req, res) => {
    const { channelId, dmToUserId, content, embed } = req.body;

    try {
      let target;
      let destinationName;

      // Determine Target
      if (dmToUserId) {
        try {
           target = await client.users.fetch(dmToUserId);
           destinationName = `User ${target.tag}`;
        } catch (e) {
           console.warn(`Notify: User ${dmToUserId} not found.`);
           // Return success to frontend anyway to prevent website crash
           return res.json({ success: false, reason: 'User not found' }); 
        }
      } else if (channelId) {
        target = await client.channels.fetch(channelId).catch(() => null);
        destinationName = `Channel ${channelId}`;
        if (!target) {
            console.warn(`Notify: Channel ${channelId} not accessible.`);
            return res.json({ success: false, reason: 'Channel not found' });
        }
      } else {
        return res.status(400).json({ error: 'Missing target (channelId or dmToUserId)' });
      }

      // Build Payload
      const payload = {};
      if (content) payload.content = content;
      if (embed) payload.embeds = [new EmbedBuilder(embed)];

      // Send
      await target.send(payload);
      console.log(`📨 Notification sent to ${destinationName}`);
      res.json({ success: true });

    } catch (error) {
      // Handle "Cannot send messages to this user" (Error 50007) gracefully
      if (error.code === 50007) {
        console.warn(`⚠️ Failed to DM user ${dmToUserId} (DMs likely closed).`);
        return res.json({ success: false, reason: 'DMs closed' });
      }
      
      console.error('Notify Error:', error);
      // Even on error, we often want to return 200 so the frontend flow continues
      res.status(200).json({ success: false, error: error.message });
    }
  });
  
  // 5. MTA Status
  app.get('/mta-status', async (req, res) => {
    try {
        // Use GameDig or fallback mock data if environment is not set
        if (!process.env.MTA_SERVER_IP) throw new Error('No IP set');
        
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
  app.get('/announcements', async (req, res) => {
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
          console.error('Announcements Error:', e);
          res.json([]);
      }
  });

  return app;
}