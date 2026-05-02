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

export const getBotSettings = async () => {
    // This function is currently not used in the merged bot, but kept for compatibility
    return {};
};
