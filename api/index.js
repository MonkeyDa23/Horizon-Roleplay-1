import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { URLSearchParams } from 'url';
import { kv } from '@vercel/kv';

const seedInitialData = async () => {
  const isSeeded = await kv.get('db_seeded_v3'); // Increment version to allow reseeding if schema changes
  if (isSeeded) return;

  console.log("Database not seeded or old version. Seeding initial data...");

  const initialProducts = [
    { id: 'prod_001', nameKey: 'product_vip_bronze_name', descriptionKey: 'product_vip_bronze_desc', price: 9.99, imageUrl: 'https://picsum.photos/seed/vip_bronze/400/300' },
    { id: 'prod_002', nameKey: 'product_vip_silver_name', descriptionKey: 'product_vip_silver_desc', price: 19.99, imageUrl: 'https://picsum.photos/seed/vip_silver/400/300' },
  ];
  const initialRules = [
    { id: 'cat_general', titleKey: 'rules_general_title', rules: [{ id: 'rule_gen_1', textKey: 'rule_general_1' },{ id: 'rule_gen_2', textKey: 'rule_general_2' }] },
    { id: 'cat_rp', titleKey: 'rules_rp_title', rules: [{ id: 'rule_rp_1', textKey: 'rule_rp_1' }] },
  ];
  const initialQuizzes = [
    { id: 'quiz_police_dept', titleKey: 'quiz_police_name', descriptionKey: 'quiz_police_desc', isOpen: true, questions: [{ id: 'q1_police', textKey: 'q_police_1', timeLimit: 60 }, { id: 'q2_police', textKey: 'q_police_2', timeLimit: 90 }], allowedTakeRoles: [] },
  ];

  await Promise.all([
    kv.set('products', initialProducts),
    kv.set('rules', initialRules),
    kv.set('quizzes', initialQuizzes),
    kv.set('submissions', []),
    kv.set('auditLogs', []),
    kv.set('db_seeded_v3', true)
  ]);
  console.log('Database seeded successfully.');
};

const getAppUrl = () => {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, ''); 
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:5173';
};

async function getRuntimeConfig() {
    const superAdminRoles = (process.env.SUPER_ADMIN_ROLE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    const handlerRoles = (process.env.HANDLER_ROLE_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
    
    return {
        COMMUNITY_NAME: process.env.COMMUNITY_NAME || 'Horizon',
        LOGO_URL: process.env.LOGO_URL || 'https://l.top4top.io/p_356271n1v1.png',
        DISCORD_INVITE_URL: process.env.DISCORD_INVITE_URL || '',
        MTA_SERVER_URL: process.env.MTA_SERVER_URL || '',
        DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
        DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
        DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
        DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
        SUPER_ADMIN_ROLE_IDS: superAdminRoles,
        HANDLER_ROLE_IDS: handlerRoles,
        ALL_ADMIN_ROLE_IDS: [...new Set([...superAdminRoles, ...handlerRoles])], // Combined for general access
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
    if (!config.DISCORD_GUILD_ID) return [];
    const now = Date.now();
    if (rolesCache.roles && (now - rolesCache.timestamp < CACHE_TTL_MS.ROLES)) return rolesCache.roles;
    const { data } = await getDiscordApi(config.DISCORD_BOT_TOKEN).get(`/guilds/${config.DISCORD_GUILD_ID}/roles`);
    rolesCache.roles = data.sort((a, b) => b.position - a.position);
    rolesCache.timestamp = now;
    return rolesCache.roles;
}

async function getGuildMember(userId, config) {
    if (!config.DISCORD_GUILD_ID) throw new Error("DISCORD_GUILD_ID is not configured.");
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
  await kv.set('auditLogs', logs.slice(0, 100));
};

const app = express();
app.use(cors());
app.use(express.json());

seedInitialData().catch(console.error);

// Middleware to verify if user has ANY admin role
const verifyAdmin = async (req, res, next) => {
  const admin = req.body.admin || req.body.user;
  if (!admin || !admin.id) return res.status(401).json({ message: 'Unauthorized: Missing user identity.' });
  try {
    const config = await getRuntimeConfig();
    if (config.ALL_ADMIN_ROLE_IDS.length === 0) return res.status(403).json({ message: 'Forbidden: No admin roles configured on server.' });
    
    const member = await getGuildMember(admin.id, config);
    const userRoles = member.roles;
    
    if (!userRoles.some(roleId => config.ALL_ADMIN_ROLE_IDS.includes(roleId))) {
        return res.status(403).json({ message: 'Forbidden: You do not have an admin role.' });
    }
    
    req.adminUser = { id: member.user.id, username: member.user.global_name || member.user.username, roles: userRoles };
    next();
  } catch (error) {
    console.error("Admin verification failed:", error.response?.data || error.message);
    if (error.response?.status === 404) return res.status(403).json({ message: 'Forbidden: User not found in guild.' });
    return res.status(500).json({ message: 'Could not contact Discord API.' });
  }
};

// Middleware to verify if user has SUPER admin role
const verifySuperAdmin = async (req, res, next) => {
    try {
        const config = await getRuntimeConfig();
        if (config.SUPER_ADMIN_ROLE_IDS.length === 0) return res.status(403).json({ message: 'Forbidden: No super admin roles configured.' });
        
        if (!req.adminUser || !req.adminUser.roles.some(roleId => config.SUPER_ADMIN_ROLE_IDS.includes(roleId))) {
             return res.status(403).json({ message: 'Forbidden: Super admin privileges required.' });
        }
        next();
    } catch (error) {
        res.status(500).json({ message: 'Error checking super admin status.' });
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
        SUPER_ADMIN_ROLE_IDS: config.SUPER_ADMIN_ROLE_IDS, // Expose this for frontend UI logic
    });
});

// AUTHENTICATION & SESSION
app.get('/api/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  const config = await getRuntimeConfig();
  const redirectUrl = `${config.APP_URL}/auth/callback`;

  try {
    if (!code) throw new Error(req.query.error_description || "Authorization denied by user.");
    
    const { data: tokenData } = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({ client_id: config.DISCORD_CLIENT_ID, client_secret: config.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: `${config.APP_URL}/api/auth/callback` }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const { data: userData } = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
    
    // For the initial login, we only store basic info. Full info is fetched on session revalidation.
    const userJson = JSON.stringify({ id: userData.id, username: userData.global_name || userData.username, avatar: userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${(parseInt(userData.id.slice(-1))) % 5}.png`});
    const base64User = Buffer.from(userJson).toString('base64');
    
    res.redirect(`${redirectUrl}?user=${base64User}&state=${state}`);
  } catch (error) {
    const errorMsg = error.response?.data?.error_description || error.message || 'Unknown server error.';
    console.error("Auth Callback Error:", error.response?.data || error);
    res.redirect(`${redirectUrl}?error=${encodeURIComponent(errorMsg)}&state=${state}`);
  }
});

app.post('/api/auth/session', async (req, res) => {
  try {
    const config = await getRuntimeConfig();
    const { user } = req.body;
    if (!user || !user.id) return res.status(400).json({ message: 'User ID is required.' });

    const [member, guildRoles] = await Promise.all([ getGuildMember(user.id, config), getGuildRoles(config) ]);
    const userRoles = member.roles;
    const primaryRole = guildRoles.find(gr => userRoles.includes(gr.id)) || null;

    const freshUser = {
        id: member.user.id,
        username: member.user.global_name || member.user.username,
        avatar: member.avatar ? `https://cdn.discordapp.com/guilds/${config.DISCORD_GUILD_ID}/users/${member.user.id}/avatars/${member.avatar}.png` : (member.user.avatar ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${(parseInt(member.user.id.slice(-1))) % 5}.png`),
        isAdmin: userRoles.some(roleId => config.ALL_ADMIN_ROLE_IDS.includes(roleId)),
        roles: userRoles,
        primaryRole: primaryRole ? { id: primaryRole.id, name: primaryRole.name, color: `#${parseInt(primaryRole.color).toString(16).padStart(6, '0')}` } : null,
    };
    res.status(200).json(freshUser);
  } catch (error) {
      console.error("Session revalidation error:", error.response?.data || error.message);
      if (error.response?.status === 404) return res.status(404).json({ message: 'User not found in the Discord server.' });
      res.status(500).json({ message: 'Server error during session validation.' });
  }
});

// GENERAL READ API
app.get('/api/products', async (_, res) => res.json(await kv.get('products') ?? []));
app.get('/api/rules', async (_, res) => res.json(await kv.get('rules') ?? []));
app.get('/api/quizzes', async (_, res) => res.json(await kv.get('quizzes') ?? []));
app.get('/api/quizzes/:id', async (req, res) => {
    const quizzes = await kv.get('quizzes') ?? [];
    const quiz = quizzes.find(q => q.id === req.params.id);
    if (quiz) res.json(quiz);
    else res.status(404).json({ message: "Quiz not found" });
});

app.get('/api/mta-status', async (_, res) => {
    // This is a mock implementation. For a real server, you would query
    // the MTA-SA server query port (usually UDP port `your_server_port + 123`).
    // Libraries like 'gamedig' for Node.js can do this.
    try {
        if (Math.random() < 0.1) { // 10% chance of being offline for simulation
          throw new Error("Server is offline");
        }
        const players = 80 + Math.floor(Math.random() * 40); // 80-120 players
        const maxPlayers = 200;
        const config = await getRuntimeConfig();

        res.json({
            name: `${config.COMMUNITY_NAME} Roleplay | Your Story Begins`,
            players,
            maxPlayers,
        });
    } catch(e) {
        res.status(503).json({ message: e.message });
    }
});


app.get('/api/submissions', async (_, res) => res.json((await kv.get('submissions') ?? []).sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt))));
app.get('/api/users/:userId/submissions', async (req, res) => res.json((await kv.get('submissions') ?? []).filter(s => s.userId === req.params.userId).sort((a,b) => new Date(b.submittedAt) - new Date(a.submittedAt))));

app.post('/api/submissions', async (req, res) => {
  const newSubmission = { ...req.body, id: `sub_${Date.now()}`, status: 'pending' };
  const submissions = await kv.get('submissions') ?? [];
  await kv.set('submissions', [...submissions, newSubmission]);
  res.status(201).json(newSubmission);
});

// ADMIN-ONLY ROUTES
const adminRouter = express.Router();
adminRouter.use(verifyAdmin);

adminRouter.post('/log-access', async(req, res) => {
    await addAuditLog(req.adminUser, 'Accessed the admin panel.');
    res.status(204).send();
});

adminRouter.get('/audit-logs', verifySuperAdmin, async (_, res) => res.json(await kv.get('auditLogs') ?? []));

adminRouter.put('/submissions/:id/status', async (req, res) => {
    const submissions = await kv.get('submissions') ?? [];
    const subIndex = submissions.findIndex(s => s.id === req.params.id);
    if (subIndex === -1) return res.status(404).json({ message: 'Submission not found' });
    
    // Permission check for 'take' action
    if (req.body.status === 'taken') {
        const quizzes = await kv.get('quizzes') ?? [];
        const quiz = quizzes.find(q => q.id === submissions[subIndex].quizId);
        const allowedRoles = quiz?.allowedTakeRoles;
        if (allowedRoles && allowedRoles.length > 0 && !req.adminUser.roles.some(r => allowedRoles.includes(r))) {
            return res.status(403).json({ message: "You don't have the required role to take this submission." });
        }
    }

    submissions[subIndex].status = req.body.status;
    submissions[subIndex].adminId = req.adminUser.id;
    submissions[subIndex].adminUsername = req.adminUser.username;
    
    await kv.set('submissions', submissions);
    await addAuditLog(req.adminUser, `Updated submission ${submissions[subIndex].id} for ${submissions[subIndex].username} to "${req.body.status}"`);
    res.json(submissions[subIndex]);
});

// SUPER-ADMIN ONLY ROUTES
adminRouter.post('/products', verifySuperAdmin, async (req, res) => {
    const { product } = req.body;
    const products = await kv.get('products') ?? [];
    const existingIndex = products.findIndex(p => p.id === product.id);

    if (existingIndex !== -1) {
        products[existingIndex] = product;
        await addAuditLog(req.adminUser, `Updated product: "${product.nameKey}"`);
    } else {
        product.id = `prod_${Date.now()}`;
        products.push(product);
        await addAuditLog(req.adminUser, `Created product: "${product.nameKey}"`);
    }
    await kv.set('products', products);
    res.status(200).json(product);
});
adminRouter.delete('/products/:id', verifySuperAdmin, async (req, res) => {
    let products = await kv.get('products') ?? [];
    const product = products.find(p => p.id === req.params.id);
    if (product) {
        await addAuditLog(req.adminUser, `Deleted product: "${product.nameKey}"`);
        await kv.set('products', products.filter(p => p.id !== req.params.id));
    }
    res.status(204).send();
});
adminRouter.post('/rules', verifySuperAdmin, async (req, res) => { await kv.set('rules', req.body.rules); await addAuditLog(req.adminUser, `Updated the server rules.`); res.status(200).json(req.body.rules); });
adminRouter.post('/quizzes', verifySuperAdmin, async (req, res) => {
    const { quiz } = req.body;
    const quizzes = await kv.get('quizzes') ?? [];
    const existingIndex = quizzes.findIndex(q => q.id === quiz.id);

    if (existingIndex !== -1) {
        quizzes[existingIndex] = quiz;
        await addAuditLog(req.adminUser, `Updated quiz: "${quiz.titleKey}"`);
    } else {
        quiz.id = `quiz_${Date.now()}`;
        quizzes.push(quiz);
        await addAuditLog(req.adminUser, `Created quiz: "${quiz.titleKey}"`);
    }
    await kv.set('quizzes', quizzes);
    res.status(200).json(quiz);
});
adminRouter.delete('/quizzes/:id', verifySuperAdmin, async (req, res) => {
    const quizzes = await kv.get('quizzes') ?? [];
    const quiz = quizzes.find(q => q.id === req.params.id);
    if(quiz) {
        await addAuditLog(req.adminUser, `Deleted quiz: "${quiz.titleKey}"`);
        await kv.set('quizzes', quizzes.filter(q => q.id !== req.params.id));
    }
    res.status(204).send();
});

app.use('/api/admin', adminRouter);

// HEALTH CHECK
app.get('/api/health', async (_, res) => {
    const config = await getRuntimeConfig();
    const checks = {
        env: {
            DISCORD_CLIENT_ID: config.DISCORD_CLIENT_ID ? '✅ Set' : '❌ Missing',
            DISCORD_CLIENT_SECRET: config.DISCORD_CLIENT_SECRET ? '✅ Set' : '❌ Missing',
            DISCORD_BOT_TOKEN: config.DISCORD_BOT_TOKEN ? '✅ Set' : '❌ Missing',
            DISCORD_GUILD_ID: config.DISCORD_GUILD_ID ? '✅ Set' : '❌ Missing',
            SUPER_ADMIN_ROLE_IDS: config.SUPER_ADMIN_ROLE_IDS.length > 0 ? '✅ Set' : '⚠️ Not Set (No one can manage quizzes/rules)',
            HANDLER_ROLE_IDS: config.HANDLER_ROLE_IDS.length > 0 ? '✅ Set' : '⚠️ Not Set (Only Super Admins can handle submissions)',
        },
        bot: { status: 'Not Checked', error: null, guild_found: false, guild_name: null },
        urls: { app_url: config.APP_URL, redirect_uri: `${config.APP_URL}/api/auth/callback` },
    };
    let hasError = !Object.values(checks.env).every(v => v.startsWith('✅'));

    if (config.DISCORD_BOT_TOKEN) {
        try {
            const { data: botUser } = await getDiscordApi(config.DISCORD_BOT_TOKEN).get('/users/@me');
            checks.bot.status = `✅ Logged in as ${botUser.username}`;
            if (config.DISCORD_GUILD_ID) {
                const { data: guild } = await getDiscordApi(config.DISCORD_BOT_TOKEN).get(`/guilds/${config.DISCORD_GUILD_ID}`);
                checks.bot.guild_found = true;
                checks.bot.guild_name = guild.name;
            } else {
                 checks.bot.guild_name = '❌ Guild ID not set';
                 hasError = true;
            }
        } catch(e) {
            checks.bot.status = '❌ Login Failed';
            checks.bot.error = e.response?.data?.message || e.message;
            if(e.response?.data?.message.includes("Missing Access")) checks.bot.error += " (Ensure bot has 'applications.commands' scope and is invited to the server)";
            hasError = true;
        }
    } else {
        checks.bot.status = '❌ Token Missing';
        hasError = true;
    }
    res.status(hasError ? 500 : 200).json(checks);
});

export default app;
