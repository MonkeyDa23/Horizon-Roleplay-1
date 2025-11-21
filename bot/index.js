
import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { createApi } from './api.js';

console.log('Starting Vixel Core Bot v2.4 (Instant Start)...');

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
// Start the API server FIRST so the frontend gets a response immediately.
const app = createApi(client, botState);
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`🚀 API Server running on port ${PORT}`);
  
  // Only AFTER server is up, verify env and login
  const requiredEnv = ['DISCORD_BOT_TOKEN', 'API_SECRET_KEY', 'DISCORD_GUILD_ID'];
  const missingEnv = requiredEnv.filter(key => !process.env[key]);

  if (missingEnv.length > 0) {
    const errorMsg = `❌ CRITICAL: Missing env vars: ${missingEnv.join(', ')}`;
    console.error(errorMsg);
    botState.error = errorMsg;
    // Do not exit, keep server alive to report error to /health
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
    botState.error = "Bot connected to Discord, but could not fetch the configured Guild ID.";
  }
});

client.on('error', (error) => {
  console.error('⚠️ Discord Client Error:', error);
  botState.error = error.message;
});

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection:', reason);
});
