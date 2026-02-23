// This file contains utility functions for the bot module.
import { Client } from 'discord.js';

export const logToDiscord = async (client: Client, channelId: string, title: string, description: string, level: 'info' | 'success' | 'error') => {
    try {
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isTextBased()) {
            const color = {
                info: 0x3498db,    // Blue
                success: 0x2ecc71, // Green
                error: 0xe74c3c     // Red
            }[level];

            await channel.send({
                embeds: [{
                    title,
                    description,
                    color,
                    timestamp: new Date().toISOString(),
                }]
            });
        }
    } catch (error) {
        console.error(`Failed to send log message to channel ${channelId}:`, error);
    }
};
