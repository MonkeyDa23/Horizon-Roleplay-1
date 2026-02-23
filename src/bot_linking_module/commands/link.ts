// This file contains the handler for the /link command.
import { CommandInteraction, ChannelType } from 'discord.js';
import { pool, getBotSettings } from '../database';
import { logToDiscord } from '../utils';
import { env } from '../../env';

export const handleLinkCommand = async (interaction: CommandInteraction) => {
    if (interaction.channel?.type !== ChannelType.DM) {
        await interaction.reply({ content: 'This command can only be used in private messages.', ephemeral: true });
        return;
    }

    const code = interaction.options.get('code', true).value as string;
    const user = interaction.user;

    let connection;
    try {
        const settings = await getBotSettings();
        const logChannelId = settings['DISCORD_LINK_LOG_CHANNEL_ID'];

        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [codes] = await connection.execute(
            'SELECT * FROM linking_codes WHERE code = ? AND expires_at > NOW()',
            [code]
        );

        if (!Array.isArray(codes) || codes.length === 0) {
            await interaction.reply({ content: 'Invalid or expired code.', ephemeral: true });
            await logToDiscord(interaction.client, logChannelId, 'Link Attempt Failed', `User ${user.username} (${user.id}) failed with invalid/expired code: ${code}.`, 'error');
            await connection.rollback();
            return;
        }

        const linkData = (codes as any)[0];
        const mtaSerial = linkData.mta_serial;

        const [updateResult] = await connection.execute(
            'UPDATE accounts SET discord_id = ? WHERE serial = ?',
            [user.id, mtaSerial]
        ) as any[];

        if (updateResult.affectedRows === 0) {
            throw new Error('MTA account not found for the given serial.');
        }

        await connection.execute('DELETE FROM linking_codes WHERE id = ?', [linkData.id]);
        await connection.commit();

        await interaction.reply({ content: '✅ Your MTA account has been successfully linked!', ephemeral: true });
        await logToDiscord(interaction.client, logChannelId, 'Account Linked Successfully', `User ${user.username} (${user.id}) linked to serial ${mtaSerial}.`, 'success');

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Link command error:', error);
        await interaction.reply({ content: 'An error occurred. Please try again.', ephemeral: true });
    } finally {
        if (connection) connection.release();
    }
};
