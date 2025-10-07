import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { get } from '@vercel/edge-config';
import { URLSearchParams } from 'url';

const app = express();
app.use(express.json());
app.use(cors());

// --- Supabase Client ---
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- Middleware for Admin Auth ---
// A simple middleware to check for user ID and roles in headers
// In a real-world scenario, you'd use a more robust JWT or session-based system
const adminAuth = (isSuperAdminRequired = false) => async (req, res, next) => {
    const userId = req.headers['x-user-id'];
    const userRoles = (req.headers['x-user-roles'] || '').toString().split(',');

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized: User ID is missing' });
    }

    // You would typically validate this user against your database or a session
    // For this implementation, we trust the frontend call is from a logged-in admin
    
    if (isSuperAdminRequired) {
        const superAdminRoles = await get('SUPER_ADMIN_ROLE_IDS') || [];
        const isSuperAdmin = userRoles.some(roleId => superAdminRoles.includes(roleId));
        if (!isSuperAdmin) {
            return res.status(403).json({ message: 'Forbidden: Super Admin access required' });
        }
    }
    
    // Add user info to request object for logging
    const { data: user } = await supabase.from('users').select('username').eq('id', userId).single();
    req.user = { id: userId, roles: userRoles, username: user?.username || 'Unknown' };
    
    // Get client IP address
    req.ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    next();
};

// --- Audit Log Helper ---
const logAction = async (req, action) => {
    if (!req.user) return;
    await supabase.from('audit_logs').insert({
        admin_id: req.user.id,
        admin_username: req.user.username,
        action: action,
        ip_address: req.ipAddress,
    });
};


// --- Public API Routes ---

// Get public-facing configuration
app.get('/api/config', async (req, res) => {
  try {
    // Fetch multiple keys at once
    const config = await get([
        'COMMUNITY_NAME', 
        'LOGO_URL', 
        'DISCORD_INVITE_URL', 
        'MTA_SERVER_URL',
        'DISCORD_CLIENT_ID',
        'DISCORD_GUILD_ID',
        'SUPER_ADMIN_ROLE_IDS',
        'BACKGROUND_IMAGE_URL'
    ]);
    res.json(config);
  } catch (error) {
    console.error('Error fetching Edge Config:', error);
    res.status(500).json({ message: 'Failed to load server configuration.' });
  }
});


// MTA Server Status (Placeholder)
app.get('/api/mta/status', async (req, res) => {
  // This is a placeholder. A real implementation would query the MTA server.
  res.json({
    name: `${await get('COMMUNITY_NAME') || 'Horizon'} Roleplay`,
    players: Math.floor(Math.random() * 100),
    maxPlayers: 128,
  });
});

// Discord Guild Stats
app.get('/api/discord/stats', async (req, res) => {
    try {
        const guildId = await get('DISCORD_GUILD_ID');
        if (!guildId) {
            return res.status(400).json({ message: 'Discord Guild ID is not configured.'});
        }
        // Discord's widget API is public if enabled for the guild
        const response = await fetch(`https://discord.com/api/guilds/${guildId}/widget.json`);
        if (!response.ok) {
            throw new Error(`Discord API responded with status: ${response.status}`);
        }
        const data = await response.json();
        res.json({
            onlineCount: data.presence_count,
            totalCount: data.members.length,
        });
    } catch(error) {
        console.error("Failed to fetch Discord stats:", error);
        res.status(500).json({ message: "Could not retrieve Discord server statistics." });
    }
});

// Get all products
app.get('/api/products', async (req, res) => {
    const { data, error } = await supabase.from('products').select('*');
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
});

// Get all open quizzes
app.get('/api/quizzes', async (req, res) => {
    const { data, error } = await supabase.from('quizzes').select('*, questions:quiz_questions(*)');
    if (error) return res.status(500).json({ message: error.message });
    res.json(data.map(q => ({...q, questions: q.questions || []})));
});

// Get a single quiz by ID
app.get('/api/quizzes/:id', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase.from('quizzes').select('*, questions:quiz_questions(*)').eq('id', id).single();
    if (error) return res.status(404).json({ message: 'Quiz not found' });
    res.json({...data, questions: data.questions || []});
});


// Get rules
app.get('/api/rules', async (req, res) => {
    const { data, error } = await supabase.from('rules').select('content').single();
    if (error || !data) {
        console.error("Error fetching rules, returning empty array:", error);
        return res.json([]); // Return empty array if no rules are set
    }
    res.json(data.content || []);
});


// --- User-Facing Routes ---

// Submit a quiz application
app.post('/api/submissions', async (req, res) => {
    const { quizId, quizTitle, userId, username, answers, cheatAttempts } = req.body;
    
    const { data: submission, error } = await supabase.from('submissions').insert({
        quiz_id: quizId,
        quiz_title: quizTitle,
        user_id: userId,
        username: username,
        cheat_attempts: cheatAttempts || [],
    }).select().single();

    if (error) return res.status(500).json({ message: error.message });

    const answerInserts = answers.map(a => ({
        submission_id: submission.id,
        question_id: a.questionId,
        question_text: a.questionText,
        answer: a.answer,
    }));

    const { error: answersError } = await supabase.from('submission_answers').insert(answerInserts);
    if (answersError) return res.status(500).json({ message: answersError.message });

    res.status(201).json(submission);
});


// Get submissions for a specific user
app.get('/api/submissions/user/:userId', async (req, res) => {
    const { userId } = req.params;
    const { data, error } = await supabase.from('submissions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
});


// --- AUTHENTICATION ---

app.get('/api/auth/callback', async (req, res) => {
    const { code, state } = req.query;
    const APP_URL = process.env.APP_URL || `https://${process.env.VERCEL_URL}`;
    const REDIRECT_URI = `${APP_URL}/api/auth/callback`;
    const CLIENT_ID = await get('DISCORD_CLIENT_ID');
    const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;

    try {
        if (!code) throw new Error("No code provided.");

        // 1. Exchange code for access token
        const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: code.toString(),
                redirect_uri: REDIRECT_URI,
            }),
        });
        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok) throw new Error(tokenData.error_description || "Token exchange failed");

        // 2. Fetch user's basic Discord info
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const discordUser = await userResponse.json();
        if (!userResponse.ok) throw new Error("Failed to fetch user info");
        
        // 3. Fetch user's guild-specific info from our bot
        const GUILD_ID = await get('DISCORD_GUILD_ID');
        const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
        const guildMemberResponse = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${discordUser.id}`, {
            headers: { Authorization: `Bot ${BOT_TOKEN}` },
        });
        const guildMember = await guildMemberResponse.json();
        if (!guildMemberResponse.ok) throw new Error("User not found in guild. Please join our Discord server first.");

        // 4. Get all roles in the guild to find names and colors
        const guildRolesResponse = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/roles`, {
            headers: { Authorization: `Bot ${BOT_TOKEN}` },
        });
        const guildRoles = await guildRolesResponse.json();
        if (!guildRolesResponse.ok) throw new Error("Could not fetch guild roles.");

        const userRoles = guildMember.roles
            .map(roleId => guildRoles.find(r => r.id === roleId))
            .filter(Boolean) // Filter out any roles not found
            .sort((a, b) => b.position - a.position); // Sort by highest position

        const adminRoles = await get('ADMIN_ROLE_IDS') || [];
        const isAdmin = userRoles.some(role => adminRoles.includes(role.id));

        const finalUser = {
            id: discordUser.id,
            username: guildMember.nick || discordUser.global_name || discordUser.username,
            avatar: guildMember.avatar 
                ? `https://cdn.discordapp.com/guilds/${GUILD_ID}/users/${discordUser.id}/avatars/${guildMember.avatar}.png`
                : `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`,
            isAdmin,
            roles: guildMember.roles,
            primaryRole: userRoles[0] ? { id: userRoles[0].id, name: userRoles[0].name, color: `#${userRoles[0].color.toString(16).padStart(6, '0')}` } : null,
        };
        
        // Redirect back to a frontend page to handle the user data
        const userB64 = Buffer.from(JSON.stringify(finalUser)).toString('base64');
        res.redirect(`/api/auth/callback?user=${userB64}&state=${state}`);

    } catch (error) {
        console.error("Auth Callback Error:", error);
        res.redirect(`/api/auth/callback?error=${encodeURIComponent(error.message)}&state=${state}`);
    }
});


// --- ADMIN ROUTES ---

// Log admin panel access
app.post('/api/admin/access-log', adminAuth(false), async (req, res) => {
    await logAction(req, 'Accessed Admin Panel');
    res.sendStatus(204);
});


// Revalidate user session (check roles, etc.)
app.post('/api/session/revalidate', async (req, res) => {
     // Re-implement the same logic as the auth callback to get fresh data
    try {
        const { user } = req.body;
        if (!user) return res.status(400).json({ message: 'User object required' });
        
        const GUILD_ID = await get('DISCORD_GUILD_ID');
        const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
        
        const guildMemberResponse = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}`, {
            headers: { Authorization: `Bot ${BOT_TOKEN}` },
        });
        
        if (guildMemberResponse.status === 404) {
             return res.status(404).json({ message: 'User not found in guild' });
        }
        if (!guildMemberResponse.ok) throw new Error('Failed to fetch fresh member data');
        const guildMember = await guildMemberResponse.json();
        
        // This is an expensive call, so we only do it if roles have changed.
        let userRoles = user.roles;
        if (JSON.stringify(user.roles.sort()) !== JSON.stringify(guildMember.roles.sort())) {
            const guildRolesResponse = await fetch(`https://discord.com/api/guilds/${GUILD_ID}/roles`, {
                headers: { Authorization: `Bot ${BOT_TOKEN}` },
            });
            const guildRoles = await guildRolesResponse.json();
            userRoles = guildMember.roles
                .map(roleId => guildRoles.find(r => r.id === roleId))
                .filter(Boolean).sort((a,b) => b.position - a.position);
        }

        const adminRoles = await get('ADMIN_ROLE_IDS') || [];
        const isAdmin = guildMember.roles.some(roleId => adminRoles.includes(roleId));

        const freshUser = {
            ...user,
            username: guildMember.nick || user.username,
            isAdmin,
            roles: guildMember.roles,
            primaryRole: userRoles[0] ? { id: userRoles[0].id, name: userRoles[0].name, color: `#${userRoles[0].color.toString(16).padStart(6, '0')}` } : null,
        };
        res.json(freshUser);

    } catch(e) {
        console.error("Session revalidation error:", e);
        res.status(500).json({ message: e.message });
    }
});


// Get all submissions (for admins)
app.get('/api/submissions', adminAuth(false), async (req, res) => {
    const { data, error } = await supabase.from('submissions').select('*, answers:submission_answers(*)').order('created_at', { ascending: false });
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
});


// Update submission status
app.patch('/api/submissions/:id/status', adminAuth(false), async (req, res) => {
    const { id } = req.params;
    const { status, adminId, adminUsername } = req.body;
    
    const { data, error } = await supabase.from('submissions').update({ status, admin_id: adminId, admin_username: adminUsername }).eq('id', id).select().single();
    if (error) return res.status(500).json({ message: error.message });
    
    await logAction(req, `Updated submission ${id} to status ${status}`);
    res.json(data);
});


// Save/Update a quiz
app.post('/api/quizzes', adminAuth(true), async (req, res) => {
    const { id, titleKey, descriptionKey, isOpen, questions, logoUrl, bannerUrl, allowedTakeRoles } = req.body;
    
    const quizData = { title_key: titleKey, description_key: descriptionKey, is_open: isOpen, logo_url: logoUrl, banner_url: bannerUrl, allowed_take_roles: allowedTakeRoles };

    if(isOpen) quizData.last_opened_at = new Date().toISOString();
    
    const { data: savedQuiz, error } = await supabase.from('quizzes').upsert({ id, ...quizData }).select().single();
    if (error) return res.status(500).json({ message: error.message });

    // Handle questions (delete old, insert new)
    await supabase.from('quiz_questions').delete().eq('quiz_id', savedQuiz.id);
    const questionInserts = questions.map(q => ({ ...q, quiz_id: savedQuiz.id }));
    await supabase.from('quiz_questions').insert(questionInserts);

    await logAction(req, `Saved quiz form "${titleKey}" (ID: ${savedQuiz.id})`);
    res.json(savedQuiz);
});

// Delete a quiz
app.delete('/api/quizzes/:id', adminAuth(true), async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('quizzes').delete().eq('id', id);
    if (error) return res.status(500).json({ message: error.message });
    await logAction(req, `Deleted quiz form ID: ${id}`);
    res.sendStatus(204);
});

// Save rules
app.post('/api/rules', adminAuth(true), async (req, res) => {
    const { rules } = req.body;
    const { error } = await supabase.from('rules').upsert({ id: 1, content: rules });
    if (error) return res.status(500).json({ message: error.message });
    await logAction(req, 'Updated server rules');
    res.sendStatus(204);
});


// Save/Update a product
app.post('/api/products', adminAuth(true), async (req, res) => {
    const { id, nameKey, descriptionKey, price, imageUrl } = req.body;
    const productData = { name_key: nameKey, description_key: descriptionKey, price, image_url: imageUrl };
    const { data, error } = await supabase.from('products').upsert({ id, ...productData }).select().single();
    if (error) return res.status(500).json({ message: error.message });
    await logAction(req, `Saved product "${nameKey}" (ID: ${data.id})`);
    res.json(data);
});

// Delete a product
app.delete('/api/products/:id', adminAuth(true), async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) return res.status(500).json({ message: error.message });
    await logAction(req, `Deleted product ID: ${id}`);
    res.sendStatus(204);
});

// Get audit logs
app.get('/api/audit-logs', adminAuth(true), async (req, res) => {
    const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) return res.status(500).json({ message: error.message });
    res.json(data);
});


// Update public configuration in Edge Config
app.post('/api/admin/config', adminAuth(true), async (req, res) => {
    const updates = req.body;
    const vercelToken = process.env.VERCEL_API_TOKEN;
    const edgeConfigId = process.env.EDGE_CONFIG_ID;

    if (!vercelToken || !edgeConfigId) {
        return res.status(500).json({ message: 'Server is not configured for Edge Config updates.' });
    }

    try {
        const response = await fetch(`https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${vercelToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                items: Object.entries(updates).map(([key, value]) => ({
                    operation: 'update',
                    key,
                    value,
                })),
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message);
        }
        
        await logAction(req, `Updated site settings: ${Object.keys(updates).join(', ')}`);
        res.status(200).json({ message: 'Configuration updated successfully.' });
    } catch (error) {
        console.error('Error updating Edge Config:', error);
        res.status(500).json({ message: error.message });
    }
});


// Health check endpoint
app.get('/api/health', async (req, res) => {
    const checks = {
        env: {},
        bot: {},
        supabase: {},
        urls: {}
    };

    // Check Env Vars
    const requiredEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_SECRET', 'EDGE_CONFIG', 'EDGE_CONFIG_ID', 'VERCEL_API_TOKEN'];
    requiredEnv.forEach(key => {
        checks.env[key] = process.env[key] ? '✅ Set' : '❌ Not Set';
    });
    const optionalEnv = ['APP_URL'];
    optionalEnv.forEach(key => {
        checks.env[key] = process.env[key] ? '✅ Set' : '⚠️ Not Set (Optional, but recommended)';
    });

    // Check URLs
    const appUrl = process.env.APP_URL || `https://${process.env.VERCEL_URL || 'your-site.vercel.app'}`;
    checks.urls.app_url = appUrl;
    checks.urls.redirect_uri = `${appUrl}/api/auth/callback`;

    // Check Supabase
    try {
        const { error } = await supabase.from('quizzes').select('id').limit(1);
        if (error) throw error;
        checks.supabase.status = '✅ Connected';
    } catch(e) {
        checks.supabase.status = '❌ Failed';
        checks.supabase.error = e.message;
    }

    // Check Bot
    try {
        const guildId = await get('DISCORD_GUILD_ID');
        if (!guildId) {
             checks.bot.status = '❌ Failed';
             checks.bot.error = 'DISCORD_GUILD_ID not set in Edge Config.';
        } else {
            const botToken = process.env.DISCORD_BOT_TOKEN;
            const response = await fetch(`https://discord.com/api/guilds/${guildId}`, {
                headers: { Authorization: `Bot ${botToken}` }
            });
            if (!response.ok) {
                if (response.status === 401) throw new Error('Invalid Bot Token');
                if (response.status === 403) throw new Error('Bot is not in the specified guild');
                throw new Error(`API error: ${response.statusText}`);
            }
            const guildData = await response.json();
            checks.bot.status = '✅ Connected';
            checks.bot.guild_found = true;
            checks.bot.guild_name = guildData.name;
        }
    } catch(e) {
        checks.bot.status = '❌ Failed';
        checks.bot.error = e.message;
    }
    
    const hasErrors = Object.values(checks.env).some(v => v.startsWith('❌')) ||
                      Object.values(checks.bot).some(v => String(v).startsWith('❌')) ||
                      Object.values(checks.supabase).some(v => String(v).startsWith('❌'));
                      
    res.status(hasErrors ? 503 : 200).json(checks);
});


export default app;
