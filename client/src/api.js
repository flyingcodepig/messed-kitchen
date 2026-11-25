const BASE = '/api';

export function getToken() {
  return localStorage.getItem('hk_token');
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem('hk_token');
      localStorage.removeItem('hk_user');
      if (!location.pathname.startsWith('/login')) location.href = '/login';
    }
    throw new Error(data.error || `请求失败 (${res.status})`);
  }
  return data;
}

export async function upload(path, file) {
  const fd = new FormData();
  fd.append('photo', file);
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method: 'POST', headers, body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '上传失败');
  return data;
}