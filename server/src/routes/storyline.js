import { Router } from 'express';
import { query } from '../config/database.js';
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
  const targetLoc = normalizeLocation(decodedLocation);
  const logTag = options.logTag || '[Story]';

  // ---- Level 1: 精确匹配（SQL 层归一化）----
  const exactMatch = await query(
    `SELECT id, title, mood, shot_date, location
     FROM photos 
     WHERE DATE(shot_date) = ?
       AND REPLACE(TRIM(COALESCE(location, '')), ' ', '') = ?
       AND visibility != 'hidden'
     ORDER BY shot_date`,
    [date, targetLoc]
  );
  console.log(`${logTag} Level1(精确匹配): date="${date}", loc="${targetLoc}" → ${exactMatch.length} 条`);
  if (exactMatch.length > 0) return { photos: exactMatch, matchedLevel: 1 };

  // ---- Level 1.5: 日期范围容错查询（解决时区导致的 ±1天偏差）----
  const rangeMatch = await query(
    `SELECT id, title, mood, shot_date, location
     FROM photos 
     WHERE DATE(shot_date) BETWEEN DATE_SUB(?, INTERVAL 1 DAY) AND DATE_ADD(?, INTERVAL 1 DAY)
       AND REPLACE(TRIM(COALESCE(location, '')), ' ', '') = ?
       AND visibility != 'hidden'
     ORDER BY shot_date
     LIMIT 20`,
    [date, date, targetLoc]
  );

  if (rangeMatch.length > 0) {
    const diagInfo = rangeMatch.map(p => ({
      id: p.id,
      actualDate: String(p.shot_date),
      location: p.location
    }));
    console.log(`${logTag} Level1.5(日期容差±1天): 找到 ${rangeMatch.length} 条! 实际日期:`,
      JSON.stringify(diagInfo));
    console.warn(`${logTag} ⚠️ 日期不匹配: 请求="${date}", 实际存储日期见上方`);
    return { photos: rangeMatch, matchedLevel: 1.5 };
  }

  console.log(`${logTag} Level1.5(日期容差): 范围内也无匹配`);

  // ---- Level 2: 按日期范围 + JS 层归一化过滤（原逻辑增强版）----
  const dayRangeAll = await query(
    `SELECT id, title, mood, shot_date, location, visibility
     FROM photos 
     WHERE DATE(shot_date) BETWEEN DATE_SUB(?, INTERVAL 1 DAY) AND DATE_ADD(?, INTERVAL 1 DAY)
       AND visibility != 'hidden'
     ORDER BY shot_date
     LIMIT 50`,
    [date, date]
  );
  console.log(`${logTag} Level2(范围+JS归一化): 日期±1天内共 ${dayRangeAll.length} 条可见照片`);
  if (dayRangeAll.length > 0) {
    // 输出原始 shot_date 诊断（关键：排查时区问题）
    console.log(`${logTag} 📅 实际存储的 shot_date 值:`,
      dayRangeAll.map(p => `id=${p.id} date=${p.shot_date} loc="${p.location}"`));

    const jsFiltered = dayRangeAll.filter(p => normalizeLocation(p.location) === targetLoc);
    if (jsFiltered.length > 0) return { photos: jsFiltered, matchedLevel: 2 };

    // ---- Level 3: LIKE 模糊匹配 ----
    const likeResults = dayRangeAll.filter(p => {
      const raw = (p.location || '').trim();
      const norm = normalizeLocation(p.location);
      return norm.includes(targetLoc) || targetLoc.includes(norm)
        || raw.includes(decodedLocation.trim()) || decodedLocation.trim().includes(raw);
    });
    console.log(`${logTag} Level3(LIKE模糊): 匹配到 ${likeResults.length} 条`);
    if (likeResults.length > 0) return { photos: likeResults, matchedLevel: 3 };

    // ---- Level 4: 使用范围内所有照片（带警告）----
    console.warn(`${logTag} Level4(兜底): 使用±1天内全部 ${dayRangeAll.length} 张照片，location不精确匹配`);
    return { photos: dayRangeAll, matchedLevel: 4 };
  }

  // 完全没有数据 — 扩大范围诊断
  const withHidden = await query(
    `SELECT id, title, location, visibility, shot_date
     FROM photos 
     WHERE DATE(shot_date) BETWEEN DATE_SUB(?, INTERVAL 2 DAY) AND DATE_ADD(?, INTERVAL 2 DAY)
     ORDER BY shot_date
     LIMIT 10`,
    [date, date]
  );
  if (withHidden.length > 0) {
    console.error(`${logTag} ±2天内存在记录但未匹配! 详情:`,
      withHidden.map(p => `id=${p.id} date=${p.shot_date} loc="${p.location}" vis=${p.visibility}`));
  } else {
    console.error(`${logTag} 当天(date=${date})完全无任何照片记录`);
  }
  return null;
}

// 获取故事线列表 — 按同一天+同一地点聚合
router.get('/', async (req, res, next) => {
  try {
    const { year, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // 构建基础查询条件
    let whereClause = `WHERE p.visibility != 'hidden' AND p.shot_date IS NOT NULL`;
    const params = [];

    if (year) {
      whereClause += ` AND YEAR(p.shot_date) = ?`;
      params.push(parseInt(year));
    }

    const safeLimit = parseInt(limit) || 20;
    const safeOffset = (parseInt(page) - 1) * safeLimit;

    // 查询故事节点：按 日期+地点 聚合
    // 注意: LIMIT/OFFSET 使用插值而非占位符, 避免 mysql2 子查询参数绑定兼容性问题
    const stories = await query(
      `SELECT 
        story_date,
        COALESCE(location, '未知地点') as location,
        photo_ids,
        photo_count,
        first_shot,
        last_shot
       FROM (
         SELECT 
           DATE(p.shot_date) as story_date,
           p.location as location,
           GROUP_CONCAT(DISTINCT p.id ORDER BY p.shot_date) as photo_ids,
           COUNT(*) as photo_count,
           MIN(p.shot_date) as first_shot,
           MAX(p.shot_date) as last_shot
          FROM photos p
          ${whereClause}
          GROUP BY DATE(p.shot_date), p.location
       ) AS grouped
       ORDER BY story_date DESC, location
       LIMIT ${safeLimit} OFFSET ${safeOffset}`,
      params
    );

    // 为每个故事节点获取照片详情和标签
    const result = [];
    for (const story of stories) {
      const photoIds = story.photo_ids.split(',').map(id => parseInt(id));

      // 获取照片列表
      const photos = await query(
        `SELECT id, title, url, thumbnail_url, shot_date, location, mood, width, height
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
        aiSummary: null  // 由前端按需触发生成
      });
    }

    // 总数（用于分页）
    const countResult = await query(
      `SELECT COUNT(*) as total FROM (
        SELECT DATE(shot_date) as d, COALESCE(location, '') as l
        FROM photos p ${whereClause}
        GROUP BY d, l
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
router.get('/:date/:location', async (req, res, next) => {
  try {
    const { date, location } = req.params;
    const decodedLocation = decodeURIComponent(location);

    console.log(`[StoryDetail] 查询参数: date="${date}", location="${decodedLocation}"`);

    // 使用多级查找（仅获取基础字段用于定位）
    const result = await findStoryPhotos(date, decodedLocation, { logTag: '[StoryDetail]' });

    if (!result || result.photos.length === 0) {
      return res.status(404).json({ error: '故事不存在' });
    }

    console.log(`[StoryDetail] Level${result.matchedLevel} 匹配成功`);

    // 用查到的 photoIds 获取完整的照片信息（含 URL、尺寸等）
    const photoIds = result.photos.map(p => p.id);
    
    const fullPhotos = await query(
      `SELECT id, title, url, thumbnail_url, shot_date, location, mood, width, height, latitude, longitude
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

    res.json({
      date,
      location: decodedLocation,
      photos: fullPhotos,
      tags,
      photoCount: fullPhotos.length
    });
  } catch (err) {
    next(err);
  }
});

// 生成/重新生成故事的 AI 叙态摘要（使用统一的多级查找逻辑）
router.post('/:date/:location/summary', async (req, res, next) => {
  try {
    const { date, location } = req.params;
    const decodedLocation = decodeURIComponent(location);

    console.log(`[StorySummary] 查询参数: date="${date}", location="${decodedLocation}"`);

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
           AND visibility != 'hidden'
         ORDER BY shot_date`,
        photoIdsParam
      );
      console.log(`[StorySummary] photoIds直查: ${directPhotos.length}/${photoIdsParam.length} 条可见`);
      result = directPhotos.length > 0 ? { photos: directPhotos, matchedLevel: 0 } : null;
    }

    // 否则走标准多级查找
    if (!result) {
      result = await findStoryPhotos(date, decodedLocation, { logTag: '[StorySummary]' });
    }

    if (!result || result.photos.length === 0) {
      const nearby = await query(
        `SELECT id, DATE(shot_date) as d, location, visibility FROM photos ORDER BY shot_date DESC LIMIT 5`
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
    });

    if (aiResult && typeof aiResult === 'object' && aiResult.success) {
      res.json({ summary: aiResult.data });
    } else if (aiResult && typeof aiResult === 'object' && !aiResult.success) {
      res.json({ summary: null, error: aiResult });
    } else {
      res.json({ summary: String(aiResult || '') });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
