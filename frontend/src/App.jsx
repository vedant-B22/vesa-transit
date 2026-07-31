import React, { useState, useEffect } from 'react';
import { Truck, Monitor, User, Shield, Sparkles, Sun, Moon } from 'lucide-react';
import StudentApp from './components/StudentApp';
import DriverApp from './components/DriverApp';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  const [theme, setTheme] = useState('dark');
  const [userRole, setUserRole] = useState(null); // 'student', 'driver', 'admin', 'sandbox', or null (login)
  const [currentUserId, setCurrentUserId] = useState(null); // ID of logged user

  // Form logins
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('http://localhost:5001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setLoginError(data.error || 'Login failed.');
        return;
      }

      setCurrentUserId(data.user.id);
      setUserRole(data.user.role);
    } catch (err) {
      setLoginError('Could not reach backend API server. Please make sure backend is running.');
    }
  };

  const handleQuickLogin = (role) => {
    if (role === 'student') {
      setEmail('student1@college.edu');
      setPassword('password123');
    } else if (role === 'driver') {
      setEmail('driver1@transit.com');
      setPassword('password123');
    } else if (role === 'admin') {
      setEmail('admin@vesatransit.com');
      setPassword('password123');
    }
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleLogout = () => {
    setUserRole(null);
    setCurrentUserId(null);
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
          <StudentApp userId={currentUserId} onLogout={handleLogout} />
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
          <DriverApp userId={currentUserId} onLogout={handleLogout} />
        </div>
      </div>
    );
  }

  if (userRole === 'admin') {
    return (
      <AdminDashboard onLogout={handleLogout} />
    );
  }

  // 2. RENDER MULTI-ROLE LIVE SANDBOX (Displays all side by side with sockets)
  if (userRole === 'sandbox') {
    return (
      <div style={{ background: 'var(--bg-main)', minHeight: '100vh', transition: 'all 0.3s' }}>
        <div className="sandbox-header" style={{ margin: '16px 24px', position: 'sticky', top: 16, zIndex: 1000 }}>
          <div className="brand-title">
            <Sparkles size={24} color="var(--accent-cyan)" />
            <span>VESA Transit Live Sandbox Environment</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={toggleTheme} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={handleLogout} className="btn-secondary" style={{ width: 'auto', padding: '8px 16px', fontSize: '13px' }}>
              Exit Sandbox
            </button>
          </div>
        </div>

        {/* 3 Pane layout */}
        <div style={{ 
          display: 'flex', 
          gap: '24px', 
          padding: '0 24px 24px 24px', 
          flexWrap: 'wrap', 
          alignItems: 'flex-start',
          justifyContent: 'center'
        }}>
          {/* Pane 1: Admin Web Dashboard */}
          <div style={{ flex: '1 1 800px', minWidth: '400px', background: 'var(--bg-surface-solid)', border: '1px solid var(--border-color)', borderRadius: '24px', overflow: 'hidden', boxShadow: 'var(--shadow-premium)' }}>
            <div style={{ height: '780px', overflowY: 'auto' }}>
              <AdminDashboard onLogout={handleLogout} />
            </div>
          </div>

          {/* Pane 2: Driver App Emulator */}
          <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>Driver Console (BUS-101)</span>
            <div className="phone-emulator">
              <DriverApp userId={6} onLogout={handleLogout} />
            </div>
          </div>

          {/* Pane 3: Student App Emulator */}
          <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>Student App (Alex Mercer)</span>
            <div className="phone-emulator">
              <StudentApp userId={1} onLogout={handleLogout} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. RENDER LOGIN SCREEN (Default landing)
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

        {/* Demo Sandbox Entry Option (Primary spotlighted click) */}
        <button 
          onClick={() => setUserRole('sandbox')}
          className="btn-primary" 
          style={{ 
            padding: '16px', fontSize: '15px', 
            background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-indigo) 100%)',
            boxShadow: '0 0 20px rgba(6,182,212,0.35)'
          }}
        >
          <Sparkles size={18} /> Enter Interactive Demo Sandbox
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Or Login Role</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }}></div>
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

        {/* Quick Seeder selectors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>Quick Autofill Credentials for Test Roles:</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            <button onClick={() => handleQuickLogin('student')} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', color: 'var(--text-primary)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <User size={10} /> Student
            </button>
            <button onClick={() => handleQuickLogin('driver')} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', color: 'var(--text-primary)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <Truck size={10} /> Driver
            </button>
            <button onClick={() => handleQuickLogin('admin')} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', color: 'var(--text-primary)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <Shield size={10} /> Admin
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
