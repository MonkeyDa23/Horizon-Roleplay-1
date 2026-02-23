// This file contains the handler for the /showlinkstatus command.
import { CommandInteraction, GuildMember } from 'discord.js';
import { pool } from '../database';
import { env } from '../../env';

export const handleShowLinkStatusCommand = async (interaction: CommandInteraction) => {
    const member = interaction.member as GuildMember;
    if (!member.roles.cache.has(env.DISCORD_ADMIN_ROLE_ID!)) {
        await interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        return;
    }

    const targetUser = interaction.options.getUser('user', true);
    let connection;
    try {
        connection = await pool.getConnection();
        const [rows] = await connection.execute(
            'SELECT serial FROM accounts WHERE discord_id = ?',
            [targetUser.id]
        );

        if (Array.isArray(rows) && rows.length > 0) {
            const account = (rows as any)[0];
            await interaction.reply({ content: `User ${targetUser.tag} is linked to MTA serial: ${account.serial}`, ephemeral: true });
        } else {
            await interaction.reply({ content: `User ${targetUser.tag} is not linked.`, ephemeral: true });
        }
    } catch (error) {
        console.error('ShowLinkStatus error:', error);
        await interaction.reply({ content: 'An error occurred.', ephemeral: true });
    } finally {
        if (connection) connection.release();
    }
};
