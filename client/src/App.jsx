import React, { createContext, useContext, useState } from 'react';
import { Routes, Route, Navigate, Link, useNavigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage.jsx';
import VerifyPage from './pages/VerifyPage.jsx';
import KitchensPage from './pages/KitchensPage.jsx';
import KitchenPage from './pages/KitchenPage.jsx';
import EventPage from './pages/EventPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import Avatar from './Avatar.jsx';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <header className="topbar">
      <Link to="/" className="brand">胡闹厨房</Link>
      <nav>
        <Link to="/">我的厨房</Link>
        <Link to={`/profile/${user.id}`}>我的主页</Link>
        <span className="nav-user"><Avatar src={user.avatar} name={user.nickname} size={28} />{user.nickname}</span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          退出
        </button>
      </nav>
    </header>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('hk_user'));
    } catch {
      return null;
    }
  });

  const login = (token, u) => {
    localStorage.setItem('hk_token', token);
    localStorage.setItem('hk_user', JSON.stringify(u));
    setUser(u);
  };
  const logout = () => {
    localStorage.removeItem('hk_token');
    localStorage.removeItem('hk_user');
    setUser(null);
  };
  const updateUser = (patch) => {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem('hk_user', JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      <Header />
      <main className="container">
        <Routes>
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/" element={<RequireAuth><KitchensPage /></RequireAuth>} />
          <Route path="/kitchens/:id" element={<RequireAuth><KitchenPage /></RequireAuth>} />
          <Route path="/events/:id" element={<RequireAuth><EventPage /></RequireAuth>} />
          <Route path="/profile/:id" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </AuthContext.Provider>
  );
}