import React, { useState, useEffect } from 'react';
import { Truck, ShieldCheck, ArrowRight } from 'lucide-react';
import StudentApp from './components/StudentApp';
import DriverApp from './components/DriverApp';
import AdminDashboard from './components/AdminDashboard';
import ThemeToggle from './components/ThemeToggle';

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('vesa_theme') || 'dark');
  const [userRole, setUserRole] = useState(null); // 'student', 'driver', 'admin', or null
  const [currentUserId, setCurrentUserId] = useState(null); // ID of logged user
  const [token, setToken] = useState(localStorage.getItem('vesa_token') || null);

  // Form logins
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      const nextTheme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('vesa_theme', nextTheme);
      return nextTheme;
    });
  };

  const isDev = window.location.port === '3000' || window.location.port === '3001' || window.location.port === '5173';
  const loginUrl = isDev ? 'http://localhost:5001/api/auth/login' : '/api/auth/login';

  const handleLogin = async (e) => {
    if (e) e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
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
    } finally {
      setIsLoggingIn(false);
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
        <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', gap: '10px', alignItems: 'center', zIndex: 50 }}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <button onClick={handleLogout} className="btn-secondary" style={{ width: 'auto', padding: '8px 16px', fontSize: '13px' }}>
            Exit Session
          </button>
        </div>
        <div className="phone-emulator">
          <StudentApp userId={currentUserId} token={token} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
        </div>
      </div>
    );
  }

  if (userRole === 'driver') {
    return (
      <div className="standalone-container">
        <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', gap: '10px', alignItems: 'center', zIndex: 50 }}>
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          <button onClick={handleLogout} className="btn-secondary" style={{ width: 'auto', padding: '8px 16px', fontSize: '13px' }}>
            Exit Session
          </button>
        </div>
        <div className="phone-emulator">
          <DriverApp userId={currentUserId} token={token} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
        </div>
      </div>
    );
  }

  if (userRole === 'admin') {
    return (
      <AdminDashboard token={token} onLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
    );
  }

  // 2. RENDER PRODUCTION LOGIN SCREEN
  return (
    <div style={{ 
      display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', 
      background: 'var(--bg-main)', backgroundImage: 'var(--bg-gradient)', padding: '24px', position: 'relative'
    }}>
      {/* Top Floating Controls */}
      <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 10 }}>
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>

      <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
        
        {/* Brand Header */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <div style={{ 
            width: '64px', 
            height: '64px', 
            borderRadius: '18px', 
            background: 'var(--accent-cyan-light)', 
            border: '1px solid rgba(6,182,212,0.3)', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            boxShadow: 'var(--shadow-glow)',
            overflow: 'hidden',
            padding: '4px'
          }}>
            <img 
              src="/icons/icon-192.png" 
              alt="VESA Transit Logo" 
              style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '12px' }} 
            />
          </div>
          <div>
            <h1 className="brand-title" style={{ fontSize: '30px', justifyContent: 'center', marginBottom: '4px' }}>
              VESA Transit
            </h1>
            <span style={{ fontSize: '13.5px', color: 'var(--text-secondary)', fontWeight: '500' }}>
              College Bus & Fleet Operations Platform
            </span>
          </div>
        </div>

        {/* Standard Credentials Logins Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {loginError && (
            <div style={{ 
              background: 'rgba(244,63,94,0.1)', 
              border: '1px solid var(--accent-rose)', 
              color: 'var(--accent-rose)', 
              padding: '12px', 
              borderRadius: '10px', 
              fontSize: '13px', 
              textAlign: 'center',
              fontWeight: '500'
            }}>
              {loginError}
            </div>
          )}

          <div>
            <label style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              College Email Address
            </label>
            <input 
              type="email" 
              className="input-field" 
              placeholder="name@college.edu" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              autoComplete="email"
            />
          </div>

          <div>
            <label style={{ fontSize: '12.5px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Account Password
            </label>
            <input 
              type="password" 
              className="input-field" 
              placeholder="••••••••" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              autoComplete="current-password"
            />
          </div>

          <button 
            type="submit" 
            className="btn-primary" 
            style={{ marginTop: '8px', padding: '13px 20px', fontSize: '14.5px' }}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? 'Authenticating...' : (
              <>
                <span>Sign In to Transit</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <ShieldCheck size={14} color="var(--accent-emerald)" />
          <span>Encrypted End-to-End Enterprise Session</span>
        </div>

      </div>
    </div>
  );
}
