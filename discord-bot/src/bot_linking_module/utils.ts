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

        // Use Log Guild if configured, otherwise default guild
        const guildId = env.LOG_GUILD_ID || env.DISCORD_GUILD_ID;
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) return;

        const channel = await guild.channels.fetch(channelId).catch(() => null) as TextChannel;
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setDescription(description)
            .setColor(COLORS[type])
            .addFields(fields)
            .setTimestamp()
            .setThumbnail('https://cdn-icons-png.flaticon.com/512/2910/2910768.png') // Default log icon
            .setFooter({ text: `Nova RP | ${category} Logs`, iconURL: guild.iconURL() || undefined });

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error(`[LOG ERROR - ${category}]:`, error);
    }
};

export const sendDM = async (client: Client, userId: string, embedData: any) => {
    try {
        const guild = client.guilds.cache.get(env.DISCORD_GUILD_ID);
        if (!guild) return;

        // Try to fetch as a member first to ensure they are in the server
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) {
            console.warn(`[DM SKIP]: User ${userId} is not in the guild.`);
            return;
        }

        const embed = new EmbedBuilder(embedData)
            .setTimestamp()
            .setFooter({ text: 'Nova Roleplay - نظام الإشعارات التلقائي' });

        await member.send({ embeds: [embed] }).catch(err => console.warn(`Could not send DM to ${userId}:`, err.message));
    } catch (error) {
        console.error(`[DM ERROR]:`, error);
    }
};
