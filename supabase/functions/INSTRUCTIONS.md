
# Supabase Functions: Deployment and Configuration Guide

This guide provides step-by-step instructions for deploying and configuring all the necessary Supabase Edge Functions for your Vixel Roleplay website.

## What Are These Functions?

Supabase Edge Functions are pieces of code (written in TypeScript/Deno) that run on Supabase's servers. They allow your website to perform secure backend tasks that shouldn't be done directly in the user's browser.

-   **`sync-user-profile`**: The most important function. It runs every time a user logs in. It securely communicates with your Discord bot to fetch the user's latest username, avatar, and roles from your **main guild**, then updates their profile in your database. This is how permissions are granted.
-   **`get-discord-user-profile`**: Used by the Admin Panel's "User Lookup" feature to fetch a specific user's profile from Discord.
-   **`check-bot-health`**: Used by the "Health Check" page to diagnose connection issues with your Discord bot.
-   **`check-function-secrets`**: A simple diagnostic tool for the "Health Check" page to verify if essential secrets are available to the functions.
-   **`discord-proxy`**: A secure messenger. Your database triggers call this function to tell your Discord bot to send notifications (like DMs or channel messages for new submissions and admin actions).

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

**Repeat this process for all five functions.**

## Step 2: Setting Secrets (Project-Level)

Supabase secrets are managed at the **project level**, meaning you only need to add each secret **once**, and all your functions can access it.

1.  In your Supabase project, click the **Settings** icon (a gear ⚙️) in the left sidebar.
2.  Click on **"Edge Functions"** in the settings menu.
3.  You will see a **"Secrets"** section. This is where you will add all the necessary keys.
4.  Click **"+ Add a new secret"** for each of the secrets listed below.

### Secrets to Add

You need to add the following three secrets. They will be used by all your functions. **The names must be an exact match.**

| Secret Name                | How to Get the Value                                               |
| -------------------------- | ------------------------------------------------------------------ |
| `VITE_DISCORD_BOT_URL`     | The public URL of your running Discord bot (e.g., `http://12.34.56.78:3001`). |
| `VITE_DISCORD_BOT_API_KEY` | The secret password you created to protect your bot's API.         |
| `DISCORD_BOT_TOKEN`        | Your actual Discord Bot Token from the Discord Developer Portal.   |

After adding these three secrets, all of your functions will be able to access them automatically.

## Step 3: Configure the Database for the Proxy

Your database triggers need to know the URL of your new `discord-proxy` function so they can call it.

1.  Go to your Supabase Dashboard and click on the **SQL Editor**.
2.  Click **"+ New query"**.
3.  Paste and run the following two commands. **Replace the placeholder URL and key with your real ones.**

```sql
-- This command inserts the URL of your discord-proxy function.
-- Get this URL from the 'Details' page of your deployed 'discord-proxy' function.
-- It should look something like: https://YOUR-PROJECT-REF.supabase.co/functions/v1/discord-proxy
INSERT INTO private.env_vars (name, value) 
VALUES ('SUPABASE_DISCORD_PROXY_URL', 'YOUR_SUPABASE_FUNCTION_PROXY_URL')
ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value;

-- This command inserts your Supabase SERVICE_ROLE_KEY.
-- Find this in your Supabase Dashboard under Project Settings > API.
-- Make sure you are using the 'service_role' key, which is secret.
INSERT INTO private.env_vars (name, value) 
VALUES ('SUPABASE_SERVICE_ROLE_KEY', 'YOUR_SUPABASE_SERVICE_ROLE_KEY')
ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value;
```

After completing these steps, your backend functions will be fully configured, and your website's authentication and notification systems will be operational.
