# Supabase & Bot Setup Guide (V8 - Direct Bot Architecture)

This guide provides the complete, simplified instructions for deploying and configuring the backend for your website. This architecture uses **Supabase Database Functions** to directly call a **self-hosted Discord bot** via HTTP requests. This is a robust and easy-to-configure system.

**Please follow these steps exactly.**

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

**NOTE:** The `discord-proxy` function is no longer needed. If you have it deployed from a previous version, you can safely delete it.

---

## Step 2: Set Function Secrets

These secrets allow your functions to securely communicate with your bot. This step is much simpler now.

1.  Go to Supabase Project -> **Settings** (gear icon) -> **Edge Functions**.
2.  Under the **"Secrets"** section, add the following two secrets:

| Secret Name                | Value                                                                       | Where to get it?                                                              |
| -------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `VITE_DISCORD_BOT_URL`     | The full URL of your bot. **Ex:** `http://123.45.67.89:14355`                 | The public IP/domain of the server where you are running the `discord-bot`.     |
| `VITE_DISCORD_BOT_API_KEY` | The secret password from your bot's `config.json` file.                     | You create this. It MUST match the `API_SECRET_KEY` in the bot's config.    |

---

## Step 3: Run the Database Schema (VERY IMPORTANT)

This script sets up all your tables and backend functions in the database, including the direct notification system.

1.  Go to Supabase Project -> **SQL Editor**.
2.  Click **"+ New query"**.
3.  Copy the ENTIRE content of the file at `src/lib/database_schema.ts`.
4.  Paste it into the editor and click **"RUN"**.

This script will automatically enable the `http` extension required for the database to send notifications.

---

## Step 4: Configure Bot Connection in Admin Panel (CRITICAL)

The database needs to know how to contact your bot. You will set this from the website's admin panel.

1.  Log into your website with your admin account.
2.  Navigate to the **Admin Panel**.
3.  Go to the **Appearance** tab.
4.  Scroll down to the **"Discord & Bot Integration"** section.
5.  Fill in the **"Discord Bot URL"** and **"Discord Bot API Key"** fields. These values must **exactly match** the ones you set in your Supabase secrets and your bot's `config.json`.
6.  Click **"Save Settings"**.

---

## Final Check

After completing all steps, your backend should be fully operational. You can use the **Health Check** page in the Admin Panel to verify all connections. The "Step 0: Database Outbound HTTP" and "Step 3: Bot Connection Test" are particularly important for verifying the new notification system.