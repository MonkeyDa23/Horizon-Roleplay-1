import { EmbedBuilder, TextChannel, Client } from 'discord.js';
import { env } from '../env.js';

export const COLORS = {
    SUCCESS: 0x00F2EA,
    ERROR: 0xFF4444,
    INFO: 0x6366F1,
    WARNING: 0xF27D26,
    LINK: 0x5865F2
};

export type LogCategory = 'MTA' | 'COMMANDS' | 'AUTH' | 'ADMIN' | 'STORE' | 'VISITS' | 'FINANCE' | 'SUBMISSIONS';

export const logToDiscord = async (client: Client, type: 'SUCCESS' | 'ERROR' | 'INFO' | 'WARNING', title: string, description: string, category: LogCategory, fields: { name: string, value: string, inline?: boolean }[] = []) => {
    try {
        const channelMap: Record<LogCategory, string | undefined> = {
            MTA: env.LOG_CHANNEL_MTA,
            COMMANDS: env.LOG_CHANNEL_COMMANDS,
            AUTH: env.LOG_CHANNEL_AUTH,
            ADMIN: env.LOG_CHANNEL_ADMIN,
            STORE: env.LOG_CHANNEL_STORE,
            FINANCE: env.LOG_CHANNEL_FINANCE,
            SUBMISSIONS: env.LOG_CHANNEL_SUBMISSIONS,
            VISITS: env.LOG_CHANNEL_VISITS
        };

        const channelId = channelMap[category] || env.WEBSITE_BOT_CHANNEL_ID;
        if (!channelId) return;

        const channel = await client.channels.fetch(channelId) as TextChannel;
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(COLORS[type])
            .addFields(fields)
            .setTimestamp()
            .setFooter({ text: `Florida RP | ${category} Logs`, iconURL: client.user?.displayAvatarURL() });

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error(`[LOG ERROR - ${category}]:`, error);
    }
};
