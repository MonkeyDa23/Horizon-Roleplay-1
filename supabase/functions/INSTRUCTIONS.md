# Supabase & Bot-less Setup Guide (V9.0.0)

This guide provides the complete, simplified instructions for deploying and configuring the backend for your website. This architecture is **"bot-less"**, meaning you **do not need to host or run a separate bot application**. All communication with Discord happens directly and securely through Supabase Edge Functions.

**Please follow these steps exactly.**

---

## Step 1: Create a Discord Bot Application

You need a bot application to get a token, which allows your website to interact with Discord.

1.  Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2.  Click **"New Application"** and give it a name (e.g., "Vixel Website Bot").
3.  Go to the **"Bot"** tab on the left.
4.  Under the "Privileged Gateway Intents" section, **enable all three intents**:
    -   `PRESENCE INTENT`
    -   `SERVER MEMBERS INTENT` (CRITICAL for role synchronization)
    -   `MESSAGE CONTENT INTENT`
5.  Click **"Save Changes"**.
6.  Click the **"Reset Token"** button, confirm, and **copy the new token**. You will need this in the next step.
7.  Go to the **"OAuth2"** tab -> **"URL Generator"**.
8.  Select the scopes `bot` and `applications.commands`.
9.  Under "Bot Permissions", select **"Administrator"**. This is the easiest way to ensure it has all necessary permissions.
10. Copy the generated URL at the bottom, paste it into your browser, and add the bot to your Discord server.

---

## Step 2: Set Supabase Function Secrets

This secret allows your Edge Functions to securely act as your bot.

1.  Go to your Supabase Project -> **Settings** (gear icon) -> **Edge Functions**.
2.  Under the **"Secrets"** section, click **"Add a new secret"**.

| Secret Name         | Value                                                 | Where to get it?                                |
| ------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| `DISCORD_BOT_TOKEN` | The bot token you copied in the previous step.        | From your bot's page in the Discord Developer Portal. |

---

## Step 3: Deploy Supabase Edge Functions

You must deploy the required functions from the `supabase/functions` directory.

1.  Go to your Supabase Project -> **Edge Functions**.
2.  For each function listed below, click **"Create a function"**.
3.  Enter the function's name (it MUST exactly match the folder name).
4.  Delete all boilerplate code in the editor.
5.  Copy the entire contents of the corresponding `index.ts` file and paste it into the editor.
6.  Click **"Deploy"**.

**Deploy these functions:**
- `sync-user-profile`
- `get-guild-roles`
- `check-bot-health`
- `check-function-secrets`
- `troubleshoot-user-sync`
- `test-notification`
- `discord-proxy` (This is critical for all notifications)

---

## Step 4: Run the Database Schema (VERY IMPORTANT)

This script sets up all your tables and backend functions in the database.

1.  Go to Supabase Project -> **SQL Editor**.
2.  Click **"+ New query"**.
3.  Copy the ENTIRE content of the file at `src/lib/database_schema.ts`.
4.  Paste it into the editor and click **"RUN"**.

This script will automatically enable the `http` extension required for the database to send notifications.

---

## Step 5: Final Configuration in Admin Panel

Once your website is running, you need to link it to your Discord server and set up notifications.

1.  Log into your website with your admin account.
2.  Navigate to the **Admin Panel**.
3.  Go to the **Appearance** tab:
    -   Fill in your **Discord Guild ID**. (Right-click your server icon in Discord -> "Copy Server ID". You need Developer Mode enabled).
4.  Go to the **Notifications** tab:
    -   Fill in the **Webhook URLs** for the channels where you want to receive notifications (e.g., new submissions, audit logs).
    -   Fill in the **Mention Role IDs** for roles you want to ping in those notifications. (Right-click a role -> "Copy Role ID").
5.  Click **"Save Settings"** on both pages.

---

## Final Check

Your setup is complete! You can now use the **Health Check** page in the Admin Panel to verify that all connections are working correctly.
