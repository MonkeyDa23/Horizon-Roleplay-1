// bot/utils.js

/**
 * Formats a Discord GuildMember object into the structure expected by the frontend.
 * @param {import('discord.js').GuildMember} member - The GuildMember object.
 * @returns {object} The formatted user data.
 */
export function formatDiscordUser(member) {
  const roles = member.roles.cache
    .filter(role => role.id !== member.guild.id) // Exclude @everyone role
    .sort((a, b) => b.position - a.position)
    .map(formatDiscordRole);

  return {
    discordId: member.id,
    username: member.user.globalName || member.user.username,
    avatar: member.user.displayAvatarURL({ dynamic: true, size: 256 }),
    roles: roles,
    highestRole: roles[0] || null,
  };
}

/**
 * Formats a Discord Role object into a simpler structure.
 * @param {import('discord.js').Role} role - The Role object.
 * @returns {object} The formatted role data.
 */
export function formatDiscordRole(role) {
  return {
    id: role.id,
    name: role.name,
    color: role.color,
    position: role.position,
  };
}
