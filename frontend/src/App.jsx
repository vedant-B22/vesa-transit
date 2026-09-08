import React, { useState, useEffect } from 'react';
import { Truck, ShieldCheck, ArrowRight, Download, Smartphone, Share, PlusSquare, X, CheckCircle } from 'lucide-react';
import StudentApp from './components/StudentApp';
import DriverApp from './components/DriverApp';
import AdminDashboard from './components/AdminDashboard';
import ThemeToggle from './components/ThemeToggle';

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('vesa_theme') || 'dark');
  const [userRole, setUserRole] = useState(null); // 'student', 'driver', 'admin', or null
  const [currentUserId, setCurrentUserId] = useState(null); // ID of logged user
  const [token, setToken] = useState(localStorage.getItem('vesa_token') || null);

  // PWA Install State & First-Time User Prompt
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isAppInstalled, setIsAppInstalled] = useState(() => {
    return (typeof window !== 'undefined' && (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      localStorage.getItem('vesa_pwa_installed') === 'true'
    ));
  });
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  // Form logins
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      const hasDismissed = localStorage.getItem('vesa_pwa_dismissed') === 'true';
      if (!isAppInstalled && !hasDismissed) {
        setTimeout(() => setShowInstallModal(true), 1200);
      }
    };

    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      setShowInstallModal(false);
      localStorage.setItem('vesa_pwa_installed', 'true');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    
    if (isIos && !isStandalone && !isAppInstalled) {
      setIsInstallable(true);
      const hasDismissed = localStorage.getItem('vesa_pwa_dismissed') === 'true';
      if (!hasDismissed) {
        setTimeout(() => setShowInstallModal(true), 1500);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isAppInstalled]);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem('vesa_pwa_installed', 'true');
        setIsAppInstalled(true);
        setShowInstallModal(false);
      }
      setDeferredPrompt(null);
    } else {
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      if (isIos) {
        setShowIosGuide(true);
        setShowInstallModal(true);
      } else {
        alert('To install VESA Transit on your device, click the Install App icon in your browser URL bar or select "Install / Add to Home Screen" from the browser menu (⋮).');
      }
    }
  };

  const handleDismissModal = () => {
    setShowInstallModal(false);
    localStorage.setItem('vesa_pwa_dismissed', 'true');
  };

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
      <div style={{ position: 'absolute', top: 24, right: 24, zIndex: 10, display: 'flex', alignItems: 'center', gap: '10px' }}>
        {!isAppInstalled && (
          <button
            onClick={handleInstallApp}
            className="btn-primary"
            style={{
              padding: '8px 14px',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: '700',
              boxShadow: '0 0 15px rgba(6, 182, 212, 0.4)'
            }}
          >
            <Download size={15} /> Download App
          </button>
        )}
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
      </div>

      <div className="glass-card" style={{ width: '100%', maxWidth: '440px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
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

        {/* 1st User Visible Download App Banner */}
        {!isAppInstalled && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(6,182,212,0.15) 0%, rgba(99,102,241,0.15) 100%)',
            border: '1.5px solid var(--accent-cyan)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            boxShadow: '0 4px 15px rgba(6,182,212,0.15)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
                <Smartphone size={20} />
              </div>
              <div>
                <div style={{ fontSize: '12.5px', fontWeight: '800', color: 'var(--text-primary)' }}>Install VESA Mobile App</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Live GPS tracking & offline pass</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleInstallApp}
              className="btn-primary"
              style={{ width: 'auto', padding: '7px 14px', fontSize: '11.5px', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', fontWeight: '800' }}
            >
              <Download size={14} /> Install App
            </button>
          </div>
        )}

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

      {/* 1st User PWA Installation Popup Modal */}
      {showInstallModal && !isAppInstalled && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.78)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          zIndex: 10000,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '16px'
        }}>
          <div className="glass-card" style={{
            width: 'min(95vw, 420px)',
            background: 'var(--bg-surface-solid)',
            border: '1.5px solid var(--accent-cyan)',
            padding: '24px',
            borderRadius: '20px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(6,182,212,0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src="/icons/icon-192.png" alt="VESA" style={{ width: '48px', height: '48px', borderRadius: '12px', objectFit: 'contain' }} />
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>Install VESA Transit App</h3>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Official Progressive Web App (PWA)</span>
                </div>
              </div>
              <button 
                onClick={handleDismissModal} 
                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text-secondary)', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Benefits */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-card)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <CheckCircle size={15} color="var(--accent-emerald)" />
                <span><b>1-Tap Instant Launch:</b> Open directly from your home screen</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <CheckCircle size={15} color="var(--accent-cyan)" />
                <span><b>Continuous GPS Tracking:</b> Real-time stop & bus arrival alerts</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                <CheckCircle size={15} color="var(--accent-indigo)" />
                <span><b>Offline Boarding Pass:</b> Access your QR pass without internet</span>
              </div>
            </div>

            {/* iOS Safari instructions if on iOS */}
            {showIosGuide && (
              <div style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.25)', padding: '12px', borderRadius: '10px', fontSize: '11.5px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
                <div style={{ fontWeight: '700', color: 'var(--accent-cyan)', marginBottom: '4px' }}>📱 iOS Safari Setup:</div>
                <div>1. Tap the <b>Share button <Share size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /></b> in Safari.</div>
                <div>2. Select <b>"Add to Home Screen" <PlusSquare size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /></b>.</div>
                <div>3. Tap <b>"Add"</b> in the top right.</div>
              </div>
            )}

            {/* CTA Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={handleInstallApp}
                className="btn-primary"
                style={{ padding: '13px', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: '800' }}
              >
                <Download size={18} /> Download & Install App
              </button>
              <button
                type="button"
                onClick={handleDismissModal}
                className="btn-secondary"
                style={{ padding: '10px', fontSize: '12px', textAlign: 'center' }}
              >
                Maybe Later • Continue in Web Browser
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
