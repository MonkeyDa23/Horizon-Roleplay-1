# Supabase & Bot Setup Guide (V7 - Direct HTTP Architecture)

This guide provides the complete, step-by-step instructions for deploying and configuring the backend for your website. This architecture uses **Supabase Database Functions** to directly call a **self-hosted Discord bot** via HTTP requests, which is more reliable than the previous webhook system.

**Please follow these steps exactly.**

---

## Step 1: Deploy Supabase Edge Functions

You must deploy all seven functions from the `supabase/functions` directory.

1.  Go to your Supabase Project -> **Edge Functions**.
2.  Click **"Create a function"**.
3.  Enter the function's name (it MUST exactly match the folder name, e.g., `sync-user-profile`).
4.  Delete all boilerplate code in the editor.
5.  Copy the entire contents of the corresponding `index.ts` file (e.g., `supabase/functions/sync-user-profile/index.ts`) and paste it into the editor.
6.  Click **"Deploy"**.

**Repeat this process for all seven functions:**
- `sync-user-profile`
- `get-guild-roles`
- `discord-proxy` (This is still used for receiving calls from the database)
- `check-bot-health`
- `check-function-secrets`
- `troubleshoot-user-sync`
- `test-notification`

---

## Step 2: Set Function Secrets (CRITICAL)

These secrets allow your functions to securely communicate with your bot.

1.  Go to Supabase Project -> **Settings** (gear icon) -> **Edge Functions**.
2.  Under the **"Secrets"** section, add the following secrets:

| Secret Name                | Value                                                                       | Where to get it?                                                              |
| -------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `VITE_DISCORD_BOT_URL`     | The full URL of your bot. **Ex:** `http://123.45.67.89:14355`                 | The public IP/domain of the server where you are running the `discord-bot`.     |
| `VITE_DISCORD_BOT_API_KEY` | The secret password from your bot's `config.json` file.                     | You create this. It MUST match the `API_SECRET_KEY` in the bot's config.    |
| `DISCORD_PROXY_SECRET`     | A **new, unique password** for internal security between DB and functions.  | Generate a strong password. This is **NOT** the same as the bot's API key. |

---

## Step 3: Run the Database Schema (VERY IMPORTANT)

This script sets up all your tables and backend functions in the database, including the new notification system.

1.  Go to Supabase Project -> **SQL Editor**.
2.  Click **"+ New query"**.
3.  Copy the ENTIRE content of the file at `src/lib/database_schema.ts`.
4.  Paste it into the editor and click **"RUN"**.

This script will automatically enable the `http` extension required for the database to send notifications.

**NOTE:** The old database webhook is no longer needed. If you have a webhook named `discord_notifications` in your database settings, you can safely delete it to avoid confusion.

---

## Final Check

After completing all steps, your backend should be fully operational. You can use the **Health Check** page in the Admin Panel to verify all connections. The "Step 0: Database Outbound HTTP" test is particularly important for verifying the new notification system.