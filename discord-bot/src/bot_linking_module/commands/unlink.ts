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

    try {
        // In your schema, discord_id is in the 'accounts' table
        const [rows]: any = await pool.execute('SELECT username FROM accounts WHERE discord_id = ?', [discordId]);

        if (rows.length === 0) {
            await interaction.reply({ content: 'Your Discord account is not linked to any MTA account.', ephemeral: true });
            return;
        }

        const accountName = rows[0].username;
        await pool.execute('UPDATE accounts SET discord_id = NULL, discord_username = NULL, discord_avatar = NULL WHERE discord_id = ?', [discordId]);

        await interaction.reply({ content: 'You have successfully unlinked your MTA account.', ephemeral: true });
        
        await logToDiscord(client, 'WARNING', '🔓 إلغاء ربط حساب', `قام مستخدم بإلغاء ربط حسابه يدوياً.`, 'COMMANDS', [
            { name: 'المستخدم', value: `${user.tag} (${user.id})`, inline: true },
            { name: 'حساب اللعبة', value: accountName, inline: true }
        ]);

    } catch (error) {
        console.error('Error handling unlink command:', error);
        await interaction.reply({ content: 'An error occurred while trying to unlink your account.', ephemeral: true });
    }
};
