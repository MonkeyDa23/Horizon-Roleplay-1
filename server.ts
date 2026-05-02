import express from 'express';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // Serve static files in production
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
  }

  // --- PROXY FOR DISCORD BOT ---
  const ALLOWED_PATHS = [
    '/mta/account/',
    '/mta/character/',
    '/mta/unlink',
    '/mta/code',
    '/discord-invite/'
  ];

  app.all('/api/proxy/*', async (req, res) => {
    const botUrl = process.env.DISCORD_BOT_API_URL;
    const apiKey = process.env.API_SECRET_KEY;

    // 1. Special Route: Direct Discord Invite Lookup
    if (req.url.includes('/discord-invite/')) {
      try {
        const parts = req.url.split('/discord-invite/');
        const code = parts[1].split('?')[0];
        
        // Vulnerability #7: Format Validation
        if (!code || !/^[a-zA-Z0-9-]+$/.test(code)) {
          return res.status(400).json({ error: 'Invalid invite code format' });
        }

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
        return res.status(500).json({ error: 'Discord fetch failed' });
      }
    }

    // 2. Standard Bot Proxy
    if (!botUrl || !apiKey) {
      return res.status(500).json({ error: 'Proxy not configured (Missing Env Vars)' });
    }

    const targetPath = req.url.replace('/api/proxy', '');
    
    // Vulnerability #3: SSRF Whitelist
    const isAllowed = ALLOWED_PATHS.some(path => targetPath.startsWith(path));
    if (!isAllowed) {
      return res.status(403).json({ error: 'Forbidden: Path not whitelisted' });
    }

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
      console.error(`[PROXY] Error forwarding to bot API:`, error.message);
      // Vulnerability #8: Information Disclosure
      res.status(502).json({ error: 'Bad Gateway' });
    }
  });

  // MTA API Routes (Direct to DB)
  app.get('/api/mta/status/:serial', async (req, res) => {
    try {
      // Vulnerability #4: Authentication Check
      const authHeader = req.headers['authorization'];
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (authError || !user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

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
      // Vulnerability #5: Authentication Check
      const authHeader = req.headers['authorization'];
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (authError || !user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { serial } = req.body;
      console.log(`[Server] Processing unlink request for serial: ${serial}`);

      if (!serial) {
        return res.status(400).json({ error: 'Serial is required' });
      }

      // Verify ownership
      const { data: profile } = await supabase
        .from('profiles')
        .select('mta_serial')
        .eq('id', user.id)
        .single();

      if (!profile || profile.mta_serial !== serial) {
        return res.status(403).json({ error: 'Forbidden: You can only unlink your own account' });
      }

      // 1. Direct Database Unlink (Primary Action)
      const [result] = await pool.execute(
        'UPDATE accounts SET discord_id = NULL, discord_username = NULL, discord_avatar = NULL, discord_discriminator = NULL WHERE mtaserial = ?',
        [serial]
      );

      const affectedRows = (result as any).affectedRows;

      // 2. Notify Bot (Secondary/Optional)
      const botApiUrl = process.env.DISCORD_BOT_API_URL;
      const botApiKey = process.env.API_SECRET_KEY;

      if (botApiUrl && botApiKey) {
        fetch(`${botApiUrl}/mta/unlink`, {
          method: 'POST',
          headers: {
            'Authorization': botApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ serial })
        }).catch(err => console.error('[Server] Failed to notify bot of unlink:', err));
      }

      if (affectedRows > 0) {
        console.log(`[Server] Successfully unlinked account with serial: ${serial}`);
        res.json({ success: true, message: 'Account unlinked successfully' });
      } else {
        // Even if no rows affected (maybe already unlinked), we consider it a success state for the UI
        console.log(`[Server] No account found or already unlinked for serial: ${serial}`);
        res.json({ success: true, message: 'Account unlinked (or was not linked)' });
      }

    } catch (error: any) {
      console.error('[Server] MTA Unlink API Error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // SPA Fallback for production
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
