import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, upload } from '../api.js';
import { useAuth } from '../App.jsx';
import Avatar from '../Avatar.jsx';

const DEFAULT_AVATARS = [
  '/avatars/carrot.png',
  '/avatars/cabbage.png',
  '/avatars/chili.png',
  '/avatars/tomato.png',
  '/avatars/broccoli.png',
  '/avatars/eggplant.png',
  '/avatars/corn.png'
];

function challengeTag(s) {
  if (s === 'accepted') return <span className="tag">进行中</span>;
  if (s === 'completed') return <span className="tag tag-green">已完成 +1</span>;
  if (s === 'failed') return <span className="tag tag-gray">未完成</span>;
  return <span className="tag">待揭榜</span>;
}

export default function ProfilePage() {
  const { id } = useParams();
  const { user, updateUser } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const isMe = user && Number(id) === user.id;

  useEffect(() => {
    setData(null);
    api(`/users/${id}/honor`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  const reload = () => api(`/users/${id}/honor`).then(setData).catch((e) => setError(e.message));

  const setAvatar = (avatar) =>
    api('/users/me/avatar', { method: 'PATCH', body: { avatar } })
      .then(() => { updateUser({ avatar }); reload(); })
      .catch((e) => setError(e.message));

  const uploadAvatar = (file) =>
    upload('/users/me/avatar', file)
      .then((d) => { updateUser({ avatar: d.avatar }); reload(); })
      .catch((e) => setError(e.message));

  if (error) return <div className="card"><p className="error">{error}</p></div>;
  if (!data) return <p className="muted">加载中…</p>;

  return (
    <div>
      <div className="card">
        <div className="avatar-row" style={{ gap: 16 }}>
          <Avatar src={data.user.avatar} name={data.user.nickname} size={72} />
          <div>
            <h1 style={{ margin: 0 }}>{data.user.nickname}</h1>
            <div className="muted">加入于 {(data.user.created_at || '').replace('T', ' ')}</div>
          </div>
        </div>
        {isMe && (
          <div style={{ marginTop: 16 }}>
            <label>选择默认头像</label>
            <div className="avatar-picker">
              {DEFAULT_AVATARS.map((a) => (
                <button key={a} className={'avatar-option' + (data.user.avatar === a ? ' selected' : '')}
                  onClick={() => setAvatar(a)}>
                  <img src={a} alt="" />
                </button>
              ))}
            </div>
            <label className="btn btn-sm btn-ghost" style={{ cursor: 'pointer', display: 'inline-block' }}>
              上传自定义头像
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={(e) => { const f = e.target.files[0]; if (f) uploadAvatar(f); e.target.value = ''; }} />
            </label>
          </div>
        )}
      </div>

      <div className="stat-row">
        <div className="stat"><div className="num">{data.totalLikes}</div><div className="label">累计获赞</div></div>
        <div className="stat"><div className="num">{data.user.points}</div><div className="label">挑战积分</div></div>
        <div className="stat"><div className="num">{data.records.length}</div><div className="label">被赞记录</div></div>
      </div>

      <div className="card">
        <h2>揭榜挑战</h2>
        {data.challenges.length === 0 && <div className="empty">还没有揭榜挑战，去厨房挑战榜看看吧</div>}
        {data.challenges.length > 0 && (
          <table>
            <thead><tr><th>菜品</th><th>厨房</th><th>约饭</th><th>发起人</th><th>状态</th><th>评论</th></tr></thead>
            <tbody>
              {data.challenges.map((c) => (
                <tr key={c.id}>
                  <td className="dish-title">{c.dish_name}</td>
                  <td>{c.kitchen_name}</td>
                  <td>{c.event_title || '—'}</td>
                  <td>{c.creator_nickname}</td>
                  <td>{challengeTag(c.status)}</td>
                  <td className="muted">{c.comment || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>获赞记录</h2>
        {data.records.length === 0 && <div className="empty">还没有获得点赞，做一顿好吃的吧</div>}
        {data.records.length > 0 && (
          <table>
            <thead><tr><th>菜品</th><th>约饭</th><th>厨房</th><th>点赞人</th></tr></thead>
            <tbody>
              {data.records.map((r, i) => (
                <tr key={i}>
                  <td className="dish-title">{r.dish_name || '—'}</td>
                  <td>{r.event_title}</td>
                  <td>{r.kitchen_name}</td>
                  <td>{r.liked_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <Link to="/">返回首页</Link>
    </div>
  );
}