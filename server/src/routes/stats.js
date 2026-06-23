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

// 月度照片趋势（折线图）
router.get('/timeline', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const rows = await query(
      "SELECT DATE_FORMAT(shot_date, '%Y-%m') AS month, COUNT(*) AS count FROM photos WHERE shot_date IS NOT NULL GROUP BY month ORDER BY month ASC"
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// 拍摄热力图（星期 × 小时）
router.get('/heatmap', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const rows = await query(
      "SELECT DAYOFWEEK(shot_date) AS dayOfWeek, HOUR(shot_date) AS hour, COUNT(*) AS count FROM photos WHERE shot_date IS NOT NULL GROUP BY dayOfWeek, hour"
    );
    // 转为 7×24 矩阵，dayOfWeek: 1=周日 ... 7=周六
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const r of rows) {
      const d = (r.dayOfWeek - 1 + 7) % 7; // 0=周日 → 0=周一 调整为 0=周一
      const h = Math.min(Math.max(r.hour, 0), 23);
      grid[d][h] = r.count;
    }
    res.json({ data: grid });
  } catch (err) {
    next(err);
  }
});

// 获取用户列表统计（仅管理员）

export default router;
