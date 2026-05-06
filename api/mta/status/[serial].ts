import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function (req: VercelRequest, res: VercelResponse) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { serial } = req.query;
    
    if (!serial) {
      return res.status(400).json({ error: "Missing serial parameter" });
    }

    // Check Supabase for a profile with this serial and ensure it belongs to the authenticated user
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, mta_name')
      .eq('mta_serial', serial)
      .eq('id', user.id) // Authorization: Ensure the serial belongs to the current user
      .maybeSingle();
    
    if (error) {
      console.error("[API] Supabase error in /api/mta/status");
      return res.json({ linked: false, discord: null, error: "Database error" });
    }

    if (!profile) {
      return res.json({ linked: false, discord: null });
    }

    res.json({
      linked: true,
      discord: {
        id: profile.id,
        username: profile.mta_name || "Linked User",
        avatar: null // You'd need a discord bot or oauth to get the real avatar
      }
    });
  } catch (error) {
    console.error("[API] General error in /api/mta/status");
    res.status(500).json({ error: "Error checking status" });
  }
}
