import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function (req: VercelRequest, res: VercelResponse) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const serial = Array.isArray(req.query.serial) ? req.query.serial[0] : req.query.serial;
    
    if (!serial) {
      return res.status(400).json({ error: "Missing serial parameter" });
    }

    // Verify serial ownership
    const { data: profile } = await supabase
      .from('profiles')
      .select('mta_serial')
      .eq('id', user.id)
      .single();

    if (!profile || profile.mta_serial !== serial) {
      return res.status(403).json({ error: "Forbidden: You only have access to your own linked account" });
    }

    const botApiUrl = process.env.DISCORD_BOT_API_URL;
    const botApiKey = process.env.DISCORD_BOT_API_KEY;

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
    console.error("[API] Global Error in /api/mta/account");
    res.status(500).json({ 
      error: "Internal Server Error"
    });
  }
}
