// This file contains the handler for the /link command.
import { CommandInteraction, ChannelType, Client } from 'discord.js';
import { pool } from '../database.js';
import { logToDiscord } from '../utils.js';

export const handleLinkCommand = async (interaction: CommandInteraction, client: Client) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.channel?.type !== ChannelType.DM) {
        await interaction.reply({ content: 'This command can only be used in private messages.', ephemeral: true });
        return;
    }

    const code = interaction.options.get('code', true).value as string;
    const user = interaction.user;

    await interaction.deferReply({ ephemeral: true });

    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [codes] = await connection.execute(
            'SELECT * FROM linking_codes WHERE code = ? AND expires_at > NOW()',
            [code]
        );

        if (!Array.isArray(codes) || codes.length === 0) {
            await interaction.editReply({ content: '❌ الكود غير صحيح أو انتهت صلاحيته. يرجى طلب كود جديد من داخل اللعبة.' });
            await logToDiscord(client, 'WARNING', '⚠️ فشل محاولة ربط', `حاول مستخدم استخدام كود غير صحيح أو منتهي.`, 'MTA', [
                { name: 'المستخدم', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'الكود المستخدم', value: `\`${code}\``, inline: true }
            ]);
            await connection.rollback();
            return;
        }

        const linkData = (codes as any)[0];
        const mtaSerial = linkData.mta_serial;
        const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });

        // Ensure 1:1 mapping: Unlink any other account this Discord user might be linked to
        await connection.execute(
            'UPDATE accounts SET discord_id = NULL, discord_username = NULL, discord_avatar = NULL WHERE discord_id = ?',
            [user.id]
        );

        const [updateResult] = await connection.execute(
            'UPDATE accounts SET discord_id = ?, discord_username = ?, discord_avatar = ? WHERE mtaserial = ?',
            [user.id, user.tag, avatarUrl, mtaSerial]
        ) as any[];

        if (updateResult.affectedRows === 0) {
            await interaction.editReply({ content: '❌ لم يتم العثور على حساب MTA مطابق لهذا الكود. تأكد من أنك سجلت الدخول في اللعبة.' });
            await connection.rollback();
            return;
        }

        await connection.execute('DELETE FROM linking_codes WHERE id = ?', [linkData.id]);
        await connection.commit();

        // Send DM to user
        try {
            const now = new Date().toLocaleString('ar-EG');
            await user.send({
                content: `✅ **تم ربط حسابك بنجاح!**\n\nلقد قمت بربط حساب الديسكورد الخاص بك مع حسابك في سيرفر **Nova Roleplay**.\n\n**تفاصيل العملية:**\n📅 التاريخ: ${now}\n🆔 السيريال: \`${mtaSerial}\`\n\nنتمنى لك وقتاً ممتعاً في السيرفر! 🎮`
            });
        } catch (dmError) {
            console.warn(`Could not send DM to user ${user.id}:`, dmError);
        }

        await interaction.editReply({ content: '✅ تم ربط حسابك بنجاح! تفقد الرسائل الخاصة (DM) لمزيد من التفاصيل.' });
        
        await logToDiscord(client, 'SUCCESS', '🔗 تم ربط حساب جديد', `تمت عملية الربط بنجاح بين الديسكورد واللعبة.`, 'MTA', [
            { name: 'المستخدم', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'السيريال', value: `\`${mtaSerial}\``, inline: true }
        ]);

    } catch (error) {
        if (connection) await connection.rollback();
        console.error('Link command error:', error);
        await interaction.reply({ content: 'An error occurred. Please try again.', ephemeral: true });
    } finally {
        if (connection) connection.release();
    }
};
