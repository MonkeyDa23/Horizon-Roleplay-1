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

/**
 * Represents the JSON body for any notification.
 * The `type` determines where the message is sent.
 */
export type NotifyPayload =
  | { type: 'channel'; payload: { channelId: string; embed: any; content?: string; } }
  | { type: 'dm'; payload: { userId: string; embed: any; } };
