# Supabase & True Bot-less Setup Guide (V10.1.0)

This guide provides the complete, simplified instructions for deploying and configuring the backend for your website. This architecture is **truly "bot-less"**, meaning you **do not need to host or run a separate bot application**, and you **do not need to create any webhooks**. All communication with Discord happens directly and securely through Supabase Edge Functions using only a bot token.

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
8.  Select the scope `bot`.
9.  Under "Bot Permissions", select **"Administrator"**. This is the easiest way to ensure it has all necessary permissions.
10. Copy the generated URL at the bottom, paste it into your browser, and add the bot to your Discord server.

---

## Step 2: Set Supabase Function Secrets

These secrets allow your Edge Functions to securely act as your bot and call each other.

1.  Go to your Supabase Project -> **Settings** (gear icon) -> **Edge Functions**.
2.  Under the **"Secrets"** section, click **"Add a new secret"** for each of the following:

| Secret Name                   | Value                                                                   |
| ----------------------------- | ----------------------------------------------------------------------- |
| `DISCORD_BOT_TOKEN`           | The bot token you copied in the previous step.                          |
| `SUPABASE_URL`                | Your Supabase project URL (e.g., `https://xxxx.supabase.co`).           |
| `SUPABASE_SERVICE_ROLE_KEY`   | Your project's `service_role` key (found in Project Settings > API).    |

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
- `send-notification` (Replaces `test-notification`)
- `discord-proxy` (This is critical for all notifications)

---

## Step 4: Run the Database Schema (VERY IMPORTANT)

This script sets up all your tables and backend functions in the database.

1.  Go to Supabase Project -> **SQL Editor**.
2.  Click **"+ New query"**.
3.  Copy the ENTIRE content of the file at `src/lib/database_schema.ts`.
4.  Paste it into the editor and click **"RUN"**.

This script will automatically enable the `http` extension required for certain health checks.

---

## Step 5: How to Get Discord IDs

For the final configuration step, you will need Server, Channel, and Role IDs. Here's how to get them:

1.  In your Discord app, go to **User Settings** (gear icon) -> **Advanced**.
2.  Enable **Developer Mode**.
3.  Now you can right-click on anything in Discord to get its ID:
    -   **Server ID:** Right-click your server's icon -> "Copy Server ID".
    -   **Channel ID:** Right-click any text channel -> "Copy Channel ID".
    -   **Role ID:** Go to Server Settings -> Roles, right-click a role -> "Copy Role ID".

---

## Step 6: Final Configuration in Admin Panel

Once your website is running, you need to link it to your Discord server and set up notifications.

1.  Log into your website with your admin account.
2.  Navigate to the **Admin Panel**.
3.  Go to the **Appearance** tab:
    -   Fill in your **Discord Guild ID**.
    -   (Optional) Set a password for the admin panel for extra security.
4.  Go to the **Notifications** tab:
    -   Fill in the **Channel IDs** for the channels where you want to receive notifications (e.g., new submissions, audit logs).
    -   Fill in the **Mention Role IDs** for roles you want to ping in those notifications.
5.  Click **"Save Settings"** on both pages.

---

## Final Check

Your setup is complete! You can now use the **Health Check** page in the Admin Panel to verify that all connections are working correctly.