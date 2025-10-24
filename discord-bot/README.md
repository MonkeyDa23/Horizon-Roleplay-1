# Vixel Roleplay - Discord Bot

This is the backend Discord bot required for the Vixel Roleplay website. It's a lightweight Express.js server that communicates with the Discord API to provide real-time user data and send notifications.

## Features

-   Fetches user profiles, including roles, nickname, and avatar.
-   Fetches a complete list of guild roles.
-   Receives requests from the website (via Supabase) to send messages to specific channels or users (DMs).
-   Protected API endpoints using a secret key.
-   Simple health check endpoint for diagnostics.

## ⚠️ Important Prerequisite

Before setting up the bot, go to the [Discord Developer Portal](https://discord.com/developers/applications), select your bot application, and go to the "Bot" tab.

You **MUST** enable the **SERVER MEMBERS INTENT**.

This is the #1 cause of login issues. If this is disabled, the bot cannot see the roles of users who are not cached, and the login system will fail.

## Bot Invitation & Scopes

For the bot and its slash commands (like `/setstatus`) to work correctly, it must be invited to your server with the correct permissions and scopes.

1.  **Required Scopes**: The bot needs both `bot` and `applications.commands`.
2.  **Required Permissions**: The bot needs `Administrator` permissions to function correctly. This is the simplest setup, but you can also grant specific permissions like `Manage Roles` and `Send Messages` if you prefer.
3.  **Generate Invite Link**:
    *   Go to the Discord Developer Portal.
    *   Select your application, then go to `OAuth2 > URL Generator`.
    *   Select the scopes: `bot` and `applications.commands`.
    *   Select the bot permission: `Administrator`.
    *   Copy the generated URL at the bottom.
4.  **Re-Invite The Bot**: Use the generated URL to invite the bot to your server. If the bot is already in the server, you can simply use the URL again to update its permissions without kicking it.

**If slash commands are not appearing in Discord, it's almost always because the bot was invited without the `applications.commands` scope.**

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

-   In the `discord-bot/src` directory, you will find a file named `config.example.json`.
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

### 3. Running the Bot

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
-   To see the bot's logs:
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

## Firewall

Ensure that the port the bot is running on (default is **3000**) is open in your server's firewall, so that Supabase and your website can reach it.