import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  const pool = mysql.createPool({
    host: '51.38.205.167',
    user: 'u80078_Xpie51qdR4',
    password: 'SI^B=+4Tvm@xNGABLh1bZ^Jf',
    database: 's80078_db1771579900188',
    port: 3306
  });
  
  try {
    const [tables]: any = await pool.execute("SHOW TABLES");
    console.log("Tables:", tables.map((t: any) => Object.values(t)[0]));
    
    const [factionCols]: any = await pool.execute("SHOW COLUMNS FROM factions");
    console.log("Factions Columns:", factionCols.map((c: any) => c.Field));
    
    // Try to find a rank table
    const rankTable = tables.map((t: any) => Object.values(t)[0]).find((t: string) => t.includes('rank'));
    if (rankTable) {
        const [rankCols]: any = await pool.execute(`SHOW COLUMNS FROM ${rankTable}`);
        console.log(`${rankTable} Columns:`, rankCols.map((c: any) => c.Field));
    }
  } catch (e: any) {
    console.error("Error:", e.message);
  } finally {
    await pool.end();
  }
}

check();
