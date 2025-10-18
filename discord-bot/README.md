# Vixel Discord Bot API (TypeScript Edition)

This is a professional, high-performance Node.js application built with TypeScript. It serves two critical functions:

1.  **Acts as a Discord Bot:** It logs into Discord and maintains a 24/7 connection to your server.
2.  **Runs a Web API:** It provides a secure, lightning-fast API endpoint that the main Vixel website calls to get a list of all roles in your server.

This upgraded version uses TypeScript for enhanced stability and type safety.

## Why is this needed?

By having this bot run 24/7, it keeps a fresh list of your server's roles in its memory (a "cache"). When the website needs the roles (e.g., on the Admin Permissions page), it asks this bot instead of asking Discord directly. This is much faster and prevents the website from hitting Discord's API rate limits.

## Setup Instructions

Follow these steps to get your bot up and running on your hosting service (like Wispbyte).

### 1. Configure Environment Variables

This is the most important step. This application reads its configuration from **Environment Variables**, which you must set in your hosting provider's control panel.

**Do NOT use an `.env` or `env.ts` file for configuration on your live server.**

Go to your server's control panel (e.g., the Wispbyte panel) and find the section for "Variables" or "Environment Variables" and add the following:

-   `DISCORD_BOT_TOKEN`:
    -   Go to the [Discord Developer Portal](https://discord.com/developers/applications).
    -   Select your bot's application.
    -   Go to the "Bot" page from the menu on the left.
    -   Click the "Reset Token" button to reveal your token. **Treat this like a password!**
    -   **CRITICAL:** On the same "Bot" page, scroll down to "Privileged Gateway Intents" and **enable the SERVER MEMBERS INTENT**. The bot cannot see roles without this.

-   `DISCORD_GUILD_ID`:
    -   In your Discord app, go to User Settings > Advanced and enable **Developer Mode**.
    -   Right-click on your server's icon and click "Copy Server ID".
    -   Paste the ID here.

-   `API_SECRET_KEY`:
    -   This is a password you create to protect your API.
    -   Use a strong, random password (e.g., from a password generator).
    -   You will need to put this **exact same key** into the main website's environment variables (`VITE_DISCORD_BOT_API_KEY`).

Your hosting provider will automatically provide the `PORT` variable. You do not need to set it.

### 2. Deployment

Your work is mostly done! When you upload this `discord-bot` folder to your host, the startup scripts should automatically:

1.  Run `npm install` to download the necessary packages.
2.  Run `npm run build` to compile the TypeScript code into JavaScript in a `dist` folder.
3.  Run `npm start` to execute the compiled code from `dist/index.js`.

You should see logs in your hosting console like:
```
> node dist/index.js

✅ Logged in as YourBotName#1234!
🚀 API server is listening on port 2077 (or whichever port the host assigned)
✅ Successfully cached 52 roles from guild "Your Server Name".
```

### 3. Configure the Main Website

Now that your bot is running, you need to tell the website how to connect to it.

1.  Go to your main website's project and configure its environment variables (e.g., in Vercel or your Supabase project settings).
2.  Fill in the values:
    -   `VITE_DISCORD_BOT_URL`: This is the public URL of your bot's API. Your hosting provider gives you this (e.g., `https://my-bot.wispbyte.com`).
    -   `VITE_DISCORD_BOT_API_KEY`: This must be the **exact same** `API_SECRET_KEY` you created in Step 1.

After deploying your website with these variables, it will now fetch roles from your super-fast bot!
