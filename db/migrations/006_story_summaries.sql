-- 故事 AI 摘要缓存表
-- 按 story_date（月级粒度）唯一索引，与故事线按月聚合对齐

CREATE TABLE IF NOT EXISTS story_summaries (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  story_date  VARCHAR(10)     NOT NULL COMMENT '故事日期键, 格式 YYYY-MM-01 (按月聚合)',
  summary_text TEXT           NOT NULL COMMENT 'AI 生成的叙事文本',
  photo_hash  VARCHAR(64)     DEFAULT NULL COMMENT '照片集合hash, 用于检测照片变化',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_story_date (story_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
