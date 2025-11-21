
import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { createApi } from './api.js';

console.log('Starting Vixel Bot Core v3.0 (Connection Fix)...');

// --- CLIENT SETUP ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

// --- SHARED STATE ---
const botState = {
    ready: false,
    guild: null,
    error: null
};

// --- API SERVER STARTUP (IMMEDIATE) ---
const app = createApi(client, botState);

// Wispbyte/Pterodactyl/Katbump usually inject the assigned port as SERVER_PORT.
// We prioritize that, then check .env PORT, then default to 3001.
const PORT = process.env.SERVER_PORT || process.env.PORT || 3001;

// CRITICAL: Bind to '0.0.0.0' to accept connections from outside (Required for Docker/Panels)
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n===================================================`);
  console.log(`✅ BOT IS RUNNING AND LISTENING!`);
  console.log(`---------------------------------------------------`);
  console.log(`🚀 INTERNAL PORT: ${PORT}`);
  console.log(`---------------------------------------------------`);
  console.log(`⚠️  VERCEL CONFIGURATION INSTRUCTIONS ⚠️`);
  console.log(`1. Your VITE_DISCORD_BOT_URL in Vercel MUST use port: ${PORT}`);
  console.log(`   Example: http://YOUR_KATBUMP_IP:${PORT}`);
  console.log(`2. IMPORTANT: If you changed the variable in Vercel,`);
  console.log(`   YOU MUST CLICK 'REDEPLOY' in Vercel Deployments.`);
  console.log(`===================================================\n`);
  
  // Only AFTER server is up, verify env and login
  const requiredEnv = ['DISCORD_BOT_TOKEN', 'API_SECRET_KEY', 'DISCORD_GUILD_ID'];
  const missingEnv = requiredEnv.filter(key => !process.env[key]);

  if (missingEnv.length > 0) {
    const errorMsg = `❌ CRITICAL: Missing env vars: ${missingEnv.join(', ')}`;
    console.error(errorMsg);
    botState.error = errorMsg;
  } else {
      console.log(`   - Connecting to Discord...`);
      client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
          console.error("❌ Discord Login Failed:", err.message);
          botState.error = "Discord Login Failed: " + err.message;
      });
  }
});

server.on('error', (e) => {
    console.error('❌ API Server failed to start:', e);
});


// --- DISCORD EVENT HANDLERS ---
client.once('ready', async () => {
  console.log(`✅ Discord: Connected as ${client.user.tag}`);
  
  try {
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
    console.log(`✅ Discord: Guild Linked: ${guild.name} (${guild.id})`);
    botState.guild = guild;
    botState.ready = true;
    botState.error = null;
  } catch (error) {
    console.error('❌ Discord: FAILED to connect to target Guild.');
    botState.error = "Bot connected to Discord, but could not fetch the configured Guild ID. Check DISCORD_GUILD_ID.";
  }
});

client.on('error', (error) => {
  console.error('⚠️ Discord Client Error:', error);
  botState.error = error.message;
});

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection:', reason);
});
