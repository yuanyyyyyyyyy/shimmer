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
    const rows = await query('SELECT id, api_key FROM ai_settings WHERE is_active = 1 LIMIT 1');
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
        `INSERT INTO ai_settings (name, is_active, provider, model, base_url, api_key, enabled) VALUES (?, 1, ?, ?, ?, ?, ?)`,
        ['默认配置', provider || null, model || null, base_url || null, finalApiKey, enabledValue]
      );
    }

    res.json({ message: 'AI 设置已保存' });
  } catch (err) {
    next(err);
  }
});

// 预设管理
router.get('/presets', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const rows = await query(
      'SELECT id, name, is_active, provider, model, base_url, api_key, enabled, updated_at FROM ai_settings ORDER BY is_active DESC, updated_at DESC'
    );
    res.json({ presets: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/presets', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { name, provider, model, base_url, api_key, enabled } = req.body;
    const presetName = name && name.trim() ? name.trim() : '未命名配置';
    const enabledValue = enabled ? 1 : 0;

    const result = await query(
      `INSERT INTO ai_settings (name, is_active, provider, model, base_url, api_key, enabled) VALUES (?, 1, ?, ?, ?, ?, ?)`,
      [presetName, provider || null, model || null, base_url || null, api_key || null, enabledValue]
    );

    // 新预设创建后自动激活（其它预设取消激活）
    await query('UPDATE ai_settings SET is_active = 0 WHERE id != ?', [result.insertId]);

    res.json({ message: '预设已创建', id: result.insertId });
  } catch (err) {
    next(err);
  }
});

router.put('/presets/:id', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, provider, model, base_url, api_key, enabled } = req.body;

    // 只更新提供的字段
    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name.trim() || '未命名配置'); }
    if (provider !== undefined) { fields.push('provider = ?'); values.push(provider || null); }
    if (model !== undefined) { fields.push('model = ?'); values.push(model || null); }
    if (base_url !== undefined) { fields.push('base_url = ?'); values.push(base_url || null); }
    if (api_key !== undefined) { fields.push('api_key = ?'); values.push(api_key || null); }
    if (enabled !== undefined) { fields.push('enabled = ?'); values.push(enabled ? 1 : 0); }

    if (fields.length === 0) {
      return res.status(400).json({ error: '没有提供需要更新的字段' });
    }

    values.push(id);
    await query(`UPDATE ai_settings SET ${fields.join(', ')} WHERE id = ?`, values);

    res.json({ message: '预设已更新' });
  } catch (err) {
    next(err);
  }
});

router.put('/presets/:id/activate', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    // 先检查预设是否存在
    const rows = await query('SELECT id FROM ai_settings WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '预设不存在' });
    }

    await query('UPDATE ai_settings SET is_active = 0');
    await query('UPDATE ai_settings SET is_active = 1 WHERE id = ?', [id]);

    res.json({ message: '预设已激活' });
  } catch (err) {
    next(err);
  }
});

router.delete('/presets/:id', authenticateToken, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;

    const rows = await query('SELECT id, is_active FROM ai_settings WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '预设不存在' });
    }

    const wasActive = rows[0].is_active === 1;
    await query('DELETE FROM ai_settings WHERE id = ?', [id]);

    // 如果删除的是活跃预设，激活最新的一条
    if (wasActive) {
      const remaining = await query('SELECT id FROM ai_settings ORDER BY id DESC LIMIT 1');
      if (remaining.length > 0) {
        await query('UPDATE ai_settings SET is_active = 1 WHERE id = ?', [remaining[0].id]);
      }
    }

    res.json({ message: '预设已删除' });
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
