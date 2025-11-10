// api/proxy.js
// This is a Vercel Serverless Function that acts as a proxy to the bot.
const http = require('http');
const https = require('https');

// These MUST be set in your Vercel Project's Environment Variables settings.
// DO NOT hardcode them here.
const BOT_URL = process.env.DISCORD_BOT_URL;     // e.g., 'http://217.160.125.125:14686'
const API_SECRET_KEY = process.env.API_SECRET_KEY; // The secret key

module.exports = (req, res) => {
    // --- Configuration Check ---
    if (!BOT_URL || !API_SECRET_KEY) {
        console.error('[PROXY ERROR] DISCORD_BOT_URL or API_SECRET_KEY is not configured in Vercel environment variables.');
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: "Proxy configuration error on server. Admin must set environment variables." }));
        return;
    }

    const botUrl = new URL(BOT_URL);
    
    // --- Prepare options for the proxied request ---
    const options = {
        hostname: botUrl.hostname,
        port: botUrl.port,
        path: req.url, // Vercel automatically provides the path after /api/proxy
        method: req.method,
        headers: {
            // Copy essential headers from the original request
            ...req.headers,
            // **IMPORTANT**: Overwrite/add headers needed for the bot
            'Authorization': `Bearer ${API_SECRET_KEY}`,
            'host': botUrl.hostname, // Rewrite the host to match the bot server
        },
    };

    // Vercel handles some headers; remove them to avoid conflicts.
    delete options.headers['x-vercel-deployment-url'];
    delete options.headers['x-vercel-forwarded-for'];
    delete options.headers['x-vercel-id'];
    delete options.headers['x-real-ip'];

    // --- Create and send the request to the bot ---
    const proxyModule = botUrl.protocol === 'https:' ? https : http;

    const proxyReq = proxyModule.request(options, (proxyRes) => {
        // Pass the bot's response headers and status code back to the original client
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        // Pipe the response body from the bot back to the client
        proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
        console.error('[PROXY ERROR] Failed to connect to bot server:', err);
        res.statusCode = 502; // Bad Gateway
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: "Proxy Error: Could not connect to the bot server." }));
    });

    // Pipe the original request body (if any) to the bot
    req.pipe(proxyReq, { end: true });
};
