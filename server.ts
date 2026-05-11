import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import xss from 'xss-clean';
import crypto from 'crypto';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

if (!process.env.MTA_BOT_KEY) throw new Error('MTA_BOT_KEY required');
if (!process.env.SIGNATURE_KEY) throw new Error('SIGNATURE_KEY required');
if (!process.env.BOT_WEB_KEY) throw new Error('BOT_WEB_KEY required');

function verifySignature(payload: any, signature: string, secret: string, timestamp: string) {
  if (!signature || !secret || !timestamp) return false;
  const now = Date.now();
  const requestTime = parseInt(timestamp, 10);
  
  // 5 minute window
  if (isNaN(requestTime) || Math.abs(now - requestTime) > 300000) return false;

  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  
  // Standard HMAC-SHA256
  const expectedHMAC = crypto.createHmac('sha256', secret)
    .update(payloadStr + timestamp)
    .digest('hex');
    
  try {
    const sigBuf = Buffer.from(signature);
    return sigBuf.length === expectedHMAC.length && crypto.timingSafeEqual(sigBuf, Buffer.from(expectedHMAC));
  } catch (e) {
    return false;
  }
}

const ALLOWED_PATHS = ['/mta/account', '/mta/character', '/mta/unlink', '/mta/status', '/discord-invite', '/sync-user', '/notify'];

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.set('trust proxy', 1);

  app.use(express.json({ limit: '10kb' })); 
  app.use(express.urlencoded({ extended: false, limit: '10kb' }));

  app.use((req, res, next) => {
    res.locals.nonce = crypto.randomBytes(16).toString('base64');
    next();
  });

  app.use((req, res, next) => {
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", (req, res: any) => `'nonce-${res.locals.nonce}'`, "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          imgSrc: ["'self'", "data:", "https://cdn.discordapp.com", "https://cdn.discord.com", "https://*.supabase.co"],
          connectSrc: ["'self'", "https://*.supabase.co", "wss://*.supabase.co", "https://discord.com", "https://api.github.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      }
    })(req, res, next);
  });

  app.use(hpp());
  app.use(xss());

  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 500, 
    standardHeaders: true,
    legacyHeaders: false
  });

  app.use(globalLimiter);

  // Verification Rate Limiters
  const verificationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // 5 attempts per 15 minutes
    message: { error: 'Too many attempts, please try again later' }
  });

  app.post('/api/auth/verify-captcha', verificationLimiter, async (req, res) => {
    try {
      const { token } = req.body;
      const secret = process.env.HCAPTCHA_SECRET_KEY;
      
      if (!secret) {
        console.error('HCAPTCHA_SECRET_KEY is missing! Blocking verification.');
        return res.status(500).json({ error: 'Captcha system not configured' });
      }

      const response = await fetch('https://hcaptcha.com/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${secret}&response=${token}`
      });

      const data = await response.json();
      res.json({ success: data.success });
    } catch (e) {
      res.status(500).json({ error: 'Captcha verification failed' });
    }
  });

  app.post('/api/auth/verify-admin-password', verificationLimiter, async (req, res) => {
    const { password, captcha } = req.body;
    const adminPass = process.env.VITE_ADMIN_PASSWORD;
    
    if (!adminPass) {
      return res.status(500).json({ error: 'System not configured' });
    }

    if (!captcha) {
      return res.status(401).json({ error: 'Captcha required' });
    }

    // Verify Captcha
    const captchaSecret = process.env.HCAPTCHA_SECRET_KEY;
    const captchaRes = await fetch('https://hcaptcha.com/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${captchaSecret}&response=${captcha}`
    });
    const captchaData = await captchaRes.json();
    if (!captchaData.success) {
      return res.status(401).json({ error: 'Captcha verification failed' });
    }
    
    // Timing-safe comparison
    const { timingSafeEqual } = await import('node:crypto');
    const inputBuf = Buffer.from(password);
    const passBuf = Buffer.from(adminPass);

    if (inputBuf.length === passBuf.length && timingSafeEqual(inputBuf, passBuf)) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: 'Invalid password' });
    }
  });

  // Central Audit Logger
  const auditLogger = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Only log state-changing operations
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) return next();

    // Store original send to capture status code
    const originalSend = res.send;
    res.send = function (body) {
      const statusCode = res.statusCode;
      
      // Only log successful or relevant auth attempts (avoid flooding on generic 404s/403s maybe?)
      // For now, let's log everything but include the status code
      
      (async () => {
        let userId = 'Anonymous';
        let username = 'Anonymous';
        const authHeader = req.headers['authorization'];

        if (authHeader) {
          try {
            const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
            if (user) {
              userId = user.id;
              const { data: profile } = await supabase.from('users').select('username').eq('id', user.id).single();
              username = profile?.username || user.email || user.id;
            }
          } catch (e) {}
        }

        try {
          const sanitizedBody = { ...req.body };
          const sensitiveKeys = ['token', 'secret', 'password', 'backupCodes', 'p_codes', 'p_secret', 'code'];
          sensitiveKeys.forEach(key => { if (sanitizedBody[key]) sanitizedBody[key] = '[REDACTED]'; });

          await supabase.from('audit_logs').insert({
            user_id: userId === 'Anonymous' ? null : userId,
            username,
            action: `${req.method} ${req.originalUrl}`,
            details: {
              body: sanitizedBody,
              query: req.query,
              ip: req.socket.remoteAddress,
              status: statusCode
            },
            severity: statusCode >= 400 ? 'WARNING' : 'INFO',
            category: req.originalUrl.includes('admin') ? 'ADMIN' : 'SECURITY',
            ip_address: req.socket.remoteAddress,
            user_agent: req.headers['user-agent']
          });
        } catch (err) {
          console.error('Audit Log Sync Failure:', err);
        }
      })();

      return originalSend.apply(res, arguments as any);
    };
    next();
  };

  app.use(auditLogger);

  app.use(['/api/admin', '/api/auth/2fa', '/api/mta/internal'], async (req, res, next) => {
    const signature = req.headers['x-signature'] as string;
    const timestamp = req.headers['x-timestamp'] as string;
    const botSecret = process.env.BOT_WEB_KEY;
    
    // Always enforce signature for sensitive paths
    if (signature && botSecret && timestamp) {
      if (!verifySignature(req.body, signature, botSecret, timestamp)) {
        return res.status(401).json({ error: 'Auth Failed' });
      }
      return next();
    }

    res.status(403).json({ error: 'Signature Required' });
  });

  app.post('/api/auth/2fa/enable', async (req, res) => {
    try {
      const { secret, backupCodes, token: userToken } = req.body;
      const authHeader = req.headers['authorization'];
      const token = authHeader?.replace('Bearer ', '');
      const encryptionKey = process.env.ENCRYPTION_KEY;
      if (!encryptionKey || !token) return res.status(401).json({ error: 'Unauthorized' });

      // 1. Verify User
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

      // 2. Verify TOTP Token before enabling
      const { authenticator } = await import('otplib');
      const isValid = authenticator.verify({ token: userToken, secret });
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid verification code' });
      }

      // 3. Encrypt and Save
      const { encrypt } = await import('./lib/encryption.js');
      const encryptedSecret = encrypt(secret, encryptionKey);
      const encryptedCodes = backupCodes.map((code: string) => encrypt(code, encryptionKey));

      const { error: dbError } = await supabase.rpc('enable_2fa', { 
        p_secret: encryptedSecret, 
        p_backup_codes: encryptedCodes 
      });

      if (dbError) throw dbError;
      res.json({ success: true });
    } catch (e) { 
      console.error('2FA Enable Error:', e);
      res.status(500).json({ error: 'Internal Error' }); 
    }
  });

  app.get('/api/mta/status/:serial', async (req, res) => {
    try {
      const authHeader = req.headers['authorization'];
      if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      // Check if requested serial belongs to the user
      const { data: profile } = await supabase.from('users').select('mta_serial').eq('id', user.id).single();
      if (!profile || profile.mta_serial !== req.params.serial) {
        return res.status(403).json({ error: 'Forbidden - Serial Mismatch' });
      }

      const { data, error } = await supabase.from('users').select('mta_serial, username').eq('mta_serial', req.params.serial).single();
      if (error || !data) return res.json({ linked: false });
      res.json({ linked: true, username: data.username });
    } catch (e) { res.status(500).json({ error: 'Error' }); }
  });

  app.all('/api/proxy/*', async (req, res) => {
    const botUrl = process.env.DISCORD_BOT_API_URL;
    const apiKey = process.env.DISCORD_BOT_API_KEY;
    const signatureKey = process.env.SIGNATURE_KEY;

    if (!botUrl || !apiKey || !signatureKey) return res.status(500).json({ error: 'Error' });

    if (req.url.includes('/discord-invite/')) {
      try {
        const parts = req.url.split('/discord-invite/');
        const code = parts[1].split('?')[0];
        if (!code || !/^[a-zA-Z0-9-]+$/.test(code)) return res.status(400).json({ error: 'Invalid' });
        const discordRes = await fetch(`https://discord.com/api/v9/invites/${code}?with_counts=true`);
        const data = await discordRes.json();
        return res.json({
          guild: {
            name: data.guild.name,
            id: data.guild.id,
            iconURL: data.guild.icon ? `https://cdn.discordapp.com/icons/${data.guild.id}/${data.guild.icon}.png` : null
          },
          memberCount: data.approximate_member_count
        });
      } catch (e) { return res.status(500).json({ error: 'Error' }); }
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Login required' });

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) return res.status(401).json({ error: 'Invalid session' });

    const targetPath = '/' + req.params[0];
    const isAllowed = ALLOWED_PATHS.some(p => targetPath.startsWith(p));
    if (!isAllowed) return res.status(403).json({ error: 'Path not allowed' });

    try {
      const timestamp = Date.now().toString();
      const signature = crypto.createHmac('sha256', signatureKey).update(JSON.stringify(req.body) + timestamp).digest('hex');

      const response = await fetch(new URL('internal' + targetPath, botUrl).toString(), {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': apiKey,
          'x-signature': signature,
          'x-timestamp': timestamp
        },
        body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined,
      });

      res.status(response.status).send(await response.text());
    } catch (e) { res.status(502).json({ error: 'Bot offline' }); }
  });

  app.all('/api/mta/internal/*', async (req, res) => {
      const botKey = process.env.MTA_BOT_KEY;
      const signature = req.headers['x-signature'] as string;
      const timestamp = req.headers['x-timestamp'] as string;

      if (!verifySignature(req.body, signature, botKey!, timestamp)) return res.status(403).json({ error: 'Forbidden' });

      try {
          const botUrl = process.env.DISCORD_BOT_API_URL || 'http://localhost:3001';
          const apiKey = process.env.DISCORD_BOT_API_KEY;
          const targetPath = req.params[0];
          const targetUrl = new URL('internal/' + (targetPath || ''), botUrl).toString();
          const reqTimestamp = Date.now().toString();
          const reqSignature = crypto.createHmac('sha256', process.env.SIGNATURE_KEY!).update(JSON.stringify(req.body) + reqTimestamp).digest('hex');

          const response = await fetch(targetUrl, {
              method: req.method,
              headers: {
                  'Content-Type': 'application/json',
                  'Authorization': apiKey!,
                  'x-signature': reqSignature,
                  'x-timestamp': reqTimestamp
              },
              body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined,
          });
          res.status(response.status).send(await response.text());
      } catch (e) { res.status(502).json({ error: 'Error' }); }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`Server: ${PORT}`));
}

startServer();
