// discord-bot/src/types.ts

/**
 * Defines the structure of the config.json file.
 */
export interface BotConfig {
    PORT?: number;
    DISCORD_BOT_TOKEN: string;
    DISCORD_GUILD_ID: string;
    API_SECRET_KEY: string;
    PRESENCE_COMMAND_ROLE_IDS: string[];
    CHANNELS: {
        SUBMISSIONS: string;
        AUDIT_LOG_GENERAL: string;
        AUDIT_LOG_SUBMISSIONS: string;
        AUDIT_LOG_BANS: string;
        AUDIT_LOG_ADMIN: string;
    };
    MENTION_ROLES: {
        SUBMISSIONS: string;
        AUDIT_LOG_GENERAL: string;
        AUDIT_LOG_SUBMISSIONS: string;
        AUDIT_LOG_BANS: string;
        AUDIT_LOG_ADMIN: string;
    };
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

// =============================================
// NOTIFICATION PAYLOAD TYPES
// =============================================

export interface NewSubmissionPayload {
    username: string;
    avatarUrl: string;
    discordId: string;
    quizTitle: string;
    submittedAt: string;
    userHighestRole: string;
    adminPanelUrl: string;
}

export interface AuditLogPayload {
    adminUsername: string;
    action: string;
    timestamp: string;
    log_type: 'submission' | 'ban' | 'admin' | 'general';
}

export interface DmPayload {
  userId: string;
  embed: {
    titleKey: string;
    bodyKey: string;
    replacements: Record<string, string>;
  };
}


/**
 * Defines the strict structure for the /api/notify endpoint payload.
 * This uses a discriminated union to ensure type safety based on the `type` property.
 */
export type NotifyPayload =
  | { type: 'new_submission'; payload: NewSubmissionPayload }
  | { type: 'audit_log'; payload: AuditLogPayload }
  | { type: 'submission_result'; payload: DmPayload }
  | { type: 'submission_receipt'; payload: DmPayload };