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

    // Direct lookup in MySQL using mtaserial
    const [accounts]: any = await pool.execute(
      "SELECT id, username, mtaserial FROM accounts WHERE mtaserial = ? LIMIT 1",
      [serial]
    );

    if (accounts.length === 0) {
      console.log(`[API] No MTA account found in game DB for serial: ${serial}`);
      return res.status(404).json({ error: "Account not found" });
    }

    const account = accounts[0];
    console.log(`[API] Found MTA account in game DB: ${JSON.stringify(account)}`);

    // 2. Fetch Characters
    const [characters]: any = await pool.execute(
      "SELECT id, name, gender, dob, age, nationality, playtime_hours, level, job, sector, cash, bank FROM characters WHERE account_id = ?",
      [account.id]
    );
    console.log(`[API] Found ${characters.length} characters for account ${account.id}`);

    // 3. Fetch Admin History
    const [adminRecord]: any = await pool.execute(
      "SELECT type, reason, admin, date FROM adminhistory WHERE account_id = ? ORDER BY date DESC LIMIT 10",
      [account.id]
    );
    console.log(`[API] Found ${adminRecord.length} admin records for account ${account.id}`);

    // 4. Fetch Vehicles
    const [vehicles]: any = await pool.execute(
      "SELECT v.* FROM vehicles v JOIN characters c ON v.owner_id = c.id WHERE c.account_id = ?",
      [account.id]
    );

    // 5. Fetch Properties
    const [properties]: any = await pool.execute(
      "SELECT p.* FROM properties p JOIN characters c ON p.owner_id = c.id WHERE c.account_id = ?",
      [account.id]
    );

    res.json({
      id: account.id,
      username: account.username,
      serial: account.mtaserial,
      character_count: characters.length,
      admin_record: adminRecord,
      characters: characters,
      vehicles: vehicles,
      properties: properties
    });
  } catch (error) {
    console.error("[API] MySQL Error in /api/mta/account:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
