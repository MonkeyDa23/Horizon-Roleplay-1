
// api/proxy.js
// Vercel Serverless Function to proxy requests to the Discord Bot.
// This resolves mixed-content issues and keeps the API key secure.

export default async function handler(req, res) {
  // Vercel populates process.env from your project's environment variables
  const botUrl = process.env.VITE_DISCORD_BOT_URL;
  const apiKey = process.env.VITE_DISCORD_BOT_API_KEY;

  // Helper to check if string is valid URL
  const isValidUrl = (string) => {
    try { new URL(string); return true; } catch (_) { return false; }
  }

  // --- SPECIAL ROUTE: DIRECT DISCORD INVITE LOOKUP ---
  // This bypasses the bot entirely to ensure widgets work even if the bot is offline.
  // It fetches directly from Discord's public API.
  if (req.url.includes('/discord-invite/')) {
      try {
          // Extract code from URL. expecting /api/proxy/discord-invite/CODE
          const parts = req.url.split('/discord-invite/');
          if (parts.length < 2) return res.status(400).json({ error: 'Invalid invite code' });
          
          const code = parts[1].split('?')[0]; // Remove any query params
          
          const discordRes = await fetch(`https://discord.com/api/v9/invites/${code}?with_counts=true`);
          
          if (!discordRes.ok) {
              return res.status(discordRes.status).json({ 
                  error: 'Discord API Error', 
                  details: await discordRes.text() 
              });
          }
          
          const data = await discordRes.json();
          
          // Transform Discord API response to match our frontend expectation
          const transformed = {
              guild: {
                  name: data.guild.name,
                  id: data.guild.id,
                  // Construct icon URL manually since invite object gives just the hash
                  iconURL: data.guild.icon 
                      ? `https://cdn.discordapp.com/icons/${data.guild.id}/${data.guild.icon}.png` 
                      : null
              },
              memberCount: data.approximate_member_count,
              presenceCount: data.approximate_presence_count
          };
          
          return res.json(transformed);
      } catch (e) {
          console.error("[PROXY] Discord Direct Fetch Error:", e);
          return res.status(500).json({ error: 'Failed to fetch from Discord', details: e.message });
      }
  }

  // --- STANDARD BOT PROXY ---
  if (!botUrl || !apiKey) {
    console.error("Proxy Error: VITE_DISCORD_BOT_URL or VITE_DISCORD_BOT_API_KEY is not set.");
    return res.status(500).json({ error: 'Proxy service is not configured (Missing Env Vars).' });
  }

  const targetPath = req.url.replace('/api/proxy', '');
  
  let targetUrl;
  try {
      targetUrl = new URL(targetPath, botUrl);
  } catch (e) {
      return res.status(500).json({ error: `Invalid Bot URL Configuration: ${botUrl}` });
  }

  try {
    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
      },
      body: req.body ? JSON.stringify(req.body) : null,
    });

    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'content-encoding') {
        res.setHeader(key, value);
      }
    });
    
    res.status(response.status).send(await response.text());

  } catch (error) {
    console.error(`[PROXY] Error forwarding request to ${targetUrl}:`, error);
    res.status(502).json({ 
        error: 'Bad Gateway: The proxy could not connect to the bot.',
        details: error.message,
        targetUrl: targetUrl.toString()
    });
  }
}
