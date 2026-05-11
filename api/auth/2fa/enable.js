/**
 * API Endpoint to Enable 2FA
 */
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { secret, backupCodes, token: userToken } = req.body;
  const authHeader = req.headers['authorization'];
  const authToken = authHeader?.replace('Bearer ', '');

  if (!secret || !userToken || !authToken) {
    return res.status(400).json({ error: 'Missing required fields or unauthorized' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Verify User
    const { data: { user }, error: authError } = await supabase.auth.getUser(authToken);
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });
    const { error } = await supabase
      .from('users')
      .update({ 
        two_factor_secret: secret,
        two_factor_enabled: true 
      })
      .eq('id', user.id);

    if (error) throw error;

    return res.status(200).json({ success: true, message: '2FA enabled successfully' });
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
