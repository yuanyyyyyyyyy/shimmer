-- 为 review_cache 表添加 photo_hash 列，用于检测照片变化后自动失效缓存
ALTER TABLE review_cache
  ADD COLUMN photo_hash VARCHAR(64) DEFAULT NULL COMMENT '照片集合hash, 用于检测照片变化' AFTER provider;
