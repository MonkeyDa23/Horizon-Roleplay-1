CREATE TABLE IF NOT EXISTS `accounts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password` varchar(128) NOT NULL,
  `serial` varchar(50) NOT NULL,
  `discord_id` varchar(20) DEFAULT NULL,
  `ip` varchar(20) DEFAULT NULL,
  `balance` int(11) DEFAULT '0',
  `last_login` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `serial` (`serial`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `characters` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `account_id` int(11) NOT NULL,
  `name` varchar(100) NOT NULL,
  `skin` int(11) DEFAULT '0',
  `health` float DEFAULT '100',
  `hunger` float DEFAULT '100',
  `thirst` float DEFAULT '100',
  `money` bigint(20) DEFAULT '0',
  `bank` bigint(20) DEFAULT '0',
  `job` varchar(50) DEFAULT 'Unemployed',
  `faction` varchar(50) DEFAULT 'None',
  `position` varchar(255) DEFAULT '0,0,0',
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_char_acc` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `vehicles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `owner_char_id` int(11) NOT NULL,
  `model` int(11) NOT NULL,
  `plate` varchar(20) DEFAULT NULL,
  `fuel` float DEFAULT '100',
  `health` float DEFAULT '1000',
  `locked` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_veh_char` FOREIGN KEY (`owner_char_id`) REFERENCES `characters` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `system_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `type` varchar(50) NOT NULL,
  `account_id` int(11) DEFAULT NULL,
  `char_id` int(11) DEFAULT NULL,
  `action` text NOT NULL,
  `details` json DEFAULT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `serial` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_account` (`account_id`),
  KEY `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mta_admin_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `admin_name` varchar(50) NOT NULL,
  `target_name` varchar(50) DEFAULT NULL,
  `action` varchar(255) NOT NULL,
  `reason` text DEFAULT NULL,
  `duration` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
