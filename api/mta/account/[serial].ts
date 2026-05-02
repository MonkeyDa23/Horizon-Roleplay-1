import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function (req: VercelRequest, res: VercelResponse) {
  try {
    const { serial } = req.query;
    
    if (!serial || typeof serial !== 'string') {
      return res.status(400).json({ error: "Missing or invalid serial parameter" });
    }

    // Vulnerability Check: Is user authenticated?
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

    // Vulnerability Check: Does the serial belong to the user?
    const { data: profile } = await supabase
      .from('profiles').select('mta_serial')
      .eq('id', user.id).single();

    if (profile?.mta_serial !== serial) {
      return res.status(403).json({ error: 'Forbidden: You do not own this serial' });
    }

    const botApiUrl = process.env.DISCORD_BOT_API_URL;
    const botApiKey = process.env.API_SECRET_KEY;

    if (!botApiUrl || !botApiKey) {
      console.error("[API] Missing Bot API configuration");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const response = await fetch(`${botApiUrl}/mta/account/${serial}`, {
      method: 'GET',
      headers: {
        'Authorization': botApiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`[API] Bot API error: ${response.status}`);
      return res.status(response.status).json({ 
        error: "Failed to fetch data from game server"
      });
    }

    const data = await response.json();
    return res.json(data);

  } catch (error: any) {
    console.error("[API] Global Error in /api/mta/account:", error.message);
    res.status(500).json({ 
      error: "Internal Server Error"
    });
  }
}
