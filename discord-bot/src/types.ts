// discord-bot/src/types.ts

/**
 * Defines the structure of the config.json file.
 */
export interface BotConfig {
    DISCORD_BOT_TOKEN: string;
    DISCORD_GUILD_ID: string;
    API_SECRET_KEY: string;
    PRESENCE_COMMAND_ROLE_IDS: string[];
}
