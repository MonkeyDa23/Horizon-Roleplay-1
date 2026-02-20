import { VercelRequest, VercelResponse } from '@vercel/node';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.MTA_DB_HOST,
  user: process.env.MTA_DB_USER,
  password: process.env.MTA_DB_PASSWORD,
  database: process.env.MTA_DB_NAME,
  port: parseInt(process.env.MTA_DB_PORT || '3306', 10),
});

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
      "SELECT id, username, serial FROM accounts WHERE serial = ? LIMIT 1",
      [serial]
    );

    if (accounts.length === 0) {
      console.log(`[API] No MTA account found for serial: ${serial}`);
      return res.status(404).json({ error: "MTA Account not found" });
    }

    const account = accounts[0];
    console.log(`[API] Found MTA account: ${JSON.stringify(account)}`);

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
