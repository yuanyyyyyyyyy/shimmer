-- 添加年度回顾缓存表
-- 用于缓存 AI 生成的年度回顾内容，避免每次进入页面都重新调用 AI
CREATE TABLE IF NOT EXISTS review_cache (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '缓存ID',
  year INT NOT NULL COMMENT '年份',
  ai_summary TEXT COMMENT 'AI 生成的回顾文本',
  model VARCHAR(100) COMMENT '使用的 AI 模型',
  provider VARCHAR(50) COMMENT 'AI 提供商',
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '生成时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  UNIQUE KEY uk_year (year),
  INDEX idx_year (year),
  INDEX idx_generated (generated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='年度回顾缓存表';
