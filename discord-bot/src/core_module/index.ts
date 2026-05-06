import express from 'express';
import { Client, TextChannel } from 'discord.js';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import crypto from 'node:crypto';
import { env } from '../env.js';
import { logToDiscord, sendDM } from '../bot_linking_module/utils.js';
import { pool } from '../bot_linking_module/database.js';

export const setupCoreModule = (client: Client) => {
    const app = express();

    app.use(helmet());
    app.use(hpp());

    const apiLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 500,
        message: { error: 'Too many requests' }
    });
    app.use(apiLimiter);

    app.use(cors({ 
        origin: [/localhost/, /\.run\.app$/, /\.vercel\.app$/],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    }));
    app.use(express.json({ limit: '5kb' }));

    const authenticate = (req: any, res: any, next: any) => {
        const apiKey = req.headers.authorization;
        const signature = req.headers['x-signature'];
        const timestamp = req.headers['x-timestamp'];

        if (!apiKey || apiKey !== env.API_SECRET_KEY) {
            logToDiscord(client, 'CRITICAL', '🚨 unauthorized access', `IP: ${req.ip}`, 'ADMIN').catch(() => {});
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Always require signature if SIGNATURE_KEY is set
        if (env.SIGNATURE_KEY) {
            if (!signature || !timestamp) {
                return res.status(403).json({ error: 'Signature Required' });
            }

            const now = Date.now();
            const reqTime = Number(timestamp);
            if (isNaN(reqTime) || Math.abs(now - reqTime) > 5 * 60 * 1000) {
                return res.status(403).json({ error: 'Timestamp Out of Range' });
            }

            const payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
            const expectedSignature = crypto.createHmac('sha256', env.SIGNATURE_KEY!)
                .update(payload + timestamp)
                .digest('hex');

            if (signature !== expectedSignature) {
                return res.status(403).json({ error: 'Forbidden - Invalid Signature' });
            }
        }

        next();
    };

    app.post('/sync-user/:discordId', authenticate, async (req, res) => {
        const { discordId } = req.params;
        try {
            const guildId = env.DISCORD_GUILD_ID;
            if (!guildId) return res.status(500).json({ error: 'Misconfigured' });
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return res.status(500).json({ error: 'Guild not found' });

            const member = await guild.members.fetch(discordId);
            const roles = member.roles.cache
                .filter(r => r.name !== '@everyone')
                .map(r => ({ id: r.id, name: r.name, color: r.color, position: r.position }))
                .sort((a, b) => b.position - a.position);

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
                console.error(dbErr);
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
            res.status(404).json({ error: 'User not found' });
        }
    });

    app.post('/notify', authenticate, async (req: any, res: any) => {
        const { targetId, targetType, content, embed, category, title, description, fields, type, status, username } = req.body;
        
        try {
            if (category) {
                await logToDiscord(client, type || 'INFO', title || 'Notification', description || '', category, fields || []);
                
                if (category === 'SUBMISSIONS' && targetType === 'user') {
                    let finalTargetId = targetId;

                    if (!finalTargetId && username) {
                        const guildId = env.DISCORD_GUILD_ID;
                        if (guildId) {
                            const guild = client.guilds.cache.get(guildId);
                            if (guild) {
                                const members = await guild.members.fetch({ query: username, limit: 1 });
                                const member = members.first();
                                if (member) finalTargetId = member.id;
                            }
                        }
                    }

                    if (finalTargetId) {
                        let finalTitle = title || 'تحديث بخصوص تقديمك';
                        let finalColor = type === 'SUCCESS' ? 0x00F2EA : (type === 'ERROR' ? 0xFF4444 : 0x6366F1);
                        
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
                            description: description || 'تم تحديث حالة طلبك.',
                            color: finalColor,
                            fields: fields || []
                        });
                    }
                }
                return res.json({ success: true });
            }

            if (targetType === 'user' || targetType === 'dm') {
                let finalTargetId = targetId;
                if (!finalTargetId && username) {
                    const guildId = env.DISCORD_GUILD_ID;
                    if (guildId) {
                        const guild = client.guilds.cache.get(guildId);
                        if (guild) {
                            const members = await guild.members.fetch({ query: username, limit: 1 });
                            const member = members.first();
                            if (member) finalTargetId = member.id;
                        }
                    }
                }
                if (!finalTargetId) return res.status(400).json({ error: 'Target not found' });
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

    app.post('/log/mta-code', authenticate, async (req: any, res: any) => {
        const { mtaserial, code, playerName } = req.body;
        await logToDiscord(client, 'INFO', '🔑 إنشاء كود ربط جديد', '', 'MTA', [
            { name: 'اللاعب', value: playerName || 'غير معروف', inline: true },
            { name: 'الكود', value: '`' + code + '`', inline: true },
            { name: 'السيريال', value: '`' + mtaserial + '`', inline: false }
        ]);
        res.json({ success: true });
    });

    app.get('/mta/account/:serial', authenticate, async (req: any, res: any) => {
        const { serial } = req.params;
        try {
            const [accounts]: any = await pool.execute(
                "SELECT id, username, mtaserial FROM accounts WHERE mtaserial = ? LIMIT 1",
                [serial]
            );

            if (accounts.length === 0) return res.status(404).json({ error: "Not found" });
            const account = accounts[0];

            let characters: any[] = [];
            try {
                const [charRows]: any = await pool.execute("SELECT * FROM characters WHERE account = ?", [account.id]);
                const [jobRows]: any = await pool.execute("SELECT * FROM jobs").catch(() => [[]]);
                const [factionRows]: any = await pool.execute("SELECT * FROM factions").catch(() => [[]]);

                const jobMap = new Map(jobRows.map((j: any) => [j.id, j.name || j.job_name || j.label || j.id]));
                const factionMap = new Map(factionRows.map((f: any) => [f.id, f.name || f.faction_name || f.id]));

                const [vehicleRows]: any = await pool.execute(
                    "SELECT id, model, owner FROM vehicles WHERE owner IN (SELECT id FROM characters WHERE account = ?)",
                    [account.id]
                ).catch(() => [[]]);

                const [interiorRows]: any = await pool.execute(
                    "SELECT id, name, owner, cost FROM interiors WHERE owner IN (SELECT id FROM characters WHERE account = ?)",
                    [account.id]
                ).catch(() => [[]]);

                characters = charRows.map((c: any) => ({
                    id: c.id,
                    name: c.charactername,
                    skin: c.skin,
                    gender: c.gender === 0 ? 'Male' : 'Female',
                    age: c.age || 'Unknown',
                    dob: c.day + '/' + c.month + '/' + (c.year || '?'),
                    level: c.level || 1,
                    job: jobMap.get(c.job) || ('ID: ' + c.job),
                    faction: factionMap.get(c.faction_id) || ('ID: ' + c.faction_id),
                    cash: c.money,
                    bank: c.bankmoney,
                    playtime_hours: c.hoursplayed,
                    vehicles: vehicleRows.filter((v: any) => v.owner === c.id),
                    properties: interiorRows.filter((i: any) => i.owner === c.id)
                }));
            } catch (e) {
                console.error('Error fetching characters:', e);
            }

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
                    admin: r.admin_name || 'ID: ' + r.admin,
                    date: r.date,
                    duration: r.duration
                }));
            } catch (e) {
                console.error('Error fetching admin history:', e);
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
            res.status(500).json({ error: "Internal Error" });
        }
    });

    app.post('/mta/unlink', authenticate, async (req: any, res: any) => {
        const { serial, adminId } = req.body;
        try {
            const [rows]: any = await pool.execute('SELECT username, discord_id, discord_username FROM accounts WHERE mtaserial = ?', [serial]);
            if (rows.length === 0) return res.status(404).json({ error: "Not found" });
            const account = rows[0];

            await pool.execute('UPDATE accounts SET discord_id = NULL, discord_username = NULL, discord_avatar = NULL WHERE mtaserial = ?', [serial]);
            await pool.execute('DELETE FROM linking_codes WHERE mta_serial = ?', [serial]).catch(() => null);

            const isForce = !!adminId;
            const logTitle = isForce ? '🚨 فك ربط إجباري' : '🔓 إلغاء ربط حساب';
            const logDesc = isForce ? `قام المسؤول <@${adminId}> بفك ربط حساب اللاعب إجبارياً.` : 'تم إلغاء ربط حساب MTA.';
            
            await logToDiscord(client, isForce ? 'ERROR' : 'WARNING', logTitle, logDesc, 'MTA', [
                { name: 'المستخدم', value: (account.discord_username || 'Unknown') + ' (<@' + account.discord_id + '>)', inline: true },
                { name: 'حساب اللعبة', value: account.username, inline: true },
                { name: 'السيريال', value: '`' + serial + '`', inline: true }
            ]);

            if (account.discord_id) {
                await sendDM(client, account.discord_id, {
                    title: logTitle,
                    description: `مرحباً ${account.discord_username}، تم إلغاء ربط حسابك (${account.username}).`,
                    color: isForce ? 0xFF4444 : 0xF27D26
                });
            }
            res.json({ success: true });
        } catch (error: any) {
            res.status(500).json({ error: "Internal Error" });
        }
    });

    app.get('/mta/status/:serial', authenticate, async (req: any, res: any) => {
        const { serial } = req.params;
        try {
            const [rows]: any = await pool.execute('SELECT discord_id, discord_username, discord_avatar FROM accounts WHERE mtaserial = ?', [serial]);
            if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
            const acc = rows[0];
            res.json({
                linked: !!acc.discord_id,
                discord: acc.discord_id ? { id: acc.discord_id, username: acc.discord_username, avatar: acc.discord_avatar } : null
            });
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    });

    app.post('/internal/generate-code', authenticate, async (req: any, res: any) => {
        try {
            const { mtaserial } = req.body;
            if (!mtaserial || !/^[A-F0-9]{1,64}$/i.test(mtaserial)) return res.status(400).json({ error: 'Invalid Serial' });
            const code = crypto.randomBytes(16).toString('hex').toUpperCase();
            const expirySeconds = 300;
            await pool.execute(
                "INSERT INTO linking_codes (code, mta_serial, expires_at) VALUES (?, ?, NOW() + INTERVAL ? SECOND) ON DUPLICATE KEY UPDATE code = ?, expires_at = NOW() + INTERVAL ? SECOND",
                [code, mtaserial, expirySeconds, code, expirySeconds]
            );
            res.json({ success: true, code, expiresAt: Math.floor(Date.now() / 1000) + expirySeconds });
        } catch (err: any) {
            res.status(500).json({ error: 'Error' });
        }
    });

    app.listen(Number(env.PORT), '0.0.0.0', () => {
        console.log('Online on port ' + env.PORT);
    });
};
