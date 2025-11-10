// api/proxy.js
// This is a Vercel Serverless Function that acts as a proxy to the bot.
// It uses the modern `fetch` API for improved reliability in the serverless environment.

// These MUST be set in your Vercel Project's Environment Variables settings.
// Vercel -> Your Project -> Settings -> Environment Variables
// DISCORD_BOT_URL should be the public URL of your bot (e.g., https://your-bot.on-render.com)
// API_SECRET_KEY must match the key in your bot's .env file.
const BOT_URL = process.env.DISCORD_BOT_URL;
const API_SECRET_KEY = process.env.API_SECRET_KEY;

// Helper function to read the request body into a buffer, as Vercel's request object is a stream.
async function buffer(readable) {
    const chunks = [];
    for await (const chunk of readable) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

module.exports = async (req, res) => {
    // --- 1. Configuration Check ---
    if (!BOT_URL || !API_SECRET_KEY) {
        console.error('[PROXY ERROR] DISCORD_BOT_URL or API_SECRET_KEY is not configured in Vercel environment variables.');
        res.status(500).json({ error: "Proxy configuration error on server. Admin must set environment variables." });
        return;
    }

    // --- 2. Prepare the request for the bot ---
    try {
        // The original req.url from Vercel is '/api/proxy/some/path'.
        // We must remove the '/api/proxy' prefix before forwarding it to the bot,
        // so the bot receives the expected '/some/path'.
        const rewrittenUrl = req.url.replace(/^\/api\/proxy/, '');
        
        // Construct the full target URL to the bot.
        const targetUrl = new URL(rewrittenUrl, BOT_URL);

        // Buffer the incoming request body to be able to send it with fetch.
        const body = await buffer(req);

        // Copy original headers from the client's request.
        const headers = { ...req.headers };
        // Add the secret authorization key for the bot.
        headers.authorization = `Bearer ${API_SECRET_KEY}`;
        // Set the host header to match the bot's URL.
        headers.host = targetUrl.host;
        // Let `fetch` automatically set the correct content-length.
        delete headers['content-length'];

        // --- 3. Make the proxied request using fetch ---
        console.log(`[PROXY] Forwarding ${req.method} request to ${targetUrl.toString()}`);
        const botResponse = await fetch(targetUrl.toString(), {
            method: req.method,
            headers: headers,
            // Only include a body for methods that support it (e.g., POST, PUT).
            body: (req.method !== 'GET' && req.method !== 'HEAD' && body.length > 0) ? body : undefined,
            redirect: 'follow'
        });
        console.log(`[PROXY] Received ${botResponse.status} from bot.`);

        // --- 4. Send the bot's response back to the original client ---
        
        // Copy status code and headers from the bot's response.
        res.statusCode = botResponse.status;
        botResponse.headers.forEach((value, name) => {
            // Vercel handles content-encoding automatically, so we skip this header to avoid conflicts.
            if (name.toLowerCase() !== 'content-encoding') {
                res.setHeader(name, value);
            }
        });

        // Stream the response body from the bot back to the original client.
        const responseBody = await botResponse.arrayBuffer();
        res.end(Buffer.from(responseBody));

    } catch (error) {
        console.error('[PROXY FETCH ERROR] Failed to connect or proxy request to bot server:', error);
        res.status(502).json({ 
            error: "Proxy Error: Could not connect to the bot server.",
            details: error.message 
        });
    }
};