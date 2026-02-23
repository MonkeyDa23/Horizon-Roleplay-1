-- Florida Roleplay Linking System Schema
-- This script is designed to be run once to set up the necessary tables and columns for the new linking system.
-- It will NOT delete or modify any existing tables other than adding one column to your accounts table.

-- IMPORTANT: Replace `your_accounts_table` with the actual name of your player accounts table.

-- Step 1: Add the discord_id column to your existing accounts table
-- This column will store the Discord user's unique ID once they are linked.
ALTER TABLE `your_accounts_table` ADD COLUMN `discord_id` VARCHAR(255) NULL DEFAULT NULL UNIQUE;

-- Step 2: Create the table for temporary linking codes
-- This table stores the codes generated in-game.
CREATE TABLE IF NOT EXISTS `linking_codes` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `mta_serial` VARCHAR(255) NOT NULL,
  `code` VARCHAR(255) NOT NULL UNIQUE,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` TIMESTAMP NOT NULL,
  INDEX `mta_serial_index` (`mta_serial`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Step 3: Create the detailed logging table
-- Step 4: Create the settings table for the bot
-- This allows changing settings like log channels directly from the database.
CREATE TABLE IF NOT EXISTS `bot_settings` (
  `setting_key` VARCHAR(255) PRIMARY KEY,
  `setting_value` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Step 5: Insert default settings (placeholders)
-- IMPORTANT: You MUST update these values with your actual Discord Channel IDs.
INSERT INTO `bot_settings` (`setting_key`, `setting_value`) VALUES
('DISCORD_CODE_LOG_CHANNEL_ID', 'YOUR_CHANNEL_ID_HERE'),
('DISCORD_LINK_LOG_CHANNEL_ID', 'YOUR_CHANNEL_ID_HERE')
ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value);


