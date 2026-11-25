import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, upload } from '../api.js';
import { useAuth } from '../App.jsx';
import Avatar from '../Avatar.jsx';

function fmtTime(t) {
  return (t || '').replace('T', ' ');
}

function PhotoButton({ label, onFile }) {
  return (
    <label className="btn btn-sm btn-ghost" style={{ cursor: 'pointer' }}>
      {label}
      <input type="file" accept="image/*" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files[0]; if (f) onFile(f); e.target.value = ''; }} />
    </label>
  );
}

function JoinForm({ eventId, mine, onDone }) {
  const [dishName, setDishName] = useState(mine ? mine.dish_name : '');
  const [dishDesc, setDishDesc] = useState(mine ? mine.dish_desc : '');
  const [ingredients, setIngredients] = useState(
    mine && mine.ingredients.length ? mine.ingredients : [{ name: '', quantity: '', unit: '' }]
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const setIng = (i, k, v) => {
    const next = [...ingredients];
    next[i] = { ...next[i], [k]: v };
    setIngredients(next);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api(`/events/${eventId}/join`, {
        method: 'POST',
        body: {
          dish_name: dishName,
          dish_desc: dishDesc,
          ingredients: ingredients.map((i) => ({ ...i, quantity: Number(i.quantity) }))
        }
      });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="card" style={{ background: 'var(--bg)' }}>
      <h3>{mine ? '修改我的菜品' : '报名并认领菜品'}</h3>
      <div className="row">
        <input className="grow" placeholder="菜名，如：可乐鸡翅" value={dishName}
          onChange={(e) => setDishName(e.target.value)} required />
        <input className="grow" placeholder="菜品说明（可选）" value={dishDesc}
          onChange={(e) => setDishDesc(e.target.value)} />
      </div>
      <label style={{ marginTop: 12 }}>所需食材（会自动汇总到采购清单）</label>
      {ingredients.map((ing, i) => (
        <div key={i} className="ingredient-row">
          <input placeholder="食材名" value={ing.name} onChange={(e) => setIng(i, 'name', e.target.value)} />
          <input placeholder="数量" type="number" step="any" min="0" value={ing.quantity}
            onChange={(e) => setIng(i, 'quantity', e.target.value)} />
          <input placeholder="单位" value={ing.unit} onChange={(e) => setIng(i, 'unit', e.target.value)} />
          <button type="button" className="btn btn-sm btn-ghost"
            onClick={() => setIngredients(ingredients.filter((_, j) => j !== i))}>删</button>
        </div>
      ))}
      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" className="btn btn-sm btn-ghost"
          onClick={() => setIngredients([...ingredients, { name: '', quantity: '', unit: '' }])}>
          添加食材
        </button>
        <button className="btn" disabled={busy}>{mine ? '保存修改' : '确认报名'}</button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function ShoppingRow({ eventId, item, onChanged, canEdit }) {
  const [cost, setCost] = useState(String(item.cost || ''));
  const [error, setError] = useState('');
  useEffect(() => setCost(String(item.cost || '')), [item.cost]);

  const save = async (purchased, costValue) => {
    setError('');
    try {
      await api(`/events/${eventId}/shopping`, {
        method: 'PATCH',
        body: { name: item.name, unit: item.unit, purchased, cost: Number(costValue) || 0 }
      });
      onChanged();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <tr>
      <td>
        {item.name}
        <div className="muted">来自：{[...new Set(item.dishes)].join('、')}</div>
        {error && <div className="error">{error}</div>}
      </td>
      <td>{item.needed} {item.unit}</td>
      <td>{item.inStock} {item.unit}</td>
      <td>
        {item.toBuy > 0
          ? <span className="tag">需买 {item.toBuy} {item.unit}</span>
          : <span className="tag tag-green">库存充足</span>}
      </td>
      <td>
        <input type="checkbox" checked={item.purchased} disabled={!canEdit}
          onChange={(e) => save(e.target.checked, cost)} />
      </td>
      <td>
        {canEdit ? (
          <input style={{ width: 90 }} type="number" step="0.01" min="0" value={cost}
            onChange={(e) => setCost(e.target.value)}
            onBlur={() => { if (Number(cost) !== item.cost) save(item.purchased, cost); }} />
        ) : (
          <span>¥{Number(item.cost || 0).toFixed(2)}</span>
        )}
      </td>
      <td className="muted">{item.buyer || '—'}{item.stocked ? '（已入库）' : ''}</td>
    </tr>
  );
}

export default function EventPage() {
  const { id } = useParams();
  const eventId = Number(id);
  const { user } = useAuth();
  const [detail, setDetail] = useState(null);
  const [shopping, setShopping] = useState([]);
  const [settlement, setSettlement] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', event_time: '' });

  const load = useCallback(async () => {
    const [d, s, st] = await Promise.all([
      api(`/events/${eventId}`),
      api(`/events/${eventId}/shopping`),
      api(`/events/${eventId}/settlement`)
    ]);
    setDetail(d);
    setShopping(s.items);
    setSettlement(st);
  }, [eventId]);

  useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);

  if (error && !detail)
    return <div className="card"><p className="error">{error}</p><Link to="/">返回首页</Link></div>;
  if (!detail) return <p className="muted">加载中…</p>;

  const { event, participants, mine, myLikeTo, members } = detail;
  const open = event.status === 'open';
  const isCreator = event.creator_id === user.id;
  const buyerId = event.buyer_id ?? event.creator_id;
  const isBuyer = user.id === buyerId;

  const act = async (fn, msg) => {
    setError('');
    setNotice('');
    try {
      await fn();
      await load();
      if (msg) setNotice(msg);
    } catch (err) {
      setError(err.message);
    }
  };

  const endEvent = () => {
    if (window.confirm('结束后将不能再报名/修改菜品，并进入点赞和 AA 结算阶段，确定结束？'))
      act(() => api(`/events/${eventId}/end`, { method: 'POST' }), '约饭已结束，快点赞和结算吧');
  };

  const saveEdit = (e) => {
    e.preventDefault();
    act(async () => {
      await api(`/events/${eventId}`, { method: 'PATCH', body: editForm });
      setEditing(false);
    });
  };

  const like = (toUser) =>
    act(() => api(`/events/${eventId}/like`, { method: 'POST', body: { to_user: toUser } }), '点赞成功');

  const stockIn = () =>
    act(() => api(`/events/${eventId}/shopping/stock-in`, { method: 'POST' }), '已购食材已入库');

  const togglePaid = (paid) =>
    act(() => api(`/events/${eventId}/settlement/pay`, { method: 'POST', body: { paid } }));

  const assignBuyer = (uid) =>
    act(() => api(`/events/${eventId}`, { method: 'PATCH', body: { buyer_id: Number(uid) } }), '采购人已更新');

  const uploadGroup = (file) =>
    act(() => upload(`/events/${eventId}/group-photo`, file), '合影已上传');

  const uploadDish = (file) =>
    act(() => upload(`/events/${eventId}/dish-photo`, file), '菜品照片已上传');

  return (
    <div>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ marginBottom: 4 }}>
              {event.title}
              <span className={open ? 'tag' : 'tag tag-gray'}>{open ? '报名中' : '已结束'}</span>
            </h1>
            <p className="muted" style={{ margin: 0 }}>
              {fmtTime(event.event_time)} · {event.creator_nickname} 发起 ·{' '}
              <Link to={`/kitchens/${event.kitchen_id}`}>{event.kitchen_name}</Link>
            </p>
          </div>
          <div className="row">
            {open && (
              <button className="btn" onClick={() => setShowJoin(!showJoin)}>
                {mine ? '修改我的菜品' : '报名做菜'}
              </button>
            )}
            {open && mine && (
              <button className="btn btn-ghost"
                onClick={() => window.confirm('确定退出本次约饭？') &&
                  act(() => api(`/events/${eventId}/participation`, { method: 'DELETE' }))}>
                退出约饭
              </button>
            )}
            {open && isCreator && (
              <>
                <button className="btn btn-ghost" onClick={() => {
                  setEditForm({ title: event.title, event_time: event.event_time });
                  setEditing(!editing);
                }}>编辑</button>
                <button className="btn btn-green" onClick={endEvent}>结束约饭</button>
              </>
            )}
          </div>
        </div>
        {editing && (
          <form className="row" style={{ marginTop: 12 }} onSubmit={saveEdit}>
            <input className="grow" value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required />
            <input type="datetime-local" style={{ width: 220 }} value={editForm.event_time}
              onChange={(e) => setEditForm({ ...editForm, event_time: e.target.value })} required />
            <button className="btn">保存（改时间会邮件通知）</button>
          </form>
        )}
        {error && <p className="error">{error}</p>}
        {notice && <p className="success">{notice}</p>}
      </div>

      {showJoin && open && (
        <JoinForm eventId={eventId} mine={mine} onDone={() => { setShowJoin(false); load(); }} />
      )}

      <div className="card">
        <h2>参与大厨（{participants.length}）</h2>
        {participants.length === 0 && <div className="empty">还没有人报名</div>}
        {participants.map((p) => (
          <div key={p.id} className="participant">
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div>
                <span className="dish-title">{p.dish_name}</span>
                <span className="muted"> — <Link to={`/profile/${p.user_id}`} className="avatar-row" style={{ display: 'inline-flex' }}><Avatar src={p.avatar} name={p.nickname} size={22} />{p.nickname}</Link></span>
                {p.dish_desc && <div className="muted">{p.dish_desc}</div>}
                {p.ingredients.length > 0 && (
                  <div className="muted">
                    食材：{p.ingredients.map((i) => `${i.name} ${i.quantity}${i.unit}`).join('，')}
                  </div>
                )}
                {p.dish_photo && <img className="dish-thumb" src={p.dish_photo} alt={p.dish_name} />}
                {p.user_id === user.id && (
                  <div style={{ marginTop: 8 }}>
                    <PhotoButton label={p.dish_photo ? '更换菜品照片' : '上传菜品照片'} onFile={uploadDish} />
                  </div>
                )}
              </div>
              <div className="row">
                <span className="likes-badge">{p.like_count} 赞</span>
                {!open && mine && p.user_id !== user.id && (
                  myLikeTo === p.user_id
                    ? <span className="tag tag-green">已赞</span>
                    : !myLikeTo && <button className="btn btn-sm" onClick={() => like(p.user_id)}>点赞</button>
                )}
              </div>
            </div>
          </div>
        ))}
        {!open && mine && !myLikeTo && participants.length > 1 && (
          <p className="muted">每次约饭你有一次点赞机会，投给你心中的最佳大厨吧</p>
        )}
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>采购清单（自动汇总）</h2>
          <div className="row">
            <span className="muted">采购人</span>
            {isCreator && open ? (
              <select style={{ width: 130 }} value={buyerId}
                onChange={(e) => assignBuyer(e.target.value)}>
                {members.map((m) => <option key={m.id} value={m.id}>{m.nickname}</option>)}
              </select>
            ) : (
              <strong>{event.buyer_nickname || event.creator_nickname}</strong>
            )}
            <button className="btn btn-green btn-sm" onClick={stockIn}
              disabled={!shopping.some((i) => i.purchased && !i.stocked)}>
              已购食材一键入库
            </button>
          </div>
        </div>
        {!isBuyer && <p className="muted" style={{ marginTop: 8 }}>采购与价格由采购人统一填写，其他成员仅可查看。</p>}
        <table style={{ marginTop: 12 }}>
          <thead>
            <tr><th>食材</th><th>总需求</th><th>现有库存</th><th>需采购</th><th>已买</th><th>花费(元)</th><th>采购人</th></tr>
          </thead>
          <tbody>
            {shopping.length === 0 && <tr><td colSpan={7} className="empty">报名菜品后自动生成</td></tr>}
            {shopping.map((item) => (
              <ShoppingRow key={`${item.name}|${item.unit}`} eventId={eventId} item={item} onChanged={load} canEdit={isBuyer} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>AA 结算{!open ? '' : '（约饭结束后生效）'}</h2>
        {settlement && (
          <>
            <div className="stat-row">
              <div className="stat"><div className="num">¥{settlement.total.toFixed(2)}</div><div className="label">采购总花费</div></div>
              <div className="stat"><div className="num">{settlement.participants.length}</div><div className="label">参与人数</div></div>
              <div className="stat"><div className="num">¥{settlement.perPerson.toFixed(2)}</div><div className="label">每人均摊</div></div>
            </div>
            <table>
              <thead><tr><th>成员</th><th>已垫付</th><th>应摊</th><th>差额</th><th>已付清</th></tr></thead>
              <tbody>
                {settlement.participants.map((p) => {
                  const diff = Math.round((p.fronted - settlement.perPerson) * 100) / 100;
                  return (
                    <tr key={p.id}>
                      <td>{p.nickname}{p.id === user.id && <span className="tag">我</span>}</td>
                      <td>¥{p.fronted.toFixed(2)}</td>
                      <td>¥{settlement.perPerson.toFixed(2)}</td>
                      <td style={{ color: diff >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {diff >= 0 ? `应收 ¥${diff.toFixed(2)}` : `应付 ¥${(-diff).toFixed(2)}`}
                      </td>
                      <td>
                        {p.id === user.id && !open ? (
                          <input type="checkbox" checked={Boolean(p.paid)}
                            onChange={(e) => togglePaid(e.target.checked)} />
                        ) : (
                          <span className={p.paid ? 'tag tag-green' : 'tag tag-gray'}>{p.paid ? '已付' : '未付'}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>本次总结</h2>
          <PhotoButton label={event.group_photo ? '更换合影' : '上传合影'} onFile={uploadGroup} />
        </div>
        {event.group_photo && <img className="group-photo" src={event.group_photo} alt="本次合影" />}
        {participants.some((p) => p.dish_photo) && (
          <div className="photo-grid">
            {participants.filter((p) => p.dish_photo).map((p) => (
              <figure key={p.id} className="dish-figure">
                <img src={p.dish_photo} alt={p.dish_name} />
                <figcaption>{p.dish_name} · {p.nickname}</figcaption>
              </figure>
            ))}
          </div>
        )}
        {!event.group_photo && participants.every((p) => !p.dish_photo) && (
          <div className="empty" style={{ marginTop: 12 }}>上传菜品照片和合影，记录这次做饭吧</div>
        )}
      </div>
    </div>
  );
}