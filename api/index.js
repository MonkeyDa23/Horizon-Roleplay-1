// api/index.js
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { EmbedBuilder } from 'discord.js';
import { URLSearchParams } from 'url';
import { getAll } from '@vercel/edge-config';
import { kv } from '@vercel/kv';

// --- Database Seeding Logic ---
const seedInitialData = async () => {
  const isSeeded = await kv.get('db_seeded_v2');
  if (isSeeded) return;

  console.log("Database not seeded or old version. Seeding initial data...");

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


// --- Dynamic Configuration ---
const getAppUrl = () => {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, ''); 
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:5173';
};

async function getRuntimeConfig() {
    const edgeConfig = process.env.EDGE_CONFIG ? await getAll() : {};
    
    const envSecrets = {
        DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
        DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
        DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
        DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
        ADMIN_ROLE_IDS: (process.env.ADMIN_ROLE_IDS || '').split(','),
        DISCORD_ADMIN_NOTIFY_CHANNEL_ID: process.env.DISCORD_ADMIN_NOTIFY_CHANNEL_ID,
        DISCORD_LOG_CHANNEL_ID: process.env.DISCORD_LOG_CHANNEL_ID,
    };

    return {
        ...edgeConfig,
        ...envSecrets,
        APP_URL: edgeConfig.APP_URL || getAppUrl(),
        COMMUNITY_NAME: edgeConfig.COMMUNITY_NAME || 'Your Community',
    };
}


// --- Caching Layer ---
const memberCache = new Map();
const rolesCache = { roles: null, timestamp: 0 };
const guildInfoCache = { data: null, timestamp: 0 };
const CACHE_TTL = { MEMBER: 60 * 1000, ROLES: 5 * 60 * 1000, GUILD_INFO: 10 * 60 * 1000 };


// --- Discord API Helpers ---
let discordApiBotInstance = null;
function getDiscordApiBot(token) {
    if (!discordApiBotInstance || discordApiBotInstance.defaults.headers.Authorization !== `Bot ${token}`) {
        discordApiBotInstance = axios.create({
            baseURL: 'https://discord.com/api/v10',
            headers: { 'Authorization': `Bot ${token}` }
        });
    }
    return discordApiBotInstance;
}

async function getGuildRoles(config) {
    const now = Date.now();
    if (rolesCache.roles && (now - rolesCache.timestamp < CACHE_TTL.ROLES)) return rolesCache.roles;
    const { data } = await getDiscordApiBot(config.DISCORD_BOT_TOKEN).get(`/guilds/${config.DISCORD_GUILD_ID}/roles`);
    rolesCache.roles = data.sort((a, b) => b.position - a.position);
    rolesCache.timestamp = now;
    return rolesCache.roles;
}

async function getGuildMember(userId, config) {
    const now = Date.now();
    if (memberCache.has(userId)) {
        const cached = memberCache.get(userId);
        if (now - cached.timestamp < CACHE_TTL.MEMBER) return cached.data;
    }
    const { data } = await getDiscordApiBot(config.DISCORD_BOT_TOKEN).get(`/guilds/${config.DISCORD_GUILD_ID}/members/${userId}`);
    memberCache.set(userId, { data, timestamp: now });
    return data;
}

async function getGuildInfo(config) {
    const now = Date.now();
    if (guildInfoCache.data && (now - guildInfoCache.timestamp < CACHE_TTL.GUILD_INFO)) return guildInfoCache.data;
    try {
        const { data: guild } = await getDiscordApiBot(config.DISCORD_BOT_TOKEN).get(`/guilds/${config.DISCORD_GUILD_ID}`);
        const info = { name: guild.name, iconURL: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null };
        guildInfoCache.data = info;
        guildInfoCache.timestamp = now;
        return info;
    } catch (e) {
        return { name: config.COMMUNITY_NAME, iconURL: null };
    }
}

const createBaseEmbed = async (config) => {
    const guildInfo = await getGuildInfo(config);
    return new EmbedBuilder().setTimestamp().setFooter({ text: guildInfo.name, iconURL: guildInfo.iconURL });
};

const sendDm = async (userId, embed, config) => {
  try {
    const api = getDiscordApiBot(config.DISCORD_BOT_TOKEN);
    const { data: channel } = await api.post(`/users/@me/channels`, { recipient_id: userId });
    await api.post(`/channels/${channel.id}/messages`, { embeds: [embed.toJSON()] });
  } catch (error) { console.error(`Failed to send DM to user ${userId}:`, error.response?.data || error.message); }
};

const sendMessageToChannel = async (channelId, embed, config) => {
  if (!channelId) return;
  try {
    await getDiscordApiBot(config.DISCORD_BOT_TOKEN).post(`/channels/${channelId}/messages`, { embeds: [embed.toJSON()] });
  } catch (error) { console.error(`Failed to send message to channel ${channelId}:`, error.response?.data || error.message); }
};

const addAuditLog = async (admin, action) => {
  const logs = await kv.get('auditLogs') ?? [];
  const newLog = { id: `log_${Date.now()}`, adminId: admin.id, adminUsername: admin.username, timestamp: new Date().toISOString(), action };
  logs.unshift(newLog);
  await kv.set('auditLogs', logs);
};

// --- Express App ---
const app = express();
app.use(cors());
app.use(express.json());

// Seed data when the server starts
seedInitialData().catch(console.error);

// --- Security Middleware: Verify Admin ---
const verifyAdmin = async (req, res, next) => {
  const admin = req.body.admin || req.body.user;
  if (!admin || !admin.id) return res.status(401).json({ message: 'Unauthorized: Admin user not provided.' });
  try {
    const config = await getRuntimeConfig();
    const member = await getGuildMember(admin.id, config);
    if (!member.roles.some(roleId => config.ADMIN_ROLE_IDS.includes(roleId))) {
        return res.status(403).json({ message: 'Forbidden: User does not have an admin role.' });
    }
    req.adminUser = { id: member.user.id, username: member.user.username, avatar: member.user.avatar ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${(parseInt(member.user.id.slice(-1))) % 5}.png`};
    next();
  } catch (error) {
    if (error.response?.status === 404) {
      memberCache.delete(admin.id);
      return res.status(403).json({ message: 'Forbidden: User not found in guild.' });
    }
    return res.status(503).json({ message: 'Service Unavailable: Could not contact Discord.' });
  }
};

// --- DATA API (Read-only) ---
app.get('/api/products', async (req, res) => res.json(await kv.get('products') ?? []));
app.get('/api/rules', async (req, res) => res.json(await kv.get('rules') ?? []));
app.get('/api/quizzes', async (req, res) => res.json(await kv.get('quizzes') ?? []));
app.get('/api/quizzes/:id', async (req, res) => {
    const quizzes = await kv.get('quizzes') ?? [];
    res.json(quizzes.find(q => q.id === req.params.id));
});
app.get('/api/audit-logs', async (req, res) => res.json(await kv.get('auditLogs') ?? []));
app.get('/api/submissions', async (req, res) => {
    const submissions = await kv.get('submissions') ?? [];
    res.json(submissions.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
});
app.get('/api/users/:userId/submissions', async (req, res) => {
    const submissions = await kv.get('submissions') ?? [];
    res.json(submissions.filter(s => s.userId === req.params.userId));
});


// --- ADMIN API (Write) ---
app.post('/api/admin/log-access', verifyAdmin, async (req, res) => {
    const config = await getRuntimeConfig();
    const { adminUser } = req;
    const logEmbed = (await createBaseEmbed(config)).setColor(0x3498DB).setTitle('🔑 Admin Panel Accessed').setDescription(`Admin **${adminUser.username}** has accessed the control panel.`).setAuthor({ name: adminUser.username, iconURL: adminUser.avatar });
    await sendMessageToChannel(config.DISCORD_LOG_CHANNEL_ID, logEmbed, config);
    res.status(204).send();
});

app.post('/api/products', verifyAdmin, async (req, res) => {
    const config = await getRuntimeConfig();
    const { product } = req.body;
    const { adminUser } = req;
    const products = await kv.get('products') ?? [];
    const isNew = !product.id || !products.some(p => p.id === product.id);
    let logEmbed;

    if (isNew) {
        product.id = `prod_${Date.now()}`;
        products.push(product);
        await addAuditLog(adminUser, `Created product: "${product.nameKey}"`);
        logEmbed = (await createBaseEmbed(config)).setColor(0x2ECC71).setTitle('🛍️ Product Created').setDescription(`**${adminUser.username}** created a new product: **${product.nameKey}**`);
    } else {
        const index = products.findIndex(p => p.id === product.id);
        products[index] = product;
        await addAuditLog(adminUser, `Updated product: "${product.nameKey}"`);
        logEmbed = (await createBaseEmbed(config)).setColor(0x3498DB).setTitle('🛍️ Product Updated').setDescription(`**${adminUser.username}** updated the product: **${product.nameKey}**`);
    }

    await kv.set('products', products);
    await sendMessageToChannel(config.DISCORD_LOG_CHANNEL_ID, logEmbed.setAuthor({ name: adminUser.username, iconURL: adminUser.avatar }), config);
    res.status(200).json(product);
});

app.delete('/api/products/:id', verifyAdmin, async (req, res) => {
    const config = await getRuntimeConfig();
    const { id } = req.params;
    let products = await kv.get('products') ?? [];
    const product = products.find(p => p.id === id);
    if (product) {
        await addAuditLog(req.adminUser, `Deleted product: "${product.nameKey}"`);
        const logEmbed = (await createBaseEmbed(config)).setColor(0xE74C3C).setTitle('🛍️ Product Deleted').setDescription(`**${req.adminUser.username}** deleted the product: **${product.nameKey}**`).setAuthor({ name: req.adminUser.username, iconURL: req.adminUser.avatar });
        await sendMessageToChannel(config.DISCORD_LOG_CHANNEL_ID, logEmbed, config);
        products = products.filter(p => p.id !== id);
        await kv.set('products', products);
    }
    res.status(204).send();
});

app.post('/api/rules', verifyAdmin, async (req, res) => {
    const { rules } = req.body;
    const { adminUser } = req;
    await kv.set('rules', rules);
    await addAuditLog(adminUser, `Updated the server rules.`);
    res.status(200).json(rules);
});

app.post('/api/quizzes', verifyAdmin, async (req, res) => {
    const { quiz } = req.body;
    const { adminUser } = req;
    const quizzes = await kv.get('quizzes') ?? [];
    const isNew = !quiz.id || !quizzes.some(q => q.id === quiz.id);

    if (isNew) {
        quiz.id = `quiz_${Date.now()}`;
        quizzes.push(quiz);
        await addAuditLog(adminUser, `Created quiz: "${quiz.titleKey}"`);
    } else {
        const index = quizzes.findIndex(q => q.id === quiz.id);
        quizzes[index] = quiz;
        await addAuditLog(adminUser, `Updated quiz: "${quiz.titleKey}"`);
    }
    await kv.set('quizzes', quizzes);
    res.status(200).json(quiz);
});

app.delete('/api/quizzes/:id', verifyAdmin, async (req, res) => {
    const { id } = req.params;
    let quizzes = await kv.get('quizzes') ?? [];
    const quiz = quizzes.find(q => q.id === id);
    if(quiz) {
        await addAuditLog(req.adminUser, `Deleted quiz: "${quiz.titleKey}"`);
        quizzes = quizzes.filter(q => q.id !== id);
        await kv.set('quizzes', quizzes);
    }
    res.status(204).send();
});


// --- SUBMISSIONS & OAUTH LOGIC ---

app.post('/api/submissions', async (req, res) => {
  const config = await getRuntimeConfig();
  const submissionData = req.body;
  const newSubmission = { ...submissionData, id: `sub_${Date.now()}`, status: 'pending' };
  
  const submissions = await kv.get('submissions') ?? [];
  submissions.push(newSubmission);
  await kv.set('submissions', submissions);

  try {
    const api = getDiscordApiBot(config.DISCORD_BOT_TOKEN);
    const { data: applicantUser } = await api.get(`/users/${submissionData.userId}`);
    const applicantAvatar = applicantUser.avatar ? `https://cdn.discordapp.com/avatars/${applicantUser.id}/${applicantUser.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${(parseInt(applicantUser.id.slice(-1))) % 5}.png`;
    
    const userDM = (await createBaseEmbed(config)).setColor(0x3498DB).setTitle(`✅ Application Received: ${newSubmission.quizTitle}`).setDescription(`Thank you, **${applicantUser.username}**! We will review your application shortly.\n\n[Track status here.](${config.APP_URL}/my-applications)`);
    await sendDm(newSubmission.userId, userDM, config);
    
    const adminEmbed = (await createBaseEmbed(config)).setColor(0x3498DB).setTitle('New Application Submitted').setURL(`${config.APP_URL}/admin`).setAuthor({ name: applicantUser.username, iconURL: applicantAvatar }).setDescription(`Application for **${newSubmission.quizTitle}** is awaiting review.`).addFields({ name: 'Applicant', value: `<@${newSubmission.userId}>`, inline: true }, { name: 'Action', value: `[View submissions](${config.APP_URL}/admin)`, inline: true });
    await sendMessageToChannel(config.DISCORD_ADMIN_NOTIFY_CHANNEL_ID, adminEmbed, config);
    
    res.status(201).json(newSubmission);
  } catch (error) {
    console.error('[SUBMISSION] Error notifying Discord:', error.response?.data || error.message);
    res.status(201).json(newSubmission);
  }
});

app.put('/api/submissions/:id/status', verifyAdmin, async (req, res) => {
    const config = await getRuntimeConfig();
    const { id } = req.params;
    const { status } = req.body;
    const { adminUser } = req;
    
    const submissions = await kv.get('submissions') ?? [];
    const subIndex = submissions.findIndex(s => s.id === id);

    if (subIndex === -1) return res.status(404).json({ message: 'Submission not found' });
    
    const submission = submissions[subIndex];
    submission.status = status;
    submission.adminId = adminUser.id;
    submission.adminUsername = adminUser.username;
    
    await kv.set('submissions', submissions);

    try {
        const api = getDiscordApiBot(config.DISCORD_BOT_TOKEN);
        const { data: applicantUser } = await api.get(`/users/${submission.userId}`);
        const statusMap = {
            taken: { color: 0xF1C40F, title: '⏳ Application Under Review', desc: `An admin, **${adminUser.username}**, has started reviewing your application.` },
            accepted: { color: 0x2ECC71, title: '✅ Application Accepted', desc: `Congratulations! Your application has been **Accepted**.` },
            refused: { color: 0xE74C3C, title: '❌ Application Refused', desc: `Your application has been **Refused**.` }
        };
        if (statusMap[status]) {
            const { color, title, desc } = statusMap[status];
            const userDM = (await createBaseEmbed(config)).setColor(color).setTitle(title).setDescription(desc);
            await sendDm(submission.userId, userDM, config);
        }
    } catch(e) { console.error("Failed to send submission update DM:", e.message); }
    
    res.json(submission);
});


app.post('/api/auth/session', async (req, res) => {
  try {
    const config = await getRuntimeConfig();
    const { user } = req.body;
    if (!user || !user.id) return res.status(400).json({ message: 'User ID is required.' });

    const [member, guildRoles] = await Promise.all([ getGuildMember(user.id, config), getGuildRoles(config) ]);
    const primaryRoleObject = guildRoles.find(gr => member.roles.includes(gr.id)) || null;

    const freshUser = {
        id: member.user.id, username: member.user.username,
        avatar: member.avatar ? `https://cdn.discordapp.com/guilds/${config.DISCORD_GUILD_ID}/users/${member.user.id}/avatars/${member.avatar}.png` : (member.user.avatar ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${(parseInt(member.user.id.slice(-1))) % 5}.png`),
        isAdmin: member.roles.some(roleId => config.ADMIN_ROLE_IDS.includes(roleId)),
        primaryRole: primaryRoleObject ? { id: primaryRoleObject.id, name: primaryRoleObject.name, color: `#${parseInt(primaryRoleObject.color).toString(16).padStart(6, '0')}` } : null,
    };
    res.status(200).json(freshUser);
  } catch (error) {
      if (error.response?.status === 404) return res.status(404).json({ message: 'User not found in the Discord server.' });
      res.status(500).json({ message: 'Server error during session validation.' });
  }
});


app.get('/api/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  let config;
  try {
    config = await getRuntimeConfig();
    if (!code) throw new Error(req.query.error_description || "Authorization denied.");

    const discordApi = axios.create({ baseURL: 'https://discord.com/api' });
    const tokenResponse = await discordApi.post('/oauth2/token', new URLSearchParams({ client_id: config.DISCORD_CLIENT_ID, client_secret: config.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code', code, redirect_uri: `${config.APP_URL}/api/auth/callback`, }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    
    const { access_token } = tokenResponse.data;
    const { data: memberData } = await discordApi.get(`/users/@me/guilds/${config.DISCORD_GUILD_ID}/member`, { headers: { Authorization: `Bearer ${access_token}` } });
    
    const guildRoles = await getGuildRoles(config);
    const primaryRoleObject = guildRoles.find(gr => memberData.roles.includes(gr.id)) || null;

    const finalUser = {
      id: memberData.user.id, username: memberData.user.username,
      avatar: memberData.avatar ? `https://cdn.discordapp.com/guilds/${config.DISCORD_GUILD_ID}/users/${memberData.user.id}/avatars/${memberData.avatar}.png` : (memberData.user.avatar ? `https://cdn.discordapp.com/avatars/${memberData.user.id}/${memberData.user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${(parseInt(memberData.user.id.slice(-1))) % 5}.png`),
      isAdmin: memberData.roles.some(roleId => config.ADMIN_ROLE_IDS.includes(roleId)),
      primaryRole: primaryRoleObject ? { id: primaryRoleObject.id, name: primaryRoleObject.name, color: `#${parseInt(primaryRoleObject.color).toString(16).padStart(6, '0')}` } : null,
    };

    const base64User = Buffer.from(JSON.stringify(finalUser)).toString('base64');
    res.redirect(`${config.APP_URL}/auth/callback?user=${base64User}&state=${state}`);
  } catch (error) {
    const errorMsg = error.response?.data?.error_description || error.response?.data?.message || error.message || 'Unknown server error.';
    const redirectUrl = config ? `${config.APP_URL}/auth/callback` : `${getAppUrl()}/auth/callback`;
    res.redirect(`${redirectUrl}?error=${encodeURIComponent(errorMsg)}&state=${state}`);
  }
});

app.get('/api/mta-status', async (req, res) => {
    try {
        const config = await getRuntimeConfig();
        await new Promise(resolve => setTimeout(resolve, 500)); 
        if (Math.random() < 0.1) throw new Error("Server is offline");
        res.json({ name: `${config.COMMUNITY_NAME} | Your Story Begins`, players: 80 + Math.floor(Math.random() * 40), maxPlayers: 200 });
    } catch (e) {
        res.status(503).json({ message: 'Server is offline' });
    }
});

// Health check endpoint for diagnostics
app.get('/api/health', async (req, res) => {
    let botStatus = { status: '❌ Not Checked', guild_found: false, guild_name: 'N/A', error: null };
    
    const config = await getRuntimeConfig();
    const envChecks = {
      DISCORD_CLIENT_ID: config.DISCORD_CLIENT_ID ? '✅ Set' : '❌ Missing',
      DISCORD_CLIENT_SECRET: config.DISCORD_CLIENT_SECRET ? '✅ Set' : '❌ Missing',
      DISCORD_BOT_TOKEN: config.DISCORD_BOT_TOKEN ? '✅ Set' : '❌ Missing',
      DISCORD_GUILD_ID: config.DISCORD_GUILD_ID ? '✅ Set' : '❌ Missing',
      ADMIN_ROLE_IDS: config.ADMIN_ROLE_IDS && config.ADMIN_ROLE_IDS[0] ? '✅ Set' : '⚠️ Not Set (Admins cannot log in)',
    };
    
    if (config.DISCORD_BOT_TOKEN) {
        try {
            const api = getDiscordApiBot(config.DISCORD_BOT_TOKEN);
            const { data: botUser } = await api.get('/users/@me');
            botStatus.status = `✅ Logged in as ${botUser.username}`;

            if(config.DISCORD_GUILD_ID) {
                const { data: guild } = await api.get(`/guilds/${config.DISCORD_GUILD_ID}`);
                botStatus.guild_found = true;
                botStatus.guild_name = guild.name;
            } else {
                botStatus.error = 'DISCORD_GUILD_ID is not set.';
            }
        } catch(e) {
            botStatus.status = '❌ Login Failed';
            botStatus.error = e.response?.data?.message || e.message;
        }
    } else {
        botStatus.status = '❌ Token Missing';
    }

    const allOk = Object.values(envChecks).every(v => v.startsWith('✅')) && botStatus.status.startsWith('✅');

    res.status(allOk ? 200 : 503).json({
        env: envChecks,
        bot: botStatus,
        url_config: {
            detected_app_url: getAppUrl(),
            using_vercel_url: !!process.env.VERCEL_URL && !process.env.APP_URL,
            is_localhost: getAppUrl().includes('localhost')
        }
    });
});


export default app;