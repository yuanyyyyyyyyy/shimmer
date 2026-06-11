import dotenv from 'dotenv';
import { query } from '../config/database.js';

dotenv.config();

const AI_PROVIDER = process.env.AI_PROVIDER || '';
const AI_MODEL = process.env.AI_MODEL || 'llama2';
const AI_BASE_URL = process.env.AI_BASE_URL || (AI_PROVIDER === 'ollama' ? 'http://127.0.0.1:11434' : 'https://api.openai.com');
const AI_API_KEY = process.env.AI_API_KEY || '';
const AI_TIMEOUT = Number(process.env.AI_TIMEOUT || 10000);

const DEFAULT_AI_CONFIG = {
  enabled: Boolean(AI_PROVIDER),
  provider: AI_PROVIDER || null,
  model: AI_MODEL,
  baseUrl: AI_BASE_URL,
  apiKey: AI_API_KEY,
  timeout: AI_TIMEOUT
};

async function loadAiSettings() {
  try {
    let rows = await query(
      'SELECT provider, model, base_url, api_key, enabled FROM ai_settings WHERE is_active = 1 LIMIT 1'
    );

    // 无活跃预设时回退到最新一条
    if (rows.length === 0) {
      rows = await query(
        'SELECT provider, model, base_url, api_key, enabled FROM ai_settings ORDER BY id DESC LIMIT 1'
      );
    }

    if (rows.length === 0) {
      return { ...DEFAULT_AI_CONFIG };
    }

    const row = rows[0];
    return {
      enabled: row.enabled === 1,
      provider: row.provider || DEFAULT_AI_CONFIG.provider,
      model: row.model || DEFAULT_AI_CONFIG.model,
      baseUrl: row.base_url || DEFAULT_AI_CONFIG.baseUrl,
      apiKey: row.api_key || DEFAULT_AI_CONFIG.apiKey,
      timeout: DEFAULT_AI_CONFIG.timeout
    };
  } catch (err) {
    console.error('[AI] loadAiSettings error:', err.message || err);
    return { ...DEFAULT_AI_CONFIG };
  }
}

async function getAIConfig() {
  return await loadAiSettings();
}

function safeParseJSON(text) {
  if (!text || typeof text !== 'string') return null;
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first === -1 || last === -1) return null;
  const maybeJson = text.slice(first, last + 1);
  try {
    return JSON.parse(maybeJson);
  } catch (err) {
    try {
      return JSON.parse(text);
    } catch (error) {
      return null;
    }
  }
}

async function makeChatCompletion(messages, options = {}) {
  const aiConfig = await loadAiSettings();
  if (!aiConfig.enabled || !aiConfig.provider) {
    return null;
  }

  const provider = aiConfig.provider.toLowerCase();
  const model = options.model || aiConfig.model;
  const headers = {
    'Content-Type': 'application/json'
  };
  if (aiConfig.apiKey) {
    headers.Authorization = `Bearer ${aiConfig.apiKey}`;
  }

  let url;
  let body;

  if (provider === 'ollama') {
    url = `${aiConfig.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
    body = {
      model,
      messages,
      temperature: options.temperature ?? 0.8,
      max_tokens: options.maxTokens ?? 400
    };
  } else if (provider === 'zhipu') {
    // 智谱AI：使用 /chat/completions（不带 /v1）
    // 正确地址：https://open.bigmodel.cn/api/paas/v4/chat/completions
    url = `${aiConfig.baseUrl.replace(/\/$/, '')}/chat/completions`;
    body = {
      model,
      messages,
      temperature: options.temperature ?? 0.8,
      max_tokens: options.maxTokens ?? 400
    };
  } else {
    // 其他 OpenAI 兼容的 provider：使用标准 /v1/chat/completions
    url = `${aiConfig.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
    body = {
      model,
      messages,
      temperature: options.temperature ?? 0.8,
      max_tokens: options.maxTokens ?? 400
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), aiConfig.timeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error?.message || `AI 请求失败: ${response.status}`);
    }

    const choice = result.choices?.[0];
    if (!choice) {
      throw new Error('AI 返回内容空');
    }

    return choice.message?.content || choice.text || '';
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getOllamaModels() {
  const aiConfig = await loadAiSettings();
  if (aiConfig.provider?.toLowerCase() !== 'ollama') {
    return [];
  }

  const url = `${aiConfig.baseUrl.replace(/\/$/, '')}/v1/models`;
  try {
    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`Ollama 模型列表请求失败: ${response.status}`);
    }
    const models = await response.json();
    if (!Array.isArray(models)) return [];
    return models.map(model => ({ name: model.name, displayName: model.name }));
  } catch (error) {
    console.error('[AI] getOllamaModels error:', error.message || error);
    return [];
  }
}

async function generatePhotoMetadata(photoUrl, options = {}) {
  const aiConfig = await loadAiSettings();
  if (!aiConfig.enabled || !aiConfig.provider) {
    return { title: '', mood: '', tags: [] };
  }

  const prompt = `你是一个中文照片日记助手。根据下面的照片信息，生成一个精炼的中文标题、一句心情文字和 3 到 5 个标签。

请仅返回一个合法 JSON 对象，格式如下：
{
  "title": "...",
  "mood": "...",
  "tags": ["...", "...", "..."]
}

不要添加额外的说明文字，也不要输出 markdown。`;

  // 构建多模态消息内容（支持图片理解）
  const content = [
    { type: 'text', text: '请分析这张照片，生成标题、心情和标签' },
    { type: 'image_url', image_url: { url: photoUrl } }
  ];

  // 追加附加信息到文本部分
  let textParts = [];
  if (options.location) textParts.push(`拍摄地点: ${options.location}`);
  if (options.shot_date) textParts.push(`拍摄日期: ${options.shot_date}`);
  if (options.title) textParts.push(`已有标题: ${options.title}`);
  if (options.mood) textParts.push(`已有心情: ${options.mood}`);

  if (textParts.length > 0) {
    content[0].text += '\n\n附加信息:\n' + textParts.join('\n');
  }

  const messages = [
    { role: 'system', content: prompt },
    { role: 'user', content }  // content 现在是数组格式（多模态）
  ];

  try {
    const raw = await makeChatCompletion(messages, { maxTokens: 250 });
    const parsed = safeParseJSON(raw);
    if (!parsed) {
      return { title: '', mood: '', tags: [] };
    }

    return {
      title: parsed.title || '',
      mood: parsed.mood || '',
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(tag => String(tag).trim()).filter(Boolean) : []
    };
  } catch (error) {
    console.error('[AI] generatePhotoMetadata error:', error.message || error);
    return { title: '', mood: '', tags: [] };
  }
}

async function summarizeReview(reviewStats = {}, options = {}) {
  const aiConfig = await loadAiSettings();

  // 检查 AI 是否启用
  if (!aiConfig.enabled || !aiConfig.provider) {
    console.warn('[AI] summarizeReview: AI 未启用或未配置 provider');
    return { success: false, error: 'AI_NOT_ENABLED', message: 'AI 功能未启用' };
  }

  // 检查 API Key（智谱等云服务需要）
  if (aiConfig.provider !== 'ollama' && !aiConfig.apiKey) {
    console.warn('[AI] summarizeReview: 未配置 API Key');
    return { success: false, error: 'NO_API_KEY', message: '未配置 API Key，请在设置中填写' };
  }

  const summaryPrompt = `你是一个中文摄影回顾助手。根据下面的年度统计数据，写一段简短而有温度的年度回顾文字。

请仅返回纯文本，不要输出 JSON 或其他结构化数据。`;

  let content = `年度统计数据：\n`;
  if (reviewStats.totalPhotos != null) content += `总照片数：${reviewStats.totalPhotos}\n`;
  if (reviewStats.totalSize != null) content += `存储空间：${reviewStats.totalSize} KB\n`;
  if (Array.isArray(reviewStats.topTags) && reviewStats.topTags.length > 0) {
    content += `热门标签：${reviewStats.topTags.map(t => `${t.name}(${t.count})`).join('，')}\n`;
  }
  if (Array.isArray(reviewStats.topLocations) && reviewStats.topLocations.length > 0) {
    content += `热门地点：${reviewStats.topLocations.map(l => `${l.location}(${l.count})`).join('，')}\n`;
  }
  if (reviewStats.firstPhoto) content += `首张照片日期：${reviewStats.firstPhoto}\n`;
  if (reviewStats.lastPhoto) content += `最后一张照片日期：${reviewStats.lastPhoto}\n`;
  if (reviewStats.photosWithGps != null) content += `带定位照片：${reviewStats.photosWithGps}\n`;

  const messages = [
    { role: 'system', content: summaryPrompt },
    { role: 'user', content }
  ];

  try {
    console.log(`[AI] summarizeReview: 开始生成回顾 (provider=${aiConfig.provider}, model=${aiConfig.model})`);
    const raw = await makeChatCompletion(messages, { maxTokens: 250 });
    const result = String(raw).trim();

    if (!result || result.length === 0) {
      return { success: false, error: 'EMPTY_RESPONSE', message: 'AI 返回内容为空' };
    }

    console.log(`[AI] summarizeReview: 生成成功 (${result.length} 字符)`);
    return { success: true, data: result };
  } catch (error) {
    const errorMsg = error.message || error;
    console.error('[AI] summarizeReview error:', errorMsg);

    // 解析具体错误类型
    let errorType = 'UNKNOWN_ERROR';
    let userMessage = 'AI 生成失败';

    if (errorMsg.includes('401') || errorMsg.includes('invalid_api_key')) {
      errorType = 'INVALID_API_KEY';
      userMessage = 'API Key 无效或已过期，请检查设置中的 API Key';
    } else if (errorMsg.includes('model') && (errorMsg.includes('not exist') || errorMsg.includes('does not exist') || errorMsg.includes('invalid_model'))) {
      errorType = 'INVALID_MODEL';
      userMessage = `模型 "${aiConfig.model}" 不存在，请检查设置中的模型名称（推荐：glm-4-flash）`;
    } else if (errorMsg.includes('timeout') || errorMsg.includes('abort') || errorMsg.includes('Timeout')) {
      errorType = 'TIMEOUT';
      userMessage = '请求超时，AI 服务响应时间过长，请稍后重试';
    } else if (errorMsg.includes('network') || errorMsg.includes('fetch') || errorMsg.includes('ECONNREFUSED')) {
      errorType = 'NETWORK_ERROR';
      userMessage = '网络连接失败，请检查网络或 AI 服务是否正常运行';
    } else if (errorMsg.includes('rate_limit') || errorMsg.includes('429')) {
      errorType = 'RATE_LIMIT';
      userMessage = '请求过于频繁，请稍后重试';
    }

    return { success: false, error: errorType, message: userMessage, detail: errorMsg };
  }
}

async function rewriteSearchQuery(query, options = {}) {
  const aiConfig = await loadAiSettings();
  if (!aiConfig.enabled || !aiConfig.provider) {
    return { keywords: [], tags: [] };
  }

  const prompt = `你是一个中文照片搜索助手。将用户的搜索词转换为可用于照片搜索的关键词和标签建议。

请仅返回一个合法 JSON 对象，格式如下：
{
  "keywords": ["...", "..."],
  "tags": ["...", "..."]
}

不要输出解释性文字。`;

  const messages = [
    { role: 'system', content: prompt },
    { role: 'user', content: `用户搜索词：${query}` }
  ];

  try {
    const raw = await makeChatCompletion(messages, { maxTokens: 200 });
    const parsed = safeParseJSON(raw);
    if (!parsed) {
      return { keywords: [], tags: [] };
    }

    return {
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(k => String(k).trim()).filter(Boolean) : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(t => String(t).trim()).filter(Boolean) : []
    };
  } catch (error) {
    console.error('[AI] rewriteSearchQuery error:', error.message || error);
    return { keywords: [], tags: [] };
  }
}

async function generateStorySummary(storyData = {}, options = {}) {
  const aiConfig = await loadAiSettings();

  if (!aiConfig.enabled || !aiConfig.provider) {
    return { success: false, error: 'AI_NOT_ENABLED', message: 'AI 功能未启用' };
  }

  if (aiConfig.provider !== 'ollama' && !aiConfig.apiKey) {
    return { success: false, error: 'NO_API_KEY', message: '未配置 API Key' };
  }

  const { date, location, photos } = storyData;
  const photoList = (photos || []).map((p, i) => `${i + 1}. ${p.title || '无标题'}${p.mood ? `（${p.mood}）` : ''}`).join('\n');

  const prompt = `你是一个中文光影叙事助手。根据下面同一天同一地点拍摄的一组照片信息，写一段温暖、有画面感的叙事摘要（80-150字）。

要求：
- 用第一人称或第三人称叙述，营造故事感
- 提及照片中的心情变化（如果有）
- 语言优美但不矫情，像在讲述一段美好回忆
- 仅返回纯文本，不要输出 JSON 或 markdown`;

  const content = `日期：${date || '未知'}\n地点：${location || '未知地点'}\n\n照片列表：\n${photoList}\n\n共 ${photos?.length || 0} 张照片`;

  const messages = [
    { role: 'system', content: prompt },
    { role: 'user', content }
  ];

  try {
    console.log(`[AI] generateStorySummary: 开始生成 (${date} @ ${location})`);
    const raw = await makeChatCompletion(messages, { maxTokens: 300 });
    const result = String(raw).trim();

    if (!result || result.length === 0) {
      return { success: false, error: 'EMPTY_RESPONSE', message: 'AI 返回内容为空' };
    }

    console.log(`[AI] generateStorySummary: 生成成功 (${result.length} 字符)`);
    return { success: true, data: result };
  } catch (error) {
    const errorMsg = error.message || error;
    console.error('[AI] generateStorySummary error:', errorMsg);

    let errorType = 'UNKNOWN_ERROR';
    let userMessage = 'AI 叙事生成失败';

    if (errorMsg.includes('401') || errorMsg.includes('invalid_api_key')) {
      errorType = 'INVALID_API_KEY';
      userMessage = 'API Key 无效或已过期';
    } else if (errorMsg.includes('timeout') || errorMsg.includes('abort')) {
      errorType = 'TIMEOUT';
      userMessage = '请求超时，请稍后重试';
    } else if (errorMsg.includes('network') || errorMsg.includes('ECONNREFUSED')) {
      errorType = 'NETWORK_ERROR';
      userMessage = '网络连接失败';
    } else if (errorMsg.includes('rate_limit') || errorMsg.includes('429')) {
      errorType = 'RATE_LIMIT';
      userMessage = '请求过于频繁';
    }

    return { success: false, error: errorType, message: userMessage, detail: errorMsg };
  }
}

// AI 生成分享卡片文案
async function generateShareCaption(photos = [], options = {}) {
  const aiConfig = await loadAiSettings();

  if (!aiConfig.enabled || !aiConfig.provider) {
    return { success: false, error: 'AI_NOT_ENABLED', message: 'AI 未启用' };
  }

  const template = options.template || 'cinematic';
  const photoList = (photos || []).map(p => p.title || '一张美好的瞬间').join('、');

  const styleMap = {
    cinematic: '电影海报风格：一句有电影感的文案，简短有力，像电影台词',
    calendar: '日历风格：一句关于时光流逝的感慨',
    magazine: '杂志风格：文艺清新，适合小红书/朋友圈分享',
    collage: '拼图风：活泼有趣，适合日常记录'
  };

  const prompt = `你是一个中文文案创作助手。为用户的一组照片创作一段精美的分享文案。\n\n风格要求：${styleMap[template] || styleMap.cinematic}\n\n要求：仅返回纯文本文案，20-50字，不要输出 JSON 或其他格式。`;

  const messages = [
    { role: 'system', content: prompt },
    { role: 'user', content: `这组照片包含：${photoList}` }
  ];

  try {
    const raw = await makeChatCompletion(messages, { maxTokens: 100 });
    const result = String(raw).trim();
    if (!result) return { success: false, error: 'EMPTY_RESPONSE', message: '返回内容为空' };
    return { success: true, data: result };
  } catch (error) {
    console.error('[AI] generateShareCaption error:', error.message);
    return { success: false, error: 'GENERATE_FAILED', message: '文案生成失败' };
  }
}

export {
  getAIConfig,
  getOllamaModels,
  generatePhotoMetadata,
  summarizeReview,
  rewriteSearchQuery,
  generateStorySummary,
  generateShareCaption
};
