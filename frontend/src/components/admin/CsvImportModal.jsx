import React from 'react';

export default function CsvImportModal({
  isCsvModalOpen,
  setIsCsvModalOpen,
  defaultFeeAmount,
  setDefaultFeeAmount,
  feeDueDate,
  setFeeDueDate,
  csvText,
  setCsvText,
  handleImportCSV
}) {
  if (!isCsvModalOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
      <div className="glass-card" style={{ width: 'min(95vw, 580px)', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700' }}>CSV Database Importer</h3>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Input comma-separated values (One student per line):<br/>
          <b>Format: Full Name, Email, Roll Number, Contact Number, Pickup Point, Password</b>
        </span>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Default Fee Amount (₹)</label>
            <input 
              type="number" 
              className="input-field" 
              placeholder="5000" 
              value={defaultFeeAmount} 
              onChange={e => setDefaultFeeAmount(e.target.value)} 
              min="0"
              required 
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Fee Due Date</label>
            <input 
              type="date" 
              className="input-field" 
              value={feeDueDate} 
              onChange={e => setFeeDueDate(e.target.value)} 
              required 
            />
          </div>
        </div>

        <div>
          <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Student CSV Data</label>
          <textarea 
            className="input-field" 
            rows="6"
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            placeholder={"Alex Mercer, alex@college.edu, VESA-2024-ST01, +91 9876543210, Malleswaram 8th Cross, Password123\nSophia Sterling, sophia@college.edu, VESA-2024-ST02, +91 9876543211, Majestic Hub, SecurePass456"}
            style={{ resize: 'none', fontFamily: 'monospace', fontSize: '12px' }}
          ></textarea>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button onClick={handleImportCSV} className="btn-primary">Import Batch</button>
          <button onClick={() => setIsCsvModalOpen(false)} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}
