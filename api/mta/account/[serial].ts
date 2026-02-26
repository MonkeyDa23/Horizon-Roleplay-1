import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function (req: VercelRequest, res: VercelResponse) {
  console.log(`[API] Received request for /api/mta/account/${req.query.serial}`);
  
  try {
    const { serial } = req.query;
    
    if (!serial) {
      console.log("[API] Missing serial parameter.");
      return res.status(400).json({ error: "Missing serial parameter" });
    }

    const botApiUrl = process.env.VITE_DISCORD_BOT_API_URL;
    const botApiKey = process.env.VITE_DISCORD_BOT_API_KEY;

    if (!botApiUrl || !botApiKey) {
      console.error("[API] Missing Bot API configuration");
      return res.status(500).json({ error: "Server configuration error" });
    }

    console.log(`[API] Forwarding request to Bot API: ${botApiUrl}/mta/account/${serial}`);

    const response = await fetch(`${botApiUrl}/mta/account/${serial}`, {
      method: 'GET',
      headers: {
        'Authorization': botApiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] Bot API error: ${response.status} - ${errorText}`);
      return res.status(response.status).json({ 
        error: "Failed to fetch data from game server", 
        details: errorText 
      });
    }

    const data = await response.json();
    console.log(`[API] Successfully fetched data from Bot API`);
    
    return res.json(data);

  } catch (error: any) {
    console.error("[API] Global Error in /api/mta/account:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message
    });
  }
}
