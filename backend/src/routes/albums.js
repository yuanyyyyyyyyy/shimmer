import { Router } from 'express';
import { query, getConnection } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { ValidationError } from '../middleware/error.js';

const router = Router();

// 获取相册列表（需登录，只返回当前用户的相册）
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const safeLimit = Math.max(1, Math.min(100, parseInt(limit) || 20));
    const safeOffset = Math.max(0, (parseInt(page) - 1) * safeLimit);

    const userId = req.user ? req.user.id : null;

    if (!userId) {
      return res.json({ albums: [], pagination: { page: 1, limit: safeLimit, total: 0, totalPages: 0 } });
    }

    const whereClause = 'WHERE a.user_id = ?';
    const params = [userId];

    // 查询相册列表
    const albumsQuery = `
      SELECT 
        a.*,
        u.username,
        u.nickname,
        u.avatar,
        (SELECT COUNT(*) FROM album_photos WHERE album_id = a.id) as photo_count,
        CASE WHEN a.cover_photo_id IS NOT NULL THEN
          (SELECT url FROM photos WHERE id = a.cover_photo_id LIMIT 1)
        ELSE NULL END as cover_url
      FROM albums a
      LEFT JOIN users u ON a.user_id = u.id
      ${whereClause}
      ORDER BY a.sort_order DESC, a.created_at DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;

    const albums = await query(albumsQuery, params);

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total
      FROM albums a
      ${whereClause.split('LIMIT')[0]}
    `;
    const countParams = [...params];
    const [{ total }] = await query(countQuery, countParams);

    res.json({
      albums,
      pagination: {
        page: parseInt(page),
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit)
      }
    });

  } catch (err) {
    next(err);
  }
});

// 获取单个相册详情（包含照片列表）
router.get('/:id', async (req, res, next) => {
  try {
    const albumId = parseInt(req.params.id);
    const userId = req.user ? req.user.id : null;

    // 查询相册信息
    const albums = await query(`
      SELECT 
        a.*,
        u.username,
        u.nickname,
        u.avatar
      FROM albums a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.id = ?
    `, [albumId]);

    if (albums.length === 0) {
      return res.status(404).json({ error: '相册不存在' });
    }

    const album = albums[0];

    // 权限检查：只有相册作者可以查看
    if (album.user_id !== userId) {
      return res.status(403).json({ error: '无权访问此相册' });
    }

    // 查询相册内的照片
    const photos = await query(`
      SELECT 
        p.*,
        ap.added_at,
        ap.sort_order as album_sort_order
      FROM photos p
      INNER JOIN album_photos ap ON p.id = ap.photo_id
      WHERE ap.album_id = ?
      ORDER BY ap.sort_order DESC, ap.added_at DESC
    `, [albumId]);

    // 获取封面照片URL
    let coverUrl = null;
    if (album.cover_photo_id) {
      const [cover] = await query('SELECT url FROM photos WHERE id = ?', [album.cover_photo_id]);
      coverUrl = cover ? cover.url : null;
    }

    res.json({
      ...album,
      cover_url: coverUrl,
      photos,
      photo_count: photos.length
    });

  } catch (err) {
    next(err);
  }
});

// 创建相册（需要登录）
router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const { title, description, is_public = true } = req.body;
    const userId = req.user.id;

    // 验证必填字段
    if (!title || title.trim().length === 0) {
      throw new ValidationError('相册标题不能为空');
    }

    if (title.length > 100) {
      throw new ValidationError('相册标题不能超过100个字符');
    }

    // 创建相册
    const result = await query(`
      INSERT INTO albums (user_id, title, description, is_public)
      VALUES (?, ?, ?, ?)
    `, [userId, title.trim(), description || null, is_public]);

    // 返回创建的相册
    const [album] = await query('SELECT * FROM albums WHERE id = ?', [result.insertId]);

    res.status(201).json({
      message: '相册创建成功',
      album
    });

  } catch (err) {
    next(err);
  }
});

// 更新相册信息（仅作者或管理员）
router.put('/:id', authenticateToken, async (req, res, next) => {
  try {
    const albumId = parseInt(req.params.id);
    const userId = req.user.id;
    const { title, description, is_public, sort_order } = req.body;

    // 检查相册是否存在
    const [existing] = await query('SELECT * FROM albums WHERE id = ?', [albumId]);
    if (!existing) {
      return res.status(404).json({ error: '相册不存在' });
    }

    // 权限检查：仅作者
    if (existing.user_id !== userId) {
      return res.status(403).json({ error: '无权修改此相册' });
    }

    // 验证标题
    if (title !== undefined) {
      if (!title || title.trim().length === 0) {
        throw new ValidationError('相册标题不能为空');
      }
      if (title.length > 100) {
        throw new ValidationError('相册标题不能超过100个字符');
      }
    }

    // 构建更新字段
    const updates = [];
    const params = [];

    if (title !== undefined) {
      updates.push('title = ?');
      params.push(title.trim());
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description || null);
    }
    if (is_public !== undefined) {
      updates.push('is_public = ?');
      params.push(is_public);
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      params.push(parseInt(sort_order));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有需要更新的字段' });
    }

    updates.push('updated_at = NOW()');
    params.push(albumId);

    // 执行更新
    await query(`UPDATE albums SET ${updates.join(', ')} WHERE id = ?`, params);

    // 返回更新后的相册
    const [updated] = await query('SELECT * FROM albums WHERE id = ?', [albumId]);

    res.json({
      message: '相册更新成功',
      album: updated
    });

  } catch (err) {
    next(err);
  }
});

// 删除相册（仅作者或管理员）
router.delete('/:id', authenticateToken, async (req, res, next) => {
  try {
    const albumId = parseInt(req.params.id);
    const userId = req.user.id;

    // 检查相册是否存在
    const [existing] = await query('SELECT * FROM albums WHERE id = ?', [albumId]);
    if (!existing) {
      return res.status(404).json({ error: '相册不存在' });
    }

    // 权限检查：仅作者
    if (existing.user_id !== userId) {
      return res.status(403).json({ error: '无权删除此相册' });
    }

    // 删除相册（album_photos 会通过 CASCADE 自动删除）
    await query('DELETE FROM albums WHERE id = ?', [albumId]);

    res.json({ message: '相册删除成功' });

  } catch (err) {
    next(err);
  }
});

// 添加照片到相册（仅相册作者或管理员）
router.post('/:id/photos', authenticateToken, async (req, res, next) => {
  try {
    const albumId = parseInt(req.params.id);
    const userId = req.user.id;
    const { photo_id } = req.body;

    // 验证参数
    if (!photo_id) {
      throw new ValidationError('photo_id 不能为空');
    }

    const photoId = parseInt(photo_id);
    if (isNaN(photoId)) {
      throw new ValidationError('photo_id 必须是有效的数字');
    }

    // 检查相册是否存在且有权限
    const [album] = await query('SELECT * FROM albums WHERE id = ?', [albumId]);
    if (!album) {
      return res.status(404).json({ error: '相册不存在' });
    }

    if (album.user_id !== userId) {
      return res.status(403).json({ error: '无权操作此相册' });
    }

    // 检查照片是否存在且属于当前用户
    const [photo] = await query('SELECT * FROM photos WHERE id = ? AND user_id = ?', [photoId, userId]);
    if (!photo) {
      return res.status(404).json({ error: '照片不存在或无权操作' });
    }

    // 检查是否已经添加
    const existing = await query(
      'SELECT * FROM album_photos WHERE album_id = ? AND photo_id = ?',
      [albumId, photoId]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: '照片已在相册中' });
    }

    // 添加照片到相册
    await query(
      'INSERT INTO album_photos (album_id, photo_id) VALUES (?, ?)',
      [albumId, photoId]
    );

    // 如果相册没有封面，自动设置为第一张照片
    if (!album.cover_photo_id) {
      await query(
        'UPDATE albums SET cover_photo_id = ? WHERE id = ?',
        [photoId, albumId]
      );
    }

    res.status(201).json({ message: '照片已添加到相册' });

  } catch (err) {
    next(err);
  }
});

// 从相册移除照片（仅相册作者或管理员）
router.delete('/:id/photos/:photoId', authenticateToken, async (req, res, next) => {
  try {
    const albumId = parseInt(req.params.id);
    const photoId = parseInt(req.params.photoId);
    const userId = req.user.id;

    // 检查相册是否存在且有权限
    const [album] = await query('SELECT * FROM albums WHERE id = ?', [albumId]);
    if (!album) {
      return res.status(404).json({ error: '相册不存在' });
    }

    if (album.user_id !== userId) {
      return res.status(403).json({ error: '无权操作此相册' });
    }

    // 检查照片是否在相册中
    const [existing] = await query(
      'SELECT * FROM album_photos WHERE album_id = ? AND photo_id = ?',
      [albumId, photoId]
    );

    if (!existing) {
      return res.status(404).json({ error: '照片不在相册中' });
    }

    // 移除照片
    await query(
      'DELETE FROM album_photos WHERE album_id = ? AND photo_id = ?',
      [albumId, photoId]
    );

    // 如果移除的是封面照片，清除封面设置
    if (album.cover_photo_id === photoId) {
      await query(
        'UPDATE albums SET cover_photo_id = NULL WHERE id = ?',
        [albumId]
      );
    }

    res.json({ message: '照片已从相册移除' });

  } catch (err) {
    next(err);
  }
});

// 设置相册封面（仅相册作者或管理员）
router.put('/:id/cover', authenticateToken, async (req, res, next) => {
  try {
    const albumId = parseInt(req.params.id);
    const userId = req.user.id;
    const { photo_id } = req.body;

    // 检查相册是否存在且有权限
    const [album] = await query('SELECT * FROM albums WHERE id = ?', [albumId]);
    if (!album) {
      return res.status(404).json({ error: '相册不存在' });
    }

    if (album.user_id !== userId) {
      return res.status(403).json({ error: '无权操作此相册' });
    }

    // 如果 photo_id 为 null，清除封面
    if (photo_id === null || photo_id === undefined) {
      await query(
        'UPDATE albums SET cover_photo_id = NULL WHERE id = ?',
        [albumId]
      );
      return res.json({ message: '封面已清除' });
    }

    const photoId = parseInt(photo_id);

    // 检查照片是否在相册中
    const [existing] = await query(
      'SELECT * FROM album_photos WHERE album_id = ? AND photo_id = ?',
      [albumId, photoId]
    );

    if (!existing) {
      return res.status(400).json({ error: '照片不在相册中，不能设为封面' });
    }

    // 设置封面
    await query(
      'UPDATE albums SET cover_photo_id = ? WHERE id = ?',
      [photoId, albumId]
    );

    res.json({ message: '封面设置成功' });

  } catch (err) {
    next(err);
  }
});

// 获取用户的相册列表（用于选择）
router.get('/user/:userId', async (req, res, next) => {
  try {
    const targetUserId = parseInt(req.params.userId);
    const userId = req.user ? req.user.id : null;

    let whereClause = '';
    const params = [];

    if (userId && targetUserId === userId) {
      // 查看自己的：返回所有相册
      whereClause = 'WHERE a.user_id = ?';
      params.push(targetUserId);
    } else {
      // 查看别人的：无权查看
      return res.json({ albums: [] });
    }

    const albums = await query(`
      SELECT 
        a.id,
        a.title,
        a.cover_photo_id,
        (SELECT COUNT(*) FROM album_photos WHERE album_id = a.id) as photo_count,
        CASE WHEN a.cover_photo_id IS NOT NULL THEN
          (SELECT url FROM photos WHERE id = a.cover_photo_id LIMIT 1)
        ELSE NULL END as cover_url
      FROM albums a
      ${whereClause}
      ORDER BY a.sort_order DESC, a.created_at DESC
    `, params);

    res.json({ albums });

  } catch (err) {
    next(err);
  }
});

export default router;
