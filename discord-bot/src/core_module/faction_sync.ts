import { Client, Guild, Role, GuildMember } from 'discord.js';
import { env } from '../env.js';
import { pool } from '../bot_linking_module/database.js';

const SYNC_INTERVAL = 30000; // 30 seconds

export const setupFactionSync = (client: Client) => {
    console.log('🔄 Faction Sync Module Initialized (Interval: 30s)');
    
    setInterval(async () => {
        try {
            await syncAllUsers(client);
        } catch (error) {
            console.error('[FactionSync] Global Error:', error);
        }
    }, SYNC_INTERVAL);
};

const syncAllUsers = async (client: Client) => {
    // 1. Get all linked accounts
    const [accounts]: any = await pool.execute(
        'SELECT id, discord_id, username FROM accounts WHERE discord_id IS NOT NULL'
    );

    if (!accounts || accounts.length === 0) return;

    const gangFactionIds = env.GANG_FACTION_IDS.split(',').map(id => parseInt(id.trim()));

    for (const account of accounts) {
        try {
            // 2. Get current faction and rank for the account's primary character
            // We'll use the character with the most playtime or just the first one for simplicity
            const [characters]: any = await pool.execute(
                'SELECT faction_id, faction_rank, charactername FROM characters WHERE account = ? ORDER BY hoursplayed DESC LIMIT 1',
                [account.id]
            );

            if (!characters || characters.length === 0) continue;

            const char = characters[0];
            const factionId = char.faction_id;
            const factionRank = char.faction_rank;

            // 3. Determine target guild
            let targetGuildId = env.FACTIONS_GUILD_ID;
            if (gangFactionIds.includes(factionId)) {
                targetGuildId = env.GANGS_GUILD_ID;
            }

            if (!targetGuildId) continue;

            const guild = client.guilds.cache.get(targetGuildId);
            if (!guild) continue;

            // 4. Get Faction and Rank Names
            const [factions]: any = await pool.execute('SELECT name FROM factions WHERE id = ?', [factionId]);
            const factionName = factions[0]?.name || `Faction ${factionId}`;
            
            // Try to get rank name if a ranks table exists, otherwise use rank number
            // Assuming a standard MTA schema might have a ranks column or separate table
            // For now, let's just use the rank number or a generic name
            const rankName = `Rank ${factionRank}`;

            await syncUserRoles(guild, account.discord_id, factionName, rankName, factionId);

        } catch (err) {
            console.error(`[FactionSync] Error syncing user ${account.username}:`, err);
        }
    }
};

const syncUserRoles = async (guild: Guild, discordId: string, factionName: string, rankName: string, factionId: number) => {
    try {
        const member = await guild.members.fetch(discordId).catch(() => null);
        if (!member) return;

        const expectedRoleName = `[${factionName}] - ${rankName}`;
        
        // 1. Find or Create the Role
        let role = guild.roles.cache.find(r => r.name === expectedRoleName);
        
        if (!role) {
            console.log(`[FactionSync] Creating missing role: ${expectedRoleName} in ${guild.name}`);
            role = await guild.roles.create({
                name: expectedRoleName,
                hoist: true, // Display separately
                mentionable: true,
                reason: 'Auto-created by Faction Sync System'
            });
        }

        // 2. Check if user already has the role
        if (member.roles.cache.has(role.id)) {
            // User already has the correct role, but we should still check for old faction roles to remove
            await removeOldFactionRoles(member, role.id);
            return;
        }

        // 3. Add the new role
        await member.roles.add(role);
        console.log(`[FactionSync] Added role ${expectedRoleName} to ${member.user.tag}`);

        // 4. Remove any other faction roles the user might have in this guild
        await removeOldFactionRoles(member, role.id);

    } catch (error) {
        console.error(`[FactionSync] Role Sync Error for ${discordId}:`, error);
    }
};

const removeOldFactionRoles = async (member: GuildMember, currentRoleId: string) => {
    // Faction roles are identified by the pattern "[...]"
    const factionRoles = member.roles.cache.filter(r => r.name.startsWith('[') && r.id !== currentRoleId);
    
    for (const [id, role] of factionRoles) {
        try {
            await member.roles.remove(role);
            console.log(`[FactionSync] Removed old faction role ${role.name} from ${member.user.tag}`);
        } catch (err) {
            // Ignore errors if role cannot be removed (e.g. higher position)
        }
    }
};
