# Supabase & Bot Setup Guide (V12 - Simplified Architecture)

This guide provides the complete, simplified instructions for deploying and configuring the backend for your website. This architecture uses a hybrid approach for maximum stability and simplicity:

1.  **Channel Notifications (Webhooks):** New submissions and audit logs are sent **directly from the database** to Discord channels via webhooks. This is fast, reliable, and has no other dependencies.
2.  **Direct Messages (DMs):** DMs (like submission receipts or results) are sent via a simple Edge Function (`send-dm`) that securely calls your self-hosted Discord bot.

**Please follow these steps exactly.**

---

## Step 1: Deploy Supabase Edge Functions

You must deploy the required functions from the `supabase/functions` directory.

1.  Go to your Supabase Project -> **Edge Functions**.
2.  **DELETE** the old `send-notification` function if it exists.
3.  For each function listed below, click **"Create a function"**.
4.  Enter the function's name (it MUST exactly match the folder name).
5.  Delete all boilerplate code in the editor.
6.  Copy the entire contents of the corresponding `index.ts` file and paste it into the editor.
7.  Click **"Deploy"**.

**Deploy these functions:**
- `sync-user-profile`
- `get-guild-roles`
- `check-bot-health`
- `check-function-secrets`
- `troubleshoot-user-sync`
- `send-dm` **(NEW)**
- `test-webhook` **(NEW)**

---

## Step 2: Set Function Secrets

These secrets allow your Edge Functions to securely communicate with your bot.

1.  Go to Supabase Project -> **Settings** (gear icon) -> **Edge Functions**.
2.  Under the **"Secrets"** section, add the following two secrets.

| Secret Name                | Value                                                                       | Where to get it?                                                              |
| -------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `VITE_DISCORD_BOT_URL`     | The full URL of your bot. **Ex:** `http://123.45.67.89:14355`                 | The public IP/domain of the server where you are running the `discord-bot`.     |
| `VITE_DISCORD_BOT_API_KEY` | The secret password from your bot's `config.json` file.                     | You create this. It MUST match the `API_SECRET_KEY` in the bot's config.    |

---

## Step 3: Run the Database Schema (VERY IMPORTANT)

This script sets up all your tables and the new webhook trigger system in the database.

1.  Go to Supabase Project -> **SQL Editor**.
2.  Click **"+ New query"**.
3.  Copy the ENTIRE content of the file at `src/lib/database_schema.ts`.
4.  Paste it into the editor and click **"RUN"**.

This script is safe to run multiple times. It will clean up old triggers before creating the new ones.

---

## Step 4: Configure Webhook URLs in Admin Panel

You need to tell the website which Discord webhook URLs to use for channel notifications.

1.  Log into your website with your admin account.
2.  Navigate to the **Admin Panel**.
3.  Go to the **Notifications** tab.
4.  Fill in the **Webhook URLs** for:
    -   **Submission Webhook URL**: Where new application notifications will be sent.
    -   **Audit Log Webhook URL**: Where admin action logs will be sent.
5.  Click **"Save Settings"**.
6.  Use the "Test" buttons to ensure your webhooks are working correctly.

---

## Final Check

After completing all steps, your backend should be fully operational. You can use the **Health Check** page in the Admin Panel to verify all connections and send test DMs to ensure the bot is working correctly.
