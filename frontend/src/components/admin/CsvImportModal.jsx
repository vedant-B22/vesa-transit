import React, { useState, useEffect } from 'react';
import { Upload, MapPin, X, Info, Check } from 'lucide-react';

export default function CsvImportModal({
  isCsvModalOpen,
  setIsCsvModalOpen,
  defaultFeeAmount,
  setDefaultFeeAmount,
  feeDueDate,
  setFeeDueDate,
  csvText,
  setCsvText,
  handleImportCSV,
  routes = []
}) {
  const [allStops, setAllStops] = useState([]);
  const [loadingStops, setLoadingStops] = useState(false);

  useEffect(() => {
    if (isCsvModalOpen) {
      const token = localStorage.getItem('token') || '';
      setLoadingStops(true);
      fetch('/api/admin/routes/1/stops', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      })
        .then(res => res.json())
        .then(async (data1) => {
          let stopsList = Array.isArray(data1) ? data1 : [];
          // Also fetch route 2 stops if available
          try {
            const res2 = await fetch('/api/admin/routes/2/stops', {
              headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
            });
            const data2 = await res2.json();
            if (Array.isArray(data2)) {
              stopsList = [...stopsList, ...data2];
            }
          } catch (e) {}
          setAllStops(stopsList);
        })
        .catch(err => console.error(err))
        .finally(() => setLoadingStops(false));
    }
  }, [isCsvModalOpen]);

  if (!isCsvModalOpen) return null;

  const insertSampleTemplate = () => {
    setCsvText(
`Alex Mercer, alex.m@college.edu, VESA-2024-ST10, +91 9876543210, Malleswaram 8th Cross, Pass@123
Sophia Sterling, sophia.s@college.edu, VESA-2024-ST11, +91 9876543211, Majestic Hub, Pass@123
Liam Vance, liam.v@college.edu, VESA-2024-ST12, +91 9876543212, Yeshwanthpur Junction, Pass@123
Emily Thorne, emily.t@college.edu, VESA-2024-ST13, +91 9876543213, Koramangala Sony World, Pass@123`
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
      <div className="glass-card" style={{ width: 'min(95vw, 620px)', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '92vh', overflowY: 'auto', border: '1px solid var(--accent-cyan)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-cyan-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)' }}>
              <Upload size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: '800', margin: 0 }}>Student Batch CSV Importer</h3>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Bulk register students with automatic pickup stop matching</span>
            </div>
          </div>
          <button onClick={() => setIsCsvModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {/* Available Stops Reference Banner */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <MapPin size={12} /> Valid Pickup Stop Names (Click to copy name):
            </span>
            <button 
              type="button" 
              onClick={insertSampleTemplate} 
              style={{ background: 'var(--accent-cyan-light)', border: '1px solid rgba(6,182,212,0.3)', color: 'var(--accent-cyan)', fontSize: '11px', fontWeight: '700', padding: '3px 8px', borderRadius: '6px', cursor: 'pointer' }}
            >
              Fill Sample Data
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '72px', overflowY: 'auto' }}>
            {allStops.length > 0 ? (
              allStops.map(st => (
                <span 
                  key={st.id} 
                  onClick={() => navigator.clipboard && navigator.clipboard.writeText(st.name)}
                  title="Click to copy stop name"
                  style={{
                    fontSize: '10.5px',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer'
                  }}
                >
                  📍 {st.name}
                </span>
              ))
            ) : (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {loadingStops ? 'Loading stop names...' : 'Malleswaram 8th Cross, Majestic Hub, Yeshwanthpur Junction, VESA Campus Gate, Koramangala Sony World, HSR Ring Road, Indiranagar Metro Terminal'}
              </span>
            )}
          </div>
        </div>

        {/* Settings Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '11.5px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontWeight: '600' }}>
              Default Fee Amount (₹)
            </label>
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
            <label style={{ fontSize: '11.5px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px', fontWeight: '600' }}>
              Fee Due Date
            </label>
            <input 
              type="date" 
              className="input-field" 
              value={feeDueDate} 
              onChange={e => setFeeDueDate(e.target.value)} 
              required 
            />
          </div>
        </div>

        {/* CSV Text Input */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontWeight: '600' }}>
              Paste CSV Data (One student per line)
            </label>
            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
              Format: Name, Email, Roll Number, Phone, Pickup Stop, [Password]
            </span>
          </div>
          <textarea 
            className="input-field" 
            rows="7"
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            placeholder={"Alex Mercer, alex.m@college.edu, VESA-2024-ST01, +91 9876543210, Malleswaram 8th Cross, Password123\nSophia Sterling, sophia.s@college.edu, VESA-2024-ST02, +91 9876543211, Majestic Hub, SecurePass456"}
            style={{ resize: 'none', fontFamily: 'monospace', fontSize: '11.5px', lineHeight: '1.5' }}
          ></textarea>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button onClick={handleImportCSV} className="btn-primary" style={{ padding: '10px', fontSize: '13px', fontWeight: '700' }}>
            Start Batch Import
          </button>
          <button onClick={() => setIsCsvModalOpen(false)} className="btn-secondary" style={{ padding: '10px', fontSize: '13px' }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
