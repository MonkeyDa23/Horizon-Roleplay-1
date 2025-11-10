// api/proxy.js
// This is a Vercel Serverless Function that acts as a proxy to the bot.
// It uses the modern `fetch` API for improved reliability in the serverless environment.

// These MUST be set in your Vercel Project's Environment Variables settings.
const BOT_URL = process.env.DISCORD_BOT_URL;
const API_SECRET_KEY = process.env.API_SECRET_KEY;

// Helper function to read the request body into a buffer.
// Vercel's request object is a stream.
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
        // Construct the full target URL
        const targetUrl = new URL(req.url, BOT_URL);

        // Buffer the incoming request body
        const body = await buffer(req);

        // Copy original headers, but overwrite/add what's needed for the proxy
        const headers = { ...req.headers };
        headers.authorization = `Bearer ${API_SECRET_KEY}`;
        headers.host = targetUrl.host;
        // Let `fetch` automatically set the content-length based on the buffered body
        delete headers['content-length'];

        // --- 3. Make the proxied request using fetch ---
        const botResponse = await fetch(targetUrl.toString(), {
            method: req.method,
            headers: headers,
            // Only include a body for methods that support it
            body: (req.method !== 'GET' && req.method !== 'HEAD' && body.length > 0) ? body : undefined,
            redirect: 'follow'
        });

        // --- 4. Send the bot's response back to the client ---
        
        // Copy status code and headers from the bot's response
        res.statusCode = botResponse.status;
        botResponse.headers.forEach((value, name) => {
            // Vercel handles content-encoding automatically, so we skip this header
            if (name.toLowerCase() !== 'content-encoding') {
                res.setHeader(name, value);
            }
        });

        // Stream the response body from the bot back to the original client
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
