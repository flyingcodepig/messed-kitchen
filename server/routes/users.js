import { Router } from 'express';
import { db, DEFAULT_AVATARS } from '../db.js';
import { auth, fail } from '../util.js';
import { handleUpload } from '../upload.js';

const router = Router();
router.use(auth);

router.get('/:id/honor', (req, res) => {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT id, nickname, avatar, points, created_at FROM users WHERE id = ?').get(id);
  if (!user) return fail(res, 404, '用户不存在');
  const totalLikes = db.prepare('SELECT COUNT(*) AS n FROM likes WHERE to_user = ?').get(id).n;
  const records = db
    .prepare(
      `SELECT e.title AS event_title, e.event_time, k.name AS kitchen_name,
              p.dish_name, u.nickname AS liked_by, l.created_at
       FROM likes l
       JOIN events e ON e.id = l.event_id
       JOIN kitchens k ON k.id = e.kitchen_id
       JOIN users u ON u.id = l.from_user
       LEFT JOIN participants p ON p.event_id = l.event_id AND p.user_id = l.to_user
       WHERE l.to_user = ? ORDER BY l.created_at DESC`
    )
    .all(id);
  const challenges = db
    .prepare(
      `SELECT c.id, c.dish_name, c.status, c.comment, c.created_at, c.resolved_at,
              k.name AS kitchen_name, e.title AS event_title, u.nickname AS creator_nickname
       FROM challenges c
       JOIN kitchens k ON k.id = c.kitchen_id
       JOIN users u ON u.id = c.creator_id
       LEFT JOIN events e ON e.id = c.event_id
       WHERE c.acceptor_id = ? ORDER BY c.id DESC`
    )
    .all(id);
  res.json({ user, totalLikes, records, challenges });
});

router.patch('/me/avatar', (req, res) => {
  const avatar = String(req.body.avatar || '');
  if (!DEFAULT_AVATARS.includes(avatar)) return fail(res, 400, '无效的默认头像');
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, req.user.id);
  res.json({ avatar });
});

router.post('/me/avatar', handleUpload, (req, res) => {
  if (!req.file) return fail(res, 400, '请选择图片');
  const avatar = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, req.user.id);
  res.json({ avatar });
});

export default router;