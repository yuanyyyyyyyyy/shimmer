import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { getAIConfig, generatePhotoMetadata, rewriteSearchQuery, getOllamaModels } from '../services/ai.js';

const router = express.Router();

router.get('/config', async (req, res, next) => {
  try {
    const config = await getAIConfig();
    res.json({ config });
  } catch (err) {
    next(err);
  }
});

router.post('/config', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { provider, model, base_url, api_key, enabled } = req.body;
    const rows = await query('SELECT id, api_key FROM ai_settings ORDER BY id DESC LIMIT 1');
    const currentApiKey = rows[0]?.api_key || null;
    const finalApiKey = api_key === undefined ? currentApiKey : api_key || null;
    const enabledValue = enabled ? 1 : 0;

    if (rows.length > 0) {
      await query(
        `UPDATE ai_settings SET provider = ?, model = ?, base_url = ?, api_key = ?, enabled = ? WHERE id = ?`,
        [provider || null, model || null, base_url || null, finalApiKey, enabledValue, rows[0].id]
      );
    } else {
      await query(
        `INSERT INTO ai_settings (provider, model, base_url, api_key, enabled) VALUES (?, ?, ?, ?, ?)`,
        [provider || null, model || null, base_url || null, finalApiKey, enabledValue]
      );
    }

    res.json({ message: 'AI 设置已保存' });
  } catch (err) {
    next(err);
  }
});

router.post('/metadata', async (req, res, next) => {
  try {
    const { url, location, shot_date } = req.body;
    if (!url) {
      return res.status(400).json({ error: '缺少图片 URL' });
    }

    const metadata = await generatePhotoMetadata(url, { location, shot_date });
    res.json({ metadata });
  } catch (err) {
    next(err);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const q = req.query.q;
    if (!q) {
      return res.status(400).json({ error: '缺少搜索关键词' });
    }

    const result = await rewriteSearchQuery(q);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/ollama/models', async (req, res, next) => {
  try {
    const models = await getOllamaModels();
    res.json({ models });
  } catch (err) {
    next(err);
  }
});

export default router;
