// FIX: Added 'Role' to imports to provide explicit type information.
import { Client, GatewayIntentBits, Partials, TextChannel, EmbedBuilder, Role } from 'discord.js';
// FIX: Switched to a default import for express and used qualified types (e.g., `express.Request`) to resolve conflicts with global types and fix numerous property access errors.
// FIX: Using named imports for express types to resolve type errors.
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { BotConfig, DiscordRole, NotifyPayload } from './types.js';

// --- CONFIGURATION ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const config: BotConfig = JSON.parse(readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

const { DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, API_SECRET_KEY } = config;
const PORT = process.env.PORT || 3000;


// --- DISCORD BOT SETUP ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
    ],
    partials: [Partials.GuildMember],
});

client.once('ready', () => {
    console.log(`✅ Bot is online! Logged in as ${client.user?.tag}`);
    console.log(` обслуживаю сервер: ${DISCORD_GUILD_ID}`);
});

client.login(DISCORD_BOT_TOKEN);


// --- EXPRESS API SERVER ---
const app = express();
app.use(cors());
app.use(express.json());

// API Key Authentication Middleware
// FIX: Corrected express type annotations from express.Request/Response to Request/Response.
const authenticate = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing Authorization header' });
    }
    const token = authHeader.split(' ')[1];
    if (token !== API_SECRET_KEY) {
        return res.status(403).json({ error: 'Forbidden: Invalid API Key' });
    }
    next();
};

// --- API ENDPOINTS ---

// Health check endpoint
// FIX: Corrected express type annotations from express.Request/Response to Request/Response.
app.get('/health', authenticate, async (req: Request, res: Response) => {
    try {
        const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
        // Force fetch members to check intent
        await guild.members.fetch({ limit: 1 }); 
        const memberCount = guild.memberCount;

        res.status(200).json({
            status: 'ok',
            details: {
                guildName: guild.name,
                guildId: guild.id,
                memberCount: memberCount,
            }
        });
    } catch (error) {
        console.error("Health check failed:", error);
        res.status(500).json({ 
            status: 'error', 
            error: 'Failed to connect to Discord or fetch guild details.',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});


// Get a specific user's profile
// FIX: Corrected express type annotations from express.Request/Response to Request/Response.
app.get('/api/user/:userId', authenticate, async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
        const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
        const member = await guild.members.fetch(userId);

        if (!member) {
            return res.status(404).json({ error: `Member with ID ${userId} not found in guild.` });
        }
        
        // FIX: Added explicit `Role` type to the `role` parameter to resolve type errors.
        const roles = Array.from(member.roles.cache.values())
            .filter((role: Role) => role.id !== guild.id) // Exclude @everyone role
            .sort((a, b) => b.position - a.position)
            .map(role => ({
                id: role.id,
                name: role.name,
                color: role.color,
                position: role.position
            }));
            
        const highestRole = member.roles.highest ? {
            id: member.roles.highest.id,
            name: member.roles.highest.name,
            color: member.roles.highest.color,
            position: member.roles.highest.position
        } : null;

        const response = {
            id: member.id,
            username: member.displayName,
            avatar: member.displayAvatarURL({ size: 256 }),
            roles: roles,
            highestRole: highestRole,
            joinedAt: member.joinedAt?.toISOString(),
        };

        res.json(response);

    } catch (error: any) {
        console.error(`Error fetching user ${userId}:`, error);
         if (error.code === 10007) { // "Unknown Member"
             res.status(404).json({ error: `Member not found. This is likely due to the SERVER MEMBERS INTENT being disabled.` });
         } else {
             res.status(500).json({ error: 'Internal server error while fetching user.' });
         }
    }
});


// Get all roles in the guild
// FIX: Corrected express type annotations from express.Request/Response to Request/Response.
app.get('/api/roles', authenticate, async (req: Request, res: Response) => {
    try {
        const guild = await client.guilds.fetch(DISCORD_GUILD_ID);
        // FIX: Added explicit `Role` type to the `role` parameter to resolve type errors.
        const roles = Array.from(guild.roles.cache.values())
            .filter((role: Role) => role.id !== guild.id) // Exclude @everyone role
            .sort((a, b) => b.position - a.position)
            .map(role => ({
                id: role.id,
                name: role.name,
                color: role.color,
                position: role.position
            }));
        
        res.json({ roles });

    } catch (error) {
        console.error(`Error fetching roles:`, error);
        res.status(500).json({ error: 'Internal server error while fetching roles.' });
    }
});


// Send a notification (to channel or DM)
// FIX: Corrected express type annotations from express.Request/Response to Request/Response.
app.post('/api/notify', authenticate, async (req: Request, res: Response) => {
    const { type, targetId, embed: embedData }: NotifyPayload = req.body;

    if (!type || !targetId || !embedData) {
        return res.status(400).json({ error: 'Missing required fields: type, targetId, embed' });
    }

    try {
        const embed = new EmbedBuilder(embedData);

        if (type === 'channel') {
            const channel = await client.channels.fetch(targetId);
            if (channel && channel.isTextBased()) {
                await (channel as TextChannel).send({ embeds: [embed] });
            } else {
                throw new Error(`Channel ${targetId} not found or is not a text channel.`);
            }
        } else if (type === 'dm') {
            const user = await client.users.fetch(targetId);
            await user.send({ embeds: [embed] });
        } else {
            return res.status(400).json({ error: 'Invalid notification type. Must be "channel" or "dm".' });
        }
        
        res.status(200).json({ success: true, message: 'Notification sent.' });

    } catch (error) {
        console.error(`Failed to send notification to ${targetId}:`, error);
        res.status(500).json({ error: 'Failed to send notification.' });
    }
});


// --- START SERVER ---
app.listen(PORT, () => {
    console.log(`🚀 API server listening on port ${PORT}`);
});
