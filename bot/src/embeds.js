import { EmbedBuilder } from 'discord.js';

/**
 * Creates a rich embed object for various log types.
 * @param {object} options
 * @param {string} options.title - The title of the log entry.
 * @param {string} options.actorName - The name of the user who performed the action.
 * @param {string} options.actorAvatarUrl - The avatar URL of the actor.
 * @param {string} options.message - The main log message.
 * @param {'ADMIN' | 'BANS' | 'SUBMISSIONS' | 'AUTH'} options.logType - The type of log.
 * @param {{ name: string, value: string, inline?: boolean }[]} [options.fields] - Optional fields to add.
 * @returns {EmbedBuilder}
 */
export const createLogEmbed = ({ title, actorName, actorAvatarUrl, message, logType, fields = [] }) => {
    const logColors = {
        ADMIN: 0xFFA500,       // Orange
        BANS: 0xFF0000,        // Red
        SUBMISSIONS: 0x00BFFF, // DeepSkyBlue
        AUTH: 0x22C55E,        // Green
    };

    const embed = new EmbedBuilder()
        .setColor(logColors[logType] || 0x708090)
        .setTitle(title)
        .setAuthor({ name: actorName, iconURL: actorAvatarUrl })
        .setDescription(message)
        .addFields(...fields)
        .setTimestamp()
        .setFooter({ text: `Log Type: ${logType}` });

    return embed;
};

/**
 * Creates a standardized welcome embed to DM new users.
 * @param {object} options
 * @param {string} options.username - The username of the new user.
 * @param {string} options.communityName - The name of the community.
 * @param {string} options.logoUrl - The URL of the community logo.
 * @returns {EmbedBuilder}
 */
export const createWelcomeEmbed = ({ username, communityName, logoUrl }) => {
    const embed = new EmbedBuilder()
        .setColor(0x00F2EA) // Brand Cyan
        .setTitle(`Welcome to ${communityName}, ${username}!`)
        .setDescription(`We're thrilled to have you with us. You've successfully linked your Discord account to our website.\n\nYou can now access all our community features, including applications and the store.`)
        .setThumbnail(logoUrl)
        .addFields(
            { name: 'Get Started', value: 'Head back to the website to explore!', inline: true },
            { name: 'Need Help?', value: 'Feel free to open a ticket in our Discord server.', inline: true }
        )
        .setTimestamp()
        .setFooter({ text: `Your journey in ${communityName} begins now!`, iconURL: logoUrl });
    
    return embed;
};
