# Vixel Roleplay - Discord Bot

This is the backend Discord bot required for the Vixel Roleplay website. It's a lightweight Express.js server that communicates with the Discord API to provide real-time user data and send notifications/logs.

## ⚠️ Important Prerequisites

Before setting up the bot, you **MUST** do the following two things. They are the #1 cause of login and command issues.

### 1. Enable Server Members Intent

Go to the [Discord Developer Portal](https://discord.com/developers/applications), select your bot application, and go to the "Bot" tab.

You **MUST** enable the **SERVER MEMBERS INTENT**.

If this is disabled, the bot cannot see the roles of users who are not cached, and the login/permission system will fail.

### 2. Invite The Bot Correctly (For Slash Commands)

For the bot and its slash commands (like `/setstatus`) to work correctly, it must be invited to your server with the correct permissions and scopes. **If slash commands are not appearing, this is almost always the reason.**

1.  **Go to URL Generator**:
    *   Go to the [Discord Developer Portal](https://discord.com/developers/applications).
    *   Select your application, then go to `OAuth2 > URL Generator`.

2.  **Select Scopes**: The bot needs two scopes:
    *   `bot`
    *   `applications.commands` (This is the one that enables slash commands!)

3.  **Select Permissions**: The simplest setup is to grant `Administrator` permissions. This ensures the bot can do everything it needs.

4.  **Generate Invite Link**:
    *   After selecting scopes and permissions, a URL will be generated at the bottom of the page.
    *   Copy this URL.

5.  **Invite The Bot**:
    *   Paste the generated URL into your browser and invite the bot to your server.
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

### 2. Configuration

-   In the `discord-bot` directory, you will find a file named `config.example.json`.
-   Make a copy of this file and rename it to `config.json`.
-   Open `config.json` and fill in the values:

    ```json
    {
      "DISCORD_BOT_TOKEN": "YOUR_BOT_TOKEN_HERE",
      "DISCORD_GUILD_ID": "YOUR_SERVER_ID_HERE",
      "API_SECRET_KEY": "CREATE_A_STRONG_SECRET_PASSWORD_HERE",
      "PRESENCE_COMMAND_ROLE_IDS": [
        "YOUR_ADMIN_ROLE_ID_HERE"
      ]
    }
    ```

-   **`DISCORD_BOT_TOKEN`**: Get this from the Discord Developer Portal (Bot tab > "Reset Token").
-   **`DISCORD_GUILD_ID`**: Right-click your server icon in Discord (with Developer Mode on) and "Copy Server ID".
-   **`API_SECRET_KEY`**: **Create your own unique, strong password**. This is what your website will use to securely communicate with the bot. This **MUST** match the `VITE_DISCORD_BOT_API_KEY` secret you set in your Supabase project.
-   **`PRESENCE_COMMAND_ROLE_IDS`**: An array of Discord Role IDs that are allowed to use the `/setstatus` command. Server owners can always use it.

### 3. Build and Run

- First, build the TypeScript files into JavaScript:
    ```bash
    npm run build
    ```
- Then, run the bot.

#### For Development / Testing:

You can run the bot directly from your terminal. It will stop when you close the terminal.

```bash
npm start
```

#### For Production (Recommended):

It's highly recommended to use a process manager like **PM2** to keep the bot running 24/7, even if your terminal closes or the server reboots.

-   Install PM2 globally (you only need to do this once):
    ```bash
    npm install pm2 -g
    ```
-   Start the bot with PM2:
    ```bash
    pm2 start npm --name "vixel-bot" -- start
    ```
-   **To see the bot's logs (VERY IMPORTANT FOR DEBUGGING):**
    ```bash
    pm2 logs vixel-bot
    ```
-   To stop the bot:
    ```bash
    pm2 stop vixel-bot
    ```
-   To restart the bot:
     ```bash
    pm2 restart vixel-bot
    ```
-   To make PM2 automatically restart the bot on server reboot:
    ```bash
    pm2 startup
    # (Follow the instructions it gives you)
    pm2 save
    ```

## Firewall

Ensure that the port the bot is running on (default is **14355**) is open in your server's firewall. Supabase needs to be able to reach this port to send notification requests. If you are using a cloud provider (like AWS, Google Cloud, Oracle), you need to configure the "Security Group" or "Firewall Rules" for your virtual machine to allow inbound traffic on TCP port `14355`.

## Troubleshooting

**Problem: Notifications are not sent to Discord channels or DMs.**

The new architecture is more direct: A function in your Supabase database makes an HTTP request to the `discord-proxy` Edge Function, which then calls your bot.

1.  **Check the Health Check Page:**
    *   Go to your website's Admin Panel -> Health Check.
    *   Run **"Step 0: Database Outbound HTTP"**. This is the most critical test.
    *   **If it fails:** Your database cannot make external requests. This is rare, but could be due to an outdated Supabase project or network restrictions. The error message will provide clues. Ensure the `http` extension is enabled in your database (the schema script does this automatically).
    *   **If it succeeds:** The database *can* send requests. The problem is further down the line. Proceed to the next step.

2.  **Check the `discord-proxy` Function Logs:**
    *   Go to Supabase -> Edge Functions -> `discord-proxy`.
    *   Trigger an action that should send a notification (e.g., submit an application).
    *   Check the logs for an incoming request.
    *   **If you see `Unauthorized`**: Your `DISCORD_PROXY_SECRET` in the function's Secrets does not match what the database is sending. This is an internal configuration error, likely in the database schema's `private.send_notification` function.
    *   **If you see "Bot integration secrets are not configured"**: You missed Step 2 of the `supabase/functions/INSTRUCTIONS.md` guide. You need to set `VITE_DISCORD_BOT_URL` and `VITE_DISCORD_BOT_API_KEY` as secrets.
    *   **If you see "Error from bot API..." or a connection error**: The proxy function can't reach your bot. Check your bot's firewall and the `VITE_DISCORD_BOT_URL` secret. The error message will give you a hint.

3.  **Check Bot Logs:** Use `pm2 logs vixel-bot` on your server.
    *   Do you see an error like "Authentication failed"? Your `API_SECRET_KEY` in `config.json` doesn't match the `VITE_DISCORD_BOT_API_KEY` secret in Supabase.
    *   Do you see a "Discord API Error"? The bot might not have permission to send messages in the target channel or to DM the user. The error message in the log is very specific and will tell you what's wrong (e.g., "Missing Access", "Cannot send messages to this user").

**Problem: Slash commands like `/setstatus` don't appear or don't work.**

1.  **Re-Invite The Bot:** This is the most common fix. Follow the "Invite The Bot Correctly" steps at the top of this file to generate a new invite link with the correct `bot` and `applications.commands` scopes. Use it to re-authorize the bot in your server.
2.  **Check Bot Logs:** When the bot starts, it should log "Slash commands registered/updated successfully." If it logs an error, there's a problem with its connection or permissions.
3.  **Check Command Permissions:** Ensure the user trying the command has one of the roles listed in `PRESENCE_COMMAND_ROLE_IDS` or has Administrator permissions in the server. The bot logs will show a detailed permission check every time the command is used.