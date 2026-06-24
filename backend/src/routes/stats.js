import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

// 获取当前用户的统计
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const safeCount = async (sql, params = []) => {
      try {
        const [row] = await query(sql, params);
        return row.total;
      } catch { return 0; }
    };
    res.json({
      photos: await safeCount('SELECT COUNT(*) AS total FROM photos WHERE user_id = ?', [userId]),
      albums: await safeCount('SELECT COUNT(*) AS total FROM albums WHERE user_id = ?', [userId]),
      stories: await safeCount("SELECT COUNT(DISTINCT DATE_FORMAT(shot_date, '%Y-%m-01')) AS total FROM photos WHERE user_id = ? AND shot_date IS NOT NULL", [userId]),
      days: await safeCount('SELECT COUNT(DISTINCT DATE(shot_date)) AS total FROM photos WHERE user_id = ? AND shot_date IS NOT NULL', [userId])
    });
  } catch (err) {
    next(err);
  }
});

// 获取全局统计（仅管理员）
router.get('/global', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const safeCount = async (sql, params = []) => {
      try {
        const [row] = await query(sql, params);
        return row.total;
      } catch { return 0; }
    };
    res.json({
      users: await safeCount('SELECT COUNT(*) AS total FROM users'),
      photos: await safeCount('SELECT COUNT(*) AS total FROM photos'),
      albums: await safeCount('SELECT COUNT(*) AS total FROM albums'),
      publicPhotos: await safeCount("SELECT COUNT(*) AS total FROM photos WHERE visibility = 'public'")
    });
  } catch (err) {
    next(err);
  }
});

// 管理后台概览统计
router.get('/overview', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const safeCount = async (sql, params = []) => {
      try {
        const [row] = await query(sql, params);
        return row.total;
      } catch { return 0; }
    };
    const [storageRow] = await query('SELECT COALESCE(SUM(file_size), 0) AS total FROM photos');
    res.json({
      users: await safeCount('SELECT COUNT(*) AS total FROM users'),
      photos: await safeCount('SELECT COUNT(*) AS total FROM photos'),
      storage: storageRow.total || 0,
      activeDays: await safeCount('SELECT COUNT(DISTINCT DATE(created_at)) AS total FROM photos')
    });
  } catch (err) {
    next(err);
  }
});

// 月度上传趋势（折线图）
router.get('/timeline', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const rows = await query(
      "SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count FROM photos GROUP BY month ORDER BY month DESC LIMIT 12"
    );
    res.json({ data: rows.reverse() });
  } catch (err) {
    next(err);
  }
});

// 公开/私密比例
router.get('/visibility', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const rows = await query(
      "SELECT visibility, COUNT(*) AS count FROM photos GROUP BY visibility"
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// Top 5 标签
router.get('/top-tags', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT t.name, COUNT(pt.photo_id) AS count
       FROM tags t
       JOIN photo_tags pt ON t.id = pt.tag_id
       GROUP BY t.id
       ORDER BY count DESC
       LIMIT 5`
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
