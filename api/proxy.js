import crypto from 'node:crypto';

const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS = 60;

export default async function handler(req, res) {
  // --- Secure Session Check (Anti-Bot) ---
  const cookies = req.headers.cookie || '';
  // السماح بمرور الكوكيز من Supabase أيضاً لضمان العمل
  const hasValidSession = cookies.includes('vixel_secure_session=') || cookies.includes('sb-') || cookies.includes('supabase-auth-token');
  
  if (!hasValidSession && process.env.NODE_ENV === 'production') {
       return res.status(403).json({ error: 'Missing secure session. Complete Captcha first.' });
  }

  const ip = req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const userLimit = rateLimits.get(ip) || { count: 0, resetTime: now + RATE_LIMIT_WINDOW };

  if (now > userLimit.resetTime) {
    userLimit.count = 1;
    userLimit.resetTime = now + RATE_LIMIT_WINDOW;
  } else {
    userLimit.count++;
  }
  rateLimits.set(ip, userLimit);

  if (userLimit.count > MAX_REQUESTS) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const botUrl = process.env.DISCORD_BOT_API_URL || process.env.VITE_DISCORD_BOT_API_URL;
  const apiKey = process.env.API_SECRET_KEY || process.env.DISCORD_BOT_API_KEY;
  const signatureKey = process.env.SIGNATURE_KEY;

  if (req.url.includes('/discord-invite/')) {
    // ... invite logic ...
    try {
        const referer = req.headers.referer || '';
        const host = req.headers.host || '';
        if (process.env.NODE_ENV === 'production' && !referer.includes(host)) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        const parts = req.url.split('/discord-invite/');
        if (parts.length < 2) return res.status(400).json({ error: 'Invalid' });
        const code = parts[1].split('?')[0];
        if (!/^[a-zA-Z0-9-]+$/.test(code)) return res.status(400).json({ error: 'Invalid format' });
        const discordRes = await fetch(`https://discord.com/api/v9/invites/${code}?with_counts=true`);
        if (!discordRes.ok) return res.status(discordRes.status).json({ error: 'Discord Error' });
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
    } catch (e) { return res.status(500).json({ error: 'Error' }); }
  }

  if (!botUrl || !apiKey) return res.status(500).json({ error: 'Proxy misconfigured. Need DISCORD_BOT_API_URL and API_SECRET_KEY.' });

  const targetPath = req.url.replace('/api/proxy', '');
  const ALLOWED_PATHS = ['/health', '/sync-user/', '/guild-roles', '/notify', '/mta-status', '/announcements', '/discord-invite/', '/mta/account/', '/mta/unlink'];
  const isAllowed = ALLOWED_PATHS.some(p => targetPath.startsWith(p));
  if (!isAllowed) return res.status(403).json({ error: 'Forbidden path' });

  let targetUrl;
  try {
      targetUrl = new URL(targetPath, botUrl);
  } catch (e) { return res.status(500).json({ error: `Invalid URL` }); }

  try {
    const timestamp = Date.now().toString();
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
        'x-timestamp': timestamp
    };

    const method = req.method;
    let body = null;
    
    if (['POST', 'PUT', 'PATCH'].includes(method) && req.body) {
        // Use a consistent stringification
        body = JSON.stringify(req.body);
    }

    if (signatureKey) {
        // Enforce consistent payload matching the bot's expectation
        // Use empty string for GET requests or empty bodies
        const payload = body || ''; 
        const signature = crypto.createHmac('sha256', signatureKey)
            .update(payload + timestamp)
            .digest('hex');
        headers['x-signature'] = signature;
    }

    const response = await fetch(targetUrl.toString(), {
      method: method,
      headers,
      body: body || null,
    });

    const responseText = await response.text();
    
    // Copy safe headers from response
    const SAFE_HEADERS = ['content-type', 'cache-control'];
    response.headers.forEach((value, key) => {
      if (SAFE_HEADERS.includes(key.toLowerCase())) {
          res.setHeader(key, value);
      }
    });

    res.status(response.status).send(responseText);
  } catch (error) { 
      console.error('[Proxy Error]', error);
      res.status(502).json({ error: 'Bad Gateway' }); 
  }
}
