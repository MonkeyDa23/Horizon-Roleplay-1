import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { URLSearchParams } from 'url';
import { supabase } from './supabaseClient.js';

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
  const { error } = await supabase.from('audit_logs').insert({
    adminId: admin.id,
    adminUsername: admin.username,
    action,
  });
  if (error) console.error('Failed to add audit log:', error);
};

const app = express();
app.use(cors());
app.use(express.json());

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
app.get('/api/products', async (_, res) => {
    const { data, error } = await supabase.from('products').select('*');
    if (error) return res.status(500).json({ message: error.message });
    res.json(data ?? []);
});

app.get('/api/rules', async (_, res) => {
    // Assumes tables `rules_categories` and `rules` with a foreign key.
    const { data, error } = await supabase.from('rules_categories').select('*, rules(*)');
    if (error) return res.status(500).json({ message: error.message });
    res.json(data ?? []);
});

app.get('/api/quizzes', async (_, res) => {
    // Assumes tables `quizzes` and `quiz_questions` with a foreign key.
    const { data, error } = await supabase.from('quizzes').select('*, quiz_questions(*)');
    if (error) return res.status(500).json({ message: error.message });
    // Rename `quiz_questions` to `questions` for frontend compatibility
    const quizzes = data.map(q => ({ ...q, questions: q.quiz_questions, quiz_questions: undefined }));
    res.json(quizzes ?? []);
});

app.get('/api/quizzes/:id', async (req, res) => {
    const { data, error } = await supabase.from('quizzes').select('*, quiz_questions(*)').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ message: "Quiz not found" });
    const quiz = { ...data, questions: data.quiz_questions, quiz_questions: undefined };
    res.json(quiz);
});

app.get('/api/mta-status', async (_, res) => {
    try {
        if (Math.random() < 0.1) throw new Error("Server is offline"); // Mock
        const config = await getRuntimeConfig();
        res.json({
            name: `${config.COMMUNITY_NAME} Roleplay Server`,
            players: 80 + Math.floor(Math.random() * 40),
            maxPlayers: 200,
        });
    } catch(e) {
        res.status(503).json({ message: e.message });
    }
});


app.get('/api/users/:userId/submissions', async (req, res) => {
    const { data, error } = await supabase.from('submissions').select('*').eq('userId', req.params.userId).order('submittedAt', { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data ?? []);
});


app.post('/api/submissions', async (req, res) => {
    const submissionData = { ...req.body, status: 'pending' };
    const { data, error } = await supabase.from('submissions').insert(submissionData).select().single();
    if (error) return res.status(500).json({ message: error.message });
    res.status(201).json(data);
});

// ADMIN-ONLY ROUTES
const adminRouter = express.Router();
adminRouter.use(verifyAdmin);

adminRouter.get('/submissions', async (req, res) => {
    const { data, error } = await supabase.from('submissions').select('*').order('submittedAt', { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data ?? []);
});

adminRouter.post('/log-access', async(req, res) => {
    await addAuditLog(req.adminUser, 'Accessed the admin panel.');
    res.status(204).send();
});

adminRouter.get('/audit-logs', verifySuperAdmin, async (_, res) => {
    const { data, error } = await supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(100);
    if (error) return res.status(500).json({ message: error.message });
    res.json(data ?? []);
});

adminRouter.put('/submissions/:id/status', async (req, res) => {
    const { data: submission, error: subError } = await supabase.from('submissions').select('*, quizzes(allowedTakeRoles)').eq('id', req.params.id).single();
    if (subError || !submission) return res.status(404).json({ message: 'Submission not found' });
    
    if (req.body.status === 'taken') {
        const allowedRoles = submission.quizzes?.allowedTakeRoles;
        if (Array.isArray(allowedRoles) && allowedRoles.length > 0 && !req.adminUser.roles.some(r => allowedRoles.includes(r))) {
            return res.status(403).json({ message: "You don't have the required role to take this submission." });
        }
    }

    const { data: updatedSubmission, error: updateError } = await supabase
        .from('submissions')
        .update({ status: req.body.status, adminId: req.adminUser.id, adminUsername: req.adminUser.username })
        .eq('id', req.params.id)
        .select()
        .single();
    
    if (updateError) return res.status(500).json({ message: updateError.message });
    await addAuditLog(req.adminUser, `Updated submission ${updatedSubmission.id} for ${updatedSubmission.username} to "${req.body.status}"`);
    res.json(updatedSubmission);
});

// SUPER-ADMIN ONLY ROUTES
adminRouter.post('/products', verifySuperAdmin, async (req, res) => {
    const { product } = req.body;
    const { data, error } = await supabase.from('products').upsert(product).select().single();
    if (error) return res.status(500).json({ message: error.message });
    await addAuditLog(req.adminUser, product.id ? `Updated product: "${product.nameKey}"` : `Created product: "${product.nameKey}"`);
    res.status(200).json(data);
});

adminRouter.delete('/products/:id', verifySuperAdmin, async (req, res) => {
    const { data: product } = await supabase.from('products').select('nameKey').eq('id', req.params.id).single();
    const { error } = await supabase.from('products').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ message: error.message });
    if (product) await addAuditLog(req.adminUser, `Deleted product: "${product.nameKey}"`);
    res.status(204).send();
});

adminRouter.post('/rules', verifySuperAdmin, async (req, res) => { 
    // This is a destructive operation: clear and re-insert. Use DB functions for transactions in production.
    await supabase.from('rules').delete().neq('id', '0');
    await supabase.from('rules_categories').delete().neq('id', '0');
    
    const categories = req.body.rules.map(c => ({ id: c.id, titleKey: c.titleKey }));
    await supabase.from('rules_categories').insert(categories);
    
    const rules = req.body.rules.flatMap(c => c.rules.map(r => ({ id: r.id, textKey: r.textKey, category_id: c.id })));
    await supabase.from('rules').insert(rules);
    
    await addAuditLog(req.adminUser, `Updated the server rules.`); 
    res.status(200).json(req.body.rules); 
});

adminRouter.post('/quizzes', verifySuperAdmin, async (req, res) => {
    const { quiz } = req.body;
    const { questions, ...quizData } = quiz;
    const { data: savedQuiz, error } = await supabase.from('quizzes').upsert(quizData).select().single();
    if (error) return res.status(500).json({ message: error.message });

    await supabase.from('quiz_questions').delete().eq('quiz_id', savedQuiz.id);
    if (questions && questions.length > 0) {
        const questionInserts = questions.map(q => ({ ...q, quiz_id: savedQuiz.id }));
        const { error: qError } = await supabase.from('quiz_questions').insert(questionInserts);
        if (qError) return res.status(500).json({ message: qError.message });
    }
    
    await addAuditLog(req.adminUser, quiz.id ? `Updated quiz: "${quiz.titleKey}"` : `Created quiz: "${quiz.titleKey}"`);
    res.status(200).json({ ...savedQuiz, questions });
});

adminRouter.delete('/quizzes/:id', verifySuperAdmin, async (req, res) => {
    const { data: quiz } = await supabase.from('quizzes').select('titleKey').eq('id', req.params.id).single();
    // Assuming cascade delete is set up in Supabase for quiz_questions
    const { error } = await supabase.from('quizzes').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ message: error.message });
    if (quiz) await addAuditLog(req.adminUser, `Deleted quiz: "${quiz.titleKey}"`);
    res.status(204).send();
});

app.use('/api/admin', adminRouter);

// HEALTH CHECK
app.get('/api/health', async (_, res) => {
    const config = await getRuntimeConfig();
    const checks = {
        env: {
            DISCORD_CLIENT_ID: config.DISCORD_CLIENT_ID ? '✅ Set' : '❌ Missing',
            DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET ? '✅ Set' : '❌ Missing',
            DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN ? '✅ Set' : '❌ Missing',
            SUPABASE_URL: process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing',
            SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing',
            DISCORD_GUILD_ID: config.DISCORD_GUILD_ID ? '✅ Set' : '⚠️ Not Set (Discord Widget/Roles will not work)',
            SUPER_ADMIN_ROLE_IDS: config.SUPER_ADMIN_ROLE_IDS.length > 0 ? '✅ Set' : '⚠️ Not Set (No one can manage quizzes/rules)',
        },
        bot: { status: 'Not Checked', error: null, guild_found: false, guild_name: null },
        supabase: { status: 'Not Checked', error: null },
        urls: { app_url: config.APP_URL, redirect_uri: `${config.APP_URL}/api/auth/callback` },
    };
    let hasError = !Object.values(checks.env).every(v => v.startsWith('✅'));

    // Check Bot
    if (config.DISCORD_BOT_TOKEN) {
        try {
            const { data: botUser } = await getDiscordApi(config.DISCORD_BOT_TOKEN).get('/users/@me');
            checks.bot.status = `✅ Logged in as ${botUser.username}`;
            if (config.DISCORD_GUILD_ID) {
                const { data: guild } = await getDiscordApi(config.DISCORD_BOT_TOKEN).get(`/guilds/${config.DISCORD_GUILD_ID}`);
                checks.bot.guild_found = true;
                checks.bot.guild_name = guild.name;
            } else {
                 checks.bot.guild_name = '⚠️ Guild ID not set';
            }
        } catch(e) {
            checks.bot.status = '❌ Login Failed';
            checks.bot.error = e.response?.data?.message || e.message;
            hasError = true;
        }
    } else {
        checks.bot.status = '❌ Token Missing';
        hasError = true;
    }

    // Check Supabase
    try {
        const { error } = await supabase.from('products').select('id').limit(1); // a simple query to test connection
        if (error) throw error;
        checks.supabase.status = '✅ Connection successful';
    } catch(e) {
        checks.supabase.status = '❌ Connection Failed';
        checks.supabase.error = e.message;
        hasError = true;
    }

    res.status(hasError ? 500 : 200).json(checks);
});

export default app;
