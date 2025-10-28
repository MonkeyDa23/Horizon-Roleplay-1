# Supabase Functions: Deployment and Configuration Guide (V4 - Robustness)

This guide provides step-by-step instructions for deploying and configuring all the necessary Supabase Edge Functions. This architecture relies on an **external, self-hosted Discord bot** which you must run separately. These functions act as a secure bridge between your website and your bot.

## What Are These Functions?

These functions run on Supabase's servers and proxy requests from the website to your bot. This is more secure than calling the bot directly from the browser.

-   **`sync-user-profile`**: The most important function. It calls your bot's API to fetch a user's latest Discord data (roles, name, etc.) when they log in.
-   **`get-guild-roles`**: Calls your bot to get a list of all server roles for the Admin Panel.
-   **`check-bot-health`**: Used by the "Health Check" page to see if the website can reach your bot.
-   **`troubleshoot-user-sync`**: A diagnostic tool to test fetching a specific user's data via the bot.
-   **`discord-proxy`**: Receives notification requests from database triggers (via `pg_net`) and forwards them to the bot. This is how all Discord logs and notifications are sent.

## Step 1: Deploying the Functions

You need to deploy each function using the Supabase Dashboard. Repeat these steps for **all five** functions listed in the `supabase/functions` directory.

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

**Repeat this process for all five functions: `sync-user-profile`, `get-guild-roles`, `check-bot-health`, `troubleshoot-user-sync`, and `discord-proxy`.**

## Step 2: Setting Secrets

This is the most critical step. These secrets allow your Supabase functions to securely communicate with your bot.

1.  In your Supabase project, click the **Settings** icon (a gear ⚙️) in the left sidebar.
2.  Click on **"Edge Functions"** in the settings menu.
3.  Under the **"Secrets"** section, click **"+ Add a new secret"**.

### Secrets to Add

| Secret Name                   | Value                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------- |
| `VITE_DISCORD_BOT_URL`        | The full URL where your bot is hosted. **Example:** `http://123.45.67.89:14355`       |
| `VITE_DISCORD_BOT_API_KEY`    | The secret password you created in your bot's `config.json` file.                  |

## Step 3: Network Configuration for Notifications (CRITICAL)

The database sends notifications using the `pg_net` extension, which makes an HTTP request. By default, Supabase blocks all outgoing network traffic from the database for security. You **must** create a rule to allow it to call your Edge Functions. **If notifications and logs are not working, this is the #1 reason.**

1.  In your Supabase project, click the **Database** icon in the left sidebar.
2.  In the menu, click on **"Network Restrictions"**.
3.  Under "Database Egress (Outbound Traffic)", click **"Add new rule"**.
4.  Fill in the details:
    *   **Rule name**: `Allow pg_net to call Functions`
    *   **Protocol**: `TCP`
    *   **Address**: `0.0.0.0/0`
    *   **Ports**: `80, 443`
5.  Click **"Create rule"**.

**Why `0.0.0.0/0`?** This allows the database to make outbound requests to *any* IP address on the standard web ports. This is necessary for it to reach the Supabase internal network where Edge Functions run, which does not have a static IP address.

After completing these steps, your backend functions will be fully configured to communicate with your bot. Now, you need to set up and run the bot itself by following the instructions in `discord-bot/README.md`.
