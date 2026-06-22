  import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';

export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const users = await query('SELECT id, username, nickname, avatar, role, bio FROM users WHERE id = ?', [decoded.userId]);

    if (users.length === 0) {
      return res.status(401).json({ error: '用户不存在' });
    }

    req.user = users[0];
    next();
  } catch (err) {
    return res.status(403).json({ error: '令牌无效或已过期' });
  }
};

export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const users = await query('SELECT id, username, nickname, avatar, role, bio FROM users WHERE id = ?', [decoded.userId]);
    req.user = users.length > 0 ? users[0] : null;
  } catch (err) {
    req.user = null;
  }

  next();
};

// 角色检查中间件 - 需要是管理员
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: '请先登录' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
};

// 隐藏相册访问验证中间件
export const verifyHiddenAlbum = async (req, res, next) => {
  // 必须先通过 authenticateToken
  if (!req.user) {
    return res.status(401).json({ error: '请先登录' });
  }

  // 支持 header 或 query parameter 传递 hidden token
  const hiddenToken = req.headers['hidden-album-token'] || req.query.hidden_token;

  if (!hiddenToken) {
    return res.status(403).json({ error: '请先验证隐藏相册密码', requiresPassword: true });
  }

  try {
    const decoded = jwt.verify(hiddenToken, process.env.JWT_SECRET);

    // 验证 token 类型和用户匹配
    if (decoded.type !== 'hidden_album' || decoded.userId !== req.user.id) {
      return res.status(403).json({ error: '验证令牌无效', requiresPassword: true });
    }

    next();
  } catch (err) {
    return res.status(403).json({ error: '验证令牌已过期，请重新验证', requiresPassword: true });
  }
};
