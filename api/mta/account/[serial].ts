import { VercelRequest, VercelResponse } from '@vercel/node';
import mysql from 'mysql2/promise';
import { createClient } from '@supabase/supabase-js';

const pool = mysql.createPool({
  host: process.env.MTA_DB_HOST || "51.38.205.167",
  user: process.env.MTA_DB_USER || "u80078_Xpie51qdR4",
  password: process.env.MTA_DB_PASSWORD || "SI^B=+4Tvm@xNGABLh1bZ^Jf",
  database: process.env.MTA_DB_NAME || "s80078_db1771579900188",
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

    // 1. Fetch Account
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

    // 2. Fetch Characters with Job and Faction names
    // Note: We assume 'jobs' table has 'id' and 'name', and 'factions' table has 'id' and 'name'
    const [characters]: any = await pool.execute(
      `SELECT c.*, j.name as job_name, f.name as faction_name 
       FROM Characters c 
       LEFT JOIN jobs j ON c.job = j.id 
       LEFT JOIN factions f ON c.faction_id = f.id 
       WHERE c.account = ?`,
      [account.id]
    );
    console.log(`[API] Found ${characters.length} characters for account ${account.id}`);

    // 3. Fetch Admin History with Admin Username
    const [adminRecord]: any = await pool.execute(
      `SELECT h.*, a.username as admin_name 
       FROM adminhistory h 
       LEFT JOIN accounts a ON h.admin = a.id 
       WHERE h.user = ? 
       ORDER BY h.date DESC LIMIT 15`,
      [account.id]
    );
    
    const mappedAdminRecord = adminRecord.map((r: any) => ({
      id: r.id,
      type: r.type || 'Penalty',
      reason: r.reason || 'No reason',
      admin: r.admin_name || `Admin ID: ${r.admin}`,
      date: r.date,
      duration: r.duration
    }));

    // 4. Fetch Vehicles
    const [vehicles]: any = await pool.execute(
      "SELECT id, model, plate, owner FROM vehicles WHERE owner IN (SELECT id FROM Characters WHERE account = ?)",
      [account.id]
    );

    // 5. Fetch Interiors (Properties)
    const [interiors]: any = await pool.execute(
      "SELECT id, name, owner FROM interiors WHERE owner IN (SELECT id FROM Characters WHERE account = ?)",
      [account.id]
    );

    res.json({
      id: account.id,
      username: account.username,
      serial: account.mtaserial,
      character_count: characters.length,
      admin_record: mappedAdminRecord,
      characters: characters.map((c: any) => ({
        ...c,
        // Map user's specific field names to frontend expected names if needed
        name: c.charactername,
        cash: c.money,
        bank: c.bankmoney,
        playtime_hours: c.hoursplayed,
        // Birth date construction
        dob: `${c.day}/${c.month}/${c.year || '?'}` 
      })),
      vehicles: vehicles,
      properties: interiors.map((i: any) => ({
        id: i.id,
        name: i.name,
        address: `Interior ID: ${i.id}`
      }))
    });
  } catch (error: any) {
    console.error("[API] Global Error in /api/mta/account:", error);
    res.status(500).json({ 
      error: "Internal Server Error", 
      details: error.message,
      code: error.code 
    });
  }
}
