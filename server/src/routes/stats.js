import { Router } from 'express';
import { query } from '../config/database.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const safeCount = async (sql) => {
      try {
        const [row] = await query(sql);
        return row.total;
      } catch { return 0; }
    };
    res.json({
      photos: await safeCount('SELECT COUNT(*) AS total FROM photos'),
      albums: await safeCount('SELECT COUNT(*) AS total FROM albums'),
      stories: await safeCount("SELECT COUNT(DISTINCT DATE_FORMAT(shot_date, '%Y-%m-01')) AS total FROM photos WHERE shot_date IS NOT NULL"),
      days: await safeCount('SELECT COUNT(DISTINCT DATE(shot_date)) AS total FROM photos WHERE shot_date IS NOT NULL')
    });
  } catch (err) {
    next(err);
  }
});

export default router;
