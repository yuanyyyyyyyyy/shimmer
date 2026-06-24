import express from 'express';
import db from '../config/database.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// 获取当前用户使用的标签
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.json({ tags: [] });
    }
    const [tags] = await db.query(`
      SELECT t.*, COUNT(pt.photo_id) as photo_count
      FROM tags t
      JOIN photo_tags pt ON t.id = pt.tag_id
      JOIN photos p ON pt.photo_id = p.id AND p.user_id = ?
      GROUP BY t.id
      ORDER BY photo_count DESC, t.name ASC
    `, [userId]);
    res.json({ tags });
  } catch (error) {
    next(error);
  }
});

// 获取当前用户热门标签（使用最多的前 N 个）
router.get('/popular', optionalAuth, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const userId = req.user?.id;
    if (!userId) {
      return res.json({ tags: [] });
    }
    const [tags] = await db.query(`
      SELECT t.*, COUNT(pt.photo_id) as photo_count
      FROM tags t
      JOIN photo_tags pt ON t.id = pt.tag_id
      JOIN photos p ON pt.photo_id = p.id AND p.user_id = ?
      GROUP BY t.id
      HAVING photo_count > 0
      ORDER BY photo_count DESC
      LIMIT ?
    `, [userId, limit]);
    res.json({ tags });
  } catch (error) {
    next(error);
  }
});

// 创建标签（需要登录）- 如果标签已存在则返回已有的标签
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { name, color } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: '标签名称不能为空' });
    }

    // 先检查是否已存在
    const [existing] = await db.query('SELECT * FROM tags WHERE name = ?', [name.trim()]);
    if (existing.length > 0) {
      return res.json({ tag: existing[0], message: '标签已存在' });
    }

    const [result] = await db.query(
      'INSERT INTO tags (name, color) VALUES (?, ?)',
      [name.trim(), color || '#3b82f6']
    );

    const [tags] = await db.query('SELECT * FROM tags WHERE id = ?', [result.insertId]);
    res.status(201).json({ tag: tags[0] });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      // 并发情况下再次检查
      const [existing] = await db.query('SELECT * FROM tags WHERE name = ?', [name.trim()]);
      if (existing.length > 0) {
        return res.json({ tag: existing[0], message: '标签已存在' });
      }
    }
    next(error);
  }
});

// 删除标签（需要登录，只能删除自己照片使用的标签）
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 检查标签是否存在
    const [tagRows] = await db.query('SELECT id, name FROM tags WHERE id = ?', [id]);
    if (tagRows.length === 0) {
      return res.status(404).json({ error: '标签不存在' });
    }

    // 删除当前用户照片上该标签的所有关联
    await db.query(`
      DELETE pt FROM photo_tags pt
      JOIN photos p ON pt.photo_id = p.id
      WHERE pt.tag_id = ? AND p.user_id = ?
    `, [id, userId]);

    // 检查是否还有其他用户的照片在使用此标签
    const [otherUsage] = await db.query(`
      SELECT 1 FROM photo_tags pt
      JOIN photos p ON pt.photo_id = p.id
      WHERE pt.tag_id = ? AND p.user_id != ?
      LIMIT 1
    `, [id, userId]);

    // 没人用了，从 tags 表彻底删除
    if (otherUsage.length === 0) {
      await db.query('DELETE FROM tags WHERE id = ?', [id]);
    }

    res.json({ message: '标签已删除' });
  } catch (error) {
    next(error);
  }
});

// 获取照片的标签（需要认证 + 权限检查）
router.get('/photo/:photoId', authenticateToken, async (req, res, next) => {
  try {
    const { photoId } = req.params;
    const userId = req.user.id;
    
    // 检查照片归属
    const [photos] = await db.query('SELECT user_id FROM photos WHERE id = ?', [photoId]);
    if (photos.length === 0) {
      return res.status(404).json({ error: '照片不存在' });
    }
    if (photos[0].user_id !== userId) {
      return res.status(403).json({ error: '无权访问' });
    }
    
    const [tags] = await db.query(`
      SELECT t.* FROM tags t
      JOIN photo_tags pt ON t.id = pt.tag_id
      WHERE pt.photo_id = ?
    `, [photoId]);
    
    res.json({ tags });
  } catch (error) {
    next(error);
  }
});

// 为照片设置标签（需要登录 + 权限检查）
router.post('/photo/:photoId', authenticateToken, async (req, res, next) => {
  try {
    const { photoId } = req.params;
    const { tagIds } = req.body;
    const userId = req.user.id;
    
    if (!Array.isArray(tagIds)) {
      return res.status(400).json({ error: '请提供标签 ID 数组' });
    }
    
    // 检查照片归属
    const [photos] = await db.query('SELECT user_id FROM photos WHERE id = ?', [photoId]);
    if (photos.length === 0) {
      return res.status(404).json({ error: '照片不存在' });
    }
    if (photos[0].user_id !== userId) {
      return res.status(403).json({ error: '无权操作' });
    }
    
    // 删除现有关联
    await db.query('DELETE FROM photo_tags WHERE photo_id = ?', [photoId]);
    
    // 添加新关联
    for (const tagId of tagIds) {
      await db.query(
        'INSERT INTO photo_tags (photo_id, tag_id) VALUES (?, ?)',
        [photoId, tagId]
      );
    }
    
    res.json({ message: '标签已更新' });
  } catch (error) {
    next(error);
  }
});

export default router;
