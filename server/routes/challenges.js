import { Router } from 'express';
import { db } from '../db.js';
import { auth, fail, isMember, getEventOrFail } from '../util.js';

const router = Router();
router.use(auth);

function getChallengeOrFail(id, res) {
  const c = db.prepare('SELECT * FROM challenges WHERE id = ?').get(id);
  if (!c) {
    fail(res, 404, '挑战不存在');
    return null;
  }
  return c;
}

router.get('/kitchens/:id/challenges', (req, res) => {
  const id = Number(req.params.id);
  if (!isMember(id, req.user.id)) return fail(res, 403, '你不是该厨房成员');
  const challenges = db
    .prepare(
      `SELECT c.*, cu.nickname AS creator_nickname, cu.avatar AS creator_avatar,
              au.nickname AS acceptor_nickname, au.avatar AS acceptor_avatar,
              e.title AS event_title, e.status AS event_status
       FROM challenges c
       JOIN users cu ON cu.id = c.creator_id
       LEFT JOIN users au ON au.id = c.acceptor_id
       LEFT JOIN events e ON e.id = c.event_id
       WHERE c.kitchen_id = ? ORDER BY c.id DESC`
    )
    .all(id);
  res.json({ challenges });
});

router.post('/kitchens/:id/challenges', (req, res) => {
  const id = Number(req.params.id);
  if (!isMember(id, req.user.id)) return fail(res, 403, '你不是该厨房成员');
  const dishName = String(req.body.dish_name || '').trim();
  const description = String(req.body.description || '').trim();
  if (!dishName) return fail(res, 400, '请填写挑战菜品名称');
  const r = db
    .prepare(
      'INSERT INTO challenges (kitchen_id, creator_id, dish_name, description) VALUES (?, ?, ?, ?)'
    )
    .run(id, req.user.id, dishName, description);
  res.json({ id: Number(r.lastInsertRowid) });
});

router.post('/challenges/:id/accept', (req, res) => {
  const c = getChallengeOrFail(Number(req.params.id), res);
  if (!c) return;
  if (!isMember(c.kitchen_id, req.user.id)) return fail(res, 403, '你不是该厨房成员');
  if (c.status !== 'open') return fail(res, 400, '该挑战已被揭榜');
  if (c.creator_id === req.user.id) return fail(res, 400, '不能揭榜自己发布的挑战');
  const event = getEventOrFail(Number(req.body.event_id), res);
  if (!event) return;
  if (event.kitchen_id !== c.kitchen_id) return fail(res, 400, '请选择本厨房的约饭');
  if (event.status !== 'open') return fail(res, 400, '只能选择报名中的约饭');
  db.prepare("UPDATE challenges SET status = 'accepted', acceptor_id = ?, event_id = ? WHERE id = ?").run(
    req.user.id,
    event.id,
    c.id
  );
  const existing = db
    .prepare('SELECT id FROM participants WHERE event_id = ? AND user_id = ?')
    .get(event.id, req.user.id);
  if (!existing) {
    db.prepare('INSERT INTO participants (event_id, user_id, dish_name) VALUES (?, ?, ?)').run(
      event.id,
      req.user.id,
      c.dish_name
    );
  }
  res.json({ ok: true });
});

router.post('/challenges/:id/cancel', (req, res) => {
  const c = getChallengeOrFail(Number(req.params.id), res);
  if (!c) return;
  if (c.acceptor_id !== req.user.id) return fail(res, 403, '只有揭榜者可以放弃');
  if (c.status !== 'accepted') return fail(res, 400, '该挑战不在揭榜状态');
  const event = db.prepare('SELECT status FROM events WHERE id = ?').get(c.event_id);
  if (event && event.status !== 'open') return fail(res, 400, '约饭已结束，不能放弃');
  db.prepare("UPDATE challenges SET status = 'open', acceptor_id = NULL, event_id = NULL WHERE id = ?").run(c.id);
  res.json({ ok: true });
});

router.post('/challenges/:id/resolve', (req, res) => {
  const c = getChallengeOrFail(Number(req.params.id), res);
  if (!c) return;
  if (c.creator_id !== req.user.id) return fail(res, 403, '只有挑战发起人可以判定');
  if (c.status !== 'accepted') return fail(res, 400, '该挑战尚未被揭榜');
  const event = db.prepare('SELECT status FROM events WHERE id = ?').get(c.event_id);
  if (!event || event.status !== 'ended') return fail(res, 400, '约饭结束后才能判定挑战');
  const completed = req.body.completed ? 1 : 0;
  const comment = String(req.body.comment || '').trim();
  db.prepare(
    "UPDATE challenges SET status = ?, comment = ?, resolved_at = datetime('now') WHERE id = ?"
  ).run(completed ? 'completed' : 'failed', comment, c.id);
  if (completed) {
    db.prepare('UPDATE users SET points = points + 1 WHERE id = ?').run(c.acceptor_id);
  }
  res.json({ ok: true, completed: Boolean(completed) });
});

router.delete('/challenges/:id', (req, res) => {
  const c = getChallengeOrFail(Number(req.params.id), res);
  if (!c) return;
  if (c.creator_id !== req.user.id) return fail(res, 403, '只有发起人可以删除');
  if (c.status !== 'open') return fail(res, 400, '已被揭榜的挑战不能删除');
  db.prepare('DELETE FROM challenges WHERE id = ?').run(c.id);
  res.json({ ok: true });
});

export default router;