import React from 'react';
import { 
  BarChart2, Users, Navigation, UserCheck, Wrench, Route as RouteIcon, Bell 
} from 'lucide-react';
import ThemeToggle from '../ThemeToggle';

export default function AdminSidebar({ activeMenu, setActiveMenu, onLogout, theme, toggleTheme, isMobileOpen, setIsMobileOpen }) {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard Control', icon: <BarChart2 size={16} /> },
    { id: 'tracking', label: 'Live Tracking Map', icon: <Navigation size={16} /> },
    { id: 'attendance', label: 'Student Attendance', icon: <UserCheck size={16} /> },
    { id: 'students', label: 'Students Console', icon: <Users size={16} /> },
    { id: 'drivers', label: 'Drivers Register', icon: <Users size={16} /> },
    { id: 'buses', label: 'Fleet Registry', icon: <Wrench size={16} /> },
    { id: 'routes', label: 'Route Planners & Stops', icon: <RouteIcon size={16} /> },
    { id: 'broadcast', label: 'Alert Broadcasting', icon: <Bell size={16} /> }
  ];

  return (
    <div className={`admin-sidebar ${isMobileOpen ? 'mobile-open' : ''}`} style={{
      width: '270px',
      background: 'var(--bg-surface-solid)',
      borderRight: '1px solid var(--border-color)',
      padding: '24px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '28px',
      flexShrink: 0
    }}>
      <div>
        <div className="brand-title">
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'var(--accent-cyan-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(6,182,212,0.3)',
            overflow: 'hidden'
          }}>
            <img src="/icons/icon-192.png" alt="VESA Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          </div>
          <span>VESA Transit</span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', display: 'block', paddingLeft: '48px', fontWeight: '500' }}>
          Operations & Fleet Control
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {menuItems.map(item => {
          const isActive = activeMenu === item.id;
          return (
            <button 
              key={item.id}
              onClick={() => {
                setActiveMenu(item.id);
                if (setIsMobileOpen) setIsMobileOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '11px 14px',
                background: isActive ? 'var(--accent-cyan-light)' : 'transparent',
                border: isActive ? '1px solid rgba(6,182,212,0.3)' : '1px solid transparent',
                borderRadius: '10px', 
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                fontSize: '13.5px',
                fontWeight: isActive ? '700' : '500', 
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <div style={{ color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                {item.icon}
              </div>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {toggleTheme && <ThemeToggle theme={theme} onToggle={toggleTheme} />}
        <button onClick={onLogout} className="btn-secondary" style={{ width: '100%', borderColor: 'rgba(244,63,94,0.3)', color: 'var(--accent-rose)', fontSize: '13px' }}>
          Logout Admin
        </button>
      </div>
    </div>
  );
}
