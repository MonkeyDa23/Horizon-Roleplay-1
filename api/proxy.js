
// api/proxy.js
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// --- RATE LIMITING (Using Upstash Redis for serverless compatibility) ---
// Note: If UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are not set,
// this will fail. User must provide these in Vercel settings.
let ratelimit = null;

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    ratelimit = new Ratelimit({
      redis: redis,
      limiter: Ratelimit.slidingWindow(60, "1 m"),
    });
  }
} catch (e) {
  console.error("Failed to initialize Upstash Ratelimit:", e);
}

export default async function handler(req, res) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  
  if (ratelimit) {
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return res.status(429).json({ error: 'Too Many Requests' });
    }
  }

  // Secure variable names (no VITE_ prefix on secrets)
  const botUrl = process.env.DISCORD_BOT_API_URL;
  const apiKey = process.env.API_SECRET_KEY;

  // --- SPECIAL ROUTE: DIRECT DISCORD INVITE LOOKUP ---
  if (req.url.includes('/discord-invite/')) {
    try {
      const parts = req.url.split('/discord-invite/');
      if (parts.length < 2) return res.status(400).json({ error: 'Invalid invite code' });
      const code = parts[1].split('?')[0]; 
      
      if (!/^[a-zA-Z0-9-]+$/.test(code)) {
          return res.status(400).json({ error: 'Invalid invite code format' });
      }

      const discordRes = await fetch(`https://discord.com/api/v9/invites/${code}?with_counts=true`);
      if (!discordRes.ok) return res.status(discordRes.status).json({ error: 'Discord API Error' });
      
      const data = await discordRes.json();
      return res.json({
          guild: {
              name: data.guild.name,
              id: data.guild.id,
              iconURL: data.guild.icon 
                  ? `https://cdn.discordapp.com/icons/${data.guild.id}/${data.guild.icon}.png` 
                  : null
          },
          memberCount: data.approximate_member_count,
          presenceCount: data.approximate_presence_count
      });
    } catch (e) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // --- STANDARD BOT PROXY ---
  if (!botUrl || !apiKey) {
    return res.status(500).json({ error: 'Proxy service is not configured.' });
  }

  const targetPath = req.url.replace('/api/proxy', '');
  const ALLOWED_PATHS = ['/health', '/sync-user/', '/guild-roles', '/notify', '/mta-status', '/announcements', '/discord-invite/', '/mta/account/', '/mta/unlink'];
  const isAllowed = ALLOWED_PATHS.some(p => targetPath.startsWith(p));
  if (!isAllowed) return res.status(403).json({ error: 'Forbidden' });

  try {
    const targetUrl = new URL(targetPath, botUrl);
    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
      },
      body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : null,
    });

    res.status(response.status).send(await response.text());
  } catch (error) {
    console.error(`[PROXY] Error forwarding request:`, error);
    res.status(502).json({ error: 'Bad Gateway' });
  }
}
