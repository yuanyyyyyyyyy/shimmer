-- 光影手记 (Shimmer) 完整数据库初始化脚本
-- 适用于 Aiven MySQL / 生产环境部署

-- 创建数据库（如使用 Aiven 自动创建则无需此步）
-- CREATE DATABASE IF NOT EXISTS shimmer DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE shimmer;

-- ============================================================
-- 用户表
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  nickname VARCHAR(50) DEFAULT NULL,
  avatar VARCHAR(500) DEFAULT NULL,
  role ENUM('user', 'admin') DEFAULT 'user',
  bio TEXT DEFAULT NULL,
  hidden_album_password_hash VARCHAR(255) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 照片表
-- ============================================================
CREATE TABLE IF NOT EXISTS photos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(200) DEFAULT NULL,
  url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500) DEFAULT NULL,
  original_url VARCHAR(500) DEFAULT NULL,
  mood VARCHAR(100) DEFAULT NULL,
  shot_date DATE DEFAULT NULL,
  location VARCHAR(200) DEFAULT NULL,
  camera VARCHAR(100) DEFAULT NULL,
  lens VARCHAR(100) DEFAULT NULL,
  aperture VARCHAR(20) DEFAULT NULL,
  shutter_speed VARCHAR(20) DEFAULT NULL,
  iso INT DEFAULT NULL,
  width INT DEFAULT NULL,
  height INT DEFAULT NULL,
  file_size INT DEFAULT NULL COMMENT '文件大小 (KB)',
  sort_order INT DEFAULT 0,
  visibility ENUM('public', 'private') DEFAULT 'private',
  latitude DECIMAL(10, 7) DEFAULT NULL,
  longitude DECIMAL(10, 7) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_visibility (visibility),
  INDEX idx_shot_date (shot_date),
  INDEX idx_created_at (created_at),
  INDEX idx_sort (sort_order, created_at),
  INDEX idx_user_visibility (user_id, visibility),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 标签表
-- ============================================================
CREATE TABLE IF NOT EXISTS tags (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  color VARCHAR(7) DEFAULT '#3b82f6',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 照片-标签关联表
-- ============================================================
CREATE TABLE IF NOT EXISTS photo_tags (
  photo_id BIGINT UNSIGNED NOT NULL,
  tag_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (photo_id, tag_id),
  INDEX idx_tag_id (tag_id),
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 收藏表
-- ============================================================
CREATE TABLE IF NOT EXISTS favorites (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  photo_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED DEFAULT NULL,
  fingerprint VARCHAR(64) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_photo_id (photo_id),
  INDEX idx_user_id (user_id),
  INDEX idx_fingerprint (fingerprint),
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- AI 设置表
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_settings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL DEFAULT '默认配置',
  is_active TINYINT(1) DEFAULT 0,
  provider VARCHAR(50) DEFAULT NULL,
  model VARCHAR(100) DEFAULT NULL,
  base_url VARCHAR(500) DEFAULT NULL,
  api_key VARCHAR(500) DEFAULT NULL,
  timeout INT DEFAULT 120000,
  enabled TINYINT(1) DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 相册表
-- ============================================================
CREATE TABLE IF NOT EXISTS albums (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT DEFAULT NULL,
  cover_photo_id BIGINT UNSIGNED DEFAULT NULL,
  is_public BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_public (is_public, created_at),
  INDEX idx_sort (sort_order, created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (cover_photo_id) REFERENCES photos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 相册-照片关联表
-- ============================================================
CREATE TABLE IF NOT EXISTS album_photos (
  album_id BIGINT UNSIGNED NOT NULL,
  photo_id BIGINT UNSIGNED NOT NULL,
  added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sort_order INT DEFAULT 0,
  PRIMARY KEY (album_id, photo_id),
  INDEX idx_photo_id (photo_id),
  INDEX idx_added (added_at),
  FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
  FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 分享卡片表
-- ============================================================
CREATE TABLE IF NOT EXISTS share_cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  share_id VARCHAR(24) NOT NULL UNIQUE,
  user_id INT DEFAULT NULL,
  photo_ids JSON NOT NULL,
  template VARCHAR(32) NOT NULL DEFAULT 'cinematic',
  custom_text TEXT DEFAULT NULL,
  ai_caption TEXT DEFAULT NULL,
  story_date DATE DEFAULT NULL,
  story_location VARCHAR(255) DEFAULT NULL,
  view_count INT DEFAULT 0,
  is_deleted TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME DEFAULT NULL,
  INDEX idx_share_id (share_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 年度回顾缓存表
-- ============================================================
CREATE TABLE IF NOT EXISTS review_cache (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  year INT NOT NULL,
  ai_summary TEXT DEFAULT NULL,
  model VARCHAR(100) DEFAULT NULL,
  provider VARCHAR(50) DEFAULT NULL,
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_year (year),
  INDEX idx_year (year),
  INDEX idx_generated (generated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 故事线摘要缓存表
-- ============================================================
CREATE TABLE IF NOT EXISTS story_summaries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  story_date VARCHAR(10) NOT NULL COMMENT '格式 YYYY-MM-01',
  summary_text TEXT NOT NULL,
  photo_hash VARCHAR(64) DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_story_date (story_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
