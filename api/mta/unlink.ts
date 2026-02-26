import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function (req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { serial } = req.body;
    console.log(`[API] Forwarding unlink request for ${serial} to Bot API`);

    const botApiUrl = process.env.VITE_DISCORD_BOT_API_URL;
    const botApiKey = process.env.VITE_DISCORD_BOT_API_KEY;

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
      const errorText = await response.text();
      console.error(`[API] Bot API error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({ 
        error: "Failed to unlink account", 
        details: errorText 
      });
    }

    const data = await response.json();
    res.json(data);

  } catch (error: any) {
    console.error('[API] MTA Unlink API Error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
