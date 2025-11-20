
import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { createApi } from './api.js';

console.log('Starting Vixel Core Bot v2.1...');

// --- CONFIG CHECK ---
const requiredEnv = ['DISCORD_BOT_TOKEN', 'API_SECRET_KEY', 'DISCORD_GUILD_ID'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`❌ CRITICAL ERROR: Missing environment variables: ${missingEnv.join(', ')}`);
  console.error('Please check your .env file in the bot directory.');
  process.exit(1);
}

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
// We use a state object to allow the API to know if the bot is ready,
// without blocking the API startup.
const botState = {
    ready: false,
    guild: null,
    error: null
};

// --- API SERVER STARTUP (IMMEDIATE) ---
// We start the express app immediately so the frontend proxy always has something to talk to.
const app = createApi(client, botState);
const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`🚀 API Server running on port ${PORT}`);
  console.log(`   - Waiting for Discord connection...`);
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

// --- GLOBAL ERROR HANDLING ---
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err);
});

// --- LOGIN ---
client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
    console.error("❌ Discord Login Failed:", err.message);
    botState.error = "Discord Login Failed: " + err.message;
});
