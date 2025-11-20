
import 'dotenv/config';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { createApi } from './api.js';

console.log('Starting Vixel Core Bot v2.0...');

// --- CRITICAL CONFIG CHECK ---
const requiredEnv = ['DISCORD_BOT_TOKEN', 'API_SECRET_KEY', 'DISCORD_GUILD_ID'];
const missingEnv = requiredEnv.filter(key => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`❌ CRITICAL ERROR: Missing environment variables: ${missingEnv.join(', ')}`);
  console.error('Please check your .env file in the bot directory.');
  process.exit(1);
}

// --- ROBUST CLIENT SETUP ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Crucial for syncing users
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel], // Required to receive DMs
});

// --- GLOBAL ERROR HANDLING (Anti-Crash) ---
process.on('unhandledRejection', (reason, p) => {
  console.error('⚠️ Unhandled Rejection/Async Error:', reason);
  // Do not exit the process, keep the bot alive
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err);
  // Do not exit the process, keep the bot alive
});

client.on('error', (error) => {
  console.error('⚠️ Discord Client Error:', error);
});

// --- STARTUP LOGIC ---
client.once('ready', async () => {
  console.log(`✅ Bot Connected: ${client.user.tag}`);
  
  try {
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
    console.log(`✅ Guild Linked: ${guild.name} (${guild.id})`);
    
    // Start the API Server only when bot is ready
    const app = createApi(client, guild);
    const PORT = process.env.PORT || 3001;
    
    app.listen(PORT, () => {
      console.log(`🚀 Vixel API Server is running on port ${PORT}`);
      console.log(`🔗 Status: READY to receive website requests.`);
    });

  } catch (error) {
    console.error('❌ FAILED to connect to the target Guild. Check DISCORD_GUILD_ID.');
    console.error(error);
  }
});

// --- LOGIN ---
client.login(process.env.DISCORD_BOT_TOKEN);