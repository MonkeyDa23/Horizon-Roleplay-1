-- ==========================================
-- 2. ملف إعدادات phpMyAdmin (MySQL/MariaDB)
-- انسخ هذا الكود وصقه في تبويب SQL في phpMyAdmin الخاص بسيرفر MTA
-- ==========================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- جدول الحسابات المربوطة
CREATE TABLE IF NOT EXISTS `accounts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL COMMENT 'اسم المستخدم في الموقع',
  `mtaserial` varchar(100) DEFAULT NULL COMMENT 'سيريال اللاعب في MTA',
  `discord_id` varchar(100) DEFAULT NULL COMMENT 'آيدي الديسكورد',
  `discord_username` varchar(100) DEFAULT NULL,
  `discord_avatar` text DEFAULT NULL,
  `linked_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_username` (`username`),
  UNIQUE KEY `unique_serial` (`mtaserial`),
  KEY `idx_discord` (`discord_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- جدول أكواد الربط المؤقتة
CREATE TABLE IF NOT EXISTS `linking_codes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `code` varchar(32) NOT NULL,
  `mta_serial` varchar(100) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_mta_serial` (`mta_serial`),
  UNIQUE KEY `unique_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
