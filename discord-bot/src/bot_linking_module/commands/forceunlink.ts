import { CommandInteraction, GuildMember, Client } from 'discord.js';
import { pool } from '../database.js';
import { logToDiscord } from '../utils.js';
import { env } from '../../env.js';

export const handleForceUnlinkCommand = async (interaction: CommandInteraction, client: Client) => {
    if (!interaction.isChatInputCommand()) return;
    const member = interaction.member as GuildMember;
    const adminRoleId = env.DISCORD_ADMIN_ROLE_ID;

    // Check for admin permissions
    const hasRole = adminRoleId ? member.roles.cache.has(adminRoleId) : false;
    const isOwner = member.permissions.has('Administrator');

    if (!hasRole && !isOwner) {
        await interaction.reply({ content: '❌ ليس لديك صلاحية لاستخدام هذا الأمر.', ephemeral: true });
        return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const adminUser = interaction.user;

    await interaction.deferReply({ ephemeral: true });

    let connection;
    try {
        connection = await pool.getConnection();
        
        const [rows]: any = await connection.execute('SELECT username, mtaserial FROM accounts WHERE discord_id = ?', [targetUser.id]);
        const account = rows[0];

        const [updateResult] = await connection.execute(
            'UPDATE accounts SET discord_id = NULL, discord_username = NULL, discord_avatar = NULL WHERE discord_id = ?',
            [targetUser.id]
        ) as any[];

        if (updateResult.affectedRows > 0) {
            await interaction.editReply({ content: `Successfully unlinked the account for ${targetUser.tag}.` });
            
            await logToDiscord(client, 'ERROR', '🛡️ إلغاء ربط إجباري', `قام مسؤول بإلغاء ربط حساب مستخدم إجبارياً.`, 'MTA', [
                { name: 'المسؤول', value: `${adminUser.tag} (${adminUser.id})`, inline: true },
                { name: 'المستهدف', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                { name: 'حساب اللعبة', value: account?.username || 'Unknown', inline: true },
                { name: 'السيريال', value: `\`${account?.mtaserial || 'Unknown'}\``, inline: true }
            ]);
        } else {
            await interaction.editReply({ content: `${targetUser.tag} does not have a linked account.` });
        }
    } catch (error) {
        console.error('ForceUnlink error:', error);
        await interaction.reply({ content: 'An error occurred.', ephemeral: true });
    } finally {
        if (connection) connection.release();
    }
};
