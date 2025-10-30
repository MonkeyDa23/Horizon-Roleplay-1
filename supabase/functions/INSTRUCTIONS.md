# Supabase Functions: Deployment and Configuration Guide (V6 - Direct Bot Notifications)

This guide provides step-by-step instructions for deploying and configuring all the necessary Supabase Edge Functions. This architecture relies on an **external, self-hosted Discord bot** which you must run separately. These functions act as a secure bridge between your website, your database, and your bot.

This version **DOES NOT USE WEBHOOKS**. Instead, it uses database triggers to call the `discord-proxy` function, which then calls your bot.

## What Are These Functions?

-   **`sync-user-profile`**: The most important function. It calls your bot's API to fetch a user's latest Discord data (roles, name, etc.) when they log in.
-   **`get-guild-roles`**: Calls your bot to get a list of all server roles for the Admin Panel.
-   **`check-bot-health`**: Used by the "Health Check" page to see if the website can reach your bot.
-   **`check-function-secrets`**: A diagnostic tool for the Health Check page.
-   **`troubleshoot-user-sync`**: A diagnostic tool to test fetching a specific user's data via the bot.
-   **`discord-proxy`**: Receives notification requests directly from database triggers and securely forwards them to your self-hosted bot.
-   **`test-notification`**: A function for the admin panel that allows testing notification templates.

## Step 1: Deploying the Functions

You need to deploy each function using the Supabase Dashboard. Repeat these steps for **all seven** functions listed in the `supabase/functions` directory.

1.  Go to your Supabase Project Dashboard.
2.  Click on the **Edge Functions** icon in the left sidebar (a lambda λ symbol).
3.  Click **"Create a function"**.
4.  Enter the function's name. **The name MUST exactly match the folder name**. (e.g., `sync-user-profile`).
5.  Click **"Create function"**.
6.  You will be taken to a code editor. **Delete all the boilerplate code**.
7.  Open the corresponding `index.ts` file on your computer (e.g., `supabase/functions/sync-user-profile/index.ts`).
8.  **Copy the entire contents** of the file.
9.  **Paste the code** into the Supabase editor.
10. Click **"Deploy"** in the top right corner.

**Repeat this process for all seven functions.**

## Step 2: Setting Secrets (CRITICAL)

This is the most important step. These secrets allow your Supabase functions to securely communicate with your bot and with each other.

1.  In your Supabase project, click the **Settings** icon (a gear ⚙️) in the left sidebar.
2.  Click on **"Edge Functions"** in the settings menu.
3.  Under the **"Secrets"** section, click **"+ Add a new secret"**.

### Secrets to Add (Total of 3)

| Secret Name                   | Value                                                                              | Where to get it? |
| ----------------------------- | ---------------------------------------------------------------------------------- | ---------------- |
| `VITE_DISCORD_BOT_URL`        | The full URL where your bot is hosted. **Example:** `http://123.45.67.89:14355`       | This is the public IP or domain of the server where you run the Discord Bot. |
| `VITE_DISCORD_BOT_API_KEY`    | The secret password you created in your bot's `config.json` file.                  | You create this password yourself. It must match what's in the bot's config. |
| `DISCORD_PROXY_SECRET`        | A new, strong, unique password you create just for this.                           | **Generate a new UUID** or create a strong password. This is NOT the same as the bot's API key. |

**Important:** The `DISCORD_PROXY_SECRET` is used for communication *between your database and your `discord-proxy` function*. It acts as an internal password.

## Step 3: Configure Settings in the Admin Panel

After deploying the functions and setting the secrets, you must configure the final pieces in the website's Admin Panel.

1. Log into your website with an account that has Super Admin permissions.
2. Go to the **Admin Panel**.
3. Go to the **Appearance** tab.
4. Fill in the following two fields under the "Discord & Game Integration" section:
    - **Discord Proxy Function URL**:
        - Go back to your Supabase Dashboard -> Edge Functions.
        - Click on the `discord-proxy` function.
        - **Copy the "Invocations URL"** and paste it here.
    - **Discord Proxy Secret**:
        - **Paste the exact same secret value** you created for `DISCORD_PROXY_SECRET` in Step 2.

**This is a critical step.** The database needs to know the URL of the proxy function and the secret to use when calling it.

## Final Check

Once you have:
1. Deployed all 7 functions.
2. Set all 3 secrets.
3. Configured the Proxy URL and Secret in the Admin Panel.
4. Run the database schema from `src/lib/database_schema.ts`.
5. Started your self-hosted Discord bot.

...your notification system should be fully operational. You can use the **Health Check** page in the Admin Panel to test each part of the connection.