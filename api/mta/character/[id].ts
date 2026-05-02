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
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function (req: VercelRequest, res: VercelResponse) {
  try {
    // Vulnerability #1: Authentication Check via Supabase Session
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: "Missing character ID parameter" });
    }

    // Check if the character belongs to the authenticated user
    // We need to check the 'profiles' table for the user's serial, then check characters table
    const { data: profile } = await supabase
      .from('profiles')
      .select('mta_serial')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.mta_serial) {
      return res.status(403).json({ error: 'Forbidden: No linked MTA account' });
    }

    // 1. Fetch Character Info and verify ownership via serial
    // Assuming 'characters' table has 'owner_serial' or similar. 
    // If it only has 'owner_id' (account id in MTA), we'd need to join with accounts.
    // For now, we'll just check if the character exists. 
    // Ideally, we'd verify ownership here.
    const [chars]: any = await pool.execute(
      "SELECT c.* FROM characters c JOIN accounts a ON c.account_id = a.id WHERE c.id = ? AND a.mtaserial = ? LIMIT 1",
      [id, profile.mta_serial]
    );

    if (chars.length === 0) {
      return res.status(404).json({ error: "Character not found or access denied" });
    }
    const character = chars[0];

    // 2. Fetch Vehicles
    const [vehicles]: any = await pool.execute(
      "SELECT id, model, plate FROM vehicles WHERE owner_id = ?",
      [id]
    );

    // 3. Fetch Properties
    const [properties]: any = await pool.execute(
      "SELECT id, name, address FROM properties WHERE owner_id = ?",
      [id]
    );

    res.json({
      character,
      vehicles,
      properties
    });
  } catch (error) {
    console.error("[API] MySQL Error in /api/mta/character");
    res.status(500).json({ error: "Internal Server Error" });
  }
}
