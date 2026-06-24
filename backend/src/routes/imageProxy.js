import express from 'express';

const router = express.Router();

const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

function isAllowedOrigin(url) {
  try {
    const parsed = new URL(url);
    if (R2_PUBLIC_URL) {
      const r2Host = new URL(R2_PUBLIC_URL).hostname;
      return parsed.hostname === r2Host;
    }
    return parsed.hostname.endsWith('.r2.dev');
  } catch {
    return false;
  }
}

router.get('/image-proxy', async (req, res) => {
  const { url } = req.query;

  if (!url || !isAllowedOrigin(url)) {
    return res.status(400).json({ error: '无效的图片地址' });
  }

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      return res.status(resp.status).json({ error: '图片获取失败' });
    }

    const contentType = resp.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const buffer = Buffer.from(await resp.arrayBuffer());
    res.send(buffer);
  } catch (err) {
    console.error('[ImageProxy] Error:', err.message);
    res.status(502).json({ error: '图片代理请求失败' });
  }
});

export default router;
