# Supabase & Bot Setup Guide (V11 - Direct Notifications)

This guide provides the complete, simplified instructions for deploying and configuring the backend for your website. This architecture uses a **client-driven** approach where your website calls a secure **Supabase Edge Function (`send-notification`)**, which then communicates with your **self-hosted Discord bot**.

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
- `send-notification` (The new, unified notification handler)

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

This script sets up all your tables and backend helper functions in the database.

1.  Go to Supabase Project -> **SQL Editor**.
2.  Click **"+ New query"**.
3.  Copy the ENTIRE content of the file at `src/lib/database_schema.ts`.
4.  Paste it into the editor and click **"RUN"**.

This script is now much simpler as it no longer contains the complex webhook triggers.

---

## Step 4: Configure Notification Channels in Admin Panel

You need to tell the website which Discord channels to send notifications to.

1.  Log into your website with your admin account.
2.  Navigate to the **Admin Panel**.
3.  Go to the **Notifications** tab.
4.  Fill in the **Channel IDs** for:
    -   **Submission Channel**: Where new application notifications will be sent.
    -   **Audit Log Channel**: Where admin action logs will be sent.
5.  Click **"Save Settings"**.

---

## Final Check

After completing all steps, your backend should be fully operational. You can use the **Health Check** page in the Admin Panel to verify all connections and send test notifications to ensure everything is working correctly.
