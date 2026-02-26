import express from 'express';
import { createServer as createViteServer } from 'vite';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.MTA_DB_HOST || 'localhost',
  user: process.env.MTA_DB_USER || 'root',
  password: process.env.MTA_DB_PASSWORD || '',
  database: process.env.MTA_DB_NAME || 'mta_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- PROXY FOR DISCORD BOT ---
  app.all('/api/proxy/*', async (req, res) => {
    const botUrl = process.env.VITE_DISCORD_BOT_API_URL;
    const apiKey = process.env.VITE_DISCORD_BOT_API_KEY;

    // 1. Special Route: Direct Discord Invite Lookup
    if (req.url.includes('/discord-invite/')) {
      try {
        const parts = req.url.split('/discord-invite/');
        const code = parts[1].split('?')[0];
        const discordRes = await fetch(`https://discord.com/api/v9/invites/${code}?with_counts=true`);
        if (!discordRes.ok) return res.status(discordRes.status).json({ error: 'Discord API Error' });
        const data = await discordRes.json();
        return res.json({
          guild: {
            name: data.guild.name,
            id: data.guild.id,
            iconURL: data.guild.icon ? `https://cdn.discordapp.com/icons/${data.guild.id}/${data.guild.icon}.png` : null
          },
          memberCount: data.approximate_member_count,
          presenceCount: data.approximate_presence_count
        });
      } catch (e: any) {
        return res.status(500).json({ error: 'Discord fetch failed', details: e.message });
      }
    }

    // 2. Standard Bot Proxy
    if (!botUrl || !apiKey) {
      return res.status(500).json({ error: 'Proxy not configured (Missing Env Vars)' });
    }

    const targetPath = req.url.replace('/api/proxy', '');
    const targetUrl = new URL(targetPath, botUrl).toString();

    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey,
        },
        body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined,
      });

      res.status(response.status).send(await response.text());
    } catch (error: any) {
      console.error(`[PROXY] Error forwarding to ${targetUrl}:`, error);
      res.status(502).json({ error: 'Bad Gateway', details: error.message, targetUrl });
    }
  });

  // MTA API Routes (Direct to DB)
  app.get('/api/mta/status/:serial', async (req, res) => {
    try {
      const { serial } = req.params;
      const [rows] = await pool.execute('SELECT discord_id, discord_username, discord_avatar FROM accounts WHERE mtaserial = ?', [serial]);
      const account = (rows as any[])[0];

      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      res.json({
        linked: !!account.discord_id,
        discord: account.discord_id ? {
          id: account.discord_id,
          username: account.discord_username,
          avatar: account.discord_avatar
        } : null
      });
    } catch (error) {
      console.error('MTA Status API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/mta/unlink', async (req, res) => {
    try {
      const { serial } = req.body;
      console.log(`[Server] Forwarding unlink request for ${serial} to Bot API`);

      const botApiUrl = process.env.VITE_DISCORD_BOT_API_URL;
      const botApiKey = process.env.VITE_DISCORD_BOT_API_KEY;

      if (!botApiUrl || !botApiKey) {
        console.error("[Server] Missing Bot API configuration");
        return res.status(500).json({ error: "Server configuration error" });
      }

      const response = await fetch(`${botApiUrl}/mta/unlink`, {
        method: 'POST',
        headers: {
          'Authorization': botApiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ serial })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Server] Bot API error: ${response.status} - ${errorText}`);
        return res.status(response.status).json({ 
          error: "Failed to unlink account", 
          details: errorText 
        });
      }

      const data = await response.json();
      res.json(data);

    } catch (error: any) {
      console.error('[Server] MTA Unlink API Error:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
