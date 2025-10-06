// api/index.js
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { EmbedBuilder } from 'discord.js';
import { URLSearchParams } from 'url';

// --- Configuration and Sanity Checks ---
const requiredEnvVars = [
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_BOT_TOKEN',
  'DISCORD_GUILD_ID',
  'ADMIN_ROLE_IDS',
];
const recommendedEnvVars = ['APP_URL'];


const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

const getAppUrl = () => {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, ''); 
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:5173';
};


const config = {
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
  ADMIN_ROLE_IDS: (process.env.ADMIN_ROLE_IDS || '').split(','),
  DISCORD_ADMIN_NOTIFY_CHANNEL_ID: process.env.DISCORD_ADMIN_NOTIFY_CHANNEL_ID,
  DISCORD_LOG_CHANNEL_ID: process.env.DISCORD_LOG_CHANNEL_ID,
  APP_URL: getAppUrl(),
};

// --- In-Memory Database ---
let products = [
  { id: 'prod_001', nameKey: 'product_vip_bronze_name', descriptionKey: 'product_vip_bronze_desc', price: 9.99, imageUrl: 'https://picsum.photos/seed/vip_bronze/400/300' },
  { id: 'prod_002', nameKey: 'product_vip_silver_name', descriptionKey: 'product_vip_silver_desc', price: 19.99, imageUrl: 'https://picsum.photos/seed/vip_silver/400/300' },
  { id: 'prod_003', nameKey: 'product_cash_1_name', descriptionKey: 'product_cash_1_desc', price: 4.99, imageUrl: 'https://picsum.photos/seed/cash_pack/400/300' },
  { id: 'prod_004', nameKey: 'product_custom_plate_name', descriptionKey: 'product_custom_plate_desc', price: 14.99, imageUrl: 'https://picsum.photos/seed/license_plate/400/300' },
];
let rules = [
  { id: 'cat_general', titleKey: 'rules_general_title', rules: [{ id: 'rule_gen_1', textKey: 'rule_general_1' },{ id: 'rule_gen_2', textKey: 'rule_general_2' }] },
  { id: 'cat_rp', titleKey: 'rules_rp_title', rules: [{ id: 'rule_rp_1', textKey: 'rule_rp_1' }] }
];
let quizzes = [
  { id: 'quiz_police_dept', titleKey: 'quiz_police_name', descriptionKey: 'quiz_police_desc', isOpen: true, questions: [{ id: 'q1_police', textKey: 'q_police_1', timeLimit: 60 }, { id: 'q2_police', textKey: 'q_police_2', timeLimit: 90 }] },
  { id: 'quiz_ems_dept', titleKey: 'quiz_medic_name', descriptionKey: 'quiz_medic_desc', isOpen: false, questions: [{ id: 'q1_ems', textKey: 'q_medic_1', timeLimit: 75 }] },
];
let submissions = [];
let auditLogs = [];
let nextLogId = 1;

// --- Caching Layer ---
const memberCache = new Map();
const rolesCache = { roles: null, timestamp: 0 };
const guildInfoCache = { data: null, timestamp: 0 };

const CACHE_TTL = {
    MEMBER: 60 * 1000, // 60 seconds
    ROLES: 5 * 60 * 1000, // 5 minutes
    GUILD_INFO: 10 * 60 * 1000, // 10 minutes
};


// --- Discord API Helpers (NEW STATELESS & CACHED IMPLEMENTATION) ---
const discordApiBot = axios.create({
  baseURL: 'https://discord.com/api/v10',
  headers: {
    'Authorization': `Bot ${config.DISCORD_BOT_TOKEN}`
  }
});

async function getGuildRoles() {
    const now = Date.now();
    if (rolesCache.roles && (now - rolesCache.timestamp < CACHE_TTL.ROLES)) {
        return rolesCache.roles;
    }
    console.log('[CACHE] Roles cache miss or expired. Fetching from Discord.');
    const { data } = await discordApiBot.get(`/guilds/${config.DISCORD_GUILD_ID}/roles`);
    const sortedRoles = data.sort((a, b) => b.position - a.position);
    rolesCache.roles = sortedRoles;
    rolesCache.timestamp = now;
    return sortedRoles;
}

async function getGuildMember(userId) {
    const now = Date.now();
    if (memberCache.has(userId)) {
        const cached = memberCache.get(userId);
        if (now - cached.timestamp < CACHE_TTL.MEMBER) {
            return cached.data;
        }
    }
    console.log(`[CACHE] Member cache miss or expired for user ${userId}. Fetching from Discord.`);
    const { data } = await discordApiBot.get(`/guilds/${config.DISCORD_GUILD_ID}/members/${userId}`);
    memberCache.set(userId, { data, timestamp: now });
    return data;
}

async function getGuildInfo() {
    const now = Date.now();
    if (guildInfoCache.data && (now - guildInfoCache.timestamp < CACHE_TTL.GUILD_INFO)) {
        return guildInfoCache.data;
    }
    console.log('[CACHE] Guild Info cache miss or expired. Fetching from Discord.');
    try {
        const { data: guild } = await discordApiBot.get(`/guilds/${config.DISCORD_GUILD_ID}`);
        const info = {
            name: guild.name,
            iconURL: guild.icon ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png` : null
        };
        guildInfoCache.data = info;
        guildInfoCache.timestamp = now;
        return info;
    } catch (e) {
        console.error("CRITICAL: Failed to fetch guild info.", e.response?.data || e.message);
        // Return a fallback to prevent crashes
        return { name: "Discord Server", iconURL: null };
    }
}

const createBaseEmbed = async () => {
    const guildInfo = await getGuildInfo();
    const embed = new EmbedBuilder().setTimestamp();
    if (guildInfo.name) {
      embed.setFooter({ text: guildInfo.name, iconURL: guildInfo.iconURL });
    }
    return embed;
};

const sendDm = async (userId, embed) => {
  try {
    const { data: channel } = await discordApiBot.post(`/users/@me/channels`, { recipient_id: userId });
    await discordApiBot.post(`/channels/${channel.id}/messages`, { embeds: [embed.toJSON()] });
    console.log(`Sent DM to user ${userId}`);
  } catch (error) { 
    console.error(`Failed to send DM to user ${userId}:`, error.response?.data || error.message); 
  }
};

const sendMessageToChannel = async (channelId, embed) => {
  if (!channelId) return;
  try {
    await discordApiBot.post(`/channels/${channelId}/messages`, { embeds: [embed.toJSON()] });
  } catch (error) { 
    console.error(`Failed to send message to channel ${channelId}:`, error.response?.data || error.message);
  }
};

const addAuditLog = (admin, action) => {
  auditLogs.unshift({ id: `log_${nextLogId++}`, adminId: admin.id, adminUsername: admin.username, timestamp: new Date().toISOString(), action });
};

// --- Express App Setup ---
const app = express();
app.use(cors());
app.use(express.json());

// --- HEALTH CHECK ENDPOINT ---
app.get('/api/health', async (req, res) => {
  const checks = { env: {}, bot: { status: 'pending', guild_found: false, guild_name: 'N/A', error: null }, url_config: { detected_app_url: config.APP_URL, using_vercel_url: !process.env.APP_URL && !!process.env.VERCEL_URL, is_localhost: config.APP_URL.includes('localhost') }};
  try {
    requiredEnvVars.forEach(v => checks.env[v] = process.env[v] ? '✅ Set' : '❌ MISSING');
    recommendedEnvVars.forEach(v => checks.env[v] = process.env[v] ? '✅ Set' : '⚠️ Not Set (Required for production login)');
    const currentMissing = Object.values(checks.env).some(v => v.includes('MISSING'));
    if (currentMissing) { checks.bot.status = '❌ Skipped'; checks.bot.error = 'Cannot check bot status due to missing env vars.'; return res.status(500).json(checks); }

    const { data: guild } = await discordApiBot.get(`/guilds/${config.DISCORD_GUILD_ID}`);
    checks.bot.status = '✅ OK';
    checks.bot.guild_found = true;
    checks.bot.guild_name = guild.name;
  
    const hasErrors = currentMissing || checks.bot.status !== '✅ OK' || (!process.env.APP_URL && process.env.NODE_ENV === 'production');
    res.status(hasErrors ? 500 : 200).json(checks);
  } catch (e) {
    console.error('[HEALTH CHECK] Unhandled error:', e.response?.data || e.message);
    checks.bot.status = '❌ FAILED';
    if (e.response?.status === 401) checks.bot.error = `Invalid Token. The DISCORD_BOT_TOKEN is incorrect.`;
    else if (e.response?.status === 404) checks.bot.error = `Unknown Guild. The DISCORD_GUILD_ID is incorrect.`;
    else if (e.response?.status === 403) checks.bot.error = `Missing Access. The bot may not have permissions to access guild information.`;
    else checks.bot.error = `An unexpected error occurred: ${e.message}`;
    res.status(500).json(checks);
  }
});

// --- Security Middleware: Verify Admin ---
const verifyAdmin = async (req, res, next) => {
  const admin = req.body.admin || req.body.user;
  if (!admin || !admin.id) return res.status(401).json({ message: 'Unauthorized: Admin user not provided.' });
  try {
    const member = await getGuildMember(admin.id);
    const isAdmin = member.roles.some(roleId => config.ADMIN_ROLE_IDS.includes(roleId));
    if (!isAdmin) return res.status(403).json({ message: 'Forbidden: User is not an admin.' });
    
    req.adminUser = {
      id: member.user.id,
      username: member.user.username,
      avatar: member.user.avatar ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${(parseInt(member.user.id.slice(-1))) % 5}.png`
    };
    next();
  } catch (error) {
    console.error('Admin verification failed:', error.response?.data || error.message);
    if (error.response?.status === 404) {
      memberCache.delete(admin.id); // Invalidate cache if user not found
      return res.status(403).json({ message: 'Forbidden: User not found in guild.' });
    }
    return res.status(503).json({ message: 'Service Unavailable: Could not verify admin status.' });
  }
};

// --- DATA API ENDPOINTS ---
app.get('/api/products', (req, res) => res.json(products));
app.get('/api/rules', (req, res) => res.json(rules));
app.get('/api/quizzes', (req, res) => res.json(quizzes));
app.get('/api/quizzes/:id', (req, res) => res.json(quizzes.find(q => q.id === req.params.id)));
app.get('/api/audit-logs', (req, res) => res.json(auditLogs));
app.get('/api/submissions', (req, res) => res.json(submissions.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())));
app.get('/api/users/:userId/submissions', (req, res) => res.json(submissions.filter(s => s.userId === req.params.userId)));

// --- ADMIN API ENDPOINTS ---
app.post('/api/admin/log-access', verifyAdmin, async (req, res) => {
    try {
        const { adminUser } = req;
        const logEmbed = (await createBaseEmbed())
            .setColor(0x3498DB) // Blue
            .setTitle('🔑 Admin Panel Accessed')
            .setDescription(`Admin **${adminUser.username}** has accessed the control panel.`)
            .setAuthor({ name: adminUser.username, iconURL: adminUser.avatar });

        await sendMessageToChannel(config.DISCORD_LOG_CHANNEL_ID, logEmbed);
        res.status(200).send();
    } catch (error) {
        console.error('[API][log-access] Failed to log admin access:', error);
        res.status(200).send();
    }
});

app.post('/api/products', verifyAdmin, async (req, res) => {
  try {
    const { product } = req.body;
    const { adminUser } = req;
    const isNew = !product.id || !products.some(p => p.id === product.id);
    if (isNew) {
        product.id = `prod_${Date.now()}`;
        products.push(product);
        addAuditLog(adminUser, `Created product: "${product.nameKey}"`);
    } else {
        const index = products.findIndex(p => p.id === product.id);
        products[index] = product;
        addAuditLog(adminUser, `Updated product: "${product.nameKey}"`);
    }
    res.status(200).json(product);
  } catch (error) {
    console.error(`[API][Products] Failed to save product:`, error);
    res.status(500).json({ message: 'Failed to save product due to a server error.' });
  }
});
app.delete('/api/products/:id', verifyAdmin, async (req, res) => {
  try {
    const { adminUser } = req;
    const { id } = req.params;
    const product = products.find(p => p.id === id);
    if (product) {
        addAuditLog(adminUser, `Deleted product: "${product.nameKey}"`);
    }
    products = products.filter(p => p.id !== id);
    res.status(204).send();
  } catch (error) {
    console.error(`[API][Products] Failed to delete product ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to delete product due to a server error.' });
  }
});

app.post('/api/rules', verifyAdmin, async (req, res) => {
  try {
    rules = req.body.rules;
    addAuditLog(req.adminUser, 'Updated the server rules.');
    res.status(200).json(rules);
  } catch (error) {
    console.error(`[API][Rules] Failed to save rules:`, error);
    res.status(500).json({ message: 'Failed to save rules due to a server error.' });
  }
});

app.post('/api/quizzes', verifyAdmin, async (req, res) => {
  try {
    const { quiz } = req.body;
    const { adminUser } = req;
    const isNew = !quiz.id || !quizzes.some(q => q.id === quiz.id);
    if (isNew) {
      quiz.id = `quiz_${Date.now()}`;
      quizzes.push(quiz);
      addAuditLog(adminUser, `Created quiz: "${quiz.titleKey}"`);
    } else {
      const index = quizzes.findIndex(q => q.id === quiz.id);
      if (index > -1) {
        quizzes[index] = quiz;
        addAuditLog(adminUser, `Updated quiz: "${quiz.titleKey}"`);
      } else {
         return res.status(404).json({ message: "Quiz not found for update."});
      }
    }
    res.status(200).json(quiz);
  } catch (error) {
    console.error(`[API][Quizzes] Failed to save quiz:`, error);
    res.status(500).json({ message: 'Failed to save quiz due to a server error.' });
  }
});

app.delete('/api/quizzes/:id', verifyAdmin, async (req, res) => {
  try {
    const { adminUser } = req;
    const { id } = req.params;
    const quiz = quizzes.find(q => q.id === id);
    if (quiz) {
      addAuditLog(adminUser, `Deleted quiz: "${quiz.titleKey}"`);
    }
    quizzes = quizzes.filter(q => q.id !== id);
    res.status(204).send();
  } catch (error) {
    console.error(`[API][Quizzes] Failed to delete quiz ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to delete quiz due to a server error.' });
  }
});


// --- SUBMISSIONS LOGIC ---
app.post('/api/submissions', async (req, res) => {
  try {
    const submissionData = req.body;
    const newSubmission = { ...submissionData, id: `sub_${Date.now()}`, status: 'pending' };
    submissions.push(newSubmission);

    const { data: applicantUser } = await discordApiBot.get(`/users/${submissionData.userId}`);
    const applicantAvatar = applicantUser.avatar ? `https://cdn.discordapp.com/avatars/${applicantUser.id}/${applicantUser.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${(parseInt(applicantUser.id.slice(-1))) % 5}.png`;
    const guildIcon = (await getGuildInfo()).iconURL;

    const userDM = (await createBaseEmbed())
      .setColor(0x3498DB) // Blue
      .setTitle(`✅ Application Received: ${newSubmission.quizTitle}`)
      .setDescription(`Thank you for your application, **${applicantUser.username}**! We have received it and our administration team will review it shortly. You will be notified here of any status updates.\n\n[You can track the status here.](${config.APP_URL}/my-applications)`)
      .setThumbnail(guildIcon);
    await sendDm(newSubmission.userId, userDM);
    
    const adminEmbed = (await createBaseEmbed())
      .setColor(0x3498DB) // Blue
      .setTitle('New Application Submitted')
      .setURL(`${config.APP_URL}/admin`)
      .setAuthor({ name: applicantUser.username, iconURL: applicantAvatar })
      .setDescription(`A new application for **${newSubmission.quizTitle}** is awaiting review.`)
      .addFields(
        { name: 'Applicant', value: `<@${newSubmission.userId}>`, inline: true },
        { name: 'Action', value: `[Click here to view submissions](${config.APP_URL}/admin)`, inline: true }
      );
    await sendMessageToChannel(config.DISCORD_ADMIN_NOTIFY_CHANNEL_ID, adminEmbed);
    
    res.status(201).json(newSubmission);
  } catch (error) {
    console.error('[SUBMISSION] Failed to process new submission:', error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to process submission due to a server error.' });
  }
});

app.put('/api/submissions/:id/status', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const { adminUser } = req;
    const submission = submissions.find(s => s.id === id);
    if (!submission) return res.status(404).json({ message: 'Submission not found' });
    
    const oldStatus = submission.status;
    if (oldStatus === status) return res.json(submission); // No change
    
    submission.status = status;
    submission.adminId = adminUser.id;
    submission.adminUsername = adminUser.username;

    const { data: applicantUser } = await discordApiBot.get(`/users/${submission.userId}`);
    const applicantAvatar = applicantUser.avatar ? `https://cdn.discordapp.com/avatars/${applicantUser.id}/${applicantUser.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${(parseInt(applicantUser.id.slice(-1))) % 5}.png`;

    let logEmbed; 
    let userDM;

    if (status === 'taken' && oldStatus === 'pending') {
      logEmbed = (await createBaseEmbed())
        .setColor(0xF1C40F) // Yellow
        .setTitle(`📝 Application Claimed`)
        .setDescription(`**${submission.quizTitle}** application from **${applicantUser.username}** claimed for review.`)
        .setAuthor({ name: adminUser.username, iconURL: adminUser.avatar })
        .setThumbnail(applicantAvatar);

      userDM = (await createBaseEmbed())
        .setColor(0xF1C40F) // Yellow
        .setTitle('⏳ Application Under Review')
        .setDescription(`Good news, **${applicantUser.username}**! An admin, **${adminUser.username}**, has started reviewing your application for **"${submission.quizTitle}"**.\n\nWe will notify you again once a final decision has been made.`)
        .setThumbnail(adminUser.avatar);
      await sendDm(submission.userId, userDM);

    } else if (status === 'accepted' || status === 'refused') {
      const isAccepted = status === 'accepted';
      const decisionText = isAccepted ? 'Accepted' : 'Refused';
      const decisionColor = isAccepted ? 0x2ECC71 : 0xE74C3C;
      
      userDM = (await createBaseEmbed())
        .setColor(decisionColor)
        .setTitle(`Application Update: ${submission.quizTitle}`)
        .setDescription(`Hello **${applicantUser.username}**, your application has been **${decisionText}**.`)
        .addFields({ name: 'Reviewed By', value: adminUser.username })
        .setThumbnail((await getGuildInfo()).iconURL);
      await sendDm(submission.userId, userDM);
      
      logEmbed = (await createBaseEmbed())
        .setColor(decisionColor)
        .setTitle(`Application ${decisionText}`)
        .setDescription(`**${submission.quizTitle}** application from **${applicantUser.username}** was **${decisionText.toLowerCase()}**.`)
        .setAuthor({ name: adminUser.username, iconURL: adminUser.avatar })
        .setThumbnail(applicantAvatar);
    }

    if (logEmbed) await sendMessageToChannel(config.DISCORD_LOG_CHANNEL_ID, logEmbed);
    res.json(submission);
  } catch (error) {
    console.error(`[SUBMISSION STATUS] Failed to update status for submission ${req.params.id}:`, error.response?.data || error.message);
    res.status(500).json({ message: 'Failed to update submission status due to a server error.' });
  }
});


// --- OAUTH2 & SESSION ENDPOINTS ---
app.post('/api/auth/session', async (req, res) => {
  try {
    const { user } = req.body;
    if (!user || !user.id) return res.status(400).json({ message: 'User ID is required.' });

    const [member, guildRoles] = await Promise.all([
      getGuildMember(user.id),
      getGuildRoles()
    ]);
    
    const userRolesIds = member.roles;
    const primaryRoleObject = guildRoles.find(gr => userRolesIds.includes(gr.id)) || null;

    const freshUser = {
        id: member.user.id,
        username: member.user.username,
        avatar: member.avatar ? `https://cdn.discordapp.com/guilds/${config.DISCORD_GUILD_ID}/users/${member.user.id}/avatars/${member.avatar}.png` : (member.user.avatar ? `https://cdn.discordapp.com/avatars/${member.user.id}/${member.user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${(parseInt(member.user.id.slice(-1))) % 5}.png`),
        isAdmin: userRolesIds.some(roleId => config.ADMIN_ROLE_IDS.includes(roleId)),
        primaryRole: primaryRoleObject ? { id: primaryRoleObject.id, name: primaryRoleObject.name, color: `#${primaryRoleObject.color.toString(16).padStart(6, '0')}` } : null,
    };
    res.status(200).json(freshUser);
  } catch (error) {
      console.error('Session revalidation failed:', error.response?.data || error.message);
      if (error.response?.status === 404) {
        memberCache.delete(req.body.user.id); // Invalidate cache if user not found
        return res.status(404).json({ message: 'User not found in the Discord server.' });
      }
      res.status(500).json({ message: 'A server error occurred during session validation.' });
  }
});


app.get('/api/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  const frontendCallbackUrl = `${config.APP_URL}/auth/callback`;
  
  try {
    if (missingEnvVars.length > 0) throw new Error(`Server misconfigured. Missing: ${missingEnvVars.join(', ')}`);
    if (!code) throw new Error(req.query.error_description || "Authorization denied.");

    const discordApi = axios.create({ baseURL: 'https://discord.com/api' });
    const tokenResponse = await discordApi.post('/oauth2/token', new URLSearchParams({
      client_id: config.DISCORD_CLIENT_ID, client_secret: config.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code', code, redirect_uri: `${config.APP_URL}/api/auth/callback`,
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    const { access_token } = tokenResponse.data;
    
    const memberResponse = await discordApi.get(`/users/@me/guilds/${config.DISCORD_GUILD_ID}/member`, { 
        headers: { Authorization: `Bearer ${access_token}` } 
    });
    
    const memberData = memberResponse.data;
    const userRolesIds = memberData.roles;
    
    // Use the cached function to get roles, ensuring consistency and performance
    const guildRoles = await getGuildRoles();
    
    const primaryRoleObject = guildRoles.find(guildRole => userRolesIds.includes(guildRole.id)) || null;
    const isAdmin = userRolesIds.some(roleId => config.ADMIN_ROLE_IDS.includes(roleId));

    const finalUser = {
      id: memberData.user.id,
      username: memberData.user.username,
      avatar: memberData.avatar ? `https://cdn.discordapp.com/guilds/${config.DISCORD_GUILD_ID}/users/${memberData.user.id}/avatars/${memberData.avatar}.png` : (memberData.user.avatar ? `https://cdn.discordapp.com/avatars/${memberData.user.id}/${memberData.user.avatar}.png` : `https://cdn.discordapp.com/embed/avatars/${(parseInt(memberData.user.id.slice(-1))) % 5}.png`),
      isAdmin,
      primaryRole: primaryRoleObject ? { id: primaryRoleObject.id, name: primaryRoleObject.name, color: `#${primaryRoleObject.color.toString(16).padStart(6, '0')}` } : null,
    };

    const base64User = Buffer.from(JSON.stringify(finalUser)).toString('base64');
    res.redirect(`${frontendCallbackUrl}?user=${base64User}&state=${state}`);
  } catch (error) {
    const errorData = error.response ? JSON.stringify(error.response.data) : error.message;
    console.error(`[AUTH_CALLBACK] CRITICAL ERROR: ${errorData}`);
    const errorMessage = error.response?.data?.error_description || error.response?.data?.message || error.message || 'An unknown server error occurred.';
    res.redirect(`${frontendCallbackUrl}?error=${encodeURIComponent(errorMessage)}&state=${state}`);
  }
});

export default app;