-- ==========================================
-- ملف إعدادات قاعدة بيانات MTA (MySQL)
-- انسخ هذا الكود بالكامل وصقه في قاعدة بيانات السيرفر (HeidiSQL / phpMyAdmin)
-- ==========================================

CREATE TABLE IF NOT EXISTS `accounts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(100) NOT NULL,
  `mtaserial` varchar(100) DEFAULT NULL,
  `discord_id` varchar(100) DEFAULT NULL,
  `discord_username` varchar(100) DEFAULT NULL,
  `discord_avatar` text DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `discord_id` (`discord_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `linking_codes` (
  `code` varchar(64) NOT NULL,
  `mta_serial` varchar(100) NOT NULL,
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`mta_serial`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ==========================================
-- ملاحظة: إذا كنت تستخدم نظام رتب يعتمد على ديسكورد،
-- تأكد من أن جدول accounts يحتوي على الأعمدة المذكورة أعلاه.
-- ==========================================
