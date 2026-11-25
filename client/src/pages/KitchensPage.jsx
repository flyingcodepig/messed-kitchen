import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function KitchensPage() {
  const navigate = useNavigate();
  const [kitchens, setKitchens] = useState([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api('/kitchens').then((d) => setKitchens(d.kitchens)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const d = await api('/kitchens', { method: 'POST', body: { name } });
      navigate(`/kitchens/${d.kitchen.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const join = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const d = await api('/kitchens/join', { method: 'POST', body: { code } });
      navigate(`/kitchens/${d.kitchen.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1>我的厨房</h1>
      {error && <p className="error">{error}</p>}
      <div className="row" style={{ alignItems: 'stretch', marginBottom: 16 }}>
        <div className="card grow" style={{ marginBottom: 0 }}>
          <h3>创建新厨房</h3>
          <form className="row" onSubmit={create}>
            <input className="grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：3 栋 502 宿舍厨房" required />
            <button className="btn" disabled={busy}>创建</button>
          </form>
        </div>
        <div className="card grow" style={{ marginBottom: 0 }}>
          <h3>凭邀请码加入</h3>
          <form className="row" onSubmit={join}>
            <input className="grow" value={code} onChange={(e) => setCode(e.target.value)} placeholder="输入 6 位邀请码" required />
            <button className="btn btn-green" disabled={busy}>加入</button>
          </form>
        </div>
      </div>
      {kitchens.length === 0 ? (
        <div className="card empty">还没有厨房，创建一个或凭邀请码加入吧</div>
      ) : (
        <div className="kitchen-grid">
          {kitchens.map((k) => (
            <div key={k.id} className="card kitchen-card" onClick={() => navigate(`/kitchens/${k.id}`)}>
              <h2>{k.name}{k.is_owner ? <span className="tag">房主</span> : null}</h2>
              <p className="muted">{k.member_count} 位成员 · 邀请码 {k.invite_code}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}