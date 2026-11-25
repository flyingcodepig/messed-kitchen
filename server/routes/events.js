import { Router } from 'express';
import { db } from '../db.js';
import { notifyMembers } from '../mailer.js';
import { auth, fail, wrap, isMember, memberEmails, getEventOrFail, APP_URL } from '../util.js';
import { handleUpload } from '../upload.js';

const router = Router();
router.use(auth);

function eventDetail(eventId, userId) {
  const event = db
    .prepare(
      `SELECT e.*, k.name AS kitchen_name, u.nickname AS creator_nickname,
              bu.nickname AS buyer_nickname
       FROM events e JOIN kitchens k ON k.id = e.kitchen_id JOIN users u ON u.id = e.creator_id
       LEFT JOIN users bu ON bu.id = e.buyer_id
       WHERE e.id = ?`
    )
    .get(eventId);
  const participants = db
    .prepare(
      `SELECT p.id, p.user_id, p.dish_name, p.dish_desc, p.dish_photo, u.nickname, u.avatar,
              (SELECT COUNT(*) FROM likes l WHERE l.event_id = p.event_id AND l.to_user = p.user_id) AS like_count
       FROM participants p JOIN users u ON u.id = p.user_id WHERE p.event_id = ? ORDER BY p.id`
    )
    .all(eventId);
  const ingStmt = db.prepare('SELECT name, quantity, unit FROM dish_ingredients WHERE participant_id = ?');
  for (const p of participants) p.ingredients = ingStmt.all(p.id);
  const mine = participants.find((p) => p.user_id === userId) || null;
  const myLike = db.prepare('SELECT to_user FROM likes WHERE event_id = ? AND from_user = ?').get(eventId, userId);
  const members = db
    .prepare(
      `SELECT u.id, u.nickname, u.avatar FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.kitchen_id = ? ORDER BY u.nickname`
    )
    .all(event.kitchen_id);
  return { event, participants, mine, myLikeTo: myLike ? myLike.to_user : null, members };
}

router.get('/kitchens/:id/events', (req, res) => {
  const id = Number(req.params.id);
  if (!isMember(id, req.user.id)) return fail(res, 403, '你不是该厨房成员');
  const events = db
    .prepare(
      `SELECT e.*, u.nickname AS creator_nickname,
              (SELECT COUNT(*) FROM participants p WHERE p.event_id = e.id) AS participant_count
       FROM events e JOIN users u ON u.id = e.creator_id
       WHERE e.kitchen_id = ? ORDER BY e.event_time DESC`
    )
    .all(id);
  res.json({ events });
});

router.post('/kitchens/:id/events', (req, res) => {
  const id = Number(req.params.id);
  if (!isMember(id, req.user.id)) return fail(res, 403, '你不是该厨房成员');
  const title = String(req.body.title || '').trim();
  const eventTime = String(req.body.event_time || '').trim();
  if (!title || !eventTime) return fail(res, 400, '请填写约饭标题和时间');
  const result = db
    .prepare('INSERT INTO events (kitchen_id, title, event_time, creator_id, buyer_id) VALUES (?, ?, ?, ?, ?)')
    .run(id, title, eventTime, req.user.id, req.user.id);
  const eventId = Number(result.lastInsertRowid);
  const kitchen = db.prepare('SELECT name FROM kitchens WHERE id = ?').get(id);
  const url = `${APP_URL}/events/${eventId}`;
  notifyMembers(
    memberEmails(id, req.user.id),
    `【胡闹厨房】${kitchen.name} 发起约饭：${title}`,
    `<p>${req.user.nickname} 在「${kitchen.name}」发起了约饭「${title}」，时间：${eventTime.replace('T', ' ')}。</p>
     <p>快去报名并认领你的菜品：<a href="${url}">${url}</a></p>`
  );
  res.json({ event: db.prepare('SELECT * FROM events WHERE id = ?').get(eventId) });
});

router.get('/events/:id', (req, res) => {
  const event = getEventOrFail(Number(req.params.id), res);
  if (!event) return;
  if (!isMember(event.kitchen_id, req.user.id)) return fail(res, 403, '你不是该厨房成员');
  res.json(eventDetail(event.id, req.user.id));
});

router.patch('/events/:id', (req, res) => {
  const event = getEventOrFail(Number(req.params.id), res);
  if (!event) return;
  if (event.creator_id !== req.user.id) return fail(res, 403, '只有发起人可以修改');
  if (event.status !== 'open') return fail(res, 400, '约饭已结束，不能修改');
  const title = String(req.body.title || event.title).trim();
  const eventTime = String(req.body.event_time || event.event_time).trim();
  const buyerId =
    req.body.buyer_id === undefined ? event.buyer_id : Number(req.body.buyer_id) || null;
  if (buyerId && !isMember(event.kitchen_id, buyerId))
    return fail(res, 400, '采购人必须是该厨房成员');
  const timeChanged = eventTime !== event.event_time;
  db.prepare('UPDATE events SET title = ?, event_time = ?, buyer_id = ? WHERE id = ?').run(
    title,
    eventTime,
    buyerId,
    event.id
  );
  if (timeChanged) {
    const url = `${APP_URL}/events/${event.id}`;
    notifyMembers(
      memberEmails(event.kitchen_id, req.user.id),
      `【胡闹厨房】约饭时间变更：${title}`,
      `<p>约饭「${title}」时间调整为 ${eventTime.replace('T', ' ')}。</p><p><a href="${url}">查看详情</a></p>`
    );
  }
  res.json({ ok: true });
});

router.post('/events/:id/join', (req, res) => {
  const event = getEventOrFail(Number(req.params.id), res);
  if (!event) return;
  if (!isMember(event.kitchen_id, req.user.id)) return fail(res, 403, '你不是该厨房成员');
  if (event.status !== 'open') return fail(res, 400, '约饭已结束，不能报名');
  const dishName = String(req.body.dish_name || '').trim();
  const dishDesc = String(req.body.dish_desc || '').trim();
  const ingredients = Array.isArray(req.body.ingredients) ? req.body.ingredients : [];
  if (!dishName) return fail(res, 400, '请填写菜品名称');
  const clean = ingredients
    .map((i) => ({
      name: String(i.name || '').trim(),
      quantity: Number(i.quantity),
      unit: String(i.unit || '').trim()
    }))
    .filter((i) => i.name && Number.isFinite(i.quantity) && i.quantity > 0);

  const existing = db
    .prepare('SELECT id FROM participants WHERE event_id = ? AND user_id = ?')
    .get(event.id, req.user.id);
  let participantId;
  if (existing) {
    participantId = existing.id;
    db.prepare('UPDATE participants SET dish_name = ?, dish_desc = ? WHERE id = ?').run(
      dishName,
      dishDesc,
      participantId
    );
    db.prepare('DELETE FROM dish_ingredients WHERE participant_id = ?').run(participantId);
  } else {
    const r = db
      .prepare('INSERT INTO participants (event_id, user_id, dish_name, dish_desc) VALUES (?, ?, ?, ?)')
      .run(event.id, req.user.id, dishName, dishDesc);
    participantId = Number(r.lastInsertRowid);
  }
  const ins = db.prepare(
    'INSERT INTO dish_ingredients (participant_id, name, quantity, unit) VALUES (?, ?, ?, ?)'
  );
  for (const i of clean) ins.run(participantId, i.name, i.quantity, i.unit);
  res.json({ ok: true });
});

router.delete('/events/:id/participation', (req, res) => {
  const event = getEventOrFail(Number(req.params.id), res);
  if (!event) return;
  if (event.status !== 'open') return fail(res, 400, '约饭已结束，不能退出');
  db.prepare('DELETE FROM participants WHERE event_id = ? AND user_id = ?').run(event.id, req.user.id);
  res.json({ ok: true });
});

router.post('/events/:id/end', (req, res) => {
  const event = getEventOrFail(Number(req.params.id), res);
  if (!event) return;
  const kitchen = db.prepare('SELECT owner_id, name FROM kitchens WHERE id = ?').get(event.kitchen_id);
  if (event.creator_id !== req.user.id && kitchen.owner_id !== req.user.id)
    return fail(res, 403, '只有发起人或房主可以结束约饭');
  if (event.status !== 'open') return fail(res, 400, '约饭已经结束');
  const count = db.prepare('SELECT COUNT(*) AS n FROM participants WHERE event_id = ?').get(event.id).n;
  if (count === 0) return fail(res, 400, '还没有人报名，不能结束');
  db.prepare("UPDATE events SET status = 'ended' WHERE id = ?").run(event.id);
  const url = `${APP_URL}/events/${event.id}`;
  notifyMembers(
    memberEmails(event.kitchen_id),
    `【胡闹厨房】约饭「${event.title}」已结束`,
    `<p>本次约饭已结束，快去给厨师点赞并完成 AA 结算：<a href="${url}">${url}</a></p>`
  );
  res.json({ ok: true });
});

router.post('/events/:id/like', (req, res) => {
  const event = getEventOrFail(Number(req.params.id), res);
  if (!event) return;
  if (event.status !== 'ended') return fail(res, 400, '约饭结束后才能点赞');
  const toUser = Number(req.body.to_user);
  const isParticipant = (uid) =>
    Boolean(db.prepare('SELECT 1 FROM participants WHERE event_id = ? AND user_id = ?').get(event.id, uid));
  if (!isParticipant(req.user.id)) return fail(res, 403, '只有参与者可以点赞');
  if (!isParticipant(toUser)) return fail(res, 400, '只能给本次约饭的厨师点赞');
  if (toUser === req.user.id) return fail(res, 400, '不能给自己点赞');
  const existing = db
    .prepare('SELECT id FROM likes WHERE event_id = ? AND from_user = ?')
    .get(event.id, req.user.id);
  if (existing) return fail(res, 409, '每次约饭只能点赞一次');
  db.prepare('INSERT INTO likes (event_id, from_user, to_user) VALUES (?, ?, ?)').run(
    event.id,
    req.user.id,
    toUser
  );
  res.json({ ok: true });
});

function shoppingList(event) {
  const rows = db
    .prepare(
      `SELECT di.name, di.unit, SUM(di.quantity) AS needed, p.dish_name
       FROM dish_ingredients di JOIN participants p ON p.id = di.participant_id
       WHERE p.event_id = ? GROUP BY di.name, di.unit, p.dish_name`
    )
    .all(event.id);
  const merged = new Map();
  for (const r of rows) {
    const key = `${r.name}\u0000${r.unit}`;
    if (!merged.has(key)) merged.set(key, { name: r.name, unit: r.unit, needed: 0, dishes: [] });
    const item = merged.get(key);
    item.needed += r.needed;
    item.dishes.push(r.dish_name);
  }
  const stateStmt = db.prepare(
    `SELECT s.*, u.nickname AS buyer_nickname FROM shopping_state s
     LEFT JOIN users u ON u.id = s.buyer_id WHERE s.event_id = ? AND s.name = ? AND s.unit = ?`
  );
  const stockStmt = db.prepare(
    'SELECT quantity FROM inventory WHERE kitchen_id = ? AND name = ? AND unit = ?'
  );
  const items = [...merged.values()].map((item) => {
    const stock = stockStmt.get(event.kitchen_id, item.name, item.unit);
    const inStock = stock ? stock.quantity : 0;
    const state = stateStmt.get(event.id, item.name, item.unit);
    return {
      ...item,
      inStock,
      toBuy: Math.max(0, item.needed - inStock),
      purchased: state ? Boolean(state.purchased) : false,
      cost: state ? state.cost : 0,
      buyer: state ? state.buyer_nickname : null,
      stocked: state ? Boolean(state.stocked) : false
    };
  });
  items.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  return items;
}

router.get('/events/:id/shopping', (req, res) => {
  const event = getEventOrFail(Number(req.params.id), res);
  if (!event) return;
  if (!isMember(event.kitchen_id, req.user.id)) return fail(res, 403, '你不是该厨房成员');
  res.json({ items: shoppingList(event) });
});

router.patch('/events/:id/shopping', (req, res) => {
  const event = getEventOrFail(Number(req.params.id), res);
  if (!event) return;
  if (!isMember(event.kitchen_id, req.user.id)) return fail(res, 403, '你不是该厨房成员');
  const allowedBuyer = event.buyer_id ?? event.creator_id;
  if (req.user.id !== allowedBuyer) return fail(res, 403, '只有采购人可以填写采购信息');
  const name = String(req.body.name || '').trim();
  const unit = String(req.body.unit || '').trim();
  const purchased = req.body.purchased ? 1 : 0;
  const cost = Math.max(0, Number(req.body.cost) || 0);
  if (!name) return fail(res, 400, '缺少食材名称');
  db.prepare(
    `INSERT INTO shopping_state (event_id, name, unit, purchased, cost, buyer_id)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (event_id, name, unit)
     DO UPDATE SET purchased = excluded.purchased, cost = excluded.cost, buyer_id = excluded.buyer_id`
  ).run(event.id, name, unit, purchased, cost, purchased ? req.user.id : null);
  res.json({ ok: true });
});

router.post('/events/:id/shopping/stock-in', (req, res) => {
  const event = getEventOrFail(Number(req.params.id), res);
  if (!event) return;
  if (!isMember(event.kitchen_id, req.user.id)) return fail(res, 403, '你不是该厨房成员');
  const items = shoppingList(event).filter((i) => i.purchased && !i.stocked);
  if (items.length === 0) return fail(res, 400, '没有待入库的已购食材');
  const upsert = db.prepare(
    `INSERT INTO inventory (kitchen_id, name, unit, quantity) VALUES (?, ?, ?, ?)
     ON CONFLICT (kitchen_id, name, unit)
     DO UPDATE SET quantity = quantity + excluded.quantity, updated_at = datetime('now')`
  );
  const mark = db.prepare(
    'UPDATE shopping_state SET stocked = 1 WHERE event_id = ? AND name = ? AND unit = ?'
  );
  for (const item of items) {
    if (item.toBuy > 0) upsert.run(event.kitchen_id, item.name, item.unit, item.toBuy);
    mark.run(event.id, item.name, item.unit);
  }
  res.json({ ok: true, count: items.length });
});

router.post('/events/:id/group-photo', handleUpload, (req, res) => {
  const event = getEventOrFail(Number(req.params.id), res);
  if (!event) return;
  if (!isMember(event.kitchen_id, req.user.id)) return fail(res, 403, '你不是该厨房成员');
  if (!req.file) return fail(res, 400, '请选择图片');
  const url = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE events SET group_photo = ? WHERE id = ?').run(url, event.id);
  res.json({ url });
});

router.post('/events/:id/dish-photo', handleUpload, (req, res) => {
  const event = getEventOrFail(Number(req.params.id), res);
  if (!event) return;
  if (!isMember(event.kitchen_id, req.user.id)) return fail(res, 403, '你不是该厨房成员');
  const p = db
    .prepare('SELECT id FROM participants WHERE event_id = ? AND user_id = ?')
    .get(event.id, req.user.id);
  if (!p) return fail(res, 403, '只有参与者可以上传菜品照片');
  if (!req.file) return fail(res, 400, '请选择图片');
  const url = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE participants SET dish_photo = ? WHERE id = ?').run(url, p.id);
  res.json({ url });
});

router.get('/events/:id/settlement', (req, res) => {
  const event = getEventOrFail(Number(req.params.id), res);
  if (!event) return;
  if (!isMember(event.kitchen_id, req.user.id)) return fail(res, 403, '你不是该厨房成员');
  const total = db
    .prepare('SELECT COALESCE(SUM(cost), 0) AS n FROM shopping_state WHERE event_id = ? AND purchased = 1')
    .get(event.id).n;
  const participants = db
    .prepare(
      `SELECT u.id, u.nickname,
              (SELECT COALESCE(SUM(s.cost), 0) FROM shopping_state s
               WHERE s.event_id = ? AND s.purchased = 1 AND s.buyer_id = u.id) AS fronted,
              (SELECT COALESCE(p.paid, 0) FROM payments p WHERE p.event_id = ? AND p.user_id = u.id) AS paid
       FROM participants pt JOIN users u ON u.id = pt.user_id WHERE pt.event_id = ?`
    )
    .all(event.id, event.id, event.id);
  const perPerson = participants.length ? Math.round((total / participants.length) * 100) / 100 : 0;
  res.json({ total, perPerson, participants });
});

router.post('/events/:id/settlement/pay', (req, res) => {
  const event = getEventOrFail(Number(req.params.id), res);
  if (!event) return;
  if (event.status !== 'ended') return fail(res, 400, '约饭结束后才能结算');
  const isParticipant = db
    .prepare('SELECT 1 FROM participants WHERE event_id = ? AND user_id = ?')
    .get(event.id, req.user.id);
  if (!isParticipant) return fail(res, 403, '只有参与者需要结算');
  const paid = req.body.paid ? 1 : 0;
  db.prepare(
    `INSERT INTO payments (event_id, user_id, paid, paid_at) VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT (event_id, user_id) DO UPDATE SET paid = excluded.paid, paid_at = excluded.paid_at`
  ).run(event.id, req.user.id, paid);
  res.json({ ok: true });
});

export default router;