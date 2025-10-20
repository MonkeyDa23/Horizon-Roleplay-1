# Vixel Discord Bot API (TypeScript Edition)

This is a professional, high-performance Node.js application built with TypeScript. It serves two critical functions:

1.  **Acts as a Discord Bot:** It logs into Discord and maintains a 24/7 connection to your server.
2.  **Runs a Web API:** It provides a secure, lightning-fast API that the main Vixel website calls to get guild data (like roles and member info) and to send all notifications (DMs and channel messages).

This upgraded version uses TypeScript for enhanced stability and type safety.

## ❗ CRITICAL STEP: FIXING "INVALID TOKEN" OR "USER NOT FOUND" ERRORS

The most common problems when setting up the bot are login failures, often with misleading error messages.

**This is almost always caused by a required permission that has not been enabled on the Discord Developer Portal.**

To fix this, you **MUST** do the following:

1.  Go to the **[Discord Developer Portal](https://discord.com/developers/applications)**.
2.  Select your bot application from the list.
3.  Click the **"Bot"** tab on the left-side menu.
4.  Scroll down to the **"Privileged Gateway Intents"** section.
5.  Find the **"SERVER MEMBERS INTENT"** and **turn the switch ON**.
6.  Click the green **"Save Changes"** button at the bottom of the page.



After enabling this intent, **restart your bot**. The login and user sync should now succeed.

## Why is this needed?

This bot acts as the central brain for all Discord interactions. It keeps a fresh list of your server's roles in memory (a "cache"). When the website needs roles, member data, or needs to send a notification, it makes a quick, secure call to this bot. This is much faster and more reliable than other methods and avoids hitting Discord's API rate limits.

## Setup Instructions

Follow these steps to get your bot up and running on your hosting service.

### Configuration Method 1: Environment Variables (Recommended & Secure)

This is the **best and most secure** way to configure the bot. Most professional hosting panels support this method.

1.  Log into your server's control panel.
2.  Look for a tab or menu item named **"Startup"** or **"Startup Parameters"**.
3.  On that page, you should find a section called **"ENVIRONMENT VARIABLES"**.
4.  Add the following variables:

-   `DISCORD_BOT_TOKEN`:
    -   Go to the [Discord Developer Portal](https://discord.com/developers/applications).
    -   Select your bot's application -> "Bot" page.
    -   Click "Reset Token". **Treat this like a password!**
    -   **Remember to enable the Gateway Intents as described in the critical step above!**

-   `DISCORD_GUILD_ID`:
    -   In your Discord app, enable Developer Mode (User Settings > Advanced).
    -   Right-click on your server's icon and click "Copy Server ID".

-   `API_SECRET_KEY`:
    -   This is a password **you create** to protect your API.
    -   Use a strong, random password (e.g., from a password generator).
    -   You must put this **exact same key** into the main website's environment variables (`VITE_DISCORD_BOT_API_KEY`).

**Note:** Channel IDs for notifications (submissions, audit logs) are now configured in the website's **Admin Panel** under the **Settings** tab, not here.

5.  After adding the variables, **restart your server** from the panel's console.

### Configuration Method 2: `config.json` File (Workaround)

Use this method **only if you are absolutely sure** that your hosting panel does not have a "Startup" or "Variables" page.

**WARNING: This method is less secure.** It involves placing your secrets in a file. **NEVER share this file with anyone.**

1.  Navigate to the `discord-bot/src` folder.
2.  Create a new file named `config.json`.
3.  Copy the contents from `config.example.json` and paste them into your new `config.json`.
4.  Replace the placeholder text with your actual token, server ID, and secret key.
5.  Save the `config.json` file and restart your bot.

### Deployment

Your work is mostly done! When you upload this `discord-bot` folder to your host, the startup scripts should automatically:

1.  Run `npm install` to download the necessary packages.
2.  Run `npm run build` to compile the TypeScript code into JavaScript in a `dist` folder.
3.  Run `npm start` to execute the compiled code from `dist/index.js`.

You should see logs in your hosting console like:
```
> node dist/index.js

ℹ️ No local config.json found. Relying solely on environment variables.
✅ Logged in as YourBotName#1234!
🚀 API server is listening on port 3001 (or whichever port the host assigned)
✅ Successfully cached 52 roles from guild "Your Server Name".
```

### Configure the Main Website

Now that your bot is running, you need to tell the website how to connect to it.

1.  Go to your main website's project and configure its environment variables (e.g., in your Supabase project settings for the Edge Functions).
2.  Fill in the values:
    -   `VITE_DISCORD_BOT_URL`: This is the public URL of your bot's API. Your hosting provider gives you this (e.g., `http://123.45.67.89:3001`).
    -   `VITE_DISCORD_BOT_API_KEY`: This must be the **exact same** `API_SECRET_KEY` you created.

## Troubleshooting

### API Test Fails with "Connection Refused"

If the Health Check page shows an error like `Connection refused`, it means your Supabase function was able to find your bot's server, but the server actively rejected the connection. This is a problem with your bot's hosting environment, not the website code.

Here are the most common causes and how to fix them:

1.  **The Bot is Not Running:**
    -   **Symptom:** The connection is instantly refused because no program is listening on that port.
    -   **Solution:** Check the logs on your hosting provider (e.g., Pterodactyl, a VPS `pm2 logs` command, etc.). Look for crash errors. If the bot is stopped, start it.

2.  **Firewall is Blocking the Port:**
    -   **Symptom:** The bot is running, but the server's firewall is preventing outside connections from reaching it.
    -   **Solution:** Go to your server or hosting provider's firewall settings (this might be called "Networking" or "Firewall"). You must create a rule to **ALLOW incoming TCP traffic** on the port your bot is using (e.g., `3001`).

3.  **Incorrect URL/Port:**
    -   **Symptom:** You've checked the two points above, but it's still failing.
    -   **Solution:** Go to your Supabase project's **Settings > Edge Functions** page. Carefully check the value for the `VITE_DISCORD_BOT_URL` secret. Ensure the IP address and port number are exactly correct and do not have any typos. Remember to include `http://`.

4.  **Bot Listening on the Wrong Interface (Less Common):**
    -   **Symptom:** The bot is only listening for connections from `localhost` (itself).
    -   **Solution:** The provided `index.ts` code is already configured to listen on `0.0.0.0`, which means it accepts connections from any IP. If you have modified this, ensure it is listening on `0.0.0.0` and not `127.0.0.1` or `localhost`.
