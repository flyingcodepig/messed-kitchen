import jwt from 'jsonwebtoken';
import { db } from './db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
export const APP_URL = process.env.APP_URL || 'http://localhost:5173';

export function fail(res, code, msg) {
  return res.status(code).json({ error: msg });
}

export function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return fail(res, 401, '请先登录');
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, email, nickname, avatar, points, verified FROM users WHERE id = ?').get(payload.id);
    if (!user) return fail(res, 401, '账号不存在');
    if (!user.verified) return fail(res, 403, '邮箱尚未验证');
    req.user = user;
    next();
  } catch {
    return fail(res, 401, '登录已过期，请重新登录');
  }
}

export function isMember(kitchenId, userId) {
  return Boolean(
    db.prepare('SELECT 1 FROM memberships WHERE kitchen_id = ? AND user_id = ?').get(kitchenId, userId)
  );
}

export function memberEmails(kitchenId, excludeUserId = null) {
  return db
    .prepare(
      `SELECT u.email FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.kitchen_id = ? AND u.verified = 1 AND u.id != ?`
    )
    .all(kitchenId, excludeUserId ?? -1)
    .map((r) => r.email);
}

export function getEventOrFail(eventId, res) {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!event) {
    fail(res, 404, '约饭不存在');
    return null;
  }
  return event;
}