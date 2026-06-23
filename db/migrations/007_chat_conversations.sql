-- Chat conversation history table
-- Created: 2026-06-20

CREATE TABLE IF NOT EXISTS chat_conversations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED DEFAULT NULL COMMENT 'Owner user ID (NULL for anonymous)',
  fingerprint VARCHAR(64) DEFAULT NULL COMMENT 'Device fingerprint for anonymous users',
  title VARCHAR(100) NOT NULL DEFAULT '' COMMENT 'Auto-generated from first user message',
  personality VARCHAR(20) NOT NULL DEFAULT 'tsundere' COMMENT 'Cat personality used in this conversation',
  messages JSON NOT NULL COMMENT 'Full conversation messages array',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_user_id (user_id),
  INDEX idx_fingerprint (fingerprint),
  INDEX idx_updated_at (updated_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='AI chat conversation history';
