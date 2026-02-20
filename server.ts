import express from "express";
import { createServer as createViteServer } from "vite";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const PORT = 3000;

// Supabase Client for Backend
const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.MTA_DB_HOST,
  user: process.env.MTA_DB_USER,
  password: process.env.MTA_DB_PASSWORD,
  database: process.env.MTA_DB_NAME,
  port: parseInt(process.env.MTA_DB_PORT || "3306"),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

app.use(express.json());

// API: Get MTA Account Info by Serial
app.get("/api/mta/account/:serial", async (req, res) => {
  console.log(`[API] Received request for /api/mta/account/${req.params.serial}`);
  try {
    const { serial } = req.params;
    
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
});

// API: Check Link Status for MTA Menu
app.get("/api/mta/status/:serial", async (req, res) => {
  console.log(`[API] Received request for /api/mta/status/${req.params.serial}`);
  try {
    const { serial } = req.params;
    
    // Check Supabase for a profile with this serial
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, mta_name')
      .eq('mta_serial', serial)
      .single();
    
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
});

// API: Unlink Account
app.post("/api/mta/unlink", async (req, res) => {
  console.log(`[API] Received unlink request for serial: ${req.body.serial}`);
  try {
    const { serial } = req.body;
    
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
});

// API: Get Character Details (Vehicles, Properties)
app.get("/api/mta/character/:id", async (req, res) => {
  console.log(`[API] Received request for /api/mta/character/${req.params.id}`);
  try {
    const { id } = req.params;

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
});

// Vite middleware for development
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }
}

setupVite().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
