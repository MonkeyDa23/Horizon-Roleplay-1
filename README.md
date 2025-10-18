# Vixel Roleplay Community Website

This repository contains the source code for the Vixel Roleplay website and its associated Discord Bot API.

## Project Structure

- `/src`: Contains the source code for the main React/Vite frontend website.
- `/discord-bot`: Contains the source code for the Node.js/Express Discord Bot API.
- `/supabase/functions`: Contains Supabase Edge Functions that interact with Discord.

---

## ✅ Environment Variables - THE MOST IMPORTANT PART

This project will not run without the correct environment variables. **`.env` files are for local development ONLY.** For deployment, you **MUST** set these variables in your hosting provider's dashboard.

### 1. Frontend Website (Deploy to Vercel, Netlify, etc.)

In your Vercel project settings, go to **Settings > Environment Variables** and add the following:

- `VITE_SUPABASE_URL`: Your Supabase project URL. (Found in Supabase: Project Settings > API)
- `VITE_SUPABASE_ANON_KEY`: Your Supabase public `anon` key. (Found in Supabase: Project Settings > API)
- `VITE_DISCORD_BOT_URL`: The public URL of your running Discord Bot API (from the backend deployment, e.g., `https://my-bot.wispbyte.com`).
- `VITE_DISCORD_BOT_API_KEY`: The secret key you created for your bot API.

### 2. Backend Discord Bot (Deploy to Wispbyte, Pterodactyl, Heroku)

In your Wispbyte server panel, go to the **"Startup"** or **"Variables"** tab and add the following:

- `DISCORD_BOT_TOKEN`: Your secret Discord bot token from the Discord Developer Portal.
- `DISCORD_GUILD_ID`: Your Discord server's unique ID.
- `API_SECRET_KEY`: A strong, random password you create to protect your API. This **must match** `VITE_DISCORD_BOT_API_KEY` on the frontend.

### 3. Supabase Edge Functions

In your Supabase project dashboard, go to **Project Settings > Functions** and add the following secrets:

- `DISCORD_BOT_TOKEN`: The same secret Discord bot token as above.

---

## Local Development Setup

1.  **Create `.env` file for Frontend:**
    -   In the root directory, create a file named `.env`.
    -   Copy the contents from `src/env.example.ts` (just the keys and values) into `.env`.
    -   Fill in your development keys.

2.  **Run the Frontend:**
    ```bash
    npm install
    npm run dev
    ```

3.  **Run the Backend Bot:**
    -   Navigate to the `discord-bot` directory: `cd discord-bot`
    -   Create a `.env` file inside the `discord-bot` directory.
    -   Add your bot variables (`DISCORD_BOT_TOKEN`, etc.) to this file.
    -   Run the bot:
        ```bash
        npm install
        npm run dev
        ```
