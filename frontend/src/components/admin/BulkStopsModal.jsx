import React from 'react';
import { Upload, X } from 'lucide-react';

export default function BulkStopsModal({
  isBulkStopsModalOpen,
  setIsBulkStopsModalOpen,
  bulkStopsRouteId,
  setBulkStopsRouteId,
  routes,
  bulkStopsCsvText,
  setBulkStopsCsvText,
  bulkStopsLoading,
  handleBulkImportStops
}) {
  if (!isBulkStopsModalOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
      <div className="glass-card" style={{ width: '600px', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Bulk Import Route Stops (CSV)</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Import all pickup points with coordinates and schedules for a route in one batch.
            </span>
          </div>
          <button onClick={() => setIsBulkStopsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleBulkImportStops} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Select Target Transit Route</label>
            <select 
              className="input-field" 
              value={bulkStopsRouteId} 
              onChange={e => setBulkStopsRouteId(e.target.value)}
              style={{ background: 'var(--bg-main)' }}
              required
            >
              <option value="">-- Choose Route --</option>
              {routes.map(r => (
                <option key={r.id} value={r.id}>{r.name} ({r.start_location} → {r.end_location})</option>
              ))}
            </select>
          </div>

          <div style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.2)', borderRadius: '8px', padding: '12px', fontSize: '12px', lineHeight: '1.5' }}>
            <div style={{ fontWeight: '700', color: 'var(--accent-cyan)', marginBottom: '4px' }}>CSV Format (5 columns per line):</div>
            <code style={{ fontSize: '11px', color: 'var(--text-primary)' }}>
              Pickup Point Name, Pickup Time, Latitude, Longitude, Sequence Number
            </code>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Example:<br/>
              Navale Bridge, 07:15 AM, 12.9716, 77.5946, 1<br/>
              Chandani Chowk, 07:30 AM, 12.9810, 77.6010, 2
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Paste CSV Content</label>
            <textarea 
              className="input-field" 
              rows="8" 
              placeholder={"Navale Bridge, 07:15 AM, 12.9716, 77.5946, 1\nChandani Chowk, 07:30 AM, 12.9810, 77.6010, 2\nKothrud Stand, 07:45 AM, 12.9920, 77.6100, 3"}
              value={bulkStopsCsvText} 
              onChange={e => setBulkStopsCsvText(e.target.value)} 
              style={{ fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '6px' }}>
            <button type="submit" disabled={bulkStopsLoading} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Upload size={16} /> {bulkStopsLoading ? 'Importing Stops...' : 'Import Stops Batch'}
            </button>
            <button type="button" onClick={() => setIsBulkStopsModalOpen(false)} className="btn-secondary">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
