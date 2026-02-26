import express from 'express';
import { Client, TextChannel } from 'discord.js';
import cors from 'cors';
import helmet from 'helmet';
import { env } from '../env.js';
import { logToDiscord } from '../bot_linking_module/utils.js';
import { pool } from '../bot_linking_module/database.js';

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

            // Check for MTA Link
            let mtaLink = null;
            try {
                const [rows]: any = await pool.execute(
                    'SELECT mtaserial, username FROM accounts WHERE discord_id = ?',
                    [discordId]
                );
                if (rows.length > 0) {
                    mtaLink = {
                        serial: rows[0].mtaserial,
                        name: rows[0].username
                    };
                }
            } catch (dbErr) {
                console.error('DB Sync Error:', dbErr);
            }

            res.json({
                discordId: member.id,
                username: member.user.username,
                avatar: member.user.displayAvatarURL({ size: 256 }),
                roles,
                highestRole: roles[0] || null,
                mtaLink
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
        const { mtaserial, code, playerName } = req.body;
        await logToDiscord(client, 'INFO', '🔑 إنشاء كود ربط جديد', 'قام لاعب بإنشاء كود ربط من داخل اللعبة.', 'MTA', [
            { name: 'اللاعب', value: playerName || 'غير معروف', inline: true },
            { name: 'الكود', value: '`' + code + '`', inline: true },
            { name: 'السيريال', value: '`' + mtaserial + '`', inline: false }
        ]);
        res.json({ success: true });
    });

    // 4. MTA Account Info Endpoint
    app.get('/mta/account/:serial', authenticate, async (req: any, res: any) => {
        const { serial } = req.params;
        console.log('[BOT API] Fetching account for serial: ' + serial);
        
        try {
            // 1. Fetch Account
            const [accounts]: any = await pool.execute(
                "SELECT id, username, mtaserial FROM accounts WHERE mtaserial = ? LIMIT 1",
                [serial]
            );

            if (accounts.length === 0) {
                return res.status(404).json({ error: "Account not found" });
            }

            const account = accounts[0];

            // 2. Fetch Characters
            let characters: any[] = [];
            try {
                const [charRows]: any = await pool.execute(
                    "SELECT c.*, j.name as job_name, f.name as faction_name FROM characters c LEFT JOIN jobs j ON c.job = j.id LEFT JOIN factions f ON c.faction_id = f.id WHERE c.account = ?",
                    [account.id]
                );
                characters = charRows.map((c: any) => ({
                    ...c,
                    name: c.charactername,
                    cash: c.money,
                    bank: c.bankmoney,
                    playtime_hours: c.hoursplayed,
                    dob: c.day + '/' + c.month + '/' + (c.year || '?'),
                    age: c.age || 'Unknown'
                }));
            } catch (e: any) {
                console.error('[BOT API] Error fetching characters: ' + e.message);
            }

            // 3. Fetch Admin History
            let mappedAdminRecord: any[] = [];
            try {
                const [adminRows]: any = await pool.execute(
                    "SELECT h.*, a.username as admin_name FROM adminhistory h LEFT JOIN accounts a ON h.admin = a.id WHERE h.user = ? ORDER BY h.date DESC LIMIT 15",
                    [account.id]
                );
                mappedAdminRecord = adminRows.map((r: any) => ({
                    id: r.id,
                    type: r.type || 'Penalty',
                    reason: r.reason || 'No reason',
                    admin: r.admin_name || 'Admin ID: ' + r.admin,
                    date: r.date,
                    duration: r.duration
                }));
            } catch (e: any) {
                console.error('[BOT API] Error fetching admin history: ' + e.message);
            }

            // 4. Fetch Vehicles
            let vehicles: any[] = [];
            try {
                const [vehicleRows]: any = await pool.execute(
                    "SELECT id, model, plate, owner FROM vehicles WHERE owner IN (SELECT id FROM characters WHERE account = ?)",
                    [account.id]
                );
                vehicles = vehicleRows;
            } catch (e: any) {
                console.error('[BOT API] Error fetching vehicles: ' + e.message);
            }

            // 5. Fetch Interiors
            let interiors: any[] = [];
            try {
                const [interiorRows]: any = await pool.execute(
                    "SELECT id, name, owner FROM interiors WHERE owner IN (SELECT id FROM characters WHERE account = ?)",
                    [account.id]
                );
                interiors = interiorRows.map((i: any) => ({
                    id: i.id,
                    name: i.name,
                    address: 'Interior ID: ' + i.id
                }));
            } catch (e: any) {
                console.error('[BOT API] Error fetching interiors: ' + e.message);
            }

            res.json({
                id: account.id,
                username: account.username,
                serial: account.mtaserial,
                character_count: characters.length,
                admin_record: mappedAdminRecord,
                characters: characters,
                vehicles: vehicles,
                properties: interiors
            });

        } catch (error: any) {
            console.error('[BOT API] Global error: ' + error.message);
            res.status(500).json({ error: "Internal Server Error", details: error.message });
        }
    });

    app.listen(Number(env.PORT), '0.0.0.0', () => {
        console.log('🚀 Core API Module online on port ' + env.PORT);
    });
};
