const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

// --- Configuration and Sanity Checks ---
const requiredEnvVars = [
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_BOT_TOKEN',
  'DISCORD_GUILD_ID',
  'ADMIN_ROLE_IDS',
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
  console.error('!!! FATAL ERROR: Missing required environment variables on Vercel:');
  console.error(`!!! Please set the following in your Vercel Project Settings -> Environment Variables: ${missingEnvVars.join(', ')}`);
}

const config = {
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
  DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
  ADMIN_ROLE_IDS: (process.env.ADMIN_ROLE_IDS || '').split(','), // Comma-separated string in env
  DISCORD_ADMIN_NOTIFY_CHANNEL_ID: process.env.DISCORD_ADMIN_NOTIFY_CHANNEL_ID,
  DISCORD_LOG_CHANNEL_ID: process.env.DISCORD_LOG_CHANNEL_ID,
  
  // Vercel provides this automatically.
  // Fallback to localhost for local 'vercel dev' command.
  APP_URL: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:5173',
};


// --- Discord Bot Setup ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

// A flag to ensure we only log in once in a serverless environment
let botLoggedIn = false;
if (!botLoggedIn && config.DISCORD_BOT_TOKEN && missingEnvVars.length === 0) {
    client.login(config.DISCORD_BOT_TOKEN).then(() => {
        botLoggedIn = true;
        console.log(`✅ Discord Bot logged in as ${client.user.tag}`);
    }).catch(e => console.error("Bot login failed:", e.message));
}

const sendDm = async (userId, message) => {
  if (!botLoggedIn) return;
  try {
    const user = await client.users.fetch(userId);
    if (user) {
      await user.send(message);
      console.log(`Sent DM to user ${userId}`);
    }
  } catch (error) {
    console.error(`Failed to send DM to user ${userId}:`, error);
  }
};

const sendMessageToChannel = async (channelId, embed) => {
    if (!botLoggedIn || !channelId) return;
    try {
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
            await channel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error(`Failed to send message to channel ${channelId}:`, error);
    }
};


// --- Mock Database (to be replaced with a real DB like Vercel Postgres) ---
let submissions = []; 

// --- Express App Setup ---
const app = express();
app.use(cors()); // Enable CORS for all routes
app.use(express.json());

// --- Security Middleware ---
// Verifies that the user making the request is a genuine admin.
const verifyAdmin = async (req, res, next) => {
    // For actions that need admin rights, the frontend sends the 'admin' user object.
    // This middleware verifies the user's roles on the backend to prevent impersonation.
    // NOTE: A more robust solution for a large application would use signed session tokens (JWTs).
    const { admin } = req.body;
    if (!admin || !admin.id) {
        return res.status(401).json({ message: 'Unauthorized: Admin user not provided.' });
    }

    if (!botLoggedIn) {
        return res.status(503).json({ message: 'Service Unavailable: Bot is not ready.' });
    }

    try {
        const guild = await client.guilds.fetch(config.DISCORD_GUILD_ID);
        const member = await guild.members.fetch(admin.id);
        const isAdmin = member.roles.cache.some(role => config.ADMIN_ROLE_IDS.includes(role.id));

        if (!isAdmin) {
            return res.status(403).json({ message: 'Forbidden: User is not an admin.' });
        }
        // If admin is verified, proceed to the actual route handler.
        next();
    } catch (error) {
        console.error('Admin verification failed:', error.message);
        // This can happen if the admin is no longer in the server.
        return res.status(403).json({ message: 'Forbidden: Could not verify admin status.' });
    }
};


// --- API Endpoints for Frontend ---
// Note: Vercel maps requests like /api/submissions to this file,
// so the paths in Express are relative (e.g., /submissions).

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

    // --- Discord Notifications ---
    await sendDm(newSubmission.userId, `✅ Your application for **${newSubmission.quizTitle}** has been submitted successfully. We will review it shortly!`);
    
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
    await sendMessageToChannel(config.DISCORD_ADMIN_NOTIFY_CHANNEL_ID, adminEmbed);
    
    const logEmbed = new EmbedBuilder()
        .setColor(0x95A5A6) // Gray
        .setTitle('📝 Application Log: Submitted')
        .setDescription(`**${newSubmission.username}** submitted an application for **${newSubmission.quizTitle}**.`)
        .setTimestamp();
    await sendMessageToChannel(config.DISCORD_LOG_CHANNEL_ID, logEmbed);

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

    // --- Discord Notifications ---
    let logEmbed;
    if(status === 'taken' && oldStatus === 'pending') {
        logEmbed = new EmbedBuilder()
            .setColor(0xF1C40F) // Yellow
            .setTitle(` Gavel Application Log: Claimed`)
            .setDescription(`**${admin.username}** claimed the application from **${submission.username}**.`)
            .setTimestamp();
    } else if (status === 'accepted' || status === 'refused') {
        const decisionText = status === 'accepted' ? 'Accepted' : 'Refused';
        const decisionColor = status === 'accepted' ? 0x2ECC71 : 0xE74C3C; // Green or Red
        
        await sendDm(submission.userId, `Your application for **${submission.quizTitle}** has been **${decisionText}**.`);
        
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
       await sendMessageToChannel(config.DISCORD_LOG_CHANNEL_ID, logEmbed);
    }

    res.json(submission);
});


// --- OAUTH2 AUTHENTICATION ROUTE ---
app.get('/api/auth/callback', async (req, res) => {
  const code = req.query.code;
  const frontendCallbackUrl = `${config.APP_URL}/auth/callback`;

  if (missingEnvVars.length > 0) {
    const errorMessage = `Server is misconfigured. Administrator needs to set the following environment variables: ${missingEnvVars.join(', ')}`;
    return res.redirect(`${frontendCallbackUrl}?error=${encodeURIComponent(errorMessage)}`);
  }

  if (!code) {
      // If Discord sends an error, forward it to the frontend popup.
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
    const errorMessage = discordError?.error_description || discordError?.message || 'An unknown server error occurred during authentication.';
    res.redirect(`${frontendCallbackUrl}?error=${encodeURIComponent(errorMessage)}`);
  }
});


// Export the app for Vercel
module.exports = app;