import { Router } from 'express';
import { query } from '../config/database.js';
import { optionalAuth, authenticateToken } from '../middleware/auth.js';
import { generateStorySummary } from '../services/ai.js';

const router = Router();

// ============================================================
// 工具函数：统一 location 归一化（JS 层，确保一致性）
// 移除所有 Unicode 空白字符（含全角空格、不间断空格等）
// ============================================================
const normalizeLocation = (loc) => {
  if (!loc) return '';
  return String(loc).trim().replace(/\s+/g, '');
};

// ============================================================
// 工具函数：多级降级查找故事照片
// 返回 { photos, matchedLevel } 或 null
// ============================================================
async function findStoryPhotos(date, decodedLocation, options = {}) {
  const logTag = options.logTag || '[Story]';
  const userId = options.userId || null;

  // 从 date (如 '2026-06-01') 提取年月
  const dateObj = new Date(date + 'T00:00:00Z');
  const year = dateObj.getUTCFullYear();
  const month = dateObj.getUTCMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  // 隐私过滤：登录用户只看自己的 public 照片，匿名看不到任何照片
  const visibilityFilter = userId
    ? `user_id = ? AND visibility = 'public'`
    : `1 = 0`;
  const params = userId ? [monthStart, monthEnd, userId] : [monthStart, monthEnd];

  const photos = await query(
    `SELECT id, title, mood, shot_date, location
     FROM photos 
     WHERE shot_date >= ? AND shot_date < ?
       AND ${visibilityFilter}
     ORDER BY shot_date`,
    params
  );
  console.log(`${logTag} 当月(${monthStart} ~ ${monthEnd}): ${photos.length} 条`);
  if (photos.length > 0) return { photos, matchedLevel: 1 };

  console.error(`${logTag} 当月(${monthStart} ~ ${monthEnd})完全无任何照片记录`);
  return null;
}

// 获取故事线列表 — 按同一月+同一地点聚合
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { year, page = 1, limit = 20 } = req.query;
    const userId = req.user?.id || null;

    // 构建基础查询条件：登录用户只看自己的 public 照片，匿名看不到任何照片
    const visibilityFilter = userId
      ? `p.user_id = ? AND p.visibility = 'public'`
      : `1 = 0`;
    let whereClause = `WHERE ${visibilityFilter} AND p.shot_date IS NOT NULL`;
    const params = userId ? [userId] : [];

    if (year) {
      whereClause += ` AND YEAR(p.shot_date) = ?`;
      params.push(parseInt(year));
    }

    const safeLimit = parseInt(limit) || 20;
    const safeOffset = (parseInt(page) - 1) * safeLimit;

    // 查询故事节点：按 月份 聚合（同月所有照片归为一条故事），LEFT JOIN 已缓存的 AI 摘要
    // 注意: LIMIT/OFFSET 使用插值而非占位符, 避免 mysql2 子查询参数绑定兼容性问题
    const stories = await query(
      `SELECT 
        grouped.*,
        ss.summary_text AS cached_summary
       FROM (
         SELECT 
           DATE_FORMAT(p.shot_date, '%Y-%m-01') as story_date,
           GROUP_CONCAT(DISTINCT COALESCE(p.location, '未知地点') SEPARATOR ' / ') as location,
           GROUP_CONCAT(DISTINCT p.id ORDER BY p.shot_date) as photo_ids,
           COUNT(*) as photo_count,
           MIN(p.shot_date) as first_shot,
           MAX(p.shot_date) as last_shot
          FROM photos p
          ${whereClause}
          GROUP BY DATE_FORMAT(p.shot_date, '%Y-%m-01')
       ) AS grouped
       LEFT JOIN story_summaries ss ON ss.story_date = grouped.story_date
       ORDER BY story_date DESC
       LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      params
    );

    // 为每个故事节点获取照片详情和标签
    const result = [];
    for (const story of stories) {
      const photoIds = story.photo_ids.split(',').map(id => parseInt(id));

      // 获取照片列表
      const photos = await query(
        `SELECT id, title, url, thumbnail_url, original_url, shot_date, location, mood, width, height
         FROM photos WHERE id IN (${photoIds.map(() => '?').join(',')})
         ORDER BY shot_date`,
        photoIds
      );

      // 获取标签
      const tags = await query(
        `SELECT DISTINCT t.id, t.name, t.color
         FROM tags t
         JOIN photo_tags pt ON t.id = pt.tag_id
         WHERE pt.photo_id IN (${photoIds.map(() => '?').join(',')})
         ORDER BY t.name`,
        photoIds
      );

      result.push({
        date: story.story_date,
        location: story.location,
        photos,
        tags,
        photoCount: story.photo_count,
        aiSummary: story.cached_summary || null  // 关联已缓存的 AI 摘要
      });
    }

    // 总数（用于分页）
    const countResult = await query(
      `SELECT COUNT(*) as total FROM (
        SELECT DATE_FORMAT(shot_date, '%Y-%m-01') as d
        FROM photos p ${whereClause}
        GROUP BY DATE_FORMAT(shot_date, '%Y-%m-01')
      ) AS grouped`,
      params
    );

    res.json({
      stories: result,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (err) {
    next(err);
  }
});

// 获取单个故事详情（使用统一的多级查找逻辑，与 summary 接口保持一致）
router.get('/:date/:location', optionalAuth, async (req, res, next) => {
  try {
    const { date, location } = req.params;
    const decodedLocation = decodeURIComponent(location);
    const userId = req.user?.id || null;

    console.log(`[StoryDetail] 查询参数: date="${date}", location="${decodedLocation}"`);

    // 使用多级查找（仅获取基础字段用于定位）
    const result = await findStoryPhotos(date, decodedLocation, { logTag: '[StoryDetail]', userId });

    if (!result || result.photos.length === 0) {
      return res.status(404).json({ error: '故事不存在' });
    }

    console.log(`[StoryDetail] Level${result.matchedLevel} 匹配成功`);

    // 用查到的 photoIds 获取完整的照片信息（含 URL、尺寸等）
    const photoIds = result.photos.map(p => p.id);
    
    const fullPhotos = await query(
      `SELECT id, title, url, thumbnail_url, original_url, shot_date, location, mood, width, height, latitude, longitude
       FROM photos WHERE id IN (${photoIds.map(() => '?').join(',')})
       ORDER BY shot_date`,
      photoIds
    );

    const tags = await query(
      `SELECT DISTINCT t.id, t.name, t.color
       FROM tags t
       JOIN photo_tags pt ON t.id = pt.tag_id
       WHERE pt.photo_id IN (${photoIds.map(() => '?').join(',')})
       ORDER BY t.name`,
      photoIds
    );

    // 查询已缓存的 AI 摘要
    const summaryRows = await query(
      `SELECT summary_text FROM story_summaries WHERE story_date = ?`,
      [date]
    );

    res.json({
      date,
      location: decodedLocation,
      photos: fullPhotos,
      tags,
      photoCount: fullPhotos.length,
      aiSummary: summaryRows.length > 0 ? summaryRows[0].summary_text : null
    });
  } catch (err) {
    next(err);
  }
});

// 生成/重新生成故事的 AI 叙态摘要（使用统一的多级查找逻辑）
// 支持 regenerate 参数：true=强制重新调 AI；缺省/false=优先返回缓存
router.post('/:date/:location/summary', authenticateToken, async (req, res, next) => {
  try {
    const { date, location } = req.params;
    const decodedLocation = decodeURIComponent(location);
    const { regenerate } = req.body || {};
    const userId = req.user?.id;

    console.log(`[StorySummary] 查询参数: date="${date}", location="${decodedLocation}", regenerate=${!!regenerate}`);

    // ---- 缓存命中检查（非强制重新生成时）----
    if (!regenerate) {
      const cached = await query(
        `SELECT summary_text, updated_at FROM story_summaries WHERE story_date = ?`,
        [date]
      );
      if (cached.length > 0 && cached[0].summary_text) {
        console.log(`[StorySummary] 命中缓存 (updated_at: ${cached[0].updated_at})`);
        return res.json({ summary: cached[0].summary_text, cached: true });
      }
    }

    // 支持可选的 photoIds 兜底参数（前端可从列表数据中传入已知 ID）
    let photoIdsParam = null;
    if (req.body?.photoIds && Array.isArray(req.body.photoIds)) {
      photoIdsParam = req.body.photoIds;
      console.log(`[StorySummary] 使用前端传入的 photoIds: [${photoIdsParam.join(',')}]`);
    }

    let result;

    // 如果有 photoIds 参数，直接用 ID 查询（最高优先级兜底）
    if (photoIdsParam && photoIdsParam.length > 0) {
      const directPhotos = await query(
        `SELECT id, title, mood, shot_date, location
         FROM photos WHERE id IN (${photoIdsParam.map(() => '?').join(',')})
           AND visibility = 'public'
         ORDER BY shot_date`,
        photoIdsParam
      );
      console.log(`[StorySummary] photoIds直查: ${directPhotos.length}/${photoIdsParam.length} 条可见`);
      result = directPhotos.length > 0 ? { photos: directPhotos, matchedLevel: 0 } : null;
    }

    // 否则走标准多级查找
    if (!result) {
      result = await findStoryPhotos(date, decodedLocation, { logTag: '[StorySummary]', userId });
    }

    if (!result || result.photos.length === 0) {
      const nearby = await query(
        `SELECT id, DATE(shot_date) as d, location, visibility FROM photos WHERE visibility = 'public' ORDER BY shot_date DESC LIMIT 5`
      );
      return res.status(404).json({ 
        error: '故事不存在', 
        debug: { date, location: decodedLocation, nearby } 
      });
    }

    const { photos, matchedLevel } = result;
    console.log(`[StorySummary] Level${matchedLevel} 匹配成功，共 ${photos.length} 张照片`);

    // 调用 AI 生成叙事摘要
    const aiResult = await generateStorySummary({
      date,
      location: decodedLocation,
      photos: photos.map(p => ({ title: p.title, mood: p.mood }))
    }, {}, req.user.id);

    console.log(`[StorySummary] AI 返回结果类型: ${typeof aiResult}, 值:`, JSON.stringify(aiResult)?.slice(0, 200));

    if (aiResult && typeof aiResult === 'object' && aiResult.success) {
      const summaryText = String(aiResult.data || '').trim();
      if (summaryText.length > 0) {
        // ---- 持久化到 story_summaries 表 ----
        try {
          await query(
            `INSERT INTO story_summaries (story_date, summary_text, photo_hash)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE summary_text = VALUES(summary_text), updated_at = CURRENT_TIMESTAMP`,
            [date, summaryText, null]
          );
          console.log('[StorySummary] AI 结果已持久化');
        } catch (dbErr) {
          // 存库失败不影响返回结果
          console.error('[StorySummary] 持久化失败（不影响返回）:', dbErr.message);
        }

        res.json({ summary: summaryText, cached: false });
      } else {
        res.json({ summary: null, error: { message: 'AI 返回内容为空，请稍后重试', code: 'EMPTY_CONTENT' } });
      }
    } else if (aiResult && typeof aiResult === 'object' && !aiResult.success) {
      res.json({ summary: null, error: { message: aiResult.message || 'AI 生成失败', code: aiResult.error } });
    } else {
      // aiResult 不是预期的对象格式
      console.warn('[StorySummary] AI 返回异常格式:', typeof aiResult, aiResult);
      res.json({ summary: null, error: { message: 'AI 服务响应异常，请检查配置', code: 'INVALID_RESPONSE' } });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
