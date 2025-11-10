# Vixel Roleplay - Discord Bot Setup

This directory contains the new standalone Discord bot that handles all interactions with the Discord API, including notifications, user data synchronization, and more. This replaces the previous Supabase Edge Functions system.

## Architecture Overview

- **Node.js & Express:** The bot runs on Node.js and uses an Express server to create an HTTP API.
- **Discord.js:** The bot uses the powerful `discord.js` library to interact with Discord's real-time gateway and REST API.
- **Website Integration:** The main website frontend makes authenticated HTTP requests to this bot's API to perform actions (e.g., send a notification, fetch user roles).

This "bot-first" approach ensures that your bot appears online in Discord, provides more robust error handling, and is generally faster and more reliable than the previous function-based system.

## Setup Instructions

### Step 1: Install Dependencies

Navigate to this `bot` directory in your terminal and install the required packages.

```bash
cd bot
npm install
```

### Step 2: Configure Environment Variables

1.  Create a copy of the `.env.example` file in this directory and rename it to `.env`.
2.  Open the new `.env` file and fill in the following values:

    -   `DISCORD_BOT_TOKEN`: Your bot's secret token from the [Discord Developer Portal](https://discord.com/developers/applications).
    -   `DISCORD_GUILD_ID`: The ID of your Discord server.
    -   `PORT`: The port for the API server to run on (e.g., `3001`).
    -   `API_SECRET_KEY`: A strong, random password you create. This is used to secure the API from unauthorized requests. **This value must exactly match the `VITE_DISCORD_BOT_API_KEY` in the main project's `.env` file.**

### Step 3: Enable Required Bot Intents

For the bot to function correctly, you must enable the **Server Members Intent** in the Discord Developer Portal.

1.  Go to your application in the Developer Portal.
2.  Click on the "Bot" tab in the left sidebar.
3.  Scroll down to the "Privileged Gateway Intents" section.
4.  Enable the **"SERVER MEMBERS INTENT"**.



### Step 4: Run the Bot

Once configured, you can start the bot from within the `bot` directory.

```bash
node index.js
```

You should see console output indicating that the bot has logged into Discord and the API server is listening on your configured port.

**You must keep this bot running on a server (like a VPS, Heroku, or Render) for your website's features to work.**

### Step 5: Configure the Frontend

Make sure the `.env` file in the **root directory** of your project has the correct values for:
- `VITE_DISCORD_BOT_URL`: The full URL where your bot is accessible (e.g., `http://your-server-ip:3001`).
- `VITE_DISCORD_BOT_API_KEY`: The same secret key you set in the bot's `.env` file.

---

## Production Deployment & HTTPS

**IMPORTANT:** When you deploy your website to a service like Vercel or Netlify, it will be served over **`https`**. If your bot is running on a server with a simple `http` URL, browsers will block the website from communicating with it due to a **"Mixed Content" security policy**.

**To fix this, your bot's API must also be accessible over `https`.**

### Recommended Method: Reverse Proxy (Cloudflare)

The easiest and most robust way to secure your bot is to use a domain name and a free service like Cloudflare.

1.  **Get a domain name** and point it to your server's IP address.
2.  **Add your domain to Cloudflare** and enable its proxy service (the orange cloud). Cloudflare will automatically provide a free SSL certificate and handle all `https` traffic for you.
3.  Update your frontend's `VITE_DISCORD_BOT_URL` to your new `https` domain (e.g., `https://bot.yourdomain.com`).

### Alternative: Native HTTPS

This bot script now supports running an `https` server directly if you provide your own SSL certificate files. This is for advanced users who are managing their own certificates (e.g., from Let's Encrypt).

1.  Add the following variables to your bot's `.env` file:
    -   `HTTPS_KEY_PATH`: The full server path to your private key file (e.g., `/etc/letsencrypt/live/yourdomain.com/privkey.pem`).
    -   `HTTPS_CERT_PATH`: The full server path to your full chain certificate file (e.g., `/etc/letsencrypt/live/yourdomain.com/fullchain.pem`).
2.  Restart the bot. It will automatically detect these files and start an `https` server instead of an `http` server.
