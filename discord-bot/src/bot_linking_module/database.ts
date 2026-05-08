// This file will handle the database connection and fetching settings.
import mysql from 'mysql2/promise';
import { env } from '../env.js';

export const pool = mysql.createPool({
    host: env.MTA_DB_HOST,
    user: env.MTA_DB_USER,
    password: env.MTA_DB_PASSWORD,
    database: env.MTA_DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

import { createClient } from '@supabase/supabase-js';
if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('Supabase env vars missing in bot database.ts');
}
export const supabase = createClient(
    process.env.VITE_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export const getBotSettings = async () => {
    // This function is currently not used in the merged bot, but kept for compatibility
    return {};
};
