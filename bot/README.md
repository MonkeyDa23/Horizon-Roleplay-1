# Vixel Roleplay - Standalone Discord Bot

This is the dedicated Discord bot for the Vixel Roleplay website. It handles all Discord-related interactions, including user data synchronization, role fetching, and sending notifications/logs.

## Features

-   **Express API:** Exposes a secure API for the website to communicate with.
-   **User Sync:** Provides detailed user profiles (roles, avatar, etc.) to the website upon login.
-   **Role Management:** Exposes an endpoint to fetch all server roles for the permissions panel.
-   **Notifications:** Sends rich, embedded messages to specific channels or as DMs to users for:
    -   New submissions
    -   Submission status updates (Accepted/Refused)
    -   Audit logs (Bans, Admin actions)
    -   Welcome messages for new users logging into the website.

## Setup & Installation

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Environment Variables:**
    -   Copy the `.env.example` file to a new file named `.env`.
    -   Fill in the required values:
        -   `DISCORD_BOT_TOKEN`: Your bot's token from the [Discord Developer Portal](https://discord.com/developers/applications).
        -   `DISCORD_GUILD_ID`: The ID of your Discord server.
        -   `PORT`: The port for the API server to run on (default is `3001`).
        -   `API_SECRET_KEY`: A strong, secret random string. **This must be the exact same value as `VITE_DISCORD_BOT_API_KEY` in the website's `.env` file.**

3.  **Enable Discord Intents:**
    -   Go to your bot's application page in the Discord Developer Portal.
    -   Navigate to the "Bot" tab.
    -   Enable the **SERVER MEMBERS INTENT** under "Privileged Gateway Intents". This is **required** for the bot to fetch member details.

## Running the Bot

### Development

For development, it's recommended to use `nodemon` for automatic restarts on file changes.

```bash
npm run dev
```

### Production

For a production environment, use the standard start script. It's recommended to use a process manager like `pm2` to keep the bot running.

```bash
npm start
```

## Website Configuration

Ensure your website's `.env` file is configured correctly to communicate with this bot:

```
VITE_DISCORD_BOT_URL=http://localhost:3001  # Or your bot's public URL in production
VITE_DISCORD_BOT_API_KEY="the-same-secret-key-as-in-the-bot-env"
```
