import React from 'react';
import { Bell } from 'lucide-react';

export default function BroadcastAlerts({
  broadcastType,
  setBroadcastType,
  broadcastTargetId,
  setBroadcastTargetId,
  broadcastTitle,
  setBroadcastTitle,
  broadcastMsg,
  setBroadcastMsg,
  handleSendBroadcast,
  complaints
}) {
  return (
    <div className="admin-grid">
      {/* Form */}
      <div className="glass-card" style={{ gridColumn: 'span 6' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Dispatch Alert Broadcast Notification</h3>
        <form onSubmit={handleSendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Recipient Scope</label>
            <select className="input-field" value={broadcastType} onChange={e => setBroadcastType(e.target.value)} style={{ background: 'var(--bg-main)' }}>
              <option value="all">Entire College Scope</option>
              <option value="route">Selected Transit Route</option>
              <option value="student">Targeted Student User</option>
            </select>
          </div>

          {broadcastType !== 'all' && (
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Target ID (Route ID or Student User ID)</label>
              <input type="number" className="input-field" placeholder="Input target ID..." value={broadcastTargetId} onChange={e => setBroadcastTargetId(e.target.value)} required />
            </div>
          )}

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Notification Subject</label>
            <input type="text" className="input-field" placeholder="Subject line..." value={broadcastTitle} onChange={e => setBroadcastTitle(e.target.value)} required />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Broadcasting Message Body</label>
            <textarea className="input-field" rows="4" placeholder="Notification details..." value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} style={{ resize: 'none' }} required></textarea>
          </div>

          <button type="submit" className="btn-primary">
            <Bell size={16} /> Broadcast Push Alerts
          </button>
        </form>
      </div>

      {/* Suggestions & Complaints feed */}
      <div className="glass-card" style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Recent Student Feedback Reports</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {complaints.length === 0 ? (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No recent reports registered.</span>
          ) : (
            complaints.map(comp => (
              <div key={comp.id} style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{
                    padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700',
                    background: comp.category === 'bus_issue' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)',
                    color: comp.category === 'bus_issue' ? 'var(--accent-amber)' : 'var(--text-primary)'
                  }}>
                    {comp.category}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Student: {comp.student_name}</span>
                </div>
                <p style={{ fontSize: '12px', marginTop: '6px', color: 'var(--text-secondary)' }}>{comp.description}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
