import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api.js';

export default function VerifyPage() {
  const [params] = useSearchParams();
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/auth/verify?token=${encodeURIComponent(params.get('token') || '')}`)
      .then(() => setState('ok'))
      .catch((err) => {
        setError(err.message);
        setState('fail');
      });
  }, []);

  return (
    <div className="auth-wrap">
      <div className="card" style={{ textAlign: 'center' }}>
        {state === 'loading' && <p>正在验证…</p>}
        {state === 'ok' && (
          <>
            <h2>验证成功</h2>
            <p>邮箱已激活，现在可以登录了。</p>
            <Link className="btn" to="/login">去登录</Link>
          </>
        )}
        {state === 'fail' && (
          <>
            <h2>验证失败</h2>
            <p className="error">{error}</p>
            <Link to="/register">重新注册</Link>
          </>
        )}
      </div>
    </div>
  );
}