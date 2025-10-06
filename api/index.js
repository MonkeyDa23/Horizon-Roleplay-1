import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { EmbedBuilder } from 'discord.js';
import { URLSearchParams } from 'url';
import { kv } from '@vercel/kv';

const seedInitialData = async () => {
  const isSeeded = await kv.get('db_seeded_v2');
  if (isSeeded) return;

  console.log("Database not seeded. Seeding initial data...");

  const initialProducts = [
    { id: 'prod_001', nameKey: 'product_vip_bronze_name', descriptionKey: 'product_vip_bronze_desc', price: 9.99, imageUrl: 'https://picsum.photos/seed/vip_bronze/400/300' },
    { id: 'prod_002', nameKey: 'product_vip_silver_name', descriptionKey: 'product_vip_silver_desc', price: 19.99, imageUrl: 'https://picsum.photos/seed/vip_silver/400/300' },
  ];
  const initialRules = [
    { id: 'cat_general', titleKey: 'rules_general_title', rules: [{ id: 'rule_gen_1', textKey: 'rule_general_1' },{ id: 'rule_gen_2', textKey: 'rule_general_2' }] },
  ];
  const initialQuizzes = [
    { id: 'quiz_police_dept', titleKey: 'quiz_police_name', descriptionKey: 'quiz_police_desc', isOpen: true, questions: [{ id: 'q1_police', textKey: 'q_police_1', timeLimit: 60 }, { id: 'q2_police', textKey: 'q_police_2', timeLimit: 90 }] },
  ];

  await Promise.all([
    kv.set('products', initialProducts),
    kv.set('rules', initialRules),
    kv.set('quizzes', initialQuizzes),
    kv.set('submissions', []),
    kv.set('auditLogs', []),
    kv.set('db_seeded_v2', true)
  ]);
  console.log('Database seeded successfully.');
};

const getAppUrl = () => {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, ''); 
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:5173';
};

async function getRuntimeConfig() {
    return {
        COMMUNITY_NAME: process.env.COMMUNITY_NAME || 'Horizon',
        LOGO_URL: process.env.LOGO_URL || 'https://l.top4top.io/p_356271n1v1.png',
        DISCORD_INVITE_URL: process.env.DISCORD_INVITE_URL || '',
        MTA_SERVER_URL: process.env.MTA_SERVER_URL || '',
        DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
        DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
        DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
        DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
        ADMIN_ROLE_IDS: (process.env.ADMIN_ROLE_IDS || '').split(',').filter(Boolean),
        DISCORD_ADMIN_NOTIFY_CHANNEL_ID: process.env.DISCORD_ADMIN_NOTIFY_CHANNEL_ID,
        DISCORD_LOG_CHANNEL_ID: process.env.DISCORD_LOG_CHANNEL_ID,
        APP_URL: getAppUrl(),
    };
}

const memberCache = new Map();
const rolesCache = { roles: null, timestamp: 0 };
const CACHE_TTL_MS = { MEMBER: 60 * 1000, ROLES: 5 * 60 * 1000 };

const getDiscordApi = (token) => axios.create({
    baseURL: 'https://discord.com/api/v10',
    headers: { 'Authorization': `Bot ${token}` }
});

async function getGuildRoles(config) {
    const now = Date.now();
    if (rolesCache.roles && (now - rolesCache.timestamp < CACHE_TTL_MS.ROLES)) return rolesCache.roles;
    const { data } = await getDiscordApi(config.DISCORD_BOT_TOKEN).get(`/guilds/${config.DISCORD_GUILD_ID}/roles`);
    rolesCache.roles = data.sort((a, b) => b.position - a.position);
    rolesCache.timestamp = now;
    return rolesCache.roles;
}

async function getGuildMember(userId, config) {
    const now = Date.now();
    if (memberCache.has(userId)) {
        const cached = memberCache.get(userId);
        if (now - cached.timestamp < CACHE_TTL_MS.MEMBER) return cached.data;
    }
    const { data } = await getDiscordApi(config.DISCORD_BOT_TOKEN).get(`/guilds/${config.DISCORD_GUILD_ID}/members/${userId}`);
    memberCache.set(userId, { data, timestamp: now });
    return data;
}

const addAuditLog = async (admin, action) => {
  const logs = await kv.get('auditLogs') || [];
  logs.unshift({ id: `log_${Date.now()}`, adminId: admin.id, adminUsername: admin.username, timestamp: new Date().toISOString(), action });
  await kv.set('auditLogs', logs.slice(0, 100)); // Keep last 100 logs
};

const app = express();
app.use(cors());
app.use(express.json());

seedInitialData().catch(console.error);

const verifyAdmin = async (req, res, next) => {
  const admin = req.body.admin || req.body.user;
  if (!admin || !admin.id) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const config = await getRuntimeConfig();
    const member = await getGuildMember(admin.id, config);
    if (!member.roles.some(roleId => config.ADMIN_ROLE_IDS.includes(roleId))) {
        return res.status(403).json({ message: 'Forbidden' });
    }
    req.adminUser = { id: member.user.id, username: member.user.global_name || member.user.username };
    next();
  } catch (error) {
    console.error("Admin verification failed:", error.response?.data || error.message);
    if (error.response?.status === 404) return res.status(403).json({ message: 'Forbidden: User not found in guild.' });
    return res.status(500).json({ message: 'Could not contact Discord.' });
  }
};

// PUBLIC CONFIG ENDPOINT
app.get('/api/config', async (req, res) => {
    const config = await getRuntimeConfig();
    res.json({
        COMMUNITY_NAME: config.COMMUNITY_NAME,
        LOGO_URL: config.LOGO_URL,
        DISCORD_INVITE_URL: config.DISCORD_INVITE_URL,
        MTA_SERVER_URL: config.MTA_SERVER_URL,
        DISCORD_CLIENT_ID: config.DISCORD_CLIENT_ID,
        DISCORD_GUILD_ID: config.DISCORD_GUILD_ID,
    });
});

// DATA API (Read-only)
app.get('/api/products', async (_, res) => res.json(await kv.get('products') ?? []));
app.get('/api/rules', async (_, res) => res.json(await kv.get('rules') ?? []));
app.get('/api/quizzes', async (_, res) => res.json(await kv.get('quizzes') ?? []));
app.get('/api/quizzes/:id', async (req, res) => res.json((await kv.get('quizzes') ?? []).find(q => q.id === req.params.id)));
app.get('/api/submissions', async (_, res) => res.json((await kv.get('submissions') ?? []).sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt))));
app.get('/api/users/:userId/submissions', async (req, res) => res.json((await kv.get('submissions') ?? []).filter(s => s.userId === req.params.userId)));

// MTA STATUS
app.get('/api/mta-status', async (_, res) => {
    try {
        const config = await getRuntimeConfig();
        // This is a mock. Replace with a real query to your MTA server if possible.
        res.json({ name: `${config.COMMUNITY_NAME} | Roleplay`, players: Math.floor(Math.random() * 50) + 20, maxPlayers: 150 });
    } catch (e) { res.status(503).json({ message: 'Server offline' }); }
});


// ADMIN READ API
app.get('/api/audit-logs', async (_, res) => res.json(await kv.get('auditLogs') ?? []));


// ADMIN WRITE API
app.post('/api/products', verifyAdmin, async (req, res) => {
    const { product } = req.body;
    const products = await kv.get('products') ?? [];
    if (product.id) {
        const index = products.findIndex(p => p.id === product.id);
        products[index] = product;
        await addAuditLog(req.adminUser, `Updated product: "${product.nameKey}"`);
    } else {
        product.id = `prod_${Date.now()}`;
        products.push(product);
        await addAuditLog(req.adminUser, `Created product: "${product.nameKey}"`);
    }
    await kv.set('products', products);
    res.status(200).json(product);
});
app.delete('/api/products/:id', verifyAdmin, async (req, res) => {
    let products = await kv.get('products') ?? [];
    const product = products.find(p => p.id === req.params.id);
    if (product) {
        await addAuditLog(req.adminUser, `Deleted product: "${product.nameKey}"`);
        await kv.set('products', products.filter(p => p.id !== req.params.id));
    }
    res.status(204).send();
});

app.post('/api/rules', verifyAdmin, async (req, res) => {
    await kv.set('rules', req.body.rules);
    await addAuditLog(req.adminUser, `Updated the server rules.`);
    res.status(200).json(req.body.rules);
});

app.post('/api/quizzes', verifyAdmin, async (req, res) => {
    const { quiz } = req.body;
    const quizzes = await kv.get('quizzes') ?? [];
    if (quiz.id) {
        quizzes[quizzes.findIndex(q => q.id === quiz.id)] = quiz;
        await addAuditLog(req.adminUser, `Updated quiz: "${quiz.titleKey}"`);
    } else {
        quiz.id = `quiz_${Date.now()}`;
        quizzes.push(quiz);
        await addAuditLog(req.adminUser, `Created quiz: "${quiz.titleKey}"`);
    }
    await kv.set('quizzes', quizzes);
    res.status(200).json(quiz);
});

app.delete('/api/quizzes/:id', verifyAdmin, async (req, res) => {
    const quizzes = await kv.get('quizzes') ?? [];
    const quiz = quizzes.find(q => q.id === req.params.id);
    if(quiz) {
        await addAuditLog(req.adminUser, `Deleted quiz: "${quiz.titleKey}"`);
        await kv.set('quizzes', quizzes.filter(q => q.id !== req.params.id));
    }
    res.status(204).send();
});

// SUBMISSIONS & NOTIFICATIONS
app.post('/api/submissions', async (req, res) => {
  const newSubmission = { ...req.body, id: `sub_${Date.now()}`, status: 'pending' };
  const submissions = await kv.get('submissions') ?? [];
  await kv.set('submissions', [...submissions, newSubmission]);
  // Discord notifications can be added here if needed
  res.status(201).json(newSubmission);
});

app.put('/api/submissions/:id/status', verifyAdmin, async (req, res) => {
    const submissions = await kv.get('submissions') ?? [];
    const subIndex = submissions.findIndex(s => s.id === req.params.id);
    if (subIndex === -1) return res.status(404).json({ message: 'Submission not found' });
    
    submissions[subIndex].status = req.body.status;
    submissions[subIndex].adminId = req.adminUser.id;
    submissions[subIndex].adminUsername = req.adminUser.username;
    
    await kv.set('submissions', submissions);
    // Discord notifications can be added here
    res.json(submissions[subIndex]);
});


// AUTHENTICATION
app.post('/api/auth/session', async (req, res) => {
  try {
    const config = await getRuntimeConfig();
    const { user } = req.body;
    if (!user || !user.id) return res.status(400).json({ message: 'User ID is required.' });

    const [member, guildRoles] = await Promise.all([ getGuildMember(user.id, config), getGuildRoles(config) ]);
    const primaryRole = guildRoles.find(gr => member.roles.includes(gr.id)) || null;

    const freshUser = {
        id: member.user.id,
        username: member.user.global_name || member.user.username,
        avatar: member.avatar ? `https://cdn.discordapp.com/guilds/${config.DISCORD_GUILD_ID}/users/${member.user.id}/avatars/${member.avatar}.png` : (member.user.avatar ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${(parseInt(member.user.id.slice(-1))) % 5}.png`),
        isAdmin: member.roles.some(roleId => config.ADMIN_ROLE_IDS.includes(roleId)),
        primaryRole: primaryRole ? { id: primaryRole.id, name: primaryRole.name, color: `#${parseInt(primaryRole.color).toString(16).padStart(6, '0')}` } : null,
    };
    res.status(200).json(freshUser);
  } catch (error) {
      if (error.response?.status === 404) return res.status(404).json({ message: 'User not found in the Discord server.' });
      res.status(500).json({ message: 'Server error during session validation.' });
  }
});

app.get('/api/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  const config = await getRuntimeConfig();
  const redirectUrl = `${config.APP_URL}/auth/callback`;

  try {
    if (!code) throw new Error(req.query.error_description || "Authorization denied by user.");
    
    const { data: tokenData } = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({ client_id: config.DISCORD_CLIENT_ID, client_secret: config.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: `${config.APP_URL}/api/auth/callback` }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const { data: userData } = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
    
    const userJson = JSON.stringify({ id: userData.id, username: userData.global_name || userData.username, avatar: userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${(parseInt(userData.id.slice(-1))) % 5}.png`});
    const base64User = Buffer.from(userJson).toString('base64');
    
    res.redirect(`${redirectUrl}?user=${base64User}&state=${state}`);
  } catch (error) {
    const errorMsg = error.response?.data?.error_description || error.message || 'Unknown server error.';
    res.redirect(`${redirectUrl}?error=${encodeURIComponent(errorMsg)}&state=${state}`);
  }
});

// HEALTH CHECK
app.get('/api/health', async (_, res) => {
    const config = await getRuntimeConfig();
    const checks = {
        env: {
            DISCORD_CLIENT_ID: config.DISCORD_CLIENT_ID ? '✅ Set' : '❌ Missing',
            DISCORD_CLIENT_SECRET: config.DISCORD_CLIENT_SECRET ? '✅ Set' : '❌ Missing',
            DISCORD_BOT_TOKEN: config.DISCORD_BOT_TOKEN ? '✅ Set' : '❌ Missing',
            DISCORD_GUILD_ID: config.DISCORD_GUILD_ID ? '✅ Set' : '❌ Missing',
            ADMIN_ROLE_IDS: config.ADMIN_ROLE_IDS.length > 0 ? '✅ Set' : '⚠️ Not Set',
        },
        bot: { status: 'Not Checked', error: null },
        urls: { app_url: config.APP_URL, redirect_uri: `${config.APP_URL}/api/auth/callback` },
    };

    if (config.DISCORD_BOT_TOKEN) {
        try {
            const { data: botUser } = await getDiscordApi(config.DISCORD_BOT_TOKEN).get('/users/@me');
            checks.bot.status = `✅ Logged in as ${botUser.username}`;
        } catch(e) {
            checks.bot.status = '❌ Login Failed';
            checks.bot.error = e.response?.data?.message || e.message;
        }
    } else {
        checks.bot.status = '❌ Token Missing';
    }
    res.json(checks);
});

export default app;
