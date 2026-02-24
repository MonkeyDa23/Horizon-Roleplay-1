-- ====================================================================
-- MTA:SA DATABASE SETUP FOR DISCORD LINKING BOT
-- ====================================================================
-- Execute these commands in your MTA server's database (e.g., via phpMyAdmin).
-- This will add the necessary columns to your 'accounts' table and create the 'linking_codes' table.

-- 1. Add Discord-related columns to your existing 'accounts' table.
-- IMPORTANT: This assumes you already have an 'accounts' table with a 'serial' column.
-- If your serial column has a different name, update it in the bot's code.

ALTER TABLE `accounts`
ADD COLUMN `discord_id` VARCHAR(255) NULL DEFAULT NULL AFTER `mtaserial`,
ADD COLUMN `discord_username` VARCHAR(255) NULL DEFAULT NULL AFTER `discord_id`,
ADD COLUMN `discord_avatar` VARCHAR(255) NULL DEFAULT NULL AFTER `discord_username`;

-- 2. Create the table for temporary linking codes.
-- The bot uses this table to verify linking requests from the game server.

CREATE TABLE IF NOT EXISTS `linking_codes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `mta_serial` VARCHAR(255) NOT NULL,
  `code` VARCHAR(255) NOT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  UNIQUE KEY `unique_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ====================================================================
-- NOTES:
-- ====================================================================
-- - If you get an error like "Unknown column 'serial'", it means your 'accounts' table
--   does not have a 'serial' column. You MUST add it. It's critical for linking.
--   Example command to add it (if it's missing):
--   -- ALTER TABLE `accounts` ADD COLUMN `serial` VARCHAR(255) NULL DEFAULT NULL;
--
-- - Make sure the user/pass in your bot's .env file has permission to run these commands.
-- ====================================================================
