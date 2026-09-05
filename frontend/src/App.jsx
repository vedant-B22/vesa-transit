import React, { useState, useEffect } from 'react';
import { Truck } from 'lucide-react';
import StudentApp from './components/StudentApp';
import DriverApp from './components/DriverApp';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  const [theme] = useState('dark');
  const [userRole, setUserRole] = useState(null); // 'student', 'driver', 'admin', or null
  const [currentUserId, setCurrentUserId] = useState(null); // ID of logged user
  const [token, setToken] = useState(localStorage.getItem('vesa_token') || null);

  // Form logins
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const isDev = window.location.port === '3000' || window.location.port === '3001' || window.location.port === '5173';
  const loginUrl = isDev ? 'http://localhost:5001/api/auth/login' : '/api/auth/login';

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setLoginError(data.error || 'Login failed.');
        return;
      }

      setToken(data.token);
      localStorage.setItem('vesa_token', data.token);
      setCurrentUserId(data.user.id);
      setUserRole(data.user.role);
    } catch (err) {
      setLoginError('Could not reach backend API server. Please ensure backend is running.');
    }
  };

  const handleLogout = () => {
    setUserRole(null);
    setCurrentUserId(null);
    setToken(null);
    localStorage.removeItem('vesa_token');
    setEmail('');
    setPassword('');
  };

  // 1. RENDER MAIN ROLE VIEWS
  if (userRole === 'student') {
    return (
      <div className="standalone-container">
        <div style={{ position: 'absolute', top: 20, right: 20 }}>
          <button onClick={handleLogout} className="btn-secondary" style={{ width: 'auto' }}>Exit Standalone Student App</button>
        </div>
        <div className="phone-emulator">
          <StudentApp userId={currentUserId} token={token} onLogout={handleLogout} />
        </div>
      </div>
    );
  }

  if (userRole === 'driver') {
    return (
      <div className="standalone-container">
        <div style={{ position: 'absolute', top: 20, right: 20 }}>
          <button onClick={handleLogout} className="btn-secondary" style={{ width: 'auto' }}>Exit Standalone Driver App</button>
        </div>
        <div className="phone-emulator">
          <DriverApp userId={currentUserId} token={token} onLogout={handleLogout} />
        </div>
      </div>
    );
  }

  if (userRole === 'admin') {
    return (
      <AdminDashboard token={token} onLogout={handleLogout} />
    );
  }

  // 2. RENDER PRODUCTION LOGIN SCREEN
  return (
    <div style={{ 
      display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', 
      background: 'radial-gradient(ellipse at bottom, #0f172a 0%, #020617 100%)', padding: '24px' 
    }}>
      <div className="glass-card" style={{ width: '420px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: 'var(--shadow-glow)' }}>
            <Truck size={32} color="var(--accent-cyan)" />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '800', fontFamily: 'var(--font-display)', background: 'linear-gradient(135deg, #fff 0%, var(--accent-cyan) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              VESA Transit
            </h1>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>AI Powered College Bus Platform</span>
          </div>
        </div>

        {/* Standard Credentials Logins Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {loginError && (
            <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid var(--accent-rose)', color: 'var(--accent-rose)', padding: '10px', borderRadius: '8px', fontSize: '12px', textAlign: 'center' }}>
              {loginError}
            </div>
          )}

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>College Email Address</label>
            <input 
              type="email" 
              className="input-field" 
              placeholder="name@college.edu" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Account Password</label>
            <input 
              type="password" 
              className="input-field" 
              placeholder="••••••••" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>
            Verify Credentials & Enter
          </button>
        </form>

      </div>
    </div>
  );
}
