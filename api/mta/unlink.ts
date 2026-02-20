import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

export default async function (req: VercelRequest, res: VercelResponse) {
  console.log(`[API] Received unlink request for serial: ${req.body.serial}`);
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST']);
      return res.status(405).end('Method Not Allowed');
    }

    const { serial } = req.body;

    if (!serial) {
      console.log("[API] Missing serial parameter for unlink.");
      return res.status(400).json({ error: "Missing serial parameter" });
    }
    
    const { error } = await supabase
      .from('profiles')
      .update({ mta_serial: null, mta_name: null, mta_linked_at: null })
      .eq('mta_serial', serial);

    if (error) {
      console.error("[API] Supabase error during unlink:", error);
      throw error;
    }
    
    console.log(`[API] Successfully unlinked serial: ${serial}`);
    res.json({ success: true });
  } catch (error) {
    console.error("[API] General error in /api/mta/unlink:", error);
    res.status(500).json({ error: "Unlink failed" });
  }
}
