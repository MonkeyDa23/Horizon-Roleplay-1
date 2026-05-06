import crypto from 'crypto';

export default async function handler(req, res) {
    // Secret keys from environment variables
    const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET_KEY || process.env.VITE_HCAPTCHA_SITE_KEY; // Ensure you have HCAPTCHA_SECRET_KEY in Vercel
    const SESSION_SECRET = process.env.SESSION_SECRET;

    if (!SESSION_SECRET) {
        console.error('CRITICAL: SESSION_SECRET environment variable is required');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    if (req.method === 'GET') {
        const cookies = req.headers.cookie || '';
        if (cookies.includes('vixel_secure_session=')) {
            // Extract and verify token
            const match = cookies.match(/vixel_secure_session=([^;]+)/);
            if (match) {
                const token = decodeURIComponent(match[1]);
                const [payload, signature] = token.split(':signature:');
                if (payload && signature) {
                    const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
                    if (signature === expectedSignature) {
                        const [, expires] = payload.split(':');
                        if (Date.now() < parseInt(expires, 10)) {
                            return res.json({ verified: true });
                        }
                    }
                }
            }
        }
        return res.json({ verified: false });
    }

    if (req.method === 'POST') {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: 'Token is required' });

        try {
            // Verify with hCaptcha API
            const params = new URLSearchParams({
                secret: HCAPTCHA_SECRET,
                response: token
            });

            const verifyRes = await fetch('https://hcaptcha.com/siteverify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString()
            });

            const data = await verifyRes.json();

            if (data.success) {
                // Generate a secure Server-Side Session token signed with our backend secret
                const expires = Date.now() + 1000 * 60 * 60 * 12; // 12 hours validity
                const payload = `verified:${expires}`;
                const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
                const cookieValue = `${payload}:signature:${signature}`;

                // Set HttpOnly, Secure cookie so JS cannot read it or modify it
                res.setHeader('Set-Cookie', `vixel_secure_session=${encodeURIComponent(cookieValue)}; HttpOnly; Path=/; Max-Age=43200; Secure; SameSite=Strict`);
                return res.json({ success: true });
            }

            return res.status(400).json({ error: 'Invalid captcha' });
        } catch (error) {
            console.error('Captcha error:', error);
            return res.status(500).json({ error: 'Server error during verification' });
        }
    }
    
    return res.status(405).json({ error: 'Method Not Allowed' });
}
