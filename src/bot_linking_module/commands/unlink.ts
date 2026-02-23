// This file contains the handler for the /unlink command.
import { CommandInteraction, ChannelType } from 'discord.js';
import { pool, getBotSettings } from '../database';
import { logToDiscord } from '../utils';

export const handleUnlinkCommand = async (interaction: CommandInteraction) => {
    if (interaction.channel?.type !== ChannelType.DM) {
        await interaction.reply({ content: 'This command can only be used in private messages.', ephemeral: true });
        return;
    }

    const user = interaction.user;
    let connection;
    try {
        const settings = await getBotSettings();
        const logChannelId = settings['DISCORD_LINK_LOG_CHANNEL_ID'];

        connection = await pool.getConnection();
        const [updateResult] = await connection.execute(
            'UPDATE accounts SET discord_id = NULL WHERE discord_id = ?',
            [user.id]
        ) as any[];

        if (updateResult.affectedRows > 0) {
            await interaction.reply({ content: 'Your MTA account has been successfully unlinked.', ephemeral: true });
            await logToDiscord(interaction.client, logChannelId, 'Account Unlinked', `User ${user.username} (${user.id}) unlinked their account.`, 'info');
        } else {
            await interaction.reply({ content: 'You do not have a linked MTA account.', ephemeral: true });
        }
    } catch (error) {
        console.error('Unlink command error:', error);
        await interaction.reply({ content: 'An error occurred.', ephemeral: true });
    } finally {
        if (connection) connection.release();
    }
};
