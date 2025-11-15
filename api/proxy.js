// api/proxy.js
const BOT_URL = process.env.DISCORD_BOT_URL;
const API_SECRET_KEY = process.env.API_SECRET_KEY;

async function buffer(readable) {
    const chunks = [];
    for await (const chunk of readable) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

module.exports = async (req, res) => {
    try {
        console.log(`[PROXY] START: Received ${req.method} for ${req.url}`);

        if (!BOT_URL || !API_SECRET_KEY) {
            console.error('[PROXY] FATAL: DISCORD_BOT_URL or API_SECRET_KEY is not set in Vercel environment variables.');
            return res.status(500).json({ error: "Proxy configuration error: Missing required environment variables on the server." });
        }
        console.log(`[PROXY] Config check passed. BOT_URL is set.`);

        let correctedBotUrl = BOT_URL.trim();
        if (!correctedBotUrl.startsWith('http://') && !correctedBotUrl.startsWith('https://')) {
            console.warn(`[PROXY] WARNING: BOT_URL is missing protocol. Prepending http://.`);
            correctedBotUrl = `http://${correctedBotUrl}`;
        }
        
        const rewrittenUrl = req.url.replace(/^\/api\/gateway/, '');
        const targetUrl = new URL(rewrittenUrl, correctedBotUrl);
        
        console.log(`[PROXY] Forwarding request to: ${targetUrl.toString()}`);

        const body = await buffer(req);
        
        const headers = { ...req.headers };
        headers.authorization = `Bearer ${API_SECRET_KEY.trim()}`;
        
        // The 'host' and 'connection' headers are forbidden to be set programmatically in fetch.
        // They are managed by the HTTP agent. Deleting them from the copied headers
        // prevents a TypeError crash.
        delete headers.host;
        delete headers.connection;
        delete headers['content-length'];

        console.log(`[PROXY] Sending headers to bot (excluding some): ${JSON.stringify({ host: targetUrl.host, auth: headers.authorization ? 'Bearer ***' : 'None' })}`);

        const botResponse = await fetch(targetUrl.toString(), {
            method: req.method,
            headers: headers,
            body: (req.method !== 'GET' && req.method !== 'HEAD' && body.length > 0) ? body : undefined,
            redirect: 'follow'
        });

        console.log(`[PROXY] RESPONSE from bot: Status ${botResponse.status}`);

        res.statusCode = botResponse.status;
        botResponse.headers.forEach((value, name) => {
            // Vercel handles content-encoding automatically, passing it can cause issues.
            if (name.toLowerCase() !== 'content-encoding') {
                res.setHeader(name, value);
            }
        });

        if (botResponse.body) {
            const { Readable } = require('stream');
            const readable = Readable.fromWeb(botResponse.body);
            readable.pipe(res);
            console.log(`[PROXY] END: Piping response stream to client.`);
        } else {
            res.end();
            console.log(`[PROXY] END: No response body from bot.`);
        }

    } catch (error) {
        console.error('[PROXY] FATAL CRASH:', error);
        res.status(500).json({
            error: "An internal error occurred in the proxy function.",
            details: error.message,
        });
    }
};
