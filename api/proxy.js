const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS = 60;

export default async function handler(req, res) {
  // --- Secure Session Check (Anti-Bot) ---
  const cookies = req.headers.cookie || '';
  if (!cookies.includes('vixel_secure_session=')) {
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

  const botUrl = process.env.DISCORD_BOT_API_URL;
  const apiKey = process.env.DISCORD_BOT_API_KEY;

  if (req.url.includes('/discord-invite/')) {
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

  if (!botUrl || !apiKey) return res.status(500).json({ error: 'Proxy misconfigured' });

  const targetPath = req.url.replace('/api/proxy', '');
  const ALLOWED_PATHS = ['/health', '/sync-user/', '/guild-roles', '/notify', '/mta-status', '/announcements', '/discord-invite/', '/mta/account/', '/mta/unlink'];
  const isAllowed = ALLOWED_PATHS.some(p => targetPath.startsWith(p));
  if (!isAllowed) return res.status(403).json({ error: 'Forbidden' });

  let targetUrl;
  try {
      targetUrl = new URL(targetPath, botUrl);
      const botBase = new URL(botUrl);
      if (targetUrl.origin !== botBase.origin) return res.status(403).json({ error: 'Forbidden' });
  } catch (e) { return res.status(500).json({ error: `Invalid URL` }); }

  try {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
    };
    if (req.headers['x-signature']) headers['x-signature'] = req.headers['x-signature'];
    if (req.headers['x-timestamp']) headers['x-timestamp'] = req.headers['x-timestamp'];

    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers,
      body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : null,
    });

    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'content-encoding') res.setHeader(key, value);
    });
    res.status(response.status).send(await response.text());
  } catch (error) { res.status(502).json({ error: 'Bad Gateway' }); }
}
