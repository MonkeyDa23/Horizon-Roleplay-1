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
 * A simplified representation of a Discord Role, sent to the web client.
 */
export interface DiscordRole {
    id: string;
    name: string;
    color: number;
    position: number;
}

/**
 * Represents the JSON body for a channel-based notification.
 */
interface ChannelNotificationPayload {
  channelId: string;
  embed: any; // The raw embed object from Supabase/website
  content?: string; // Optional text content, used for role mentions
}

/**
 * Represents the JSON body for a user DM-based notification.
 */
interface DmNotificationPayload {
  userId: string;
  embed: any; // The raw embed object from Supabase/website
}

/**
 * Defines the strict structure for the /api/notify endpoint payload.
 * This uses a discriminated union to ensure type safety based on the `type` property.
 */
export type NotifyPayload =
  | { type: 'new_submission'; payload: ChannelNotificationPayload }
  | { type: 'audit_log'; payload: ChannelNotificationPayload }
  | { type: 'submission_result'; payload: DmNotificationPayload }
  | { type: 'submission_receipt'; payload: DmNotificationPayload };
