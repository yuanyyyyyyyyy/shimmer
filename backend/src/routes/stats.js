import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = Router();

const safeCount = async (sql, params = []) => {
  try {
    const [row] = await query(sql, params);
    return row.total;
  } catch { return 0; }
};

// 解析时间范围参数
function parseDateFilter(query) {
  const { start, end } = query;
  let where = '';
  const params = [];
  if (start) { where += ' AND shot_date >= ?'; params.push(start); }
  if (end) { where += ' AND shot_date <= ?'; params.push(end + ' 23:59:59'); }
  return { where, params };
}

// 获取当前用户的统计
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const userId = req.user.id;
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
    const { where, params } = parseDateFilter(req.query);

    const [storageRow] = await query(`SELECT COALESCE(SUM(file_size), 0) AS total FROM photos WHERE 1=1${where}`, params);
    const totalPhotos = await safeCount(`SELECT COUNT(*) AS total FROM photos WHERE 1=1${where}`, params);
    const totalStorage = storageRow.total || 0;
    res.json({
      users: await safeCount('SELECT COUNT(*) AS total FROM users'),
      photos: totalPhotos,
      albums: await safeCount(`SELECT COUNT(DISTINCT album_id) AS total FROM photos WHERE 1=1${where}`, params),
      storage: totalStorage,
      avgStorage: totalPhotos > 0 ? Math.round(totalStorage / totalPhotos) : 0,
      activeDays: await safeCount(`SELECT COUNT(DISTINCT DATE(shot_date)) AS total FROM photos WHERE shot_date IS NOT NULL${where}`, params)
    });
  } catch (err) {
    next(err);
  }
});

// 月度拍摄趋势（折线图）— 基于 shot_date，自动补全缺失月份
router.get('/timeline', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { where, params } = parseDateFilter(req.query);

    const rows = await query(
      `SELECT DATE_FORMAT(shot_date, '%Y-%m') AS month, COUNT(*) AS count FROM photos WHERE shot_date IS NOT NULL${where} GROUP BY month ORDER BY month ASC`,
      params
    );

    // 补全缺失月份：生成连续月份序列
    if (rows.length < 2) {
      return res.json({ data: rows });
    }

    const firstMonth = rows[0].month;
    const lastMonth = rows[rows.length - 1].month;
    const countMap = new Map(rows.map(r => [r.month, r.count]));

    const filled = [];
    let [y, m] = firstMonth.split('-').map(Number);
    const [endY, endM] = lastMonth.split('-').map(Number);

    while (y < endY || (y === endY && m <= endM)) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      filled.push({ month: key, count: countMap.get(key) || 0 });
      m++;
      if (m > 12) { m = 1; y++; }
    }

    res.json({ data: filled });
  } catch (err) {
    next(err);
  }
});

// 公开/私密比例
router.get('/visibility', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { where, params } = parseDateFilter(req.query);
    const rows = await query(
      `SELECT visibility, COUNT(*) AS count FROM photos WHERE 1=1${where} GROUP BY visibility`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// Top 5 标签
router.get('/top-tags', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { where, params } = parseDateFilter(req.query);
    const rows = await query(
      `SELECT t.name, COUNT(pt.photo_id) AS count
       FROM tags t
       JOIN photo_tags pt ON t.id = pt.tag_id
       JOIN photos p ON pt.photo_id = p.id
       WHERE 1=1${where}
       GROUP BY t.id
       ORDER BY count DESC
       LIMIT 5`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// 用户贡献 Top 10
router.get('/top-users', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { where, params } = parseDateFilter(req.query);
    const rows = await query(
      `SELECT u.username, COUNT(p.id) AS photo_count, COALESCE(SUM(p.file_size), 0) AS storage
       FROM users u
       LEFT JOIN photos p ON u.id = p.user_id AND 1=1${where}
       GROUP BY u.id
       ORDER BY photo_count DESC
       LIMIT 10`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

// 照片数据覆盖率（EXIF / GPS）
router.get('/coverage', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { where, params } = parseDateFilter(req.query);
    const [row] = await query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN camera IS NOT NULL AND camera != '' THEN 1 ELSE 0 END) AS has_exif,
              SUM(CASE WHEN lens IS NOT NULL AND lens != '' THEN 1 ELSE 0 END) AS has_lens,
              SUM(CASE WHEN latitude IS NOT NULL THEN 1 ELSE 0 END) AS has_gps
       FROM photos WHERE 1=1${where}`,
      params
    );
    res.json({
      total: row.total || 0,
      hasExif: row.has_exif || 0,
      hasLens: row.has_lens || 0,
      hasGps: row.has_gps || 0
    });
  } catch (err) {
    next(err);
  }
});

export default router;
