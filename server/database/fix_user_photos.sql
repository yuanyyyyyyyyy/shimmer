-- =====================================================
-- 修复用户照片关联和可见性问题
-- =====================================================

-- 1. 确保 visibility 字段支持三种值
ALTER TABLE photos
  MODIFY COLUMN visibility ENUM('public', 'private', 'hidden')
  NOT NULL DEFAULT 'public'
  COMMENT '可见性：public=公开, private=私有, hidden=隐藏';

-- 2. 将所有旧照片关联到管理员用户
UPDATE photos
SET user_id = (SELECT id FROM users WHERE role = 'admin' LIMIT 1)
WHERE user_id IS NULL;

-- 3. 验证结果
SELECT
  u.id as user_id,
  u.username,
  COUNT(p.id) as photo_count,
  SUM(CASE WHEN p.visibility = 'public' THEN 1 ELSE 0 END) as public_count,
  SUM(CASE WHEN p.visibility = 'private' THEN 1 ELSE 0 END) as private_count,
  SUM(CASE WHEN p.visibility = 'hidden' THEN 1 ELSE 0 END) as hidden_count
FROM users u
LEFT JOIN photos p ON u.id = p.user_id
GROUP BY u.id, u.username;
