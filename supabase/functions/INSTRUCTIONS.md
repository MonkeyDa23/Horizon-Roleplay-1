# Supabase Functions: Deployment and Configuration Guide

This guide provides step-by-step instructions for deploying and configuring all the necessary Supabase Edge Functions for your Vixel Roleplay website.

## What Are These Functions?

Supabase Edge Functions are pieces of code (written in TypeScript/Deno) that run on Supabase's servers. They allow your website to perform secure backend tasks that shouldn't be done directly in the user's browser.

-   **`sync-user-profile`**: The most important function. It runs every time a user logs in. It securely communicates with the Discord API (via your bot) to fetch the user's latest username, avatar, and roles, then updates their profile in your database.
-   **`get-discord-user-profile`**: Used by the Admin Panel's "User Lookup" feature to fetch a specific user's profile from Discord.
-   **`check-bot-health`**: Used by the "Health Check" page to diagnose connection issues with your Discord bot.
-   **`discord-proxy`**: A secure messenger. Your database triggers call this function to tell your Discord bot to send notifications (like DMs or channel messages).

## Step 1: Deploying the Functions

You need to deploy each function using the Supabase Dashboard. Repeat these steps for **all four** functions listed in the `supabase/functions` directory (`sync-user-profile`, `get-discord-user-profile`, `check-bot-health`, and `discord-proxy`).

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

**Repeat this process for all four functions.**

## Step 2: Setting Environment Variables

This is the most critical step. Your functions need secret keys to communicate with your Discord bot and database securely.

1.  While still in the **Edge Functions** section of your Supabase Dashboard, click on a function you just deployed.
2.  Go to the **Settings** tab for that function.
3.  Scroll down to the **"Secrets"** section.
4.  Click **"Add a new secret"**.
5.  Add the following secrets.

---

### Secrets for `sync-user-profile`

| Secret Name                | Value                                                              |
| -------------------------- | ------------------------------------------------------------------ |
| `VITE_DISCORD_BOT_URL`     | The public URL of your running Discord bot (e.g., `http://12.34.56.78:3001`). |
| `VITE_DISCORD_BOT_API_KEY` | The secret password you created for your bot's API.                |

---

### Secrets for `get-discord-user-profile`

| Secret Name         | Value                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| `DISCORD_BOT_TOKEN` | Your actual Discord Bot Token from the Discord Developer Portal. |

---

### Secrets for `check-bot-health` and `discord-proxy`

These two functions need the same secrets.

| Secret Name                | Value                                                              |
| -------------------------- | ------------------------------------------------------------------ |
| `VITE_DISCORD_BOT_URL`     | The public URL of your running Discord bot.                        |
| `VITE_DISCORD_BOT_API_KEY` | The secret password you created for your bot's API.                |

---

## Step 3: Configure the Database for the Proxy

Your database triggers need to know the URL of your new `discord-proxy` function so they can call it.

1.  Go to your Supabase Dashboard and click on the **SQL Editor**.
2.  Click **"+ New query"**.
3.  Paste and run the following two commands. **Replace the placeholder URL and key with your real ones.**

```sql
-- This command inserts the URL of your discord-proxy function.
-- Get this URL from the 'Details' page of your deployed 'discord-proxy' function.
INSERT INTO private.env_vars (name, value) 
VALUES ('SUPABASE_DISCORD_PROXY_URL', 'https://YOUR-PROJECT-REF.supabase.co/functions/v1/discord-proxy')
ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value;

-- This command inserts your Supabase SERVICE_ROLE_KEY.
-- Find this in your Supabase Dashboard under Project Settings > API.
INSERT INTO private.env_vars (name, value) 
VALUES ('SUPABASE_SERVICE_ROLE_KEY', 'YOUR_SUPABASE_SERVICE_ROLE_KEY')
ON CONFLICT (name) DO UPDATE SET value = EXCLUDED.value;

```

After completing these three steps, your backend functions will be fully configured and your website's notification system will be operational.
