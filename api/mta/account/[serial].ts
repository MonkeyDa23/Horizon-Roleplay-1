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

    // Direct lookup in MySQL using mtaserial with fallback to serial
    let accounts: any[] = [];
    try {
      const [rows]: any = await pool.execute(
        "SELECT * FROM accounts WHERE mtaserial = ? LIMIT 1",
        [serial]
      );
      accounts = rows;
    } catch (err) {
      console.log("[API] mtaserial column not found, trying serial column");
      try {
        const [rows]: any = await pool.execute(
          "SELECT * FROM accounts WHERE serial = ? LIMIT 1",
          [serial]
        );
        accounts = rows;
      } catch (serialErr) {
        console.error("[API] Both mtaserial and serial lookups failed.");
        throw serialErr;
      }
    }

    if (accounts.length === 0) {
      console.log(`[API] No MTA account found in game DB for serial: ${serial}`);
      return res.status(404).json({ error: "Account not found" });
    }

    const account = accounts[0];
    console.log(`[API] Found MTA account in game DB: ${JSON.stringify(account)}`);

    // 2. Fetch Characters - Using SELECT * to be safe
    let characters = [];
    try {
      const [rows]: any = await pool.execute(
        "SELECT * FROM characters WHERE account_id = ?",
        [account.id]
      );
      characters = rows;
    } catch (err) {
      console.log("[API] account_id not found in characters, trying user_id or similar");
      // You can add more fallbacks here if needed
    }

    // 3. Fetch Admin History - Using SELECT * and mapping columns
    let adminRecord = [];
    try {
      const [rows]: any = await pool.execute(
        "SELECT * FROM adminhistory WHERE account_id = ? ORDER BY date DESC LIMIT 10",
        [account.id]
      );
      adminRecord = rows.map((r: any) => ({
        type: r.type || r.action || 'Unknown',
        reason: r.reason || 'No reason',
        admin: r.admin || 'System',
        date: r.date,
        duration: r.duration
      }));
    } catch (adminErr: any) {
      console.log("[API] Fallback: Trying 'user' column for adminhistory");
      try {
        const [rows]: any = await pool.execute(
          "SELECT * FROM adminhistory WHERE user = ? ORDER BY date DESC LIMIT 10",
          [account.id]
        );
        adminRecord = rows.map((r: any) => ({
          type: r.type || r.action || 'Unknown',
          reason: r.reason || 'No reason',
          admin: r.admin || 'System',
          date: r.date,
          duration: r.duration
        }));
      } catch (fallbackErr) {
        console.error("[API] Admin history fetch failed completely.");
      }
    }
    console.log(`[API] Found ${adminRecord.length} admin records for account ${account.id}`);

    // 4. Fetch Vehicles
    let vehicles = [];
    try {
      const [rows]: any = await pool.execute(
        "SELECT v.* FROM vehicles v JOIN characters c ON v.owner_id = c.id WHERE c.account_id = ?",
        [account.id]
      );
      vehicles = rows;
    } catch (err) {
      console.error("[API] Error fetching vehicles:", err);
    }

    // 5. Fetch Properties
    let properties = [];
    try {
      const [rows]: any = await pool.execute(
        "SELECT p.* FROM properties p JOIN characters c ON p.owner_id = c.id WHERE c.account_id = ?",
        [account.id]
      );
      properties = rows;
    } catch (err) {
      console.error("[API] Error fetching properties:", err);
    }

    res.json({
      id: account.id,
      username: account.username,
      serial: account.mtaserial || account.serial,
      character_count: characters.length,
      admin_record: adminRecord,
      characters: characters,
      vehicles: vehicles,
      properties: properties
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
