import React, { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';
import Avatar from '../Avatar.jsx';

function fmtTime(t) {
  return (t || '').replace('T', ' ');
}

function EventsTab({ kitchenId }) {
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ title: '', event_time: '' });
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => api(`/kitchens/${kitchenId}/events`).then((d) => setEvents(d.events)), [kitchenId]);
  useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api(`/kitchens/${kitchenId}/events`, { method: 'POST', body: form });
      setForm({ title: '', event_time: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>约饭列表</h2>
        <button className="btn" onClick={() => setShowForm(!showForm)}>{showForm ? '收起' : '发起约饭'}</button>
      </div>
      {showForm && (
        <form onSubmit={create} style={{ marginTop: 14 }}>
          <div className="row">
            <input className="grow" placeholder="约饭标题，如：周五晚火锅局" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <input type="datetime-local" style={{ width: 220 }} value={form.event_time}
              onChange={(e) => setForm({ ...form, event_time: e.target.value })} required />
            <button className="btn">发起并通知成员</button>
          </div>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      <div style={{ marginTop: 12 }}>
        {events.length === 0 && <div className="empty">还没有约饭，发起第一场吧</div>}
        {events.map((ev) => (
          <div key={ev.id} className="event-item">
            <div>
              <Link to={`/events/${ev.id}`}>{ev.title}</Link>
              <span className={ev.status === 'open' ? 'tag' : 'tag tag-gray'}>
                {ev.status === 'open' ? '报名中' : '已结束'}
              </span>
              <div className="muted">{fmtTime(ev.event_time)} · {ev.creator_nickname} 发起 · {ev.participant_count} 人参与</div>
            </div>
            <Link className="btn btn-sm btn-ghost" to={`/events/${ev.id}`}>查看</Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function InventoryTab({ kitchenId }) {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: '', unit: '', quantity: '' });
  const [error, setError] = useState('');

  const load = useCallback(() => api(`/kitchens/${kitchenId}/inventory`).then((d) => setItems(d.items)), [kitchenId]);
  useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api(`/kitchens/${kitchenId}/inventory`, {
        method: 'POST',
        body: { name: form.name, unit: form.unit, quantity: Number(form.quantity) }
      });
      setForm({ name: '', unit: '', quantity: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const adjust = async (item, delta) => {
    setError('');
    try {
      await api(`/inventory/${item.id}/adjust`, { method: 'POST', body: { delta } });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const setQty = async (item) => {
    const input = window.prompt(`修改「${item.name}」的数量`, String(item.quantity));
    if (input === null) return;
    setError('');
    try {
      await api(`/inventory/${item.id}`, { method: 'PATCH', body: { quantity: Number(input) } });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`确定删除「${item.name}」？`)) return;
    await api(`/inventory/${item.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="card">
      <h2>现有食材清点</h2>
      <form className="row" onSubmit={add}>
        <input className="grow" placeholder="食材名称" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <input style={{ width: 110 }} placeholder="数量" type="number" step="any" min="0.01" value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
        <input style={{ width: 90 }} placeholder="单位" value={form.unit}
          onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        <button className="btn">入库</button>
      </form>
      {error && <p className="error">{error}</p>}
      <table style={{ marginTop: 12 }}>
        <thead>
          <tr><th>食材</th><th>数量</th><th>消耗 / 补充</th><th>操作</th></tr>
        </thead>
        <tbody>
          {items.length === 0 && <tr><td colSpan={4} className="empty">库存空空如也</td></tr>}
          {items.map((it) => (
            <tr key={it.id}>
              <td>{it.name}</td>
              <td>{it.quantity} {it.unit}</td>
              <td>
                <button className="btn btn-sm btn-ghost" onClick={() => adjust(it, -1)}>-1</button>{' '}
                <button className="btn btn-sm btn-ghost" onClick={() => adjust(it, 1)}>+1</button>
              </td>
              <td>
                <button className="btn btn-sm btn-ghost" onClick={() => setQty(it)}>改数量</button>{' '}
                <button className="btn btn-sm btn-danger" onClick={() => remove(it)}>删除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeaderboardTab({ kitchenId }) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    api(`/kitchens/${kitchenId}/leaderboard`).then((d) => setRows(d.leaderboard));
  }, [kitchenId]);
  return (
    <div className="card">
      <h2>厨房荣誉榜</h2>
      <table>
        <thead><tr><th>名次</th><th>大厨</th><th>本厨房获赞</th><th>累计获赞</th><th>挑战积分</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td><span className="medal">{i + 1}</span></td>
              <td><Link to={`/profile/${r.id}`} className="avatar-row"><Avatar src={r.avatar} name={r.nickname} size={26} />{r.nickname}</Link></td>
              <td className="likes-badge">{r.kitchen_likes}</td>
              <td>{r.total_likes}</td>
              <td>{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MembersTab({ kitchenId, detail, reload }) {
  const { user } = useAuth();
  const [error, setError] = useState('');

  const resetCode = async () => {
    if (!window.confirm('重置后旧邀请码立即失效，确定？')) return;
    await api(`/kitchens/${kitchenId}/reset-code`, { method: 'POST' });
    reload();
  };

  const remove = async (m) => {
    if (!window.confirm(`确定将 ${m.nickname} 移出厨房？`)) return;
    setError('');
    try {
      await api(`/kitchens/${kitchenId}/members/${m.id}`, { method: 'DELETE' });
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>成员（{detail.members.length}）</h2>
        <div className="row">
          <span className="muted">邀请码</span>
          <span className="code-box">{detail.kitchen.invite_code}</span>
          {detail.isOwner && <button className="btn btn-sm btn-ghost" onClick={resetCode}>重置</button>}
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <table style={{ marginTop: 12 }}>
        <thead><tr><th>成员</th><th>身份</th><th>加入时间</th>{detail.isOwner && <th>操作</th>}</tr></thead>
        <tbody>
          {detail.members.map((m) => (
            <tr key={m.id}>
              <td><Link to={`/profile/${m.id}`} className="avatar-row"><Avatar src={m.avatar} name={m.nickname} size={26} />{m.nickname}</Link>{m.id === user.id && <span className="tag">我</span>}</td>
              <td>{m.is_owner ? <span className="tag">房主</span> : <span className="muted">成员</span>}</td>
              <td className="muted">{m.joined_at}</td>
              {detail.isOwner && (
                <td>{!m.is_owner && <button className="btn btn-sm btn-danger" onClick={() => remove(m)}>移除</button>}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChallengeTab({ kitchenId }) {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState([]);
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState({ dish_name: '', description: '' });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(null);
  const [acceptEvent, setAcceptEvent] = useState('');
  const [resolveId, setResolveId] = useState(null);
  const [comment, setComment] = useState('');

  const load = useCallback(() => Promise.all([
    api(`/kitchens/${kitchenId}/challenges`).then((d) => setChallenges(d.challenges)),
    api(`/kitchens/${kitchenId}/events`).then((d) => setEvents(d.events.filter((e) => e.status === 'open')))
  ]), [kitchenId]);
  useEffect(() => { load().catch((e) => setError(e.message)); }, [load]);

  const act = async (fn) => {
    setError('');
    try { await fn(); await load(); } catch (e) { setError(e.message); }
  };

  const create = (e) => {
    e.preventDefault();
    act(async () => {
      await api(`/kitchens/${kitchenId}/challenges`, { method: 'POST', body: form });
      setForm({ dish_name: '', description: '' });
      setShowForm(false);
    });
  };

  const statusTag = (s) => {
    if (s === 'open') return <span className="tag">待揭榜</span>;
    if (s === 'accepted') return <span className="tag">进行中</span>;
    if (s === 'completed') return <span className="tag tag-green">已完成</span>;
    return <span className="tag tag-gray">未完成</span>;
  };

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>挑战榜</h2>
        <button className="btn" onClick={() => setShowForm(!showForm)}>{showForm ? '收起' : '发布挑战'}</button>
      </div>
      {showForm && (
        <form onSubmit={create} style={{ marginTop: 14 }}>
          <div className="field">
            <label>挑战菜品</label>
            <input value={form.dish_name} onChange={(e) => setForm({ ...form, dish_name: e.target.value })}
              placeholder="想让大家挑战的菜，如：文思豆腐" required />
          </div>
          <div className="field">
            <label>补充说明（可选）</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="难度、要求等" />
          </div>
          <button className="btn">发布到挑战榜</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      <div style={{ marginTop: 12 }}>
        {challenges.length === 0 && <div className="empty">还没有挑战，发布一道菜让大家揭榜吧</div>}
        {challenges.map((c) => (
          <div key={c.id} className="challenge-item">
            <div className="challenge-head">
              <div>
                <span className="dish-title">{c.dish_name}</span>{statusTag(c.status)}
                <div className="muted avatar-row" style={{ marginTop: 4 }}>
                  <Avatar src={c.creator_avatar} name={c.creator_nickname} size={20} />
                  {c.creator_nickname} 发起 · {fmtTime(c.created_at)}
                </div>
                {c.description && <div className="muted">{c.description}</div>}
                {c.acceptor_nickname && (
                  <div className="muted avatar-row" style={{ marginTop: 4 }}>
                    <Avatar src={c.acceptor_avatar} name={c.acceptor_nickname} size={20} />
                    {c.acceptor_nickname} 揭榜 · 约饭「{c.event_title}」
                  </div>
                )}
                {c.comment && <div className="muted" style={{ marginTop: 4 }}>判定评论：{c.comment}</div>}
              </div>
              <div className="row">
                {c.status === 'open' && c.creator_id !== user.id && (
                  <button className="btn btn-sm" onClick={() => { setAccepting(c.id); setAcceptEvent(events[0] ? String(events[0].id) : ''); }}>揭榜</button>
                )}
                {c.status === 'open' && c.creator_id === user.id && (
                  <button className="btn btn-sm btn-danger" onClick={() => window.confirm('删除这道挑战？') && act(() => api(`/challenges/${c.id}`, { method: 'DELETE' }))}>删除</button>
                )}
                {c.status === 'accepted' && c.acceptor_id === user.id && c.event_status === 'open' && (
                  <button className="btn btn-sm btn-ghost" onClick={() => act(() => api(`/challenges/${c.id}/cancel`, { method: 'POST' }))}>放弃</button>
                )}
                {c.status === 'accepted' && c.creator_id === user.id && c.event_status === 'ended' && (
                  <button className="btn btn-sm" onClick={() => { setResolveId(c.id); setComment(''); }}>判定</button>
                )}
              </div>
            </div>
            {accepting === c.id && (
              <div className="row" style={{ marginTop: 10 }}>
                {events.length === 0 ? (
                  <span className="muted">本厨房暂无报名中的约饭，先发起一场吧</span>
                ) : (
                  <>
                    <select style={{ width: 220 }} value={acceptEvent} onChange={(e) => setAcceptEvent(e.target.value)}>
                      {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
                    </select>
                    <button className="btn btn-sm" disabled={!acceptEvent}
                      onClick={() => act(async () => { await api(`/challenges/${c.id}/accept`, { method: 'POST', body: { event_id: Number(acceptEvent) } }); setAccepting(null); })}>
                      确认揭榜
                    </button>
                  </>
                )}
                <button className="btn btn-sm btn-ghost" onClick={() => setAccepting(null)}>取消</button>
              </div>
            )}
            {resolveId === c.id && (
              <div style={{ marginTop: 10 }}>
                <textarea rows={2} placeholder="给这位厨师的评论" value={comment} onChange={(e) => setComment(e.target.value)} />
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn btn-sm btn-green"
                    onClick={() => act(async () => { await api(`/challenges/${c.id}/resolve`, { method: 'POST', body: { completed: true, comment } }); setResolveId(null); })}>
                    完成挑战（+1 积分）
                  </button>
                  <button className="btn btn-sm btn-danger"
                    onClick={() => act(async () => { await api(`/challenges/${c.id}/resolve`, { method: 'POST', body: { completed: false, comment } }); setResolveId(null); })}>
                    未完成
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KitchenPage() {
  const { id } = useParams();
  const kitchenId = Number(id);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'events';
  const [detail, setDetail] = useState(null);
  const [myKitchens, setMyKitchens] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api(`/kitchens/${kitchenId}`).then(setDetail).catch((e) => setError(e.message));
  }, [kitchenId]);

  useEffect(() => {
    setDetail(null);
    load();
    api('/kitchens').then((d) => setMyKitchens(d.kitchens));
  }, [load]);

  if (error) return <div className="card"><p className="error">{error}</p><Link to="/">返回我的厨房</Link></div>;
  if (!detail) return <p className="muted">加载中…</p>;

  const tabs = [
    ['events', '约饭'],
    ['challenges', '挑战榜'],
    ['inventory', '库存清点'],
    ['leaderboard', '荣誉榜'],
    ['members', '成员']
  ];

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>{detail.kitchen.name}</h1>
        {myKitchens.length > 1 && (
          <select style={{ width: 200 }} value={kitchenId}
            onChange={(e) => navigate(`/kitchens/${e.target.value}`)}>
            {myKitchens.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        )}
      </div>
      <div className="tabs">
        {tabs.map(([key, label]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setParams({ tab: key })}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'events' && <EventsTab kitchenId={kitchenId} />}
      {tab === 'challenges' && <ChallengeTab kitchenId={kitchenId} />}
      {tab === 'inventory' && <InventoryTab kitchenId={kitchenId} />}
      {tab === 'leaderboard' && <LeaderboardTab kitchenId={kitchenId} />}
      {tab === 'members' && <MembersTab kitchenId={kitchenId} detail={detail} reload={load} />}
    </div>
  );
}