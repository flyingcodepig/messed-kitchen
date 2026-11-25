import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { db, DEFAULT_AVATARS } from '../db.js';
import { sendMail, mailEnabled } from '../mailer.js';
import { auth, fail, wrap, JWT_SECRET, APP_URL } from '../util.js';

const router = Router();

router.post(
  '/register',
  wrap(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const nickname = String(req.body.nickname || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(res, 400, '邮箱格式不正确');
    if (password.length < 6) return fail(res, 400, '密码至少 6 位');
    if (!nickname) return fail(res, 400, '请填写昵称');

    const token = randomBytes(24).toString('hex');
    const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (existing && existing.verified) return fail(res, 409, '该邮箱已注册，请直接登录');
    if (existing) {
      db.prepare('UPDATE users SET password_hash = ?, nickname = ?, verify_token = ? WHERE id = ?').run(
        bcrypt.hashSync(password, 10),
        nickname,
        token,
        existing.id
      );
    } else {
      db.prepare(
        'INSERT INTO users (email, password_hash, nickname, avatar, verify_token) VALUES (?, ?, ?, ?, ?)'
      ).run(
        email,
        bcrypt.hashSync(password, 10),
        nickname,
        DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)],
        token
      );
    }

    const verifyUrl = `${APP_URL}/verify?token=${token}`;
    await sendMail(
      email,
      '【胡闹厨房】验证你的邮箱',
      `<p>你好，${nickname}！</p><p>点击链接完成注册：<a href="${verifyUrl}">${verifyUrl}</a></p>`
    );
    res.json({ ok: true, devVerifyUrl: mailEnabled ? undefined : verifyUrl });
  })
);

router.get('/verify', (req, res) => {
  const token = String(req.query.token || '');
  const user = db.prepare('SELECT id FROM users WHERE verify_token = ? AND verified = 0').get(token);
  if (!user) return fail(res, 400, '验证链接无效或已使用');
  db.prepare('UPDATE users SET verified = 1, verify_token = NULL WHERE id = ?').run(user.id);
  res.json({ ok: true });
});

router.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(String(req.body.password || ''), user.password_hash))
    return fail(res, 400, '邮箱或密码错误');
  if (!user.verified) return fail(res, 403, '邮箱尚未验证，请先查收验证邮件');
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, email: user.email, nickname: user.nickname, avatar: user.avatar, points: user.points } });
});

router.get('/me', auth, (req, res) => {
  const likes = db.prepare('SELECT COUNT(*) AS n FROM likes WHERE to_user = ?').get(req.user.id).n;
  res.json({ user: req.user, totalLikes: likes });
});

export default router;