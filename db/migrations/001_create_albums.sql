-- 相册功能迁移脚本
-- 创建时间: 2026-06-09
-- 说明: 添加相册管理功能所需的表

-- 创建相册表
CREATE TABLE IF NOT EXISTS albums (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT '相册ID',
  user_id BIGINT UNSIGNED NOT NULL COMMENT '创建者ID',
  title VARCHAR(100) NOT NULL COMMENT '相册标题',
  description TEXT COMMENT '相册描述',
  cover_photo_id BIGINT UNSIGNED NULL COMMENT '封面照片ID',
  is_public BOOLEAN DEFAULT TRUE COMMENT '是否公开',
  sort_order INT DEFAULT 0 COMMENT '排序权重',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  -- 外键约束
  CONSTRAINT fk_albums_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_albums_cover_photo_id FOREIGN KEY (cover_photo_id) REFERENCES photos(id) ON DELETE SET NULL,
  
  -- 索引优化
  INDEX idx_user (user_id),
  INDEX idx_public (is_public, created_at),
  INDEX idx_sort (sort_order, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='相册表';

-- 创建相册照片关联表
CREATE TABLE IF NOT EXISTS album_photos (
  album_id BIGINT UNSIGNED NOT NULL COMMENT '相册ID',
  photo_id BIGINT UNSIGNED NOT NULL COMMENT '照片ID',
  added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '添加时间',
  sort_order INT DEFAULT 0 COMMENT '在相册中的排序权重',
  
  -- 复合主键（防止重复添加）
  PRIMARY KEY (album_id, photo_id),
  
  -- 外键约束
  CONSTRAINT fk_album_photos_album_id FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
  CONSTRAINT fk_album_photos_photo_id FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE,
  
  -- 索引优化
  INDEX idx_photo (photo_id),
  INDEX idx_added (added_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='相册照片关联表';

-- 插入示例数据（可选，用于测试）
-- INSERT INTO albums (user_id, title, description, is_public) VALUES
-- (1, '示例相册', '这是一个示例相册', TRUE);
