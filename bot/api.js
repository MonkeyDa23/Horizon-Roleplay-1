// bot/api.js
import express from 'express';
import cors from 'cors';
import { formatDiscordUser, formatDiscordRole } from './utils.js';
import GameDig from 'gamedig';
import { EmbedBuilder } from 'discord.js';

/**
 * Creates and configures the Express API server.
 * @param {import('discord.js').Client} client - The Discord client instance.
 * @param {import('discord.js').Guild} guild - The Discord guild object.
 * @returns {express.Express} The configured Express app.
 */
export function createApi(client, guild) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // API Key authentication middleware
  const authenticate = (req, res, next) => {
    const apiKey = req.headers.authorization;
    if (apiKey && apiKey === process.env.API_SECRET_KEY) {
      next();
    } else {
      res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }
  };
  
  app.use(authenticate);

  // --- API ROUTES ---

  app.get('/health', (req, res) => {
    res.json({
      status: 'online',
      botUser: client.user.tag,
      guildName: guild.name,
    });
  });
  
  app.post('/sync-user/:discordId', async (req, res) => {
    try {
      const { discordId } = req.params;
      const member = await guild.members.fetch(discordId);
      if (!member) {
        return res.status(404).json({ error: 'User not found in this server.' });
      }
      res.json(formatDiscordUser(member));
    } catch (error) {
        console.error(`[API /sync-user] Error syncing user ${req.params.discordId}:`, error);
        if (error.code === 10007) { // Unknown Member
             return res.status(404).json({ error: 'User not found in this server.' });
        }
        // This specific error message helps diagnose a common setup issue.
        if (error.message.includes("Members fetching is disabled")) {
            return res.status(503).json({ error: 'Bot is missing permissions. The "Server Members Intent" is likely not enabled in the Discord Developer Portal.'});
        }
        res.status(500).json({ error: 'An internal error occurred while fetching user data.' });
    }
  });

  app.get('/guild-roles', (req, res) => {
    const roles = guild.roles.cache
      .filter(role => role.id !== guild.id)
      .sort((a, b) => b.position - a.position)
      .map(formatDiscordRole);
    res.json(roles);
  });

  app.post('/notify', async (req, res) => {
    try {
      const { channelId, dmToUserId, content, embed } = req.body;
      const embedBuilder = new EmbedBuilder(embed);

      if (dmToUserId) {
        const user = await client.users.fetch(dmToUserId);
        await user.send({ content, embeds: [embedBuilder] });
      } else if (channelId) {
        const channel = await client.channels.fetch(channelId);
        if (channel.isTextBased()) {
          await channel.send({ content, embeds: [embedBuilder] });
        } else {
          throw new Error('Channel is not a text-based channel.');
        }
      } else {
        return res.status(400).json({ error: 'Either channelId or dmToUserId must be provided.' });
      }
      res.status(204).send();
    } catch (error) {
      console.error('[API /notify] Error sending notification:', error);
      res.status(500).json({ error: `Failed to send notification: ${error.message}` });
    }
  });
  
  app.get('/mta-status', async (req, res) => {
      try {
        if (!process.env.MTA_SERVER_IP || !process.env.MTA_SERVER_PORT) {
            throw new Error('MTA server address is not configured in the bot environment.');
        }
        const state = await GameDig.query({
            type: 'mtasa',
            host: process.env.MTA_SERVER_IP,
            port: process.env.MTA_SERVER_PORT,
        });
        res.json({
            name: state.name,
            players: state.players.length,
            maxPlayers: state.maxplayers,
            version: state.raw?.version || 'N/A'
        });
      } catch (error) {
          console.error('[API /mta-status] Error fetching MTA server status:', error);
          res.status(500).json({ name: 'Server Offline', players: 0, maxPlayers: 0, version: 'N/A' });
      }
  });

  app.get('/announcements', async (req, res) => {
      try {
          const channelId = process.env.ANNOUNCEMENTS_CHANNEL_ID;
          if (!channelId) {
              throw new Error('ANNOUNCEMENTS_CHANNEL_ID is not set in the bot environment.');
          }
          const channel = await client.channels.fetch(channelId);
          if (!channel || !channel.isTextBased()) {
              throw new Error('Announcements channel not found or is not a text channel.');
          }
          const messages = await channel.messages.fetch({ limit: 5 });
          const announcements = messages.map(msg => ({
              id: msg.id,
              title: msg.embeds[0]?.title || `Announcement`,
              content: msg.content || msg.embeds[0]?.description || '',
              author: {
                  name: msg.author.globalName || msg.author.username,
                  avatarUrl: msg.author.displayAvatarURL(),
              },
              timestamp: msg.createdAt.toISOString(),
              url: msg.url,
          }));
          res.json(announcements);
      } catch (error) {
          console.error('[API /announcements] Error fetching announcements:', error);
          res.status(500).json({ error: `Failed to fetch announcements: ${error.message}` });
      }
  });

  // Simplified test notification handler
  app.post('/notify-test', async (req, res) => {
    try {
        const { type, targetId } = req.body;
        const testEmbed = new EmbedBuilder()
            .setTitle(`✅ Test Notification: ${type}`)
            .setDescription(`This is a test notification sent to target ID \`${targetId}\`.\nTimestamp: ${new Date().toISOString()}`)
            .setColor(0x00FF00);
        
        const target = await client.channels.fetch(targetId).catch(() => client.users.fetch(targetId));
        if (!target) throw new Error("Target channel or user not found.");

        await target.send({ embeds: [testEmbed] });
        res.status(204).send();
    } catch(error) {
        console.error('[API /notify-test] Error sending test notification:', error);
        res.status(500).json({ error: `Failed to send test notification: ${error.message}` });
    }
  });


  return app;
}
