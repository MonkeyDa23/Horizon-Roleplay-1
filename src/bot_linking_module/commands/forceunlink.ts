// This file contains the handler for the /forceunlink command.
import { CommandInteraction, GuildMember } from 'discord.js';
import { pool, getBotSettings } from '../database';
import { logToDiscord } from '../utils';
import { env } from '../../env';

export const handleForceUnlinkCommand = async (interaction: CommandInteraction) => {
    const member = interaction.member as GuildMember;
    if (!member.roles.cache.has(env.DISCORD_ADMIN_ROLE_ID!)) {
        await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const adminUser = interaction.user;
    let connection;
    try {
        const settings = await getBotSettings();
        const logChannelId = settings['DISCORD_LINK_LOG_CHANNEL_ID'];

        connection = await pool.getConnection();
        const [updateResult] = await connection.execute(
            'UPDATE accounts SET discord_id = NULL WHERE discord_id = ?',
            [targetUser.id]
        ) as any[];

        if (updateResult.affectedRows > 0) {
            await interaction.reply({ content: `Successfully unlinked the account for ${targetUser.tag}.`, ephemeral: true });
            await logToDiscord(interaction.client, logChannelId, 'Account Force Unlinked', `Admin ${adminUser.username} unlinked ${targetUser.username}.`, 'info');
        } else {
            await interaction.reply({ content: `${targetUser.tag} does not have a linked account.`, ephemeral: true });
        }
    } catch (error) {
        console.error('ForceUnlink error:', error);
        await interaction.reply({ content: 'An error occurred.', ephemeral: true });
    } finally {
        if (connection) connection.release();
    }
};
