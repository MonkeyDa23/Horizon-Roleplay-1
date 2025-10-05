// api/index.js
import express from 'express';
import axios from 'axios';
import cors from 'cors';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
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

// --- Discord Bot Singleton Pattern ---
let clientInstance = null;
let clientPromise = null;
async function getReadyBotClient() {
  if (clientInstance && clientInstance.isReady()) return clientInstance;
  if (clientPromise) return clientPromise;
  if (missingEnvVars.length > 0) throw new Error(`Bot cannot start due to missing env vars: ${missingEnvVars.join(', ')}`);
  
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
  clientPromise = new Promise((resolve, reject) => {
    client.once('ready', () => { console.log(`✅ Discord Bot logged in as ${client.user.tag}`); clientInstance = client; resolve(client); });
    client.login(config.DISCORD_BOT_TOKEN).catch(err => { 
      console.error("Bot login failed:", err.message); 
      // CRITICAL FIX: Reset promise on failure to allow retry on next request.
      clientPromise = null; 
      reject(err); 
    });
  });
  return clientPromise;
}
getReadyBotClient().catch(() => {});

// --- Discord Helper Functions ---
const sendDm = async (userId, embed) => {
  try {
    const client = await getReadyBotClient();
    const user = await client.users.fetch(userId);
    await user.send({ embeds: [embed] });
    console.log(`Sent DM to user ${userId}`);
  } catch (error) { console.error(`Failed to send DM to user ${userId}:`, error.message); }
};
const sendMessageToChannel = async (channelId, embed) => {
  if (!channelId) return;
  try {
    const client = await getReadyBotClient();
    const channel = await client.channels.fetch(channelId);
    if (channel && channel.isTextBased()) await channel.send({ embeds: [embed] });
  } catch (error) { console.error(`Failed to send message to channel ${channelId}:`, error.message); }
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

    const client = await getReadyBotClient();
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    if (guild) { checks.bot.status = '✅ OK'; checks.bot.guild_found = true; checks.bot.guild_name = guild.name; } 
    else { checks.bot.status = '❌ FAILED'; checks.bot.error = `Could not find Guild with ID: ${config.DISCORD_GUILD_ID}.`; }
  
    const hasErrors = currentMissing || checks.bot.status !== '✅ OK' || (!process.env.APP_URL && process.env.NODE_ENV === 'production');
    res.status(hasErrors ? 500 : 200).json(checks);
  } catch (e) {
    console.error('[HEALTH CHECK] Unhandled error:', e);
    checks.bot.status = '❌ FAILED';
    if (e.code === 10004) checks.bot.error = `Unknown Guild. The DISCORD_GUILD_ID is incorrect.`;
    else if (e.code === 50001) checks.bot.error = `Missing Access. The bot may not be in the specified guild.`;
    else if (e.message?.includes('Invalid token')) checks.bot.error = `Invalid Token. The DISCORD_BOT_TOKEN is incorrect.`;
    else checks.bot.error = `An unexpected error occurred: ${e.message}`;
    res.status(500).json(checks);
  }
});

// --- Security Middleware: Verify Admin ---
const verifyAdmin = async (req, res, next) => {
  const admin = req.body.admin || req.body.user; // Allow 'user' for revalidation
  if (!admin || !admin.id) return res.status(401).json({ message: 'Unauthorized: Admin user not provided.' });
  try {
    const client = await getReadyBotClient();
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const member = await guild.members.fetch(admin.id);
    const isAdmin = member.roles.cache.some(role => config.ADMIN_ROLE_IDS.includes(role.id));
    if (!isAdmin) return res.status(403).json({ message: 'Forbidden: User is not an admin.' });
    req.adminUser = admin;
    next();
  } catch (error) {
    console.error('Admin verification failed:', error.message);
    if (error.code === 10007) return res.status(403).json({ message: 'Forbidden: User not found in guild.' });
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
app.post('/api/products', verifyAdmin, async (req, res) => {
  try {
    const { product, admin } = req.body;
    const isNew = !product.id || !products.some(p => p.id === product.id);
    if (isNew) {
        product.id = `prod_${Date.now()}`;
        products.push(product);
        addAuditLog(admin, `Created product: "${product.nameKey}"`);
    } else {
        const index = products.findIndex(p => p.id === product.id);
        products[index] = product;
        addAuditLog(admin, `Updated product: "${product.nameKey}"`);
    }
    res.status(200).json(product);
  } catch (error) {
    console.error(`[API][Products] Failed to save product:`, error);
    res.status(500).json({ message: 'Failed to save product due to a server error.' });
  }
});
app.delete('/api/products/:id', verifyAdmin, async (req, res) => {
  try {
    const { admin } = req.body;
    const { id } = req.params;
    const product = products.find(p => p.id === id);
    if (product) {
        addAuditLog(admin, `Deleted product: "${product.nameKey}"`);
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

// FIX: Add missing quiz management endpoints
app.post('/api/quizzes', verifyAdmin, async (req, res) => {
  try {
    const { quiz, admin } = req.body;
    const isNew = !quiz.id || !quizzes.some(q => q.id === quiz.id);
    if (isNew) {
      quiz.id = `quiz_${Date.now()}`;
      quizzes.push(quiz);
      addAuditLog(admin, `Created quiz: "${quiz.titleKey}"`);
    } else {
      const index = quizzes.findIndex(q => q.id === quiz.id);
      if (index > -1) {
        quizzes[index] = quiz;
        addAuditLog(admin, `Updated quiz: "${quiz.titleKey}"`);
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
    const { admin } = req.body;
    const { id } = req.params;
    const quiz = quizzes.find(q => q.id === id);
    if (quiz) {
      addAuditLog(admin, `Deleted quiz: "${quiz.titleKey}"`);
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

    const client = await getReadyBotClient();
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);

    const userDM = new EmbedBuilder()
      .setColor(0x3498DB).setTitle(`Application Received: ${newSubmission.quizTitle}`)
      .setDescription(`Thank you for your application, **${newSubmission.username}**! We have received it and our administration team will review it shortly. You will be notified here of any status updates.`)
      .setThumbnail(guild.iconURL())
      .setTimestamp().setFooter({ text: guild.name, iconURL: guild.iconURL() });
    sendDm(newSubmission.userId, userDM);

    const adminEmbed = new EmbedBuilder()
      .setColor(0x3498DB).setTitle('New Application Submitted')
      .setURL(`${config.APP_URL}/admin`)
      .setDescription(`**${newSubmission.username}** has submitted a new application.`)
      .addFields(
        { name: 'Applicant', value: `<@${newSubmission.userId}> (${newSubmission.username})`, inline: true },
        { name: 'Application Type', value: newSubmission.quizTitle, inline: true },
        { name: 'Action', value: `[Click here to view submissions](${config.APP_URL}/admin)` }
      ).setTimestamp().setFooter({ text: `User ID: ${newSubmission.userId}` });
    sendMessageToChannel(config.DISCORD_ADMIN_NOTIFY_CHANNEL_ID, adminEmbed);
    
    res.status(201).json(newSubmission);
  } catch (error) {
    console.error('[SUBMISSION] Failed to process new submission:', error);
    res.status(500).json({ message: 'Failed to process submission due to a server error.' });
  }
});

app.put('/api/submissions/:id/status', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin } = req.body;
    const submission = submissions.find(s => s.id === id);
    if (!submission) return res.status(404).json({ message: 'Submission not found' });
    
    const oldStatus = submission.status;
    submission.status = status;
    submission.adminId = admin.id;
    submission.adminUsername = admin.username;

    const client = await getReadyBotClient();
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    let logEmbed; let userDM;

    if (status === 'taken' && oldStatus === 'pending') {
      logEmbed = new EmbedBuilder().setColor(0xF1C40F).setTitle(`📝 Application Claimed`).setDescription(`**${admin.username}** claimed the application from **${submission.username}** for review.`).setTimestamp();
    } else if (status === 'accepted' || status === 'refused') {
      const isAccepted = status === 'accepted';
      const decisionText = isAccepted ? 'Accepted' : 'Refused';
      const decisionColor = isAccepted ? 0x2ECC71 : 0xE74C3C;
      
      userDM = new EmbedBuilder().setColor(decisionColor).setTitle(`Application Update: ${submission.quizTitle}`)
        .setDescription(`Hello **${submission.username}**, your application has been **${decisionText}**.`)
        .addFields({ name: 'Reviewed By', value: admin.username, inline: true })
        .setThumbnail(guild.iconURL())
        .setTimestamp().setFooter({ text: guild.name, iconURL: guild.iconURL() });
      sendDm(submission.userId, userDM);
      
      logEmbed = new EmbedBuilder().setColor(decisionColor).setTitle(`✅ Application ${decisionText}`)
        .setDescription(`**${admin.username}** ${decisionText.toLowerCase()} the application from **${submission.username}**.`)
        .addFields(
            { name: 'Applicant', value: `<@${submission.userId}>`, inline: true },
            { name: 'Admin', value: `<@${admin.id}>`, inline: true }
        ).setTimestamp();
    }
    if (logEmbed) sendMessageToChannel(config.DISCORD_LOG_CHANNEL_ID, logEmbed);
    res.json(submission);
  } catch (error) {
    console.error(`[SUBMISSION STATUS] Failed to update status for submission ${req.params.id}:`, error);
    res.status(500).json({ message: 'Failed to update submission status due to a server error.' });
  }
});


// --- OAUTH2 & SESSION ENDPOINTS ---
app.post('/api/auth/session', async (req, res) => {
  try {
    const { user } = req.body;
    if (!user || !user.id) return res.status(400).json({ message: 'User ID is required.' });

    const client = await getReadyBotClient();
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const member = await guild.members.fetch(user.id);
    const guildRoles = (await guild.roles.fetch()).sort((a, b) => b.position - a.position);
    
    const userRolesIds = member.roles.cache.map(r => r.id);
    const primaryRoleObject = guildRoles.find(gr => userRolesIds.includes(gr.id)) || null;

    const freshUser = {
        ...user,
        username: member.displayName,
        avatar: member.displayAvatarURL(),
        isAdmin: userRolesIds.some(roleId => config.ADMIN_ROLE_IDS.includes(roleId)),
        primaryRole: primaryRoleObject ? { id: primaryRoleObject.id, name: primaryRoleObject.name, color: primaryRoleObject.hexColor } : null,
    };
    res.status(200).json(freshUser);
  } catch (error) {
      console.error('Session revalidation failed:', error.message);
      // If the user is not found, it's a valid outcome (e.g., they left the server).
      if (error.code === 10007) {
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
    
    // Instead of two parallel calls, fetch the user's guild member profile directly.
    // This gives us everything we need in one go: user object, guild roles, nick, etc.
    const memberResponse = await discordApi.get(`/users/@me/guilds/${config.DISCORD_GUILD_ID}/member`, { 
        headers: { Authorization: `Bearer ${access_token}` } 
    });
    
    const memberData = memberResponse.data;
    const userRolesIds = memberData.roles;
    
    // We still need all guild roles to find the highest one.
    const guildRolesResponse = await discordApi.get(`/guilds/${config.DISCORD_GUILD_ID}/roles`, { 
        headers: { Authorization: `Bot ${config.DISCORD_BOT_TOKEN}` } 
    });
    const guildRoles = guildRolesResponse.data.sort((a, b) => b.position - a.position);
    
    const primaryRoleObject = guildRoles.find(guildRole => userRolesIds.includes(guildRole.id)) || null;
    const isAdmin = userRolesIds.some(roleId => config.ADMIN_ROLE_IDS.includes(roleId));

    const finalUser = {
      id: memberData.user.id,
      username: memberData.nick || memberData.user.global_name || memberData.user.username,
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