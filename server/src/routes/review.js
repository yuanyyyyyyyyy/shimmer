import { Router } from 'express';
import { query } from '../config/database.js';
import { optionalAuth } from '../middleware/auth.js';
import { summarizeReview, getAIConfig } from '../services/ai.js';

const router = Router();

// 构建可见性过滤条件
function buildVisibilityFilter(userId) {
  if (userId) {
    // 登录用户：查看自己的 public 照片
    return {
      where: `p.user_id = ? AND p.visibility = 'public'`,
      params: [userId]
    };
  }
  // 未登录：看不到任何照片
  return {
    where: `1 = 0`,
    params: []
  };
}

// 辅助函数：构建返回数据
async function buildReviewData(yearInt, aiSummary, aiError, userId = null) {
  const vis = buildVisibilityFilter(userId);

  const yearStats = await query(
    `SELECT COUNT(*) as total_photos, SUM(file_size) as total_size
     FROM photos p WHERE ${vis.where} AND YEAR(p.shot_date) = ?`,
    [...vis.params, yearInt]
  );

  const monthlyStats = await query(
    `SELECT MONTH(shot_date) as month, COUNT(*) as count
     FROM photos p WHERE ${vis.where} AND YEAR(shot_date) = ? AND shot_date IS NOT NULL
     GROUP BY MONTH(shot_date) ORDER BY month`,
    [...vis.params, yearInt]
  );

  const dailyStats = await query(
    `SELECT DATE(shot_date) as date, COUNT(*) as count
     FROM photos p WHERE ${vis.where} AND YEAR(shot_date) = ? AND shot_date IS NOT NULL
     GROUP BY DATE(shot_date) ORDER BY date`,
    [...vis.params, yearInt]
  );

  const topTags = await query(
    `SELECT t.id, t.name, t.color, COUNT(pt.photo_id) as count
     FROM tags t
     JOIN photo_tags pt ON t.id = pt.tag_id
     JOIN photos p ON pt.photo_id = p.id
     WHERE ${vis.where} AND YEAR(p.shot_date) = ?
     GROUP BY t.id ORDER BY count DESC LIMIT 10`,
    [...vis.params, yearInt]
  );

  const topLocations = await query(
    `SELECT location, COUNT(*) as count
     FROM photos p WHERE ${vis.where} AND YEAR(shot_date) = ? AND location IS NOT NULL AND location != ''
     GROUP BY location ORDER BY count DESC LIMIT 10`,
    [...vis.params, yearInt]
  );

  const dateRange = await query(
    `SELECT MIN(shot_date) as first_photo, MAX(shot_date) as last_photo
     FROM photos p WHERE ${vis.where} AND YEAR(shot_date) = ? AND shot_date IS NOT NULL`,
    [...vis.params, yearInt]
  );

  const sizeStats = await query(
    `SELECT AVG(width) as avg_width, AVG(height) as avg_height,
            MIN(width) as min_width, MAX(width) as max_width
     FROM photos p WHERE ${vis.where} AND YEAR(shot_date) = ? AND width IS NOT NULL`,
    [...vis.params, yearInt]
  );

  const heroPhoto = await query(
    `SELECT id, url, thumbnail_url FROM photos p
     WHERE ${vis.where} AND YEAR(shot_date) = ?
     ORDER BY shot_date ASC LIMIT 1`,
    [...vis.params, yearInt]
  );

  const statPhotos = await query(
    `SELECT id, url, thumbnail_url FROM photos p
     WHERE ${vis.where} AND YEAR(shot_date) = ?
     ORDER BY shot_date ASC LIMIT 4`,
    [...vis.params, yearInt]
  );

  const gpsStats = await query(
    `SELECT COUNT(*) as count FROM photos p
     WHERE ${vis.where} AND YEAR(shot_date) = ? AND latitude IS NOT NULL AND longitude IS NOT NULL`,
    [...vis.params, yearInt]
  );

  return {
    year: yearInt,
    totalPhotos: yearStats[0].total_photos || 0,
    totalSize: yearStats[0].total_size || 0,
    monthlyStats,
    dailyStats,
    topTags,
    topLocations,
    firstPhoto: dateRange[0].first_photo,
    lastPhoto: dateRange[0].last_photo,
    avgWidth: sizeStats[0].avg_width ? Math.round(sizeStats[0].avg_width) : 0,
    avgHeight: sizeStats[0].avg_height ? Math.round(sizeStats[0].avg_height) : 0,
    photosWithGps: gpsStats[0].count || 0,
    heroPhoto: heroPhoto[0] || null,
    statPhotos: statPhotos || [],
    aiSummary: aiSummary || '',
    aiError
  };
}

// 获取可回顾的年份列表（需要放在 /:year 前面）
router.get('/years', optionalAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const vis = buildVisibilityFilter(userId);
    const years = await query(
      `SELECT DISTINCT YEAR(p.shot_date) as year
       FROM photos p
       WHERE ${vis.where} AND p.shot_date IS NOT NULL
       ORDER BY year DESC`,
      vis.params
    );

    res.json({ years: years.map(y => y.year) });
  } catch (err) {
    next(err);
  }
});

// 获取年度回顾数据
router.get('/:year', optionalAuth, async (req, res, next) => {
  try {
    const { year } = req.params;
    const yearInt = parseInt(year);
    const shouldRegenerate = req.query.regenerate === 'true';
    const userId = req.user?.id || null;
    
    if (isNaN(yearInt)) {
      return res.status(400).json({ error: 'Invalid year' });
    }

    const vis = buildVisibilityFilter(userId);

    // 检查缓存（非重新生成时）
    const cacheUserId = userId || 0;
    if (!shouldRegenerate) {
      const cached = await query(
        'SELECT ai_summary, generated_at FROM review_cache WHERE year = ? AND user_id = ?',
        [yearInt, cacheUserId]
      );
      
      if (cached.length > 0 && cached[0].ai_summary) {
        console.log(`[Review] 使用缓存的回顾 (year=${yearInt}, generated_at=${cached[0].generated_at})`);
        const reviewData = await buildReviewData(yearInt, cached[0].ai_summary, null, userId);
        return res.json(reviewData);
      }
    }

    // 缓存不存在或需要重新生成，查询统计数据
    const yearStats = await query(
      `SELECT COUNT(*) as total_photos, SUM(file_size) as total_size
       FROM photos p WHERE ${vis.where} AND YEAR(p.shot_date) = ?`,
      [...vis.params, yearInt]
    );

    const monthlyStats = await query(
      `SELECT MONTH(shot_date) as month, COUNT(*) as count
       FROM photos p WHERE ${vis.where} AND YEAR(shot_date) = ? AND shot_date IS NOT NULL
       GROUP BY MONTH(shot_date) ORDER BY month`,
      [...vis.params, yearInt]
    );

    const dailyStats = await query(
      `SELECT DATE(shot_date) as date, COUNT(*) as count
       FROM photos p WHERE ${vis.where} AND YEAR(shot_date) = ? AND shot_date IS NOT NULL
       GROUP BY DATE(shot_date) ORDER BY date`,
      [...vis.params, yearInt]
    );

    const topTags = await query(
      `SELECT t.id, t.name, t.color, COUNT(pt.photo_id) as count
       FROM tags t
       JOIN photo_tags pt ON t.id = pt.tag_id
       JOIN photos p ON pt.photo_id = p.id
       WHERE ${vis.where} AND YEAR(p.shot_date) = ?
       GROUP BY t.id ORDER BY count DESC LIMIT 10`,
      [...vis.params, yearInt]
    );

    const topLocations = await query(
      `SELECT location, COUNT(*) as count
       FROM photos p WHERE ${vis.where} AND YEAR(shot_date) = ? AND location IS NOT NULL AND location != ''
       GROUP BY location ORDER BY count DESC LIMIT 10`,
      [...vis.params, yearInt]
    );

    const dateRange = await query(
      `SELECT MIN(shot_date) as first_photo, MAX(shot_date) as last_photo
       FROM photos p WHERE ${vis.where} AND YEAR(shot_date) = ? AND shot_date IS NOT NULL`,
      [...vis.params, yearInt]
    );

    const sizeStats = await query(
      `SELECT AVG(width) as avg_width, AVG(height) as avg_height,
              MIN(width) as min_width, MAX(width) as max_width
       FROM photos p WHERE ${vis.where} AND YEAR(shot_date) = ? AND width IS NOT NULL`,
      [...vis.params, yearInt]
    );

    // Hero 照片（年度第一张）
    const heroPhoto = await query(
      `SELECT id, url, thumbnail_url FROM photos p
       WHERE ${vis.where} AND YEAR(shot_date) = ?
       ORDER BY shot_date ASC LIMIT 1`,
      [...vis.params, yearInt]
    );

    // 4 张代表性照片
    const statPhotos = await query(
      `SELECT id, url, thumbnail_url FROM photos p
       WHERE ${vis.where} AND YEAR(shot_date) = ?
       ORDER BY shot_date ASC LIMIT 4`,
      [...vis.params, yearInt]
    );

    // 有 GPS 坐标的照片数
    const gpsStats = await query(
      `SELECT COUNT(*) as count FROM photos p
       WHERE ${vis.where} AND YEAR(shot_date) = ? AND latitude IS NOT NULL AND longitude IS NOT NULL`,
      [...vis.params, yearInt]
    );

    console.log(`[Review] ${shouldRegenerate ? '重新生成' : '首次生成'} AI 回顾 (year=${yearInt})`);

    const reviewResult = await summarizeReview({
      totalPhotos: yearStats[0].total_photos || 0,
      totalSize: yearStats[0].total_size || 0,
      topTags,
      topLocations,
      firstPhoto: dateRange[0].first_photo,
      lastPhoto: dateRange[0].last_photo,
      photosWithGps: gpsStats[0].count || 0
    });

    // 处理 AI 回顾结果（支持新旧两种格式）
    let aiSummary = '';
    let aiError = null;

    if (typeof reviewResult === 'string') {
      // 旧格式：直接返回字符串
      aiSummary = reviewResult;
    } else if (reviewResult && typeof reviewResult === 'object') {
      // 新格式：返回对象 { success, data, error, message }
      if (reviewResult.success) {
        aiSummary = reviewResult.data || '';
      } else {
        aiError = {
          error: reviewResult.error || 'UNKNOWN_ERROR',
          message: reviewResult.message || 'AI 生成失败',
          detail: reviewResult.detail || null
        };
      }
    }

    // 保存到缓存（仅成功时）
    if (aiSummary && !aiError) {
      try {
        const aiConfig = await getAIConfig();
        await query(
          `INSERT INTO review_cache (year, user_id, ai_summary, model, provider) 
           VALUES (?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           ai_summary = VALUES(ai_summary), 
           model = VALUES(model), 
           provider = VALUES(provider),
           updated_at = CURRENT_TIMESTAMP`,
          [yearInt, cacheUserId, aiSummary, aiConfig.model, aiConfig.provider]
        );
        console.log(`[Review] 已缓存回顾 (year=${yearInt}, user_id=${cacheUserId})`);
      } catch (cacheErr) {
        console.error('[Review] 缓存保存失败:', cacheErr.message);
      }
    }

    res.json({
      year: yearInt,
      totalPhotos: yearStats[0].total_photos || 0,
      totalSize: yearStats[0].total_size || 0,
      monthlyStats,
      dailyStats,
      topTags,
      topLocations,
      firstPhoto: dateRange[0].first_photo,
      lastPhoto: dateRange[0].last_photo,
      avgWidth: sizeStats[0].avg_width ? Math.round(sizeStats[0].avg_width) : 0,
      avgHeight: sizeStats[0].avg_height ? Math.round(sizeStats[0].avg_height) : 0,
      photosWithGps: gpsStats[0].count || 0,
      heroPhoto: heroPhoto[0] || null,
      statPhotos: statPhotos || [],
      aiSummary,
      aiError
    });
  } catch (err) {
    next(err);
  }
});

export default router;
