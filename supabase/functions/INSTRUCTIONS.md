# Supabase Functions: Deployment and Configuration Guide (V2 - Bot Dependent)

This guide provides step-by-step instructions for deploying and configuring all the necessary Supabase Edge Functions. This architecture relies on an **external, self-hosted Discord bot** which you must run separately. These functions act as a secure bridge between your website and your bot.

## What Are These Functions?

These functions run on Supabase's servers and proxy requests from the website to your bot. This is more secure than calling the bot directly from the browser.

-   **`sync-user-profile`**: The most important function. It calls your bot's API to fetch a user's latest Discord data (roles, name, etc.) when they log in.
-   **`get-guild-roles`**: Calls your bot to get a list of all server roles for the Admin Panel.
-   **`check-bot-health`**: Used by the "Health Check" page to see if the website can reach your bot.
-   **`troubleshoot-user-sync`**: A diagnostic tool to test fetching a specific user's data via the bot.

## Step 1: Deploying the Functions

You need to deploy each function using the Supabase Dashboard. Repeat these steps for **all four** functions listed in the `supabase/functions` directory.

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

**Repeat this process for all four functions: `sync-user-profile`, `get-guild-roles`, `check-bot-health`, and `troubleshoot-user-sync`.**

## Step 2: Setting Secrets

This is the most critical step. These secrets allow your Supabase functions to securely communicate with your bot.

1.  In your Supabase project, click the **Settings** icon (a gear ⚙️) in the left sidebar.
2.  Click on **"Edge Functions"** in the settings menu.
3.  Under the **"Secrets"** section, click **"+ Add a new secret"**.

### Secrets to Add

| Secret Name                   | Value                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `VITE_DISCORD_BOT_URL`        | The full URL where your bot is hosted. **Example:** `http://123.45.67.89:3000`        |
| `VITE_DISCORD_BOT_API_KEY`    | The secret password you created in your bot's `config.json` file.                  |

After completing these steps, your backend functions will be fully configured to communicate with your bot. Now, you need to set up and run the bot itself by following the instructions in `discord-bot/README.md`.