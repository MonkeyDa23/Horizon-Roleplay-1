
# Supabase Functions: Deployment and Configuration Guide

This guide provides step-by-step instructions for deploying and configuring all the necessary Supabase Edge Functions for your Vixel Roleplay website. These functions work in tandem with your external Discord Bot.

## What Are These Functions?

Supabase Edge Functions are pieces of code (written in TypeScript/Deno) that run on Supabase's servers. They allow your website to perform secure backend tasks.

-   **`sync-user-profile`**: The most important function. It runs every time a user logs in. It securely communicates with your **external Discord bot** to fetch the user's latest username, avatar, and roles, then updates their profile in your database. This is how permissions are granted.
-   **`get-guild-roles`**: Used by the Admin Panel to fetch a list of all roles from your bot for the permissions configuration page.
-   **`check-bot-health`**: Used by the "Health Check" page to diagnose the connection to your bot.
-   **`troubleshoot-user-sync`**: A powerful diagnostic tool for the "Health Check" page to test fetching a specific user's data from the bot, helping to solve login issues.
-   **`discord-proxy`**: A secure messenger. Your database triggers call this function to send notifications (DMs, channel messages) to your bot, which then sends them to Discord.

## Step 1: Deploying the Functions

You need to deploy each function using the Supabase Dashboard. Repeat these steps for **all five** functions listed in the `supabase/functions` directory.

1.  Go to your Supabase Project Dashboard.
2.  Click on the **Edge Functions** icon in the left sidebar (it looks like a lambda λ symbol).
3.  Click **"Create a function"**.
4.  Enter the function's name. **The name MUST exactly match the folder name**. For example, for the `sync-user-profile` folder, the function name must be `sync-user-profile`.
5.  Click **"Create function"**.
6.  You will be taken to a code editor. **Delete all the boilerplate code** that is already there.
7.  Open the corresponding `index.ts` file on your computer (e.g., `supabase/functions/sync-user-profile/index.ts`).
8.  **Copy the entire contents** of the file.
9.  **Paste the code** into the Supabase editor.
10. Click **"Deploy"** in the top right corner.

**Repeat this process for all five functions: `sync-user-profile`, `get-guild-roles`, `check-bot-health`, `troubleshoot-user-sync`, and `discord-proxy`.**

## Step 2: Setting Secrets (Project-Level)

Supabase secrets are managed at the **project level**, meaning you only need to add each secret **once**, and all your functions can access it.

1.  In your Supabase project, click the **Settings** icon (a gear ⚙️) in the left sidebar.
2.  Click on **"Edge Functions"** in the settings menu.
3.  You will see a **"Secrets"** section. This is where you will add the keys that allow your functions to talk to your bot.
4.  Click **"+ Add a new secret"**.

### Secrets to Add

| Secret Name                   | How to Get the Value                                                                                                                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_DISCORD_BOT_URL`        | The **public URL** of your running Discord bot. Your hosting provider will give you this (e.g., `http://123.45.67.89:3001`). Make sure it includes `http://` and the correct port.                                                                                |
| `VITE_DISCORD_BOT_API_KEY`    | The secret password (`API_SECRET_KEY`) that you created for your bot. This must be the **exact same value** you configured for your bot.                                                                                                                           |
| `SUPABASE_SERVICE_ROLE_KEY`   | **(Already present, but verify)** This secret is usually automatically available to your functions. Find this in your Supabase Dashboard under **Project Settings > API**. Make sure you are using the `service_role` key, which is secret.                      |

After adding these secrets, all of your functions will be able to securely connect to your bot.

## Step 3: Configure the Database for Notifications

Your database triggers need to know the URL of your new `discord-proxy` function so they can call it to send notifications.

1.  Go to your Supabase Dashboard and click on the **SQL Editor**.
2.  Click **"+ New query"**.
3.  Paste and run the following command. **Replace the placeholder URL with your real one.**

```sql
-- This command inserts the URL of your discord-proxy function.
-- Get this URL from the 'Details' page of your deployed 'discord-proxy' function.
-- It should look something like: https://YOUR-PROJECT-REF.supabase.co/functions/v1/discord-proxy
INSERT INTO private.env_vars (name, value) 
VALUES ('SUPABASE_DISCORD_PROXY_URL', 'YOUR_SUPABASE_FUNCTION_URL_HERE')
ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value;
```

After completing these steps, your backend functions will be fully configured to work with your external bot.
