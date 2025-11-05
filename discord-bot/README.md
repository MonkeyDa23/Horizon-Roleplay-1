# Vixel Roleplay - Discord Bot (v3.0 - Bot-Centric)

This is the completely rebuilt backend Discord bot required for the Vixel Roleplay website. It's a lightweight, robust Express.js server that serves as the **single point of communication** for all Discord interactions. It provides an authenticated REST API for the website (via Supabase Edge Functions) to fetch real-time user data and to send all notifications and logs.

This version centralizes all Discord-related configurations (channel IDs, roles to mention) within the bot itself, removing this responsibility from the website's database and admin panel for a cleaner, more robust architecture.

The bot also includes a web-based control panel accessible directly from its URL (e.g., `http://YOUR_BOT_IP:14355`).

## ⚠️ CRITICAL PREREQUISITES

Before setting up the bot, you **MUST** do the following. These are the #1 cause of login, permission, and command issues.

### 1. Enable Server Members Intent

Go to the [Discord Developer Portal](https://discord.com/developers/applications), select your bot application, and go to the "Bot" tab.

You **MUST** enable the **SERVER MEMBERS INTENT**.

If this is disabled, the bot cannot see the roles of users who are not cached, and the entire login/permission system will fail.

### 2. Invite The Bot Correctly (For Slash Commands)

For the bot and its slash commands (like `/setstatus`) to work correctly, it must be invited to your server with the correct permissions and scopes.

1.  **Go to URL Generator**:
    *   Go to the [Discord Developer Portal](https://discord.com/developers/applications).
    *   Select your application, then go to `OAuth2 > URL Generator`.

2.  **Select Scopes**: The bot needs two scopes:
    *   `bot`
    *   `applications.commands` (This is what enables slash commands!)

3.  **Select Permissions**: The simplest setup is to grant `Administrator` permissions. This ensures the bot can do everything it needs.

4.  **Generate & Use Invite Link**:
    *   Copy the generated URL at the bottom of the page.
    *   Paste the URL into your browser and invite the bot to your server.
    *   If the bot is already in your server, you can simply use the URL again to **re-authorize and update its permissions** without kicking it.

---

## Installation & Setup

You need to host this bot on a server, such as a VPS or a dedicated machine.

### 1. Upload and Install

-   Upload the entire `discord-bot` folder to your server.
-   Navigate into the folder in your server's terminal: `cd discord-bot`
-   Install the required packages:
    ```bash
    npm install
    ```

### 2. Configuration (The Most Important Step)

-   In the `discord-bot` directory, find the file named `config.example.json`.
-   Make a copy of this file and rename it to `config.json`.
-   Open `config.json` and fill in all the values carefully.

    ```json
    {
      "DISCORD_BOT_TOKEN": "YOUR_BOT_TOKEN_HERE",
      "DISCORD_GUILD_ID": "YOUR_SERVER_ID_HERE",
      "API_SECRET_KEY": "CREATE_A_STRONG_SECRET_PASSWORD_HERE",
      "PRESENCE_COMMAND_ROLE_IDS": ["..."],
      "CHANNELS": {
        "SUBMISSIONS": "CHANNEL_ID_FOR_NEW_SUBMISSIONS",
        "AUDIT_LOG_GENERAL": "CHANNEL_ID_FOR_GENERAL_LOGS",
        "AUDIT_LOG_SUBMISSIONS": "CHANNEL_ID_FOR_SUBMISSION_ACTION_LOGS",
        "AUDIT_LOG_BANS": "CHANNEL_ID_FOR_BAN_LOGS",
        "AUDIT_LOG_ADMIN": "CHANNEL_ID_FOR_ADMIN_PANEL_ACTION_LOGS"
      },
      "MENTION_ROLES": {
        "SUBMISSIONS": "ROLE_ID_TO_MENTION_FOR_NEW_SUBMISSIONS",
        "AUDIT_LOG_GENERAL": "",
        "AUDIT_LOG_SUBMISSIONS": "",
        "AUDIT_LOG_BANS": "",
        "AUDIT_LOG_ADMIN": ""
      }
    }
    ```

-   **`DISCORD_BOT_TOKEN`**: Get this from the Discord Developer Portal (Bot tab > "Reset Token").
-   **`DISCORD_GUILD_ID`**: Right-click your server icon in Discord (with Developer Mode on) and "Copy Server ID".
-   **`API_SECRET_KEY`**: **Create your own unique, strong password**. This is what your website will use to securely communicate with the bot. This **MUST** match the `VITE_DISCORD_BOT_API_KEY` secret you set in your Supabase project.
-   **`CHANNELS`**: **This is critical.** Fill in the ID for each channel where you want the bot to post a specific type of log. Right-click a channel in Discord and "Copy Channel ID".
-   **`MENTION_ROLES`**: (Optional) If you want the bot to mention a role with a notification, put the Role ID here. Right-click a role and "Copy Role ID". Leave as `""` if not needed.

### 3. Build and Run

- First, build the TypeScript files into JavaScript:
    ```bash
    npm run build
    ```
- Then, run the bot using a process manager like `pm2` to keep it online 24/7.

    ```bash
    # Install pm2 globally if you haven't already
    npm install pm2 -g
    
    # Start the bot and give it a name
    pm2 start dist/index.js --name vixel-bot
    
    # Save the process list so it restarts after a server reboot
    pm2 save
    ```

**Useful `pm2` commands:**
- `pm2 logs vixel-bot`: View the bot's live console logs. **(Use this for troubleshooting!)**
- `pm2 restart vixel-bot`: Restart the bot after changing `config.json`.
- `pm2 stop vixel-bot`: Stop the bot.
- `pm2 list`: See the status of all running applications.

## Firewall

Ensure that the port the bot is running on (default is **14355**) is open in your server's firewall. Supabase needs to be able to reach this port to send notification requests. If you are using a cloud provider (like AWS, Google Cloud, Oracle), you need to configure the "Security Group" or "Firewall Rules" for your virtual machine to allow inbound traffic on TCP port `14355`.

## Troubleshooting

**Problem: Notifications are not sent to Discord channels or DMs.**

1.  **Check the Health Check Page:**
    *   Go to your website's Admin Panel -> Health Check.
    *   Run **"Step 3: Bot Connection Test"**.
    *   **If it fails:** Your Supabase Function can't reach the bot. The error message will tell you why (e.g., bot is offline, firewall blocking the port, `VITE_DISCORD_BOT_URL` is wrong in Supabase secrets).

2.  **Check Bot Logs:** Use `pm2 logs vixel-bot` on your server to see the logs.
    *   Do you see an error like "Authentication failed"? Your `API_SECRET_KEY` in `config.json` doesn't match the `VITE_DISCORD_BOT_API_KEY` secret in Supabase.
    *   Do you see a "Discord API Error"? The bot might not have permission to send messages in the target channel or to DM the user. The error message in the log is very specific and will tell you what's wrong (e.g., "Missing Access", "Cannot send messages to this user"). Check the Channel IDs in `config.json`.
