import { CommandInteraction, ChannelType, Client } from 'discord.js';
import { pool } from '../database.js';
import { logToDiscord } from '../utils.js';

export const handleUnlinkCommand = async (interaction: CommandInteraction, client: Client) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.channel?.type !== ChannelType.DM) {
        await interaction.reply({ content: 'This command can only be used in private messages.', ephemeral: true });
        return;
    }

    const discordId = interaction.user.id;
    const user = interaction.user;

    await interaction.deferReply({ ephemeral: true });

    try {
        // In your schema, discord_id is in the 'accounts' table
        const [rows]: any = await pool.execute('SELECT username, mtaserial FROM accounts WHERE discord_id = ?', [discordId]);

        if (rows.length === 0) {
            await interaction.editReply({ content: 'Your Discord account is not linked to any MTA account.' });
            return;
        }

        const account = rows[0];
        await pool.execute('UPDATE accounts SET discord_id = NULL, discord_username = NULL, discord_avatar = NULL WHERE discord_id = ?', [discordId]);

        await interaction.editReply({ content: 'You have successfully unlinked your MTA account.' });
        
        // Notify user via DM
        try {
            await user.send({
                embeds: [{
                    title: '🔓 تم فك الربط بنجاح',
                    description: `مرحباً **${user.username}**،\n\nلقد قمت بفك ربط حساب MTA الخاص بك (**${account.username}**) بنجاح من حساب الديسكورد.`,
                    color: 0xFFA500,
                    timestamp: new Date().toISOString()
                }]
            });
        } catch (dmErr) {
            console.log('Could not send DM to unlinked user');
        }

        await logToDiscord(client, 'WARNING', '🔓 إلغاء ربط حساب', `قام مستخدم بإلغاء ربط حسابه يدوياً من الديسكورد.`, 'MTA', [
            { name: 'المستخدم', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'حساب اللعبة', value: account.username, inline: true },
            { name: 'السيريال', value: `\`${account.mtaserial}\``, inline: true }
        ]);

    } catch (error) {
        console.error('Error handling unlink command:', error);
        await interaction.reply({ content: 'An error occurred while trying to unlink your account.', ephemeral: true });
    }
};
