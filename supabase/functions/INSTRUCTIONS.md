# Setup Guide: Supabase Edge Functions (V12.0.0)

This guide provides instructions for setting up the Vixel Roleplay website using the integrated Supabase Edge Functions backend. This architecture moves all Discord-related logic into secure, serverless functions within your Supabase project.

**RECOMMENDATION:** It is highly recommended to have **Docker Desktop** installed and running on your system before using the Supabase CLI. This can prevent many common deployment issues.

---
## New Architecture: No More External Bot!

Previous versions of this system may have required you to run a separate Node.js bot on a server. **This is no longer necessary.**

The new architecture is "botless". All communication with Discord is handled securely and directly by the Supabase Edge Functions. This provides significant advantages:
-   **Faster Performance:** No extra network hop to an external server.
-   **Higher Reliability:** You no longer need to worry about your bot crashing or its server going down. If Supabase is online, your "bot" is online.
-   **Simpler Setup:** You only need to manage your Supabase project.

All you need is your bot's **token**, which you will store securely in Supabase's Function Secrets. The functions will then act on behalf of your bot.

---

## Step 1: Deploy Supabase Edge Functions

You must deploy all the provided functions to your Supabase project.

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

The functions need secret keys to communicate with Discord and to secure internal communication.

1.  **Go to your Supabase Project Dashboard.**
2.  Navigate to **Edge Functions**.
3.  Click on any of the functions you just deployed (e.g., `sync-user-profile`).
4.  Go to the **Secrets** tab in the function's menu.
5.  Add the following secrets:

    -   `DISCORD_BOT_TOKEN`: Your Discord bot's secret token.
    -   `DISCORD_GUILD_ID`: The ID of your Discord server (guild).
    -   `DISCORD_PROXY_SECRET`: A strong, random password that you create. This is used to secure the webhook for the audit log system. **You will need to enter this same secret in the Admin Panel later.**

    **Important:** You only need to set these secrets **once**. They are shared across all Edge Functions in your project.

---

## Step 3: Run the Database Schema

This script sets up all the necessary tables and database functions, including the new trigger-based logging system.

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
## Step 5: Configure Logging in the Admin Panel (Final Step!)

1. Go to your website and log in as an Admin.
2. Go to the **Admin Panel -> Appearance**.
3. Fill in the **"Discord Proxy Function URL"**. You can get this from your Supabase Dashboard -> Edge Functions -> discord-proxy -> Details.
4. Fill in the **"Discord Proxy Function Secret"** with the **exact same** secret you created in Step 2.
5. Save the settings.

Your setup is complete! Use the **System Health Check** page to verify that everything is connected correctly.