import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

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

export default router;
