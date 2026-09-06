import React from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ theme, onToggle, compact = false }) {
  const isDark = theme === 'dark';

  if (compact) {
    return (
      <button
        onClick={onToggle}
        type="button"
        title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        style={{
          background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
          border: '1px solid var(--border-color)',
          borderRadius: '20px',
          padding: '4px 10px',
          color: isDark ? '#fbbf24' : '#4f46e5',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          fontSize: '11px',
          fontWeight: '600',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        className="theme-toggle-compact"
      >
        {isDark ? <Sun size={13} /> : <Moon size={13} />}
        <span>{isDark ? 'Light' : 'Dark'}</span>
      </button>
    );
  }

  return (
    <button
      onClick={onToggle}
      type="button"
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
      aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
      style={{
        background: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: '8px 14px',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '13px',
        fontWeight: '600',
        fontFamily: 'var(--font-display)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        backdropFilter: 'var(--glass-blur)'
      }}
      className="theme-toggle-full"
    >
      <div style={{
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: isDark ? 'rgba(251, 191, 36, 0.15)' : 'rgba(99, 102, 241, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: isDark ? '#fbbf24' : '#6366f1'
      }}>
        {isDark ? <Sun size={13} /> : <Moon size={13} />}
      </div>
      <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
    </button>
  );
}
