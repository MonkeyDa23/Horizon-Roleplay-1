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

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

const config = {
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
  ADMIN_ROLE_IDS: (process.env.ADMIN_ROLE_IDS || '').split(','),
  DISCORD_ADMIN_NOTIFY_CHANNEL_ID: process.env.DISCORD_ADMIN_NOTIFY_CHANNEL_ID,
  DISCORD_LOG_CHANNEL_ID: process.env.DISCORD_LOG_CHANNEL_ID,
  APP_URL: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173',
};

// --- Discord Bot Singleton Pattern for Serverless ---
let clientInstance = null;
let clientPromise = null;

async function getReadyBotClient() {
  if (clientInstance && clientInstance.isReady()) {
    return clientInstance;
  }
  if (clientPromise) {
    return clientPromise;
  }

  if (missingEnvVars.length > 0) {
    const errorMsg = `Bot cannot start due to missing env vars: ${missingEnvVars.join(', ')}`;
    console.error(`!!! FATAL ERROR: ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
  });

  clientPromise = new Promise((resolve, reject) => {
    client.once('ready', () => {
      console.log(`✅ Discord Bot logged in as ${client.user.tag}`);
      clientInstance = client;
      resolve(client);
    });

    client.login(config.DISCORD_BOT_TOKEN).catch(err => {
      console.error("Bot login failed:", err.message);
      clientPromise = null; // Reset promise on failure to allow retry
      reject(err);
    });
  });

  return clientPromise;
}

// Warm up the bot on cold start. We don't await this here.
getReadyBotClient().catch(() => { /* Error is logged inside */ });


// --- Discord Helper Functions ---
const sendDm = async (userId, message) => {
  try {
    const client = await getReadyBotClient();
    const user = await client.users.fetch(userId);
    await user.send(message);
    console.log(`Sent DM to user ${userId}`);
  } catch (error) {
    console.error(`Failed to send DM to user ${userId}:`, error.message);
  }
};

const sendMessageToChannel = async (channelId, embed) => {
  if (!channelId) return;
  try {
    const client = await getReadyBotClient();
    const channel = await client.channels.fetch(channelId);
    if (channel && channel.isTextBased()) {
      await channel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error(`Failed to send message to channel ${channelId}:`, error.message);
  }
};


// --- Mock Database (In-memory store) ---
let submissions = [];

// --- Express App Setup ---
const app = express();
app.use(cors());
app.use(express.json());

// --- HEALTH CHECK / DIAGNOSTICS ENDPOINT ---
app.get('/api/health', async (req, res) => {
  console.log('[HEALTH_CHECK] Running diagnostics...');
  const checks = {
    env: {},
    bot: {
      status: 'pending',
      guild_found: false,
      guild_name: 'N/A',
      error: null,
    },
  };

  // 1. Check Environment Variables
  requiredEnvVars.forEach(varName => {
    checks.env[varName] = process.env[varName] ? '✅ Set' : '❌ MISSING';
  });
  const currentMissing = Object.values(checks.env).some(v => v.includes('MISSING'));


  // 2. Check Discord Bot Token and Guild ID
  if (currentMissing) {
    checks.bot.status = '❌ Skipped';
    checks.bot.error = 'Cannot check bot status due to missing environment variables.';
    console.log('[HEALTH_CHECK] Result:', checks);
    return res.status(500).json(checks);
  }

  try {
    const client = await getReadyBotClient();
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    if (guild) {
      checks.bot.status = '✅ OK';
      checks.bot.guild_found = true;
      checks.bot.guild_name = guild.name;
      console.log(`[HEALTH_CHECK] Bot OK, found guild: ${guild.name}`);
    } else {
      checks.bot.status = '❌ FAILED';
      checks.bot.error = `Could not find Guild with ID: ${config.DISCORD_GUILD_ID}. Is the bot in the server?`;
      console.error(`[HEALTH_CHECK] Bot FAILED: ${checks.bot.error}`);
    }
  } catch (error) {
    checks.bot.status = '❌ FAILED';
    if (error.code === 10004) { // Unknown Guild
        checks.bot.error = `Unknown Guild. The DISCORD_GUILD_ID is incorrect.`;
    } else if (error.code === 50001) { // Missing Access
        checks.bot.error = `Missing Access. The bot may not be in the specified guild.`;
    } else if (error.message.includes('Invalid token')) {
        checks.bot.error = `Invalid Token. The DISCORD_BOT_TOKEN is incorrect.`;
    } else {
        checks.bot.error = `An unexpected error occurred: ${error.message}`;
    }
    console.error(`[HEALTH_CHECK] Bot FAILED: ${checks.bot.error}`);
  }
  
  console.log('[HEALTH_CHECK] Result:', checks);
  res.status(checks.bot.status === '✅ OK' && !currentMissing ? 200 : 500).json(checks);
});


// --- Security Middleware: Verify Admin ---
const verifyAdmin = async (req, res, next) => {
  const { admin } = req.body;
  if (!admin || !admin.id) {
    return res.status(401).json({ message: 'Unauthorized: Admin user not provided.' });
  }

  try {
    const client = await getReadyBotClient();
    const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
    const member = await guild.members.fetch(admin.id);
    const isAdmin = member.roles.cache.some(role => config.ADMIN_ROLE_IDS.includes(role.id));

    if (!isAdmin) {
      return res.status(403).json({ message: 'Forbidden: User is not an admin.' });
    }
    next();
  } catch (error) {
    console.error('Admin verification failed:', error.message);
    return res.status(503).json({ message: 'Service Unavailable: Could not verify admin status with Discord.' });
  }
};


// --- API Endpoints ---
app.get('/api/submissions', (req, res) => {
  res.json(submissions.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
});

app.get('/api/users/:userId/submissions', (req, res) => {
  const { userId } = req.params;
  const userSubmissions = submissions.filter(s => s.userId === userId);
  res.json(userSubmissions);
});

app.post('/api/submissions', async (req, res) => {
  const submissionData = req.body;
  const newSubmission = {
    ...submissionData,
    id: `sub_${Date.now()}`,
    status: 'pending',
  };
  submissions.push(newSubmission);

  sendDm(newSubmission.userId, `✅ Your application for **${newSubmission.quizTitle}** has been submitted successfully. We will review it shortly!`);
  
  const adminEmbed = new EmbedBuilder()
    .setColor(0x3498DB) // Blue
    .setTitle('New Application Submitted')
    .setDescription(`A new application has been submitted by **${newSubmission.username}**.`)
    .addFields(
      { name: 'Applicant', value: `<@${newSubmission.userId}>`, inline: true },
      { name: 'Application Type', value: newSubmission.quizTitle, inline: true }
    )
    .setTimestamp()
    .setFooter({ text: `User ID: ${newSubmission.userId}` });
  sendMessageToChannel(config.DISCORD_ADMIN_NOTIFY_CHANNEL_ID, adminEmbed);
  
  const logEmbed = new EmbedBuilder()
    .setColor(0x95A5A6) // Gray
    .setTitle('📝 Application Log: Submitted')
    .setDescription(`**${newSubmission.username}** submitted an application for **${newSubmission.quizTitle}**.`)
    .setTimestamp();
  sendMessageToChannel(config.DISCORD_LOG_CHANNEL_ID, logEmbed);

  res.status(201).json(newSubmission);
});

app.put('/api/submissions/:id/status', verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { status, admin } = req.body;
  
  const submission = submissions.find(s => s.id === id);
  if (!submission) {
    return res.status(404).json({ message: 'Submission not found' });
  }

  const oldStatus = submission.status;
  submission.status = status;
  submission.adminId = admin.id;
  submission.adminUsername = admin.username;

  let logEmbed;
  if (status === 'taken' && oldStatus === 'pending') {
    logEmbed = new EmbedBuilder()
      .setColor(0xF1C40F) // Yellow
      .setTitle(` Gavel Application Log: Claimed`)
      .setDescription(`**${admin.username}** claimed the application from **${submission.username}**.`)
      .setTimestamp();
  } else if (status === 'accepted' || status === 'refused') {
    const decisionText = status === 'accepted' ? 'Accepted' : 'Refused';
    const decisionColor = status === 'accepted' ? 0x2ECC71 : 0xE74C3C; // Green or Red
    
    sendDm(submission.userId, `Your application for **${submission.quizTitle}** has been **${decisionText}**.`);
    
    logEmbed = new EmbedBuilder()
      .setColor(decisionColor)
      .setTitle(`✅ Application Log: ${decisionText}`)
      .setDescription(`**${admin.username}** ${decisionText.toLowerCase()} the application from **${submission.username}**.`)
      .addFields(
        { name: 'Application Type', value: submission.quizTitle },
        { name: 'Applicant', value: `<@${submission.userId}>`, inline: true },
        { name: 'Admin', value: `<@${admin.id}>`, inline: true }
      )
      .setTimestamp();
  }

  if (logEmbed) {
    sendMessageToChannel(config.DISCORD_LOG_CHANNEL_ID, logEmbed);
  }

  res.json(submission);
});


// --- OAUTH2 AUTHENTICATION ROUTE ---
app.get('/api/auth/callback', async (req, res) => {
  const { code, state } = req.query;
  const frontendCallbackUrl = `${config.APP_URL}/auth/callback`;
  console.log('[AUTH_CALLBACK] Received request.');

  if (missingEnvVars.length > 0) {
    const errorMessage = `Server is misconfigured. Missing env vars: ${missingEnvVars.join(', ')}`;
    console.error(`[AUTH_CALLBACK] ERROR: ${errorMessage}`);
    return res.redirect(`${frontendCallbackUrl}?error=${encodeURIComponent(errorMessage)}&state=${state}`);
  }

  if (!code) {
    const error = req.query.error_description || "Authorization was denied or cancelled.";
    console.log(`[AUTH_CALLBACK] WARN: No code provided. Reason: ${error}`);
    return res.redirect(`${frontendCallbackUrl}?error=${encodeURIComponent(error)}&state=${state}`);
  }

  console.log('[AUTH_CALLBACK] Code received, exchanging for token...');
  try {
    const discordApi = axios.create({ baseURL: 'https://discord.com/api' });
    const redirect_uri = `${config.APP_URL}/api/auth/callback`;

    const tokenResponse = await discordApi.post('/oauth2/token', new URLSearchParams({
      client_id: config.DISCORD_CLIENT_ID,
      client_secret: config.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri,
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    const { access_token } = tokenResponse.data;
    console.log('[AUTH_CALLBACK] Token acquired. Fetching user and guild data...');

    const [memberResponse, guildRolesResponse] = await Promise.all([
      discordApi.get(`/users/@me/guilds/${config.DISCORD_GUILD_ID}/member`, {
        headers: { Authorization: `Bearer ${access_token}` },
      }),
      discordApi.get(`/guilds/${config.DISCORD_GUILD_ID}/roles`, {
        headers: { Authorization: `Bot ${config.DISCORD_BOT_TOKEN}` },
      })
    ]);

    console.log('[AUTH_CALLBACK] User and guild data fetched. Processing roles...');
    const memberData = memberResponse.data;
    const userRolesIds = memberData.roles;
    const guildRoles = guildRolesResponse.data.sort((a, b) => b.position - a.position);
    
    const primaryRoleObject = guildRoles.find(guildRole => userRolesIds.includes(guildRole.id)) || null;
    
    const isAdmin = userRolesIds.some(roleId => config.ADMIN_ROLE_IDS.includes(roleId));

    const finalUser = {
      id: memberData.user.id,
      username: memberData.nick || memberData.user.global_name || memberData.user.username,
      avatar: memberData.user.avatar 
        ? `https://cdn.discordapp.com/avatars/${memberData.user.id}/${memberData.user.avatar}.png` 
        : `https://cdn.discordapp.com/embed/avatars/${(parseInt(memberData.user.id.slice(-1))) % 5}.png`,
      isAdmin,
      primaryRole: primaryRoleObject ? {
        id: primaryRoleObject.id,
        name: primaryRoleObject.name,
        color: `#${primaryRoleObject.color.toString(16).padStart(6, '0')}`,
      } : null,
    };

    console.log(`[AUTH_CALLBACK] Success for user: ${finalUser.username} (${finalUser.id}). Redirecting to frontend.`);
    const base64User = Buffer.from(JSON.stringify(finalUser)).toString('base64');
    res.redirect(`${frontendCallbackUrl}?user=${base64User}&state=${state}`);

  } catch (error) {
    const errorData = error.response ? JSON.stringify(error.response.data, null, 2) : error.message;
    console.error(`[AUTH_CALLBACK] CRITICAL ERROR: ${errorData}`);
    
    const discordError = error.response?.data;
    const errorMessage = discordError?.error_description 
                        || discordError?.message 
                        || 'An unknown server error occurred during authentication. Check server logs for details.';
    res.redirect(`${frontendCallbackUrl}?error=${encodeURIComponent(errorMessage)}&state=${state}`);
  }
});


// Export the app for Vercel
export default app;
