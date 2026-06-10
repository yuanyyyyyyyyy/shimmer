import { Router } from 'express';
import { query } from '../config/database.js';
import { randomUUID } from 'crypto';

const router = Router();

// 创建分享卡片
router.post('/', async (req, res, next) => {
  try {
    const { photoIds, template = 'cinematic', customText, storyDate, storyLocation } = req.body;

    if (!photoIds || (!Array.isArray(photoIds) && !photoIds.length)) {
      return res.status(400).json({ error: '请选择至少一张照片' });
    }

    // 生成唯一分享 ID
    const shareId = randomUUID().replace(/-/g, '').slice(0, 12);

    // 验证照片存在
    const photos = await query(
      `SELECT id, title, url, thumbnail_url, shot_date, location, mood, width, height
       FROM photos WHERE id IN (${photoIds.map(() => '?').join(',')}) AND visibility != 'hidden'`,
      photoIds
    );

    if (photos.length === 0) {
      return res.status(404).json({ error: '未找到有效照片' });
    }

    // 存储分享卡片数据
    await query(
      `INSERT INTO share_cards (share_id, photo_ids, template, custom_text, story_date, story_location)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [shareId, JSON.stringify(photoIds), template, customText || null, storyDate || null, storyLocation || null]
    );

    // 获取标签
    const tags = await query(
      `SELECT DISTINCT t.id, t.name, t.color
       FROM tags t
       JOIN photo_tags pt ON t.id = pt.tag_id
       WHERE pt.photo_id IN (${photoIds.map(() => '?').join(',')})
       LIMIT 10`,
      photoIds
    );

    res.status(201).json({
      shareId,
      photos,
      tags: tags || [],
      template,
      customText: customText || null,
      shareUrl: `/share/${shareId}`,
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

// 获取分享卡片数据（公开访问，无需登录）
router.get('/:shareId', async (req, res, next) => {
  try {
    const { shareId } = req.params;

    const rows = await query(
      `SELECT * FROM share_cards WHERE share_id = ? AND is_deleted = 0`,
      [shareId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: '分享卡片不存在或已删除' });
    }

    const card = rows[0];
    const photoIds = JSON.parse(card.photo_ids);

    // 获取照片详情
    const photos = await query(
      `SELECT id, title, url, thumbnail_url, shot_date, location, mood, width, height
       FROM photos WHERE id IN (${photoIds.map(() => '?').join(',')})`,
      photoIds
    );

    // 获取标签
    const tags = await query(
      `SELECT DISTINCT t.id, t.name, t.color
       FROM tags t
       JOIN photo_tags pt ON t.id = pt.tag_id
       WHERE pt.photo_id IN (${photoIds.map(() => '?').join(',')})
       LIMIT 10`,
      photoIds
    );

    res.json({
      shareId: card.share_id,
      photos: photos || [],
      tags: tags || [],
      template: card.template,
      customText: card.custom_text,
      storyDate: card.story_date,
      storyLocation: card.story_location,
      createdAt: card.created_at,
      viewCount: card.view_count || 0
    });

    // 更新浏览次数
    await query(
      `UPDATE share_cards SET view_count = COALESCE(view_count, 0) + 1 WHERE share_id = ?`,
      [shareId]
    );
  } catch (err) {
    next(err);
  }
});

// 删除分享卡片
router.delete('/:shareId', async (req, res, next) => {
  try {
    const { shareId } = req.params;

    const result = await query(
      `UPDATE share_cards SET is_deleted = 1, deleted_at = NOW() WHERE share_id = ?`,
      [shareId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '分享卡片不存在' });
    }

    res.json({ message: '分享卡片已删除' });
  } catch (err) {
    next(err);
  }
});

export default router;
