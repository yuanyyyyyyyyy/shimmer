-- 分享卡片表 — 存储用户生成的分享卡片数据
CREATE TABLE IF NOT EXISTS share_cards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  share_id VARCHAR(24) NOT NULL UNIQUE COMMENT '公开分享唯一ID',
  user_id INT DEFAULT NULL COMMENT '创建者用户ID（可为空，支持未登录分享）',
  photo_ids JSON NOT NULL COMMENT '关联的照片ID数组',
  template VARCHAR(32) NOT NULL DEFAULT 'cinematic' COMMENT '模板类型: cinematic/calendar/magazine/collage',
  custom_text TEXT COMMENT '用户自定义文案',
  ai_caption TEXT COMMENT 'AI生成的文案',
  story_date DATE COMMENT '故事日期（如果来自故事线）',
  story_location VARCHAR(255) COMMENT '故事地点',
  view_count INT DEFAULT 0 COMMENT '浏览次数',
  is_deleted TINYINT(1) DEFAULT 0 COMMENT '是否已删除（软删除）',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME DEFAULT NULL,
  INDEX idx_share_id (share_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='分享卡片表';
