import { CommandInteraction, GuildMember, Client } from 'discord.js';
import { pool } from '../database.js';
import { logToDiscord } from '../utils.js';
import { env } from '../../env.js';

export const handleForceUnlinkCommand = async (interaction: CommandInteraction, client: Client) => {
    if (!interaction.isChatInputCommand()) return;
    const member = interaction.member as GuildMember;
    const adminRoleId = env.DISCORD_ADMIN_ROLE_ID;

    // Strict permission check
    const hasRole = adminRoleId ? member.roles.cache.has(adminRoleId) : false;
    const isOwner = member.permissions.has('Administrator');

    if (!hasRole && !isOwner) {
        await interaction.reply({ content: '❌ ليس لديك صلاحية لاستخدام هذا الأمر. يتطلب رتبة الإدارة العليا.', ephemeral: true });
        return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const adminUser = interaction.user;

    await interaction.deferReply({ ephemeral: true });

    let connection;
    try {
        connection = await pool.getConnection();
        
        const [rows]: any = await connection.execute('SELECT username, mtaserial FROM accounts WHERE discord_id = ?', [targetUser.id]);
        
        if (rows.length === 0) {
            await interaction.editReply({ content: `❌ المستخدم **${targetUser.tag}** غير مربوط بأي حساب MTA.` });
            return;
        }

        const account = rows[0];

        // Thoroughly clear all discord related fields
        await connection.execute(
            'UPDATE accounts SET discord_id = NULL, discord_username = NULL, discord_avatar = NULL WHERE discord_id = ?',
            [targetUser.id]
        );

        // Clear any pending linking codes for this user's serial
        if (account.mtaserial) {
            await connection.execute('DELETE FROM linking_codes WHERE mta_serial = ?', [account.mtaserial]).catch(() => null);
        }

        await interaction.editReply({ content: `✅ تم فك ربط حساب **${account.username}** الخاص بـ **${targetUser.tag}** بنجاح.` });
        
        // Log to Discord
        await logToDiscord(client, 'ERROR', '🚨 فك ربط إجباري (أمر)', `قام مسؤول بفك ربط حساب مستخدم إجبارياً عبر أمر الديسكورد.`, 'MTA', [
            { name: 'المسؤول', value: `${adminUser.tag} (<@${adminUser.id}>)`, inline: true },
            { name: 'المستهدف', value: `${targetUser.tag} (<@${targetUser.id}>)`, inline: true },
            { name: 'حساب اللعبة', value: account.username, inline: true },
            { name: 'السيريال', value: `\`${account.mtaserial}\``, inline: true }
        ]);

        // Notify user via DM
        try {
            await targetUser.send({
                embeds: [{
                    title: '🚨 فك ربط إجباري',
                    description: `مرحباً **${targetUser.username}**،\n\nلقد تم فك ربط حساب MTA الخاص بك (**${account.username}**) إجبارياً من قبل الإدارة.`,
                    color: 0xFF4444,
                    timestamp: new Date().toISOString()
                }]
            });
        } catch (dmErr) {
            console.log('Could not send DM to unlinked user');
        }

    } catch (error) {
        console.error('ForceUnlink error:', error);
        await interaction.editReply({ content: '❌ حدث خطأ أثناء محاولة فك الربط.' });
    } finally {
        if (connection) connection.release();
    }
};
