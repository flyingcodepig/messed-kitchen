import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../App.jsx';

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', nickname: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isLogin) {
        const data = await api('/auth/login', { method: 'POST', body: form });
        login(data.token, data.user);
        navigate('/');
      } else {
        const data = await api('/auth/register', { method: 'POST', body: form });
        setNotice(data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (notice) {
    return (
      <div className="auth-wrap">
        <div className="card">
          <h2>验证邮件已发送</h2>
          <p>请查收 <b>{form.email}</b> 的收件箱，点击邮件中的链接完成验证后即可登录。</p>
          {notice.devVerifyUrl && (
            <p className="muted">
              开发模式（未配置 SMTP）：<a href={notice.devVerifyUrl}>点击这里直接验证</a>
            </p>
          )}
          <Link to="/login">返回登录</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="brand-big">胡闹厨房</div>
      <p className="auth-sub">和同学一起约饭、买菜、AA、给大厨点赞</p>
      <div className="card">
        <h2>{isLogin ? '登录' : '注册'}</h2>
        <form onSubmit={submit}>
          {!isLogin && (
            <div className="field">
              <label>昵称</label>
              <input value={form.nickname} onChange={set('nickname')} placeholder="同学们怎么称呼你" required />
            </div>
          )}
          <div className="field">
            <label>邮箱</label>
            <input type="email" value={form.email} onChange={set('email')} placeholder="you@example.com" required />
          </div>
          <div className="field">
            <label>密码</label>
            <input type="password" value={form.password} onChange={set('password')} placeholder="至少 6 位" required />
          </div>
          {error && <p className="error">{error}</p>}
          <button className="btn" style={{ width: '100%' }} disabled={busy}>
            {busy ? '请稍候…' : isLogin ? '登录' : '注册'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 14 }}>
          {isLogin ? (
            <>还没有账号？<Link to="/register">去注册</Link></>
          ) : (
            <>已有账号？<Link to="/login">去登录</Link></>
          )}
        </p>
      </div>
    </div>
  );
}