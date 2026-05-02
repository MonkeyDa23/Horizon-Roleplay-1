import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Vulnerability #4: Authentication Check
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { serial } = req.body;
    
    // Verify that the serial belongs to this user
    const { data: profile } = await supabase
      .from('profiles')
      .select('mta_serial')
      .eq('id', user.id)
      .single();

    if (!profile || profile.mta_serial !== serial) {
      return res.status(403).json({ error: 'Forbidden: You can only unlink your own account' });
    }

    const botApiUrl = process.env.DISCORD_BOT_API_URL;
    const botApiKey = process.env.API_SECRET_KEY;

    if (!botApiUrl || !botApiKey) {
      console.error("[API] Missing Bot API configuration");
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
      console.error(`[API] Bot API error: ${response.status}`);
      return res.status(response.status).json({ 
        error: "Failed to unlink account"
      });
    }

    const data = await response.json();
    res.json(data);

  } catch (error: any) {
    console.error('[API] MTA Unlink API Error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
}
