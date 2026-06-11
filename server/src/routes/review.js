import { Router } from 'express';
import { query } from '../config/database.js';
import { summarizeReview, getAIConfig } from '../services/ai.js';

const router = Router();

// 辅助函数：构建返回数据
async function buildReviewData(yearInt, aiSummary, aiError) {
  const yearStats = await query(
    `SELECT 
      COUNT(*) as total_photos,
      SUM(file_size) as total_size
     FROM photos 
     WHERE visibility != 'hidden' AND YEAR(shot_date) = ?`,
    [yearInt]
  );

  const monthlyStats = await query(
    `SELECT 
      MONTH(shot_date) as month,
      COUNT(*) as count
     FROM photos 
     WHERE visibility != 'hidden' AND YEAR(shot_date) = ? AND shot_date IS NOT NULL
     GROUP BY MONTH(shot_date)
     ORDER BY month`,
    [yearInt]
  );

  const dailyStats = await query(
    `SELECT 
      DATE(shot_date) as date,
      COUNT(*) as count
     FROM photos 
     WHERE visibility != 'hidden' AND YEAR(shot_date) = ? AND shot_date IS NOT NULL
     GROUP BY DATE(shot_date)
     ORDER BY date`,
    [yearInt]
  );

  const topTags = await query(
    `SELECT t.id, t.name, t.color, COUNT(pt.photo_id) as count
     FROM tags t
     JOIN photo_tags pt ON t.id = pt.tag_id
     JOIN photos p ON pt.photo_id = p.id
     WHERE p.visibility != 'hidden' AND YEAR(p.shot_date) = ?
     GROUP BY t.id
     ORDER BY count DESC
     LIMIT 10`,
    [yearInt]
  );

  const topLocations = await query(
    `SELECT location, COUNT(*) as count
     FROM photos 
     WHERE visibility != 'hidden' AND YEAR(shot_date) = ? AND location IS NOT NULL AND location != ''
     GROUP BY location
     ORDER BY count DESC
     LIMIT 10`,
    [yearInt]
  );

  const dateRange = await query(
    `SELECT 
      MIN(shot_date) as first_photo,
      MAX(shot_date) as last_photo
     FROM photos 
     WHERE visibility != 'hidden' AND YEAR(shot_date) = ? AND shot_date IS NOT NULL`,
    [yearInt]
  );

  const sizeStats = await query(
    `SELECT 
      AVG(width) as avg_width,
      AVG(height) as avg_height,
      MIN(width) as min_width,
      MAX(width) as max_width
     FROM photos 
     WHERE visibility != 'hidden' AND YEAR(shot_date) = ? AND width IS NOT NULL`,
    [yearInt]
  );

  const heroPhoto = await query(
    `SELECT id, url, thumbnail_url
     FROM photos
     WHERE visibility != 'hidden' AND YEAR(shot_date) = ?
     ORDER BY shot_date ASC LIMIT 1`,
    [yearInt]
  );

  const statPhotos = await query(
    `SELECT id, url, thumbnail_url
     FROM photos
     WHERE visibility != 'hidden' AND YEAR(shot_date) = ?
     ORDER BY shot_date ASC
     LIMIT 4`,
    [yearInt]
  );

  const gpsStats = await query(
    `SELECT COUNT(*) as count
     FROM photos 
     WHERE visibility != 'hidden' AND YEAR(shot_date) = ? AND latitude IS NOT NULL AND longitude IS NOT NULL`,
    [yearInt]
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
router.get('/years', async (req, res, next) => {
  try {
    const years = await query(
      `SELECT DISTINCT YEAR(shot_date) as year
       FROM photos 
       WHERE visibility != 'hidden' AND shot_date IS NOT NULL
       ORDER BY year DESC`
    );

    res.json({ years: years.map(y => y.year) });
  } catch (err) {
    next(err);
  }
});

// 获取年度回顾数据
router.get('/:year', async (req, res, next) => {
  try {
    const { year } = req.params;
    const yearInt = parseInt(year);
    const shouldRegenerate = req.query.regenerate === 'true';
    
    if (isNaN(yearInt)) {
      return res.status(400).json({ error: 'Invalid year' });
    }

    // 检查缓存（非重新生成时）
    if (!shouldRegenerate) {
      const cached = await query(
        'SELECT ai_summary, generated_at FROM review_cache WHERE year = ?',
        [yearInt]
      );
      
      if (cached.length > 0 && cached[0].ai_summary) {
        console.log(`[Review] 使用缓存的回顾 (year=${yearInt}, generated_at=${cached[0].generated_at})`);
        const reviewData = await buildReviewData(yearInt, cached[0].ai_summary, null);
        return res.json(reviewData);
      }
    }

    // 缓存不存在或需要重新生成，查询统计数据
    const yearStats = await query(
      `SELECT 
        COUNT(*) as total_photos,
        SUM(file_size) as total_size
       FROM photos 
       WHERE visibility != 'hidden' AND YEAR(shot_date) = ?`,
      [yearInt]
    );

    const monthlyStats = await query(
      `SELECT 
        MONTH(shot_date) as month,
        COUNT(*) as count
       FROM photos 
       WHERE visibility != 'hidden' AND YEAR(shot_date) = ? AND shot_date IS NOT NULL
       GROUP BY MONTH(shot_date)
       ORDER BY month`,
      [yearInt]
    );

    const dailyStats = await query(
      `SELECT 
        DATE(shot_date) as date,
        COUNT(*) as count
       FROM photos 
       WHERE visibility != 'hidden' AND YEAR(shot_date) = ? AND shot_date IS NOT NULL
       GROUP BY DATE(shot_date)
       ORDER BY date`,
      [yearInt]
    );

    const topTags = await query(
      `SELECT t.id, t.name, t.color, COUNT(pt.photo_id) as count
       FROM tags t
       JOIN photo_tags pt ON t.id = pt.tag_id
       JOIN photos p ON pt.photo_id = p.id
       WHERE p.visibility != 'hidden' AND YEAR(p.shot_date) = ?
       GROUP BY t.id
       ORDER BY count DESC
       LIMIT 10`,
      [yearInt]
    );

    const topLocations = await query(
      `SELECT location, COUNT(*) as count
       FROM photos 
       WHERE visibility != 'hidden' AND YEAR(shot_date) = ? AND location IS NOT NULL AND location != ''
       GROUP BY location
       ORDER BY count DESC
       LIMIT 10`,
      [yearInt]
    );

    const dateRange = await query(
      `SELECT 
        MIN(shot_date) as first_photo,
        MAX(shot_date) as last_photo
       FROM photos 
       WHERE visibility != 'hidden' AND YEAR(shot_date) = ? AND shot_date IS NOT NULL`,
      [yearInt]
    );

    const sizeStats = await query(
      `SELECT 
        AVG(width) as avg_width,
        AVG(height) as avg_height,
        MIN(width) as min_width,
        MAX(width) as max_width
       FROM photos 
       WHERE visibility != 'hidden' AND YEAR(shot_date) = ? AND width IS NOT NULL`,
      [yearInt]
    );

    // 7a. Hero 照片（年度第一张）
    const heroPhoto = await query(
      `SELECT id, url, thumbnail_url
       FROM photos
       WHERE visibility != 'hidden' AND YEAR(shot_date) = ?
       ORDER BY shot_date ASC LIMIT 1`,
      [yearInt]
    );

    // 7b. 4 张代表性照片（均匀分布）
    const statPhotos = await query(
      `SELECT id, url, thumbnail_url
       FROM photos
       WHERE visibility != 'hidden' AND YEAR(shot_date) = ?
       ORDER BY shot_date ASC
       LIMIT 4`,
      [yearInt]
    );

    // 8. 有 GPS 坐标的照片数
    const gpsStats = await query(
      `SELECT COUNT(*) as count
       FROM photos 
       WHERE visibility != 'hidden' AND YEAR(shot_date) = ? AND latitude IS NOT NULL AND longitude IS NOT NULL`,
      [yearInt]
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
          `INSERT INTO review_cache (year, ai_summary, model, provider) 
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           ai_summary = VALUES(ai_summary), 
           model = VALUES(model), 
           provider = VALUES(provider),
           updated_at = CURRENT_TIMESTAMP`,
          [yearInt, aiSummary, aiConfig.model, aiConfig.provider]
        );
        console.log(`[Review] 已缓存回顾 (year=${yearInt})`);
      } catch (cacheErr) {
        console.error('[Review] 缓存保存失败:', cacheErr.message);
        // 缓存失败不影响正常返回
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
