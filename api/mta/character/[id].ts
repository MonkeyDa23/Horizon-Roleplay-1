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
  console.log(`[API] Received request for /api/mta/character/${req.query.id}`);
  try {
    const { id } = req.query;

    if (!id) {
      console.log("[API] Missing character ID parameter.");
      return res.status(400).json({ error: "Missing character ID parameter" });
    }

    // 1. Fetch Character Info
    const [chars]: any = await pool.execute(
      "SELECT * FROM characters WHERE id = ? LIMIT 1",
      [id]
    );

    if (chars.length === 0) {
      console.log(`[API] Character not found for ID: ${id}`);
      return res.status(404).json({ error: "Character not found" });
    }
    const character = chars[0];
    console.log(`[API] Found character: ${JSON.stringify(character)}`);

    // 2. Fetch Vehicles
    const [vehicles]: any = await pool.execute(
      "SELECT id, model, plate FROM vehicles WHERE owner_id = ?",
      [id]
    );
    console.log(`[API] Found ${vehicles.length} vehicles for character ${id}`);

    // 3. Fetch Properties
    const [properties]: any = await pool.execute(
      "SELECT id, name, address FROM properties WHERE owner_id = ?",
      [id]
    );
    console.log(`[API] Found ${properties.length} properties for character ${id}`);

    res.json({
      character,
      vehicles,
      properties
    });
  } catch (error) {
    console.error("[API] MySQL Error in /api/mta/character:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
