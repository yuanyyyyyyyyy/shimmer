import { Router } from 'express';
import { query } from '../config/database.js';
import { randomUUID } from 'crypto';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// 获取当前用户的分享列表（需要登录）
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const rows = await query(
      `SELECT share_id, photo_ids, template, custom_text, story_date, story_location,
              view_count, created_at
       FROM share_cards
       WHERE user_id = ? AND is_deleted = 0
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, String(limit), String(offset)]
    );

    const [{ total }] = await query(
      'SELECT COUNT(*) as total FROM share_cards WHERE user_id = ? AND is_deleted = 0',
      [userId]
    );

    // 获取每个分享的首张照片缩略图
    const shares = await Promise.all(rows.map(async (row) => {
      const photoIds = row.photo_ids;
      const [firstPhoto] = await query(
        'SELECT id, url, thumbnail_url FROM photos WHERE id = ?',
        [photoIds[0]]
      );
      return {
        shareId: row.share_id,
        template: row.template,
        customText: row.custom_text,
        storyDate: row.story_date,
        storyLocation: row.story_location,
        photoCount: photoIds.length,
        viewCount: row.view_count || 0,
        createdAt: row.created_at,
        coverPhoto: firstPhoto || null
      };
    }));

    res.json({
      shares,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    next(err);
  }
});

// 创建分享卡片（需要登录，只能分享自己的照片）
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { photoIds, template = 'cinematic', customText, storyDate, storyLocation } = req.body;
    const userId = req.user.id;

    if (!photoIds || (!Array.isArray(photoIds) && !photoIds.length)) {
      return res.status(400).json({ error: '请选择至少一张照片' });
    }

    const ids = Array.isArray(photoIds) ? photoIds : photoIds;

    // 验证照片存在且属于当前用户
    const photos = await query(
      `SELECT id, title, url, thumbnail_url, shot_date, location, mood, width, height
       FROM photos WHERE id IN (${ids.map(() => '?').join(',')}) AND user_id = ?`,
      [...ids, userId]
    );

    if (photos.length === 0) {
      return res.status(404).json({ error: '未找到有效照片' });
    }

    if (photos.length !== ids.length) {
      return res.status(403).json({ error: '只能分享自己的照片' });
    }

    // 生成唯一分享 ID
    const shareId = randomUUID().replace(/-/g, '').slice(0, 12);

    // 存储分享卡片数据（记录 user_id）
    await query(
      `INSERT INTO share_cards (share_id, user_id, photo_ids, template, custom_text, story_date, story_location)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [shareId, userId, JSON.stringify(ids), template, customText || null, storyDate || null, storyLocation || null]
    );

    // 获取标签
    const tags = await query(
      `SELECT DISTINCT t.id, t.name, t.color
       FROM tags t
       JOIN photo_tags pt ON t.id = pt.tag_id
       WHERE pt.photo_id IN (${ids.map(() => '?').join(',')})
       LIMIT 10`,
      ids
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
    const photoIds = card.photo_ids;

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

// 删除分享卡片（需要登录，只能删除自己创建的）
router.delete('/:shareId', authenticateToken, async (req, res, next) => {
  try {
    const { shareId } = req.params;
    const userId = req.user.id;

    const result = await query(
      `UPDATE share_cards SET is_deleted = 1, deleted_at = NOW() WHERE share_id = ? AND user_id = ?`,
      [shareId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '分享卡片不存在或无权删除' });
    }

    res.json({ message: '分享卡片已删除' });
  } catch (err) {
    next(err);
  }
});

export default router;
