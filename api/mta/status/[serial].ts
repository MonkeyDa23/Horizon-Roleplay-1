import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function (req: VercelRequest, res: VercelResponse) {
  try {
    const { serial } = req.query;
    
    if (!serial || typeof serial !== 'string') {
      return res.status(400).json({ error: "Missing serial parameter" });
    }

    // Vulnerability Check: Is user authenticated?
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

    // Check Supabase for a profile with this serial
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, mta_name')
      .eq('mta_serial', serial)
      .maybeSingle();
    
    if (error) {
      console.error("[API] Supabase error in /api/mta/status:", error.message);
      return res.json({ linked: false, discord: null });
    }

    if (!profile) {
      return res.json({ linked: false, discord: null });
    }

    // Only return username if it belongs to the current user
    const isOwner = profile.id === user.id;

    res.json({
      linked: true,
      discord: {
        id: profile.id,
        username: isOwner ? (profile.mta_name || "Linked User") : "Hidden",
        avatar: null
      }
    });
  } catch (error: any) {
    console.error("[API] General error in /api/mta/status:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
