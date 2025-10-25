// Bot configuration from config.json
export interface BotConfig {
    DISCORD_BOT_TOKEN: string;
    DISCORD_GUILD_ID: string;
    API_SECRET_KEY: string;
    PRESENCE_COMMAND_ROLE_IDS: string[];
}

// Simplified Discord Role object for API responses
export interface DiscordRole {
    id: string;
    name: string;
    color: number;
    position: number;
}

// Payload for the /api/notify endpoint
export interface NotifyPayload {
    type: 'channel' | 'dm';
    targetId: string; // Channel ID or User ID
    embed: any; // Raw embed data from the database
}
