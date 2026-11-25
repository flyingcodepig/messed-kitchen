import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { db } from '../db.js';
import { auth, fail, isMember } from '../util.js';

const router = Router();
router.use(auth);

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from(randomBytes(6)).map((b) => chars[b % chars.length]).join('');
  } while (db.prepare('SELECT 1 FROM kitchens WHERE invite_code = ?').get(code));
  return code;
}

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT k.*, (SELECT COUNT(*) FROM memberships m2 WHERE m2.kitchen_id = k.id) AS member_count,
              (k.owner_id = ?) AS is_owner
       FROM kitchens k JOIN memberships m ON m.kitchen_id = k.id
       WHERE m.user_id = ? ORDER BY m.joined_at DESC`
    )
    .all(req.user.id, req.user.id);
  res.json({ kitchens: rows });
});

router.post('/', (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return fail(res, 400, '请填写厨房名称');
  const code = genCode();
  const result = db
    .prepare('INSERT INTO kitchens (name, invite_code, owner_id) VALUES (?, ?, ?)')
    .run(name, code, req.user.id);
  const id = Number(result.lastInsertRowid);
  db.prepare('INSERT INTO memberships (kitchen_id, user_id) VALUES (?, ?)').run(id, req.user.id);
  res.json({ kitchen: db.prepare('SELECT * FROM kitchens WHERE id = ?').get(id) });
});

router.post('/join', (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase();
  const kitchen = db.prepare('SELECT * FROM kitchens WHERE invite_code = ?').get(code);
  if (!kitchen) return fail(res, 404, '邀请码不存在');
  if (isMember(kitchen.id, req.user.id)) return fail(res, 409, '你已经在该厨房中');
  db.prepare('INSERT INTO memberships (kitchen_id, user_id) VALUES (?, ?)').run(kitchen.id, req.user.id);
  res.json({ kitchen });
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!isMember(id, req.user.id)) return fail(res, 403, '你不是该厨房成员');
  const kitchen = db.prepare('SELECT * FROM kitchens WHERE id = ?').get(id);
  const members = db
    .prepare(
      `SELECT u.id, u.nickname, u.avatar, m.joined_at, (k.owner_id = u.id) AS is_owner
       FROM memberships m JOIN users u ON u.id = m.user_id JOIN kitchens k ON k.id = m.kitchen_id
       WHERE m.kitchen_id = ? ORDER BY m.joined_at`
    )
    .all(id);
  res.json({ kitchen, members, isOwner: kitchen.owner_id === req.user.id });
});

router.post('/:id/reset-code', (req, res) => {
  const id = Number(req.params.id);
  const kitchen = db.prepare('SELECT * FROM kitchens WHERE id = ?').get(id);
  if (!kitchen) return fail(res, 404, '厨房不存在');
  if (kitchen.owner_id !== req.user.id) return fail(res, 403, '只有房主可以重置邀请码');
  const code = genCode();
  db.prepare('UPDATE kitchens SET invite_code = ? WHERE id = ?').run(code, id);
  res.json({ invite_code: code });
});

router.delete('/:id/members/:userId', (req, res) => {
  const id = Number(req.params.id);
  const userId = Number(req.params.userId);
  const kitchen = db.prepare('SELECT * FROM kitchens WHERE id = ?').get(id);
  if (!kitchen) return fail(res, 404, '厨房不存在');
  if (kitchen.owner_id !== req.user.id) return fail(res, 403, '只有房主可以移除成员');
  if (userId === kitchen.owner_id) return fail(res, 400, '不能移除房主');
  db.prepare('DELETE FROM memberships WHERE kitchen_id = ? AND user_id = ?').run(id, userId);
  res.json({ ok: true });
});

router.get('/:id/leaderboard', (req, res) => {
  const id = Number(req.params.id);
  if (!isMember(id, req.user.id)) return fail(res, 403, '你不是该厨房成员');
  const rows = db
    .prepare(
      `SELECT u.id, u.nickname, u.avatar, u.points,
              (SELECT COUNT(*) FROM likes l JOIN events e ON e.id = l.event_id
               WHERE l.to_user = u.id AND e.kitchen_id = ?) AS kitchen_likes,
              (SELECT COUNT(*) FROM likes l WHERE l.to_user = u.id) AS total_likes
       FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.kitchen_id = ? ORDER BY kitchen_likes DESC, total_likes DESC`
    )
    .all(id, id);
  res.json({ leaderboard: rows });
});

export default router;