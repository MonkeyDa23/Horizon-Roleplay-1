import express from 'express';
import { Client, TextChannel } from 'discord.js';
import cors from 'cors';
import helmet from 'helmet';
import { env } from '../env.js';
import { logToDiscord, sendDM } from '../bot_linking_module/utils.js';
import { pool } from '../bot_linking_module/database.js';

export const setupCoreModule = (client: Client) => {
    const app = express();

    app.use(helmet());
    app.use(cors({ 
        origin: ['https://florida-roleplay.com', 'http://localhost:3000', 'https://ais-pre-ybw2kepvyjl3nudev22cgi-28074720729.europe-west2.run.app'] 
    }));
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
        const { targetId, targetType, content, embed, category, title, description, fields, type, status, username } = req.body;
        
        try {
            // If a category is provided, use the advanced logging system
            if (category) {
                await logToDiscord(client, type || 'INFO', title || 'Notification', description || '', category, fields || []);
                
                // If it's a submission result, also send a DM
                if (category === 'SUBMISSIONS' && targetType === 'user') {
                    let finalTargetId = targetId;

                    // If targetId is missing, try to find by username
                    if (!finalTargetId && username) {
                        const guild = client.guilds.cache.get(env.DISCORD_GUILD_ID);
                        if (guild) {
                            const members = await guild.members.fetch({ query: username, limit: 1 });
                            const member = members.first();
                            if (member) {
                                finalTargetId = member.id;
                            }
                        }
                    }

                    if (finalTargetId) {
                        let finalTitle = title || 'تحديث بخصوص تقديمك';
                        let finalColor = type === 'SUCCESS' ? 0x00F2EA : (type === 'ERROR' ? 0xFF4444 : 0x6366F1);
                        
                        // Specific handling for submission statuses
                        if (status === 'accepted' || status === 'accepted_final') {
                            finalTitle = '✅ تم قبول تقديمك!';
                            finalColor = 0x00F2EA;
                        } else if (status === 'rejected') {
                            finalTitle = '❌ تم رفض تقديمك';
                            finalColor = 0xFF4444;
                        } else if (status === 'taken') {
                            finalTitle = '👨‍💻 طلبك قيد المراجعة';
                            finalColor = 0xFFA500;
                        } else if (status === 'received' || status === 'pending') {
                            finalTitle = '📩 تم استلام تقديمك بنجاح';
                            finalColor = 0x6366F1;
                        }

                        await sendDM(client, finalTargetId, {
                            title: finalTitle,
                            description: description || 'تم تحديث حالة طلبك في النظام.',
                            color: finalColor,
                            fields: fields || []
                        });
                    }
                }
                return res.json({ success: true });
            }

            // Standard notification logic
            if (targetType === 'user' || targetType === 'dm') {
                let finalTargetId = targetId;
                if (!finalTargetId && username) {
                    const guild = client.guilds.cache.get(env.DISCORD_GUILD_ID);
                    if (guild) {
                        const members = await guild.members.fetch({ query: username, limit: 1 });
                        const member = members.first();
                        if (member) finalTargetId = member.id;
                    }
                }
                if (!finalTargetId) return res.status(400).json({ error: 'Missing targetId and could not find user by username' });
                await sendDM(client, finalTargetId, embed || { title, description, fields, color: 0x6366F1 });
            } else {
                const channel = await client.channels.fetch(targetId) as TextChannel;
                if (channel) await channel.send({ content, embeds: embed ? [embed] : [] });
            }

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

            // 2. Fetch Characters with detailed info
            let characters: any[] = [];
            try {
                // استعلام مبسط للشخصيات لضمان عدم حدوث خطأ 500
                const [charRows]: any = await pool.execute(
                    "SELECT * FROM characters WHERE account = ?",
                    [account.id]
                );

                // جلب الوظائف والمنظمات في استعلامات منفصلة لتجنب مشاكل الـ Join
                const [jobRows]: any = await pool.execute("SELECT * FROM jobs").catch(() => [[]]);
                const [factionRows]: any = await pool.execute("SELECT * FROM factions").catch(() => [[]]);

                const jobMap = new Map(jobRows.map((j: any) => [j.id, j.name || j.job_name || j.label || j.id]));
                const factionMap = new Map(factionRows.map((f: any) => [f.id, f.name || f.faction_name || f.id]));

                // Fetch vehicles for all characters of this account
                const [vehicleRows]: any = await pool.execute(
                    "SELECT id, model, owner FROM vehicles WHERE owner IN (SELECT id FROM characters WHERE account = ?)",
                    [account.id]
                ).catch(() => [[]]);

                // Fetch interiors for all characters of this account
                const [interiorRows]: any = await pool.execute(
                    "SELECT id, name, owner, cost FROM interiors WHERE owner IN (SELECT id FROM characters WHERE account = ?)",
                    [account.id]
                ).catch(() => [[]]);

                characters = charRows.map((c: any) => {
                    const charVehicles = vehicleRows.filter((v: any) => v.owner === c.id);
                    const charInteriors = interiorRows.filter((i: any) => i.owner === c.id);

                    return {
                        id: c.id,
                        name: c.charactername,
                        skin: c.skin,
                        gender: c.gender === 0 ? 'Male' : 'Female',
                        age: c.age || 'Unknown',
                        dob: c.day + '/' + c.month + '/' + (c.year || '?'),
                        level: c.level || 1,
                        job: jobMap.get(c.job) || ('Job ID: ' + c.job),
                        faction: factionMap.get(c.faction_id) || ('Faction ID: ' + c.faction_id),
                        cash: c.money,
                        bank: c.bankmoney,
                        playtime_hours: c.hoursplayed,
                        vehicles: charVehicles.map((v: any) => ({
                            id: v.id,
                            model: v.model,
                            owner: v.owner
                        })),
                        properties: charInteriors.map((i: any) => ({
                            id: i.id,
                            name: i.name,
                            cost: i.cost,
                            owner: i.owner
                        }))
                    };
                });
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

            res.json({
                id: account.id,
                username: account.username,
                serial: account.mtaserial,
                character_count: characters.length,
                admin_record: mappedAdminRecord,
                characters: characters
            });

        } catch (error: any) {
            console.error('[BOT API] Global error: ' + error.message);
            res.status(500).json({ error: "Internal Server Error", details: error.message });
        }
    });

    // 5. Unlink MTA Account
    app.post('/mta/unlink', authenticate, async (req: any, res: any) => {
        const { serial, adminId } = req.body;
        console.log('[BOT API] Received unlink request for serial: ' + serial);

        try {
            // Get account info before unlinking for logging
            const [rows]: any = await pool.execute('SELECT username, discord_id, discord_username FROM accounts WHERE mtaserial = ?', [serial]);
            
            if (rows.length === 0) {
                return res.status(404).json({ error: "Account not found" });
            }

            const account = rows[0];

            // Perform Unlink - Thoroughly clear all discord related fields
            await pool.execute(
                'UPDATE accounts SET discord_id = NULL, discord_username = NULL, discord_avatar = NULL WHERE mtaserial = ?', 
                [serial]
            );

            // Also clear any pending linking codes for this serial to prevent ghost links
            await pool.execute('DELETE FROM linking_codes WHERE mta_serial = ?', [serial]).catch(() => null);

            // Log to Discord
            const isForce = !!adminId;
            const logTitle = isForce ? '🚨 فك ربط إجباري' : '🔓 إلغاء ربط حساب';
            const logDesc = isForce ? `قام المسؤول <@${adminId}> بفك ربط حساب اللاعب إجبارياً.` : 'تم إلغاء ربط حساب MTA من خلال لوحة تحكم الموقع.';
            
            await logToDiscord(client, isForce ? 'ERROR' : 'WARNING', logTitle, logDesc, 'MTA', [
                { name: 'المستخدم', value: (account.discord_username || 'Unknown') + ' (<@' + account.discord_id + '>)', inline: true },
                { name: 'حساب اللعبة', value: account.username, inline: true },
                { name: 'السيريال', value: '`' + serial + '`', inline: true }
            ]);

            // Send DM to user if unlinked
            if (account.discord_id) {
                await sendDM(client, account.discord_id, {
                    title: logTitle,
                    description: `مرحباً ${account.discord_username}،\n\nلقد تم إلغاء ربط حساب MTA الخاص بك (${account.username}) بنجاح.\n\n${isForce ? 'تم هذا الإجراء من قبل الإدارة.' : ''}`,
                    color: isForce ? 0xFF4444 : 0xF27D26
                });
            }

            res.json({ success: true });

        } catch (error: any) {
            console.error('[BOT API] Unlink Error: ' + error.message);
            res.status(500).json({ error: "Internal Server Error", details: error.message });
        }
    });

    // 6. Check MTA Link Status (for Admin)
    app.get('/mta/status/:serial', authenticate, async (req: any, res: any) => {
        const { serial } = req.params;
        try {
            const [rows]: any = await pool.execute('SELECT discord_id, discord_username, discord_avatar FROM accounts WHERE mtaserial = ?', [serial]);
            if (rows.length === 0) return res.status(404).json({ error: 'Serial not found' });
            
            const acc = rows[0];
            res.json({
                linked: !!acc.discord_id,
                discord: acc.discord_id ? { id: acc.discord_id, username: acc.discord_username, avatar: acc.discord_avatar } : null
            });
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });

    app.listen(Number(env.PORT), '0.0.0.0', () => {
        console.log('🚀 Core API Module online on port ' + env.PORT);
    });
};
