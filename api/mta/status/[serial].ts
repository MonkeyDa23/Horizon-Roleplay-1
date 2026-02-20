import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

export default async function (req: VercelRequest, res: VercelResponse) {
  console.log(`[API] Received request for /api/mta/status/${req.query.serial}`);
  try {
    const { serial } = req.query;
    
    if (!serial) {
      console.log("[API] Missing serial parameter.");
      return res.status(400).json({ error: "Missing serial parameter" });
    }

    // Check Supabase for a profile with this serial
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, mta_name')
      .eq('mta_serial', serial)
      .maybeSingle();
    
    if (error) {
      console.error("[API] Supabase error in /api/mta/status:", error);
      return res.json({ linked: false, discord: null, error: error.message });
    }

    if (!profile) {
      console.log(`[API] No linked profile found for serial: ${serial}`);
      return res.json({ linked: false, discord: null });
    }

    console.log(`[API] Linked profile found for serial ${serial}: ${JSON.stringify(profile)}`);
    res.json({
      linked: true,
      discord: {
        id: profile.id,
        username: profile.mta_name || "Linked User",
        avatar: null // You'd need a discord bot or oauth to get the real avatar
      }
    });
  } catch (error) {
    console.error("[API] General error in /api/mta/status:", error);
    res.status(500).json({ error: "Error checking status" });
  }
}
