import express from 'express';
import { Client, TextChannel } from 'discord.js';
import cors from 'cors';
import helmet from 'helmet';
import { env } from '../env.js';
import { logToDiscord } from '../bot_linking_module/utils.js';

export const setupCoreModule = (client: Client) => {
    const app = express();

    app.use(helmet());
    app.use(cors({ origin: '*' }));
    app.use(express.json());

    // Auth Middleware
    const authenticate = (req: any, res: any, next: any) => {
        const providedKey = req.headers.authorization;
        if (!providedKey || providedKey !== env.API_SECRET_KEY) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        next();
    };

    // 1. Sync User Data
    app.post('/sync-user/:discordId', authenticate, async (req, res) => {
        const { discordId } = req.params;
        try {
            const guild = client.guilds.cache.get(env.DISCORD_GUILD_ID);
            if (!guild) return res.status(500).json({ error: 'Guild not found' });

            const member = await guild.members.fetch(discordId);
            const roles = member.roles.cache
                .filter(r => r.name !== '@everyone')
                .map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position }))
                .sort((a, b) => b.position - a.position);

            res.json({
                discordId: member.id,
                username: member.user.username,
                avatar: member.user.displayAvatarURL({ size: 256 }),
                roles,
                highestRole: roles[0] || null
            });
        } catch (err) {
            res.status(404).json({ error: 'User not in guild' });
        }
    });

    // 2. Notification & Logging Gateway
    app.post('/notify', authenticate, async (req: any, res: any) => {
        const { targetId, targetType, content, embed, category, title, description, fields, type } = req.body;
        
        try {
            // If a category is provided, use the advanced logging system
            if (category) {
                await logToDiscord(client, type || 'INFO', title || 'Notification', description || '', category, fields || []);
                return res.json({ success: true });
            }

            // Standard notification logic
            let target;
            if (targetType === 'user' || targetType === 'dm') {
                target = await client.users.fetch(targetId);
            } else {
                target = await client.channels.fetch(targetId) as TextChannel;
            }

            await target.send({ content, embeds: embed ? [embed] : [] });
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // 3. MTA Code Generation Log
    app.post('/log/mta-code', authenticate, async (req: any, res: any) => {
        const { serial, code, playerName } = req.body;
        await logToDiscord(client, 'INFO', '🔑 إنشاء كود ربط جديد', `قام لاعب بإنشاء كود ربط من داخل اللعبة.`, 'MTA', [
            { name: 'اللاعب', value: playerName || 'غير معروف', inline: true },
            { name: 'الكود', value: `\`${code}\``, inline: true },
            { name: 'السيريال', value: `\`${serial}\``, inline: false }
        ]);
        res.json({ success: true });
    });

    app.listen(Number(env.PORT), '0.0.0.0', () => {
        console.log(`🚀 Core API Module online on port ${env.PORT}`);
    });
};
