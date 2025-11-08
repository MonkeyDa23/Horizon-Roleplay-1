# Setup Guide: Supabase Edge Functions (V11.0.0)

This guide provides instructions for setting up the Vixel Roleplay website using the integrated Supabase Edge Functions backend. This architecture moves all Discord-related logic into secure, serverless functions within your Supabase project.

**RECOMMENDATION:** It is highly recommended to have **Docker Desktop** installed and running on your system before using the Supabase CLI. This can prevent many common deployment issues.

---

## Step 0: Clean Up Old Functions (Important for Upgrades)

> **⚠️ WARNING:** This is a critical step! If you are upgrading from a previous version, you might have old, obsolete function folders. These WILL cause deployment errors.

**Delete the following folders** from your `supabase/functions` directory if they exist:
- `discord-bot-interactions`
- `get-discord-user-profile`
- `check-function-secrets`
- `send-notification`
- `test-notification`
- `_shared`  <-- **DELETE THIS FOLDER**

Your `supabase/functions` directory should only contain the following folders: `shared`, `check-bot-health`, `discord-proxy`, `get-guild-roles`, `sync-user-profile`, `troubleshoot-user-sync`.

---

## Step 1: Deploy Supabase Edge Functions

You must deploy all the provided functions to your Supabase project.

### Deployment Method

It is **highly recommended** to deploy functions using the Supabase CLI. This method correctly handles all functions and shared code at once. While deploying directly from the Supabase dashboard's Function Editor is possible (and the code has been updated to support it), the CLI is more reliable.

1.  **Install Supabase CLI:** If you haven't already, install the Supabase command-line interface.
    ```bash
    npm install supabase --save-dev
    ```

2.  **Link Your Project:** In your project's root directory, link the CLI to your remote Supabase project. You will need your Project ID.
    ```bash
    npx supabase link --project-ref YOUR_PROJECT_ID
    ```

3.  **Deploy the Functions:** Deploy all the functions in the `supabase/functions` directory.
    ```bash
    npx supabase functions deploy --project-ref YOUR_PROJECT_ID
    ```
    This command will deploy all the necessary functions.

---

## Step 2: Set Function Secrets

The functions need secret keys to communicate with Discord. **These are NOT the same as your `.env` file.** These secrets are stored securely in Supabase.

1.  **Go to your Supabase Project Dashboard.**
2.  Navigate to **Edge Functions**.
3.  Click on any of the functions you just deployed (e.g., `sync-user-profile`).
4.  Go to the **Secrets** tab in the function's menu.
5.  Add the following secrets:

    -   `DISCORD_BOT_TOKEN`: Your Discord bot's secret token.
    -   `DISCORD_GUILD_ID`: The ID of your Discord server (guild).

    **Important:** You only need to set these secrets **once**. They are shared across all Edge Functions in your project.

---

## Step 3: Run the Database Schema

This script sets up all the necessary tables and database functions, which are now designed to work with your new Edge Functions.

1.  Go to your Supabase Project -> **SQL Editor**.
2.  Click **"+ New query"**.
3.  Copy the ENTIRE content of the file at `src/lib/database_schema.ts`.
4.  Paste it into the editor and click **"RUN"**.

---

## Step 4: Configure the Frontend

The frontend needs your Supabase project's URL and public key.

1.  In the root of this project, find the file named `.env.example`.
2.  Create a copy and rename it to `.env`.
3.  Open the new `.env` file and fill in:
    -   `VITE_SUPABASE_URL`: Your Supabase project URL.
    -   `VITE_SUPABASE_ANON_KEY`: Your Supabase project's public `anon` key.

---

## Final Check

Your setup is complete! Use the **System Health Check** page (accessible to Super Admins via the Admin Panel) to verify that the website, database, and Edge Functions are all communicating correctly with the Discord API.