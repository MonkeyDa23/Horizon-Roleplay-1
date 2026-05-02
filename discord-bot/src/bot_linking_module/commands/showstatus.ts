import { CommandInteraction, GuildMember, Client } from 'discord.js';
import { pool } from '../database.js';
import { logToDiscord } from '../utils.js';
import { env } from '../../env.js';

export const handleShowLinkStatusCommand = async (interaction: CommandInteraction, client: Client) => {
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
        const [rows] = await connection.execute(
            'SELECT username, mtaserial FROM accounts WHERE discord_id = ?',
            [targetUser.id]
        );

        if (Array.isArray(rows) && rows.length > 0) {
            const account = (rows as any)[0];
            const maskedSerial = account.mtaserial ? account.mtaserial.substring(0, 8) + '...' + account.mtaserial.substring(account.mtaserial.length - 4) : 'Unknown';
            
            await interaction.editReply({ 
                content: `🔍 **معلومات الربط لـ ${targetUser.tag}:**\n\n` +
                         `• **حساب اللعبة:** \`${account.username}\`\n` +
                         `• **السيريال:** \`${maskedSerial}\`\n` +
                         `• **الآيدي:** <@${targetUser.id}>`
            });
            
            await logToDiscord(client, 'INFO', '🔍 استعلام عن حالة ربط', `قام مسؤول بالاستعلام عن حالة ربط مستخدم.`, 'ADMIN', [
                { name: 'المسؤول', value: `${adminUser.tag} (<@${adminUser.id}>)`, inline: true },
                { name: 'المستهدف', value: `${targetUser.tag} (<@${targetUser.id}>)`, inline: true },
                { name: 'النتيجة', value: `مربوط بـ \`${account.username}\``, inline: false }
            ]);
        } else {
            await interaction.editReply({ content: `❌ المستخدم **${targetUser.tag}** غير مربوط بأي حساب MTA حالياً.` });
            
            await logToDiscord(client, 'INFO', '🔍 استعلام عن حالة ربط', `قام مسؤول بالاستعلام عن حالة ربط مستخدم.`, 'ADMIN', [
                { name: 'المسؤول', value: `${adminUser.tag} (<@${adminUser.id}>)`, inline: true },
                { name: 'المستهدف', value: `${targetUser.tag} (<@${targetUser.id}>)`, inline: true },
                { name: 'النتيجة', value: `غير مربوط`, inline: false }
            ]);
        }
    } catch (error) {
        console.error('ShowLinkStatus error:', error);
        await interaction.editReply({ content: '❌ حدث خطأ أثناء الاستعلام عن الحالة.' });
    } finally {
        if (connection) connection.release();
    }
};
