
export function formatDiscordUser(member) {
  const roles = member.roles.cache
    .filter(role => role.id !== member.guild.id)
    .sort((a, b) => b.position - a.position)
    .map(formatDiscordRole);

  return {
    discordId: member.id,
    username: member.user.globalName || member.user.username,
    avatar: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
    roles: roles,
    highestRole: roles[0] || null,
  };
}

export function formatDiscordRole(role) {
  return {
    id: role.id,
    name: role.name,
    color: role.color,
    position: role.position,
  };
}
