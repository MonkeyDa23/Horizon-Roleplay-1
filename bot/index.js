// bot/index.js
import 'dotenv/config';
import { Client, GatewayIntentBits } from 'discord.js';
import { createApi } from './api.js';

// --- VALIDATE ENVIRONMENT VARIABLES ---
const requiredEnv = [
  'DISCORD_BOT_TOKEN',
  'API_SECRET_KEY',
  'DISCORD_GUILD_ID',
  'PORT'
];

for (const envVar of requiredEnv) {
  if (!process.env[envVar]) {
    console.error(`FATAL ERROR: Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// --- DISCORD CLIENT SETUP ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Required for fetching member data
  ],
});

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  try {
    // Fetch the main guild
    const guild = await client.guilds.fetch(process.env.DISCORD_GUILD_ID);
    if (!guild) {
      console.error(`FATAL ERROR: Could not find guild with ID ${process.env.DISCORD_GUILD_ID}.`);
      console.error('Please ensure the bot is in the server and the ID is correct.');
      process.exit(1);
    }
    console.log(`Successfully connected to guild: ${guild.name}`);
    
    // --- API SERVER SETUP ---
    const app = createApi(client, guild);
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
      console.log(`API server listening on port ${PORT}`);
    });
    
  } catch (error) {
    console.error('FATAL ERROR during startup:', error);
    process.exit(1);
  }
});

// --- LOGIN ---
client.login(process.env.DISCORD_BOT_TOKEN);
