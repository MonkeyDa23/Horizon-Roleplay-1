import { Client, EmbedBuilder, TextChannel, ColorResolvable, GuildMember } from 'discord.js';
import { env } from '../env.js';
import { pool } from '../bot_linking_module/database.js';

// --- Types ---
export type FactionEventType = 
    | 'JOIN' 
    | 'LEAVE' 
    | 'KICK' 
    | 'RANK_UP' 
    | 'RANK_DOWN' 
    | 'LEADER_ASSIGN' 
    | 'LEADER_REMOVE' 
    | 'VEHICLE_RESPAWN' 
    | 'VEHICLE_RESPAWN_ALL';

export interface FactionEventData {
    type: FactionEventType;
    factionId: number;
    factionName?: string;
    
    // Player involved (target)
    playerAccount?: string;
    playerChar?: string;
    playerId?: number;
    
    // Officer/Admin responsible
    officerAccount?: string;
    officerChar?: string;
    officerId?: number;
    
    // Rank info
    oldRankName?: string;
    newRankName?: string;
    rankName?: string; // For single rank context
    
    // Other info
    reason?: string;
    vehicleModel?: string;
    vehicleId?: number;
    
    // Discord IDs if known (optional, bot will try to find if missing)
    discordId?: string;
    officerDiscordId?: string;
}

// --- Utils ---

/**
 * Decodes Arabic text that was incorrectly encoded as latin1
 * Example: Ø¬Ù†Ø¯ÙŠ -> جندي
 */
export const decodeArabic = (str: string | undefined): string => {
    if (!str) return 'غير معروف';
    try {
        // Check if it looks like it needs decoding (contains common latin1 patterns for Arabic)
        if (str.includes('Ø') || str.includes('Ù') || str.includes('Ø§') || str.includes('Ø±')) {
            return Buffer.from(str, 'latin1').toString('utf8');
        }
        return str;
    } catch (e) {
        return str;
    }
};

/**
 * Instantly syncs a member's faction role in the correct guild
 */
export const syncMemberFactionRole = async (client: Client, discordId: string, factionName: string, rankName: string, factionId: number) => {
    try {
        const gangFactionIds = (env.GANG_FACTION_IDS || '').split(',').map(id => parseInt(id.trim()));
        let targetGuildId = env.FACTIONS_GUILD_ID;
        if (gangFactionIds.includes(factionId)) {
            targetGuildId = env.GANGS_GUILD_ID;
        }

        if (!targetGuildId) return;

        const guild = await client.guilds.fetch(targetGuildId).catch(() => null);
        if (!guild) return;

        const member = await guild.members.fetch(discordId).catch(() => null);
        if (!member) return;

        const fName = decodeArabic(factionName);
        const rName = decodeArabic(rankName);
        const expectedRoleName = `[${fName}] - ${rName}`;

        // 1. Find or Create the Role
        let role = guild.roles.cache.find(r => r.name === expectedRoleName);
        if (!role) {
            role = await guild.roles.create({
                name: expectedRoleName,
                hoist: true,
                mentionable: true,
                reason: 'Auto-created by Instant Faction Sync'
            });
        }

        // 2. Add Role
        if (!member.roles.cache.has(role.id)) {
            await member.roles.add(role);
        }

        // 3. Remove other faction roles in this guild
        const otherFactionRoles = member.roles.cache.filter(r => r.name.startsWith('[') && r.id !== role?.id);
        for (const [id, r] of otherFactionRoles) {
            await member.roles.remove(r).catch(() => null);
        }

        console.log(`[InstantSync] Synced ${member.user.tag} to ${expectedRoleName}`);
    } catch (err) {
        console.error('[InstantSync] Error:', err);
    }
};

/**
 * Removes all faction roles for a user (e.g. on Kick/Leave)
 */
export const removeAllFactionRoles = async (client: Client, discordId: string) => {
    try {
        const guilds = [env.FACTIONS_GUILD_ID, env.GANGS_GUILD_ID].filter(id => !!id);
        for (const guildId of guilds) {
            const guild = await client.guilds.fetch(guildId!).catch(() => null);
            if (!guild) continue;

            const member = await guild.members.fetch(discordId).catch(() => null);
            if (!member) continue;

            const factionRoles = member.roles.cache.filter(r => r.name.startsWith('['));
            for (const [id, r] of factionRoles) {
                await member.roles.remove(r).catch(() => null);
            }
        }
    } catch (err) {
        console.error('[InstantSync] Remove Roles Error:', err);
    }
};

const getEventConfig = (type: FactionEventType) => {
    const configs: Record<FactionEventType, { title: string, color: ColorResolvable, emoji: string }> = {
        'JOIN': { title: '🆕 انضمام موظف جديد', color: 0x00F2EA, emoji: '📩' },
        'LEAVE': { title: '📤 استقالة موظف', color: 0xF27D26, emoji: '🚶' },
        'KICK': { title: '🚫 طرد موظف', color: 0xFF4444, emoji: '❌' },
        'RANK_UP': { title: '📈 ترقية موظف', color: 0x00F2EA, emoji: '⬆️' },
        'RANK_DOWN': { title: '📉 تخفيض رتبة', color: 0xF27D26, emoji: '⬇️' },
        'LEADER_ASSIGN': { title: '👑 تعيين قائد جديد', color: 0xFFD700, emoji: '⚠️' },
        'LEADER_REMOVE': { title: '💔 إزالة قائد', color: 0xFF4444, emoji: '⚠️' },
        'VEHICLE_RESPAWN': { title: '🚗 ريسباون مركبة', color: 0x6366F1, emoji: '🔄' },
        'VEHICLE_RESPAWN_ALL': { title: '🚜 ريسباون شامل للمركبات', color: 0x6366F1, emoji: '🔄' }
    };
    return configs[type];
};

// --- Main Logger ---

export const logFactionEvent = async (client: Client, data: FactionEventData) => {
    try {
        const config = getEventConfig(data.type);
        const factionName = decodeArabic(data.factionName || `Faction ${data.factionId}`);
        
        // 1. Determine Channel
        // We look for a channel ID in the environment or database
        // For now, we'll try to find a channel named "logs-faction-ID" or use a generic one
        let channelId = process.env[`LOG_CHANNEL_FACTION_${data.factionId}`];
        
        // If not found, try to fetch from DB if we added a column (optional future step)
        // For now, fallback to a general faction logs channel or the main log channel
        if (!channelId) {
            channelId = env.LOG_CHANNEL_ADMIN; // Fallback
        }

        if (!channelId) {
            console.warn(`[FactionLogger] No channel configured for faction ${data.factionId}`);
            return;
        }

        const guildId = env.LOG_GUILD_ID || env.DISCORD_GUILD_ID;
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) return;

        const channel = await guild.channels.fetch(channelId).catch(() => null) as TextChannel;
        if (!channel) return;

        // 2. Build Embed
        const embed = new EmbedBuilder()
            .setAuthor({ name: `نظام إدارة الفاكشنات | Florida RP`, iconURL: guild.iconURL() || undefined })
            .setTitle(`${config.emoji} ${config.title}`)
            .setDescription(`تم تسجيل نشاط جديد لفاكشن **${factionName}**`)
            .setColor(config.color)
            .setThumbnail(guild.iconURL())
            .setTimestamp()
            .setFooter({ text: `Florida Roleplay - نظام السجلات المتطور`, iconURL: client.user?.displayAvatarURL() });

        // --- RANK NAME FETCHING ---
        // If the rank name is a number, try to fetch the actual name from the DB
        const fetchRankName = async (rank: string | undefined, factionId: number) => {
            if (!rank) return 'غير معروف';
            if (!isNaN(parseInt(rank))) {
                try {
                    const [rows]: any = await pool.execute(`SELECT rank_${rank} as name FROM factions WHERE id = ?`, [factionId]);
                    if (rows.length > 0 && rows[0].name) {
                        return decodeArabic(rows[0].name);
                    }
                } catch (e) {
                    console.error('[RankFetch] Error:', e);
                }
            }
            return decodeArabic(rank);
        };

        const playerChar = decodeArabic(data.playerChar);
        const officerChar = decodeArabic(data.officerChar);
        const oldRank = await fetchRankName(data.oldRankName, data.factionId);
        const newRank = await fetchRankName(data.newRankName || data.rankName, data.factionId);
        const currentRank = await fetchRankName(data.rankName, data.factionId);
        const reason = decodeArabic(data.reason);

        // Add fields based on type
        if (['JOIN', 'LEAVE', 'KICK', 'RANK_UP', 'RANK_DOWN', 'LEADER_ASSIGN', 'LEADER_REMOVE'].includes(data.type)) {
            embed.addFields(
                { name: '👤 الموظف المعني', value: `> **الاسم:** ${playerChar}\n> **الحساب:** \`${data.playerAccount || '?'}\`\n> **الآيدي:** \`${data.playerId || '?'}\``, inline: false },
                { name: '👮 المسؤول عن الإجراء', value: `> **الاسم:** ${officerChar}\n> **الحساب:** \`${data.officerAccount || '?'}\``, inline: false }
            );
        }

        if (data.type === 'RANK_UP' || data.type === 'RANK_DOWN') {
            const direction = data.type === 'RANK_UP' ? '⬆️ ترقية' : '⬇️ تخفيض';
            embed.addFields(
                { name: '📊 تفاصيل الرتبة', value: `> **من:** ${oldRank}\n> **إلى:** ${newRank}\n> **الحالة:** ${direction}`, inline: false }
            );
        } else if (data.type === 'JOIN' || data.type === 'LEADER_ASSIGN') {
            embed.addFields(
                { name: '🎖️ الرتبة الحالية', value: `> ${currentRank}`, inline: true }
            );
        }

        if (data.reason && data.reason !== 'لا يوجد سبب') {
            embed.addFields({ name: '📝 ملاحظات / سبب', value: `\`\`\`${reason}\`\`\``, inline: false });
        }

        if (data.type === 'VEHICLE_RESPAWN') {
            embed.addFields(
                { name: '🚗 تفاصيل المركبة', value: `> **النوع:** ${data.vehicleModel || '?'}\n> **الآيدي:** \`${data.vehicleId || '?'}\``, inline: true },
                { name: '👤 المسؤول', value: `> ${officerChar}`, inline: true }
            );
        } else if (data.type === 'VEHICLE_RESPAWN_ALL') {
            embed.addFields(
                { name: '🚜 الإجراء المتخذ', value: `> إعادة جميع مركبات الفاكشن للمقر (Respawn All)`, inline: false },
                { name: '👤 المسؤول', value: `> ${officerChar}`, inline: true }
            );
        }

        await channel.send({ embeds: [embed] });

        // 3. Send DM to the player for important events
        if (data.discordId && ['JOIN', 'KICK', 'RANK_UP', 'RANK_DOWN', 'LEADER_ASSIGN'].includes(data.type)) {
            try {
                const dmEmbed = new EmbedBuilder()
                    .setTitle(`${config.emoji} تحديث بخصوص فاكشن ${factionName}`)
                    .setDescription(`مرحباً **${playerChar}**،\n\n${config.title} في سيرفر Florida RP.`)
                    .setColor(config.color)
                    .addFields(fields)
                    .setTimestamp();
                
                const user = await client.users.fetch(data.discordId).catch(() => null);
                if (user) await user.send({ embeds: [dmEmbed] }).catch(() => null);
            } catch (dmErr) {
                // Ignore DM errors
            }
        }

    } catch (error) {
        console.error('[FactionLogger] Error:', error);
    }
};
