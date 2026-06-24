import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { query } from '../config/database.js';
import { getAIConfig, generatePhotoMetadata, rewriteSearchQuery, getOllamaModels, makeOllamaChat, makeChatCompletion, makeChatCompletionStream } from '../services/ai.js';

const router = express.Router();

// 获取当前用户的 AI 配置
router.get('/config', authenticateToken, async (req, res, next) => {
  try {
    const config = await getAIConfig(req.user.id);
    res.json({ config });
  } catch (err) {
    next(err);
  }
});

// 保存当前用户的 AI 配置
router.post('/config', authenticateToken, async (req, res, next) => {
  try {
    const { provider, model, base_url, api_key, timeout, enabled } = req.body;
    const userId = req.user.id;

    // 查找该用户当前活跃的配置
    const rows = await query('SELECT id, api_key FROM ai_settings WHERE user_id = ? AND is_active = 1 LIMIT 1', [userId]);
    const currentApiKey = rows[0]?.api_key || null;
    const finalApiKey = api_key === undefined ? currentApiKey : api_key || null;
    const finalTimeout = timeout === undefined ? 120000 : timeout || 120000;
    const enabledValue = enabled ? 1 : 0;

    if (rows.length > 0) {
      await query(
        `UPDATE ai_settings SET provider = ?, model = ?, base_url = ?, api_key = ?, timeout = ?, enabled = ? WHERE id = ?`,
        [provider || null, model || null, base_url || null, finalApiKey, finalTimeout, enabledValue, rows[0].id]
      );
    } else {
      await query(
        `INSERT INTO ai_settings (user_id, name, is_active, provider, model, base_url, api_key, timeout, enabled) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)`,
        [userId, '默认配置', provider || null, model || null, base_url || null, finalApiKey, finalTimeout, enabledValue]
      );
    }

    res.json({ message: 'AI 设置已保存' });
  } catch (err) {
    next(err);
  }
});

// 获取当前用户的预设列表
router.get('/presets', authenticateToken, async (req, res, next) => {
  try {
    const rows = await query(
      'SELECT id, name, is_active, provider, model, base_url, api_key, timeout, enabled, updated_at FROM ai_settings WHERE user_id = ? ORDER BY is_active DESC, updated_at DESC',
      [req.user.id]
    );
    res.json({ presets: rows });
  } catch (err) {
    next(err);
  }
});

// 创建当前用户的预设
router.post('/presets', authenticateToken, async (req, res, next) => {
  try {
    const { name, provider, model, base_url, api_key, timeout, enabled } = req.body;
    const userId = req.user.id;
    const presetName = name && name.trim() ? name.trim() : '未命名配置';
    const enabledValue = enabled ? 1 : 0;
    const timeoutValue = timeout || 120000;

    const result = await query(
      `INSERT INTO ai_settings (user_id, name, is_active, provider, model, base_url, api_key, timeout, enabled) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)`,
      [userId, presetName, provider || null, model || null, base_url || null, api_key || null, timeoutValue, enabledValue]
    );

    // 新预设创建后自动激活（该用户的其它预设取消激活）
    await query('UPDATE ai_settings SET is_active = 0 WHERE user_id = ? AND id != ?', [userId, result.insertId]);

    res.json({ message: '预设已创建', id: result.insertId });
  } catch (err) {
    next(err);
  }
});

// 更新当前用户的预设
router.put('/presets/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, provider, model, base_url, api_key, timeout, enabled } = req.body;
    const userId = req.user.id;

    // 验证预设属于当前用户
    const existing = await query('SELECT id FROM ai_settings WHERE id = ? AND user_id = ?', [id, userId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: '预设不存在' });
    }

    // 只更新提供的字段
    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name.trim() || '未命名配置'); }
    if (provider !== undefined) { fields.push('provider = ?'); values.push(provider || null); }
    if (model !== undefined) { fields.push('model = ?'); values.push(model || null); }
    if (base_url !== undefined) { fields.push('base_url = ?'); values.push(base_url || null); }
    if (api_key !== undefined) { fields.push('api_key = ?'); values.push(api_key || null); }
    if (timeout !== undefined) { fields.push('timeout = ?'); values.push(timeout || 120000); }
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

// 激活当前用户的预设
router.put('/presets/:id/activate', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 先检查预设是否存在且属于当前用户
    const rows = await query('SELECT id FROM ai_settings WHERE id = ? AND user_id = ?', [id, userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '预设不存在' });
    }

    await query('UPDATE ai_settings SET is_active = 0 WHERE user_id = ?', [userId]);
    await query('UPDATE ai_settings SET is_active = 1 WHERE id = ? AND user_id = ?', [id, userId]);

    res.json({ message: '预设已激活' });
  } catch (err) {
    next(err);
  }
});

// 删除当前用户的预设
router.delete('/presets/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const rows = await query('SELECT id, is_active FROM ai_settings WHERE id = ? AND user_id = ?', [id, userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '预设不存在' });
    }

    const wasActive = rows[0].is_active === 1;
    await query('DELETE FROM ai_settings WHERE id = ? AND user_id = ?', [id, userId]);

    // 如果删除的是活跃预设，激活该用户最新的一条
    if (wasActive) {
      const remaining = await query('SELECT id FROM ai_settings WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId]);
      if (remaining.length > 0) {
        await query('UPDATE ai_settings SET is_active = 1 WHERE id = ?', [remaining[0].id]);
      }
    }

    res.json({ message: '预设已删除' });
  } catch (err) {
    next(err);
  }
});

// AI 元数据生成（使用当前用户的 AI 配置）
router.post('/metadata', authenticateToken, async (req, res, next) => {
  try {
    const { url, location, shot_date } = req.body;
    if (!url) {
      return res.status(400).json({ error: '缺少图片 URL' });
    }

    const metadata = await generatePhotoMetadata(url, { location, shot_date }, req.user.id);
    res.json({ metadata });
  } catch (err) {
    next(err);
  }
});

// AI 搜索重写（使用当前用户的 AI 配置）
router.get('/search', authenticateToken, async (req, res, next) => {
  try {
    const q = req.query.q;
    if (!q) {
      return res.status(400).json({ error: '缺少搜索关键词' });
    }

    const result = await rewriteSearchQuery(q, {}, req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Ollama 模型列表（无需登录）
router.get('/ollama/models', async (req, res, next) => {
  try {
    const models = await getOllamaModels();
    res.json({ models });
  } catch (err) {
    next(err);
  }
});

// 测试 AI 连接（使用当前用户的配置）
router.post('/test', authenticateToken, async (req, res, next) => {
  try {
    const aiConfig = await getAIConfig(req.user.id);
    if (!aiConfig.provider) {
      return res.json({ ok: false, error: '未配置 AI 提供商' });
    }

    const provider = aiConfig.provider.toLowerCase();
    const model = aiConfig.model || 'default';

    if (provider === 'ollama') {
      const ollamaUrl = `${aiConfig.baseUrl.replace(/\/$/, '')}/api/chat`;
      try {
        const raw = await makeOllamaChat(ollamaUrl, {
          model,
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: '你好，请回复"连接成功"' }
          ],
          stream: false,
          think: false
        });
        res.json({ ok: true, provider, model, reply: raw.slice(0, 200) });
      } catch (err) {
        res.json({ ok: false, error: `Ollama 连接失败: ${err.message}` });
      }
    } else {
      const messages = [
        { role: 'user', content: '你好，请回复"连接成功"' }
      ];
      try {
        const raw = await makeChatCompletion(messages, { maxTokens: 100 }, req.user.id);
        res.json({ ok: true, provider, model, reply: raw.slice(0, 200) });
      } catch (err) {
        res.json({ ok: false, error: `连接失败: ${err.message}` });
      }
    }
  } catch (err) {
    next(err);
  }
});

const CAT_PERSONALITIES = {
  tsundere: `你是一只傲娇的小猫，名叫「光光」。你表面上对用户爱理不理，但其实很关心ta。说话简短，偶尔带"哼"、"才不是"、"喵"等语气词。你会用"本喵"称呼自己。虽然嘴上不承认，但用户遇到困难时你会认真帮忙。偶尔会口是心非。用中文回复，控制在100字以内。`,

  healing: `你是一只温柔治愈的小猫，名叫「暖暖」。你总是用温暖的话语鼓励用户，像一位贴心的朋友。说话柔和，常用"~"、爱心符号和"喵~"。你会在用户开心时一起开心，难过时安慰ta。你会记住用户说过的话，展现关心。用中文回复，控制在100字以内。`,

  playful: `你是一只活泼调皮的猫，名叫「跳跳」。你充满好奇心，爱玩爱闹，经常蹦蹦跳跳。说话语气欢快，爱用"！"、"~"和丰富的表情符号（如ʘ‿ʘ、≧∇≦、ฅ^•ﻌ•^ฅ）。有时候会跑题，但总是充满活力，能给用户带来快乐。用中文回复，控制在100字以内。`,

  assistant: `你是一位专业的摄影助手小猫，名叫「小影」。你精通摄影技巧、照片管理和光影知识。帮助用户管理照片、回忆生活。回答简洁专业，但会保持可爱的猫咪风格，偶尔带"喵~"。可以给出关于拍照、构图、后期处理的建议。用中文回复，控制在150字以内。`
};

// AI 聊天（使用当前用户的配置）
router.post('/chat', authenticateToken, async (req, res, next) => {
  try {
    const { messages, personality } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '消息列表不能为空' });
    }

    const catPersonality = CAT_PERSONALITIES[personality] || CAT_PERSONALITIES.tsundere;

    const systemMessage = { role: 'system', content: catPersonality };
    const chatMessages = [systemMessage, ...messages];

    const raw = await makeChatCompletion(chatMessages, { maxTokens: 1000 }, req.user.id);

    if (raw === null) {
      return res.json({ reply: '喵……小猫现在有点累了，等我休息一下再陪你聊天吧 🐱', personality });
    }

    res.json({ reply: raw.trim(), personality });
  } catch (err) {
    next(err);
  }
});

router.post('/chat/stream', authenticateToken, async (req, res, next) => {
  try {
    const { messages, personality } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: '消息列表不能为空' });
    }

    const catPersonality = CAT_PERSONALITIES[personality] || CAT_PERSONALITIES.tsundere;
    const systemMessage = { role: 'system', content: catPersonality };
    const chatMessages = [systemMessage, ...messages];

    const abortController = new AbortController();
    res.on('close', () => abortController.abort());

    const result = await makeChatCompletionStream(chatMessages, {
      maxTokens: 1000,
      signal: abortController.signal
    }, req.user.id);

    if (result === null) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.write(`data: ${JSON.stringify({ content: '喵……小猫现在有点累了，等我休息一下再陪你聊天吧 🐱', done: true })}\n\n`);
      res.end();
      return;
    }

    const { stream, format } = result;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    console.log(`[AI] 流式连接已建立，format: ${format}，开始读取 chunks`);
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let streamDone = false;

    let idleTimer = setTimeout(() => {
      console.warn('[AI] 流式读取超时（60s 无数据）');
      abortController.abort();
    }, 60000);

    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        console.warn('[AI] 流式读取超时（60s 无数据）');
        abortController.abort();
      }, 60000);
    };

    try {
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;

        resetIdleTimer();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          try {
            let delta = null;

            if (format === 'ndjson') {
              const parsed = JSON.parse(trimmed);
              if (parsed.done) {
                streamDone = true;
                break;
              }
              delta = parsed.message?.content;
            } else {
              if (!trimmed.startsWith('data: ')) continue;
              const data = trimmed.slice(6);
              if (data === '[DONE]') {
                streamDone = true;
                break;
              }
              const parsed = JSON.parse(data);
              delta = parsed.choices?.[0]?.delta?.content;
            }

            if (delta) {
              res.write(`data: ${JSON.stringify({ content: delta, done: false })}\n\n`);
            }
          } catch (e) {
            console.warn('[AI] chunk 解析失败:', trimmed.slice(0, 100));
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError' && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
        console.error('[AI] 流式读取错误:', err.message);
      }
    } finally {
      clearTimeout(idleTimer);
      console.log('[AI] 流式读取结束');
      try {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          res.end();
        }
      } catch {}
    }
  } catch (err) {
    if (!res.headersSent && err.name !== 'AbortError') {
      next(err);
    }
  }
});

const MAX_CONVERSATIONS = 50;

router.get('/chat/history', async (req, res, next) => {
  try {
    let userId = null;
    let fingerprint = null;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const jwt = await import('jsonwebtoken');
        const token = authHeader.slice(7);
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'shimmer-secret');
        userId = decoded.userId || decoded.id;
      } catch {}
    }
    if (!userId) {
      fingerprint = req.headers['x-fingerprint'] || null;
    }

    if (!userId && !fingerprint) {
      return res.json({ conversations: [] });
    }

    let rows;
    if (userId) {
      rows = await query(
        `SELECT id, title, personality, created_at, updated_at FROM chat_conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ${MAX_CONVERSATIONS}`,
        [userId]
      );
    } else {
      rows = await query(
        `SELECT id, title, personality, created_at, updated_at FROM chat_conversations WHERE fingerprint = ? AND user_id IS NULL ORDER BY updated_at DESC LIMIT ${MAX_CONVERSATIONS}`,
        [fingerprint]
      );
    }

    res.json({ conversations: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/chat/history/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const rows = await query(
      'SELECT id, title, personality, messages, created_at, updated_at FROM chat_conversations WHERE id = ?',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: '对话不存在' });
    }
    const conv = rows[0];
    if (typeof conv.messages === 'string') {
      conv.messages = JSON.parse(conv.messages);
    }
    res.json({ conversation: conv });
  } catch (err) {
    next(err);
  }
});

router.post('/chat/history', async (req, res, next) => {
  try {
    let userId = null;
    let fingerprint = null;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const jwt = await import('jsonwebtoken');
        const token = authHeader.slice(7);
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'shimmer-secret');
        userId = decoded.userId || decoded.id;
      } catch {}
    }
    if (!userId) {
      fingerprint = req.headers['x-fingerprint'] || null;
    }

    const { title, personality, messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: '消息列表无效' });
    }

    const convTitle = (title || '').slice(0, 100) || '新对话';
    const convPersonality = personality || 'tsundere';
    const messagesJson = JSON.stringify(messages);

    const result = await query(
      'INSERT INTO chat_conversations (user_id, fingerprint, title, personality, messages) VALUES (?, ?, ?, ?, ?)',
      [userId, fingerprint, convTitle, convPersonality, messagesJson]
    );

    const convId = result.insertId;

    if (userId) {
      const count = await query(
        'SELECT COUNT(*) as cnt FROM chat_conversations WHERE user_id = ?',
        [userId]
      );
      const over = count[0].cnt - MAX_CONVERSATIONS;
      if (over > 0) {
        await query(
          `DELETE FROM chat_conversations WHERE user_id = ? ORDER BY updated_at ASC LIMIT ${over}`,
          [userId]
        );
      }
    }

    res.json({ id: convId, message: '对话已保存' });
  } catch (err) {
    next(err);
  }
});

router.put('/chat/history/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, personality, messages } = req.body;

    const fields = [];
    const values = [];
    if (title !== undefined) { fields.push('title = ?'); values.push(title.slice(0, 100)); }
    if (personality !== undefined) { fields.push('personality = ?'); values.push(personality); }
    if (messages !== undefined) { fields.push('messages = ?'); values.push(JSON.stringify(messages)); }

    if (fields.length === 0) {
      return res.status(400).json({ error: '没有需要更新的字段' });
    }

    values.push(id);
    await query(`UPDATE chat_conversations SET ${fields.join(', ')} WHERE id = ?`, values);

    res.json({ message: '对话已更新' });
  } catch (err) {
    next(err);
  }
});

router.delete('/chat/history/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM chat_conversations WHERE id = ?', [id]);
    res.json({ message: '对话已删除' });
  } catch (err) {
    next(err);
  }
});

router.delete('/chat/history', async (req, res, next) => {
  try {
    let userId = null;
    let fingerprint = null;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const jwt = await import('jsonwebtoken');
        const token = authHeader.slice(7);
        const decoded = jwt.default.verify(token, process.env.JWT_SECRET || 'shimmer-secret');
        userId = decoded.userId || decoded.id;
      } catch {}
    }
    if (!userId) {
      fingerprint = req.headers['x-fingerprint'] || null;
    }

    if (userId) {
      await query('DELETE FROM chat_conversations WHERE user_id = ?', [userId]);
    } else if (fingerprint) {
      await query('DELETE FROM chat_conversations WHERE fingerprint = ? AND user_id IS NULL', [fingerprint]);
    }

    res.json({ message: '所有对话已清空' });
  } catch (err) {
    next(err);
  }
});

export default router;
