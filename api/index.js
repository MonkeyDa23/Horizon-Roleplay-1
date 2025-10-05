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
// Subsequent requests will await the `clientPromise`.
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

// GET all submissions (for admin panel)
app.get('/api/submissions', (req, res) => {
  res.json(submissions.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
});

// GET submissions for a specific user
app.get('/api/users/:userId/submissions', (req, res) => {
  const { userId } = req.params;
  const userSubmissions = submissions.filter(s => s.userId === userId);
  res.json(userSubmissions);
});

// POST a new submission
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

// PUT: Update submission status
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
  const code = req.query.code;
  const frontendCallbackUrl = `${config.APP_URL}/auth/callback`;

  if (missingEnvVars.length > 0) {
    const errorMessage = `Server is misconfigured. Administrator needs to set: ${missingEnvVars.join(', ')}`;
    return res.redirect(`${frontendCallbackUrl}?error=${encodeURIComponent(errorMessage)}`);
  }

  if (!code) {
    const error = req.query.error_description || "No code provided by Discord.";
    return res.redirect(`${frontendCallbackUrl}?error=${encodeURIComponent(error)}`);
  }

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

    const [memberResponse, guildRolesResponse] = await Promise.all([
      discordApi.get(`/users/@me/guilds/${config.DISCORD_GUILD_ID}/member`, {
        headers: { Authorization: `Bearer ${access_token}` },
      }),
      // Use the bot's token for this, as it's more reliable and doesn't depend on user perms
      discordApi.get(`/guilds/${config.DISCORD_GUILD_ID}/roles`, {
        headers: { Authorization: `Bot ${config.DISCORD_BOT_TOKEN}` },
      })
    ]);

    const memberData = memberResponse.data;
    const userRolesIds = memberData.roles;
    const guildRoles = guildRolesResponse.data.sort((a, b) => b.position - a.position);
    
    const userRoles = userRolesIds.map(id => guildRoles.find(r => r.id === id)).filter(Boolean);
    const primaryRole = userRoles[0] || null;
    const isAdmin = userRolesIds.some(roleId => config.ADMIN_ROLE_IDS.includes(roleId));

    const finalUser = {
      id: memberData.user.id,
      username: memberData.user.global_name || memberData.user.username,
      avatar: `https://cdn.discordapp.com/avatars/${memberData.user.id}/${memberData.user.avatar}.png`,
      isAdmin,
      primaryRole: primaryRole ? {
        id: primaryRole.id,
        name: primaryRole.name,
        color: `#${primaryRole.color.toString(16).padStart(6, '0')}`,
      } : null,
    };

    const base64User = Buffer.from(JSON.stringify(finalUser)).toString('base64');
    res.redirect(`${frontendCallbackUrl}?user=${base64User}`);

  } catch (error) {
    console.error('Auth Error:', error.response ? error.response.data : error.message);
    const discordError = error.response?.data;
    const errorMessage = discordError?.error_description || discordError?.message || 'Server error during authentication.';
    res.redirect(`${frontendCallbackUrl}?error=${encodeURIComponent(errorMessage)}`);
  }
});


// Export the app for Vercel
export default app;
