-- SQL Schema for MTA Linking System

-- 1. Accounts Table (Standard MTA accounts table with extra columns)
CREATE TABLE IF NOT EXISTS `accounts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `serial` varchar(100) NOT NULL,
  `discord_id` varchar(50) DEFAULT NULL,
  `discord_username` varchar(100) DEFAULT NULL,
  `discord_avatar` text DEFAULT NULL,
  `mta_linked_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `serial` (`serial`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Characters Table
CREATE TABLE IF NOT EXISTS `characters` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `account_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `level` int(11) DEFAULT 1,
  `job` varchar(100) DEFAULT 'Unemployed',
  `cash` int(11) DEFAULT 0,
  `bank` int(11) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `account_id` (`account_id`),
  CONSTRAINT `characters_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Admin Record Table
CREATE TABLE IF NOT EXISTS `admin_record` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `account_id` int(11) NOT NULL,
  `type` varchar(50) NOT NULL, -- Ban, Kick, Warn, etc.
  `reason` text NOT NULL,
  `admin` varchar(100) NOT NULL,
  `date` timestamp NOT NULL DEFAULT current_timestamp(),
  `duration` int(11) DEFAULT 0, -- Duration in minutes
  PRIMARY KEY (`id`),
  KEY `account_id` (`account_id`),
  CONSTRAINT `admin_record_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Linking Codes Table (Temporary codes)
CREATE TABLE IF NOT EXISTS `linking_codes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(10) NOT NULL,
  `mta_serial` varchar(100) NOT NULL,
  `expires_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  UNIQUE KEY `mta_serial` (`mta_serial`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Bot Settings Table
CREATE TABLE IF NOT EXISTS `bot_settings` (
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text DEFAULT NULL,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Translations Table
CREATE TABLE IF NOT EXISTS `translations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `key` varchar(100) NOT NULL,
  `ar` text DEFAULT NULL,
  `en` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `key` (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `translations` (`key`, `ar`, `en`) VALUES
('community_name', 'Florida Roleplay', 'Florida Roleplay'),
('mta_profile', 'ملف اللعبة', 'MTA Profile'),
('discord_profile', 'ملف الديسكورد', 'Discord Profile'),
('link_account_title', 'توثيق الحساب', 'Link Account'),
('mta_status_linked', 'مربوط', 'Linked'),
('mta_status_not_linked', 'غير مربوط', 'Not Linked'),
('profile_mta_characters', 'شخصياتك في اللعبة', 'Your Characters'),
('profile_mta_admin_record', 'السجل الإداري', 'Admin Record'),
('profile_mta_unlink', 'إلغاء الربط', 'Unlink Account');
