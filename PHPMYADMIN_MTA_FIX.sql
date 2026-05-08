-- PHPMYADMIN FIX SCRIPT FOR NOVA ROLEPLAY
-- This script ensures your MTA Database (PHPMyAdmin) is compatible with the website/bot.

-- 1. Fix Accounts Table
ALTER TABLE `accounts` 
ADD COLUMN IF NOT EXISTS `discord_id` VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS `discord_username` VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS `discord_avatar` TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS `mtaserial` VARCHAR(255) DEFAULT NULL;

-- Sync data: IF you already have a column called 'serial', copy it to 'mtaserial' if mtaserial is empty
UPDATE `accounts` SET `mtaserial` = `serial` WHERE `mtaserial` IS NULL AND `serial` IS NOT NULL;

-- 2. Fix Characters Table
-- The bot expects 'charactername' but the table might have 'name'
-- We will add a column or rename, but adding is safer for existing systems.
ALTER TABLE `characters` 
ADD COLUMN IF NOT EXISTS `charactername` VARCHAR(255) DEFAULT NULL;

-- Sync character names
UPDATE `characters` SET `charactername` = `name` WHERE `charactername` IS NULL AND `name` IS NOT NULL;

-- 3. Ensure Linking Codes table exists
CREATE TABLE IF NOT EXISTS `linking_codes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `code` VARCHAR(50) NOT NULL UNIQUE,
    `mta_serial` VARCHAR(100) NOT NULL,
    `expires_at` DATETIME NOT NULL,
    INDEX (`code`),
    INDEX (`mta_serial`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
