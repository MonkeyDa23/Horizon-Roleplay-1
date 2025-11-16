// api/proxy.js
// Vercel Serverless Function to proxy requests to the Discord Bot.
// This resolves mixed-content issues and keeps the API key secure.

export default async function handler(req, res) {
  // Vercel populates process.env from your project's environment variables
  const botUrl = process.env.VITE_DISCORD_BOT_URL;
  const apiKey = process.env.VITE_DISCORD_BOT_API_KEY;

  if (!botUrl || !apiKey) {
    console.error("Proxy Error: VITE_DISCORD_BOT_URL or VITE_DISCORD_BOT_API_KEY is not set in the server environment.");
    return res.status(500).json({ error: 'Proxy service is not configured.' });
  }

  // Reconstruct the target URL. req.url includes the path and query string.
  // e.g., '/api/proxy/sync-user/12345' becomes '/sync-user/12345'
  const targetPath = req.url.replace('/api/proxy', '');
  const targetUrl = new URL(targetPath, botUrl);

  try {
    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        // Securely add the secret API key on the server-side
        'Authorization': apiKey,
      },
      // Vercel automatically parses JSON bodies, so we re-stringify it for the fetch call
      body: req.body ? JSON.stringify(req.body) : null,
    });

    // Pass all headers from the bot's response back to the client
    response.headers.forEach((value, key) => {
      // Vercel handles content-encoding automatically
      if (key.toLowerCase() !== 'content-encoding') {
        res.setHeader(key, value);
      }
    });
    
    // Send back the response from the bot
    res.status(response.status).send(await response.text());

  } catch (error) {
    console.error(`[PROXY] Error forwarding request to ${targetUrl}:`, error);
    res.status(502).json({ error: 'Bad Gateway: The proxy could not connect to the bot.' });
  }
}
