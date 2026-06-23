-- Phase 2: AI 配置改为每用户独立
-- ai_settings 表添加 user_id 字段

-- 1. 添加 user_id 列
ALTER TABLE ai_settings ADD COLUMN user_id BIGINT UNSIGNED DEFAULT NULL AFTER id;

-- 2. 添加索引和外键
ALTER TABLE ai_settings ADD INDEX idx_user_id (user_id);
ALTER TABLE ai_settings ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- 3. 将现有活跃配置复制给所有已有用户
INSERT INTO ai_settings (user_id, name, is_active, provider, model, base_url, api_key, timeout, enabled)
SELECT u.id, '默认配置', 1, s.provider, s.model, s.base_url, s.api_key, s.timeout, s.enabled
FROM users u
CROSS JOIN (SELECT * FROM ai_settings WHERE is_active = 1 LIMIT 1) s
WHERE NOT EXISTS (
  SELECT 1 FROM ai_settings a WHERE a.user_id = u.id
);

-- 4. 移除旧的全局配置（user_id 为 NULL 的）
DELETE FROM ai_settings WHERE user_id IS NULL;
