import { Router } from 'express';
import { db } from '../db.js';
import { auth, fail, isMember } from '../util.js';

const router = Router();
router.use(auth);

router.get('/kitchens/:id/inventory', (req, res) => {
  const id = Number(req.params.id);
  if (!isMember(id, req.user.id)) return fail(res, 403, '你不是该厨房成员');
  const items = db
    .prepare('SELECT * FROM inventory WHERE kitchen_id = ? ORDER BY name')
    .all(id);
  res.json({ items });
});

router.post('/kitchens/:id/inventory', (req, res) => {
  const id = Number(req.params.id);
  if (!isMember(id, req.user.id)) return fail(res, 403, '你不是该厨房成员');
  const name = String(req.body.name || '').trim();
  const unit = String(req.body.unit || '').trim();
  const quantity = Number(req.body.quantity);
  if (!name) return fail(res, 400, '请填写食材名称');
  if (!Number.isFinite(quantity) || quantity <= 0) return fail(res, 400, '数量必须大于 0');
  db.prepare(
    `INSERT INTO inventory (kitchen_id, name, unit, quantity) VALUES (?, ?, ?, ?)
     ON CONFLICT (kitchen_id, name, unit)
     DO UPDATE SET quantity = quantity + excluded.quantity, updated_at = datetime('now')`
  ).run(id, name, unit, quantity);
  res.json({ ok: true });
});

function getItemOrFail(id, userId, res) {
  const item = db.prepare('SELECT * FROM inventory WHERE id = ?').get(id);
  if (!item) {
    fail(res, 404, '食材不存在');
    return null;
  }
  if (!isMember(item.kitchen_id, userId)) {
    fail(res, 403, '你不是该厨房成员');
    return null;
  }
  return item;
}

router.patch('/inventory/:id', (req, res) => {
  const item = getItemOrFail(Number(req.params.id), req.user.id, res);
  if (!item) return;
  const quantity = Number(req.body.quantity);
  if (!Number.isFinite(quantity) || quantity < 0) return fail(res, 400, '数量不能为负');
  db.prepare("UPDATE inventory SET quantity = ?, updated_at = datetime('now') WHERE id = ?").run(
    quantity,
    item.id
  );
  res.json({ ok: true });
});

router.post('/inventory/:id/adjust', (req, res) => {
  const item = getItemOrFail(Number(req.params.id), req.user.id, res);
  if (!item) return;
  const delta = Number(req.body.delta);
  if (!Number.isFinite(delta) || delta === 0) return fail(res, 400, '请填写有效的调整量');
  const next = Math.max(0, item.quantity + delta);
  db.prepare("UPDATE inventory SET quantity = ?, updated_at = datetime('now') WHERE id = ?").run(
    next,
    item.id
  );
  res.json({ ok: true, quantity: next });
});

router.delete('/inventory/:id', (req, res) => {
  const item = getItemOrFail(Number(req.params.id), req.user.id, res);
  if (!item) return;
  db.prepare('DELETE FROM inventory WHERE id = ?').run(item.id);
  res.json({ ok: true });
});

export default router;