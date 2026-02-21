import express from 'express';
import { createServer as createViteServer } from 'vite';
import { supabase } from './src/lib/supabaseClient';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get('/api/mta/status/:serial', async (req, res) => {
    const { serial } = req.params;
    if (!serial) {
      return res.status(400).json({ error: 'Serial is required' });
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, avatar')
        .eq('mta_serial', serial)
        .single();

      if (error || !data) {
        return res.json({ isLinked: false });
      }

      res.json({ 
        isLinked: true, 
        discordUser: { 
          username: data.username,
          avatar: data.avatar
        }
      });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/mta/unlink', async (req, res) => {
    const { serial } = req.body;
    if (!serial) {
      return res.status(400).json({ error: 'Serial is required' });
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ mta_serial: null, mta_name: null, mta_linked_at: null })
        .eq('mta_serial', serial);

      if (error) throw error;

      res.status(200).json({ success: true, message: 'Account unlinked successfully.' });
    } catch (err) {
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
