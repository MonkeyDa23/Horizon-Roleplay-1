import { VercelRequest, VercelResponse } from '@vercel/node';
import mysql from 'mysql2/promise';
import { createClient } from '@supabase/supabase-js';

const pool = mysql.createPool({
  host: process.env.MTA_DB_HOST,
  user: process.env.MTA_DB_USER,
  password: process.env.MTA_DB_PASSWORD,
  database: process.env.MTA_DB_NAME,
  port: parseInt(process.env.MTA_DB_PORT || '3306', 10),
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

export default async function (req: VercelRequest, res: VercelResponse) {
  console.log(`[API] Received request for /api/mta/account/${req.query.serial}`);
  try {
    const { serial } = req.query;
    
    if (!serial) {
      console.log("[API] Missing serial parameter.");
      return res.status(400).json({ error: "Missing serial parameter" });
    }

    // First, get the MTA account ID from Supabase using the serial
    const { data: profile, error: supabaseError } = await supabase
      .from('profiles')
      .select('mta_account_id')
      .eq('mta_serial', serial)
      .single();

    if (supabaseError || !profile || !profile.mta_account_id) {
      console.log(`[API] Supabase: No linked MTA account_id found for serial: ${serial}`);
      return res.status(404).json({ error: "Linked MTA Account ID not found" });
    }

    const mtaAccountId = profile.mta_account_id;
    console.log(`[API] Found linked MTA account ID from Supabase: ${mtaAccountId}`);

    // 1. Fetch Account from MTA DB using the retrieved mtaAccountId
    const [accounts]: any = await pool.execute(
      "SELECT id, username, serial FROM accounts WHERE id = ? LIMIT 1",
      [mtaAccountId]
    );

    if (accounts.length === 0) {
      console.log(`[API] No MTA account found in game DB for ID: ${mtaAccountId}`);
      return res.status(404).json({ error: "MTA Account not found in game DB" });
    }

    const account = accounts[0];
    console.log(`[API] Found MTA account in game DB: ${JSON.stringify(account)}`);

    // 2. Fetch Characters
    const [characters]: any = await pool.execute(
      "SELECT id, name, gender, dob, age, nationality, playtime_hours, level, job, sector, cash, bank FROM characters WHERE account_id = ?",
      [account.id]
    );
    console.log(`[API] Found ${characters.length} characters for account ${account.id}`);

    // 3. Fetch Admin Record (Bans/Kicks) from actual adminhistory table
    const [adminRecord]: any = await pool.execute(
      "SELECT action as type, reason, admin, date, duration FROM adminhistory WHERE user = ? ORDER BY date DESC",
      [account.id]
    );
    console.log(`[API] Found ${adminRecord.length} admin records for account ${account.id}`);

    res.json({
      ...account,
      character_count: characters.length,
      admin_record: adminRecord,
      characters: characters
    });
  } catch (error) {
    console.error("[API] MySQL Error in /api/mta/account:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
