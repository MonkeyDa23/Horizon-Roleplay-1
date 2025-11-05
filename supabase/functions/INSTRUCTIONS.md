# Supabase & Bot Setup Guide (V10 - Pure Bot Architecture)

This guide provides the complete, simplified instructions for deploying and configuring the backend for your website. This architecture uses a **Supabase Database Function** to call a secure **Supabase Edge Function (`discord-proxy`)**, which then reliably communicates with your **self-hosted Discord bot**. All notifications, including logs and DMs, are sent through the bot.

This is the most robust and easy-to-debug setup. **Please follow these steps exactly.**

---

## Step 1: Deploy Supabase Edge Functions

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
- `discord-proxy` (This one is critical for all notifications)

---

## Step 2: Set Function Secrets

These secrets allow your Edge Functions to securely communicate with your bot.

1.  Go to Supabase Project -> **Settings** (gear icon) -> **Edge Functions**.
2.  Under the **"Secrets"** section, add the following two secrets. These are used by `sync-user-profile`, `discord-proxy`, and other functions to talk to your bot.

| Secret Name                | Value                                                                       | Where to get it?                                                              |
| -------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `VITE_DISCORD_BOT_URL`     | The full URL of your bot. **Ex:** `http://123.45.67.89:14355`                 | The public IP/domain of the server where you are running the `discord-bot`.     |
| `VITE_DISCORD_BOT_API_KEY` | The secret password from your bot's `config.json` file.                     | You create this. It MUST match the `API_SECRET_KEY` in the bot's config.    |

---

## Step 3: Run the Database Schema (VERY IMPORTANT)

This script sets up all your tables and backend functions in the database, including the new unified notification system.

1.  Go to Supabase Project -> **SQL Editor**.
2.  Click **"+ New query"**.
3.  Copy the ENTIRE content of the file at `src/lib/database_schema.ts`.
4.  Paste it into the editor and click **"RUN"**.

This script will automatically enable the `http` extension required for the database to send notifications via the proxy function.

---

## Step 4: Configure Website-to-Bot-Proxy Connection

The database needs to know how to contact its own `discord-proxy` function. You will set this from the website's admin panel.

1.  Log into your website with your admin account.
2.  Navigate to the **Admin Panel**.
3.  Go to the **Appearance** tab.
4.  Scroll down to the **"Discord & Notification Integration"** section.
5.  Fill in the following two fields:

    -   **Supabase Project URL**:
        -   **Where to find it:** Go to your Supabase Dashboard -> Project Settings -> API. Copy the **Project URL**.
        -   **Example:** `https://yourprojectid.supabase.co`

    -   **Discord Proxy Secret**:
        -   **What it is:** This is a password YOU create. It acts as a secret handshake between your database and your `discord-proxy` function.
        -   **Action:** Create a strong, random password (e.g., from a password generator) and paste it here.

6.  Click **"Save Settings"**.

---

## Step 5: Configure the Bot

All notification destinations (channel IDs, mention roles) are now managed in one place: the bot's configuration file.

1. On the server where you host the bot, open the `discord-bot/config.json` file.
2. Fill in all the `CHANNELS` and `MENTION_ROLES` with the correct IDs from your Discord server.
3. Restart the bot for the changes to take effect.

---

## Final Check

After completing all steps, your backend should be fully operational. You can use the **Health Check** page in the Admin Panel to verify all connections. If notifications still fail, any error will now appear instantly on the website, telling you exactly what went wrong.