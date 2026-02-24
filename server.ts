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

  // MTA API Routes
  app.get('/api/mta/account/:serial', async (req, res) => {
    try {
      const { serial } = req.params;
      const [rows] = await pool.execute('SELECT * FROM accounts WHERE mtaserial = ?', [serial]);
      const account = (rows as any[])[0];

      if (!account) {
        return res.status(404).json({ error: 'Account not found' });
      }

      // Fetch characters for this account
      const [charRows] = await pool.execute('SELECT * FROM characters WHERE account_id = ?', [account.id]);
      
      // Fetch admin record
      const [adminRows] = await pool.execute('SELECT * FROM admin_record WHERE account_id = ? ORDER BY date DESC LIMIT 10', [account.id]);

      res.json({
        id: account.id,
        username: account.username,
        serial: account.mtaserial,
        character_count: (charRows as any[]).length,
        characters: charRows,
        admin_record: adminRows
      });
    } catch (error) {
      console.error('MTA Account API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

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
      await pool.execute('UPDATE accounts SET discord_id = NULL, discord_username = NULL, discord_avatar = NULL WHERE mtaserial = ?', [serial]);
      res.json({ success: true });
    } catch (error) {
      console.error('MTA Unlink API Error:', error);
      res.status(500).json({ error: 'Internal server error' });
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
