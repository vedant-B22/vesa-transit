import React from 'react';
import QRCodeImage from '../LocalQRCode';

export default function BusScannerModal({ selectedBusForSticker, setSelectedBusForSticker }) {
  if (!selectedBusForSticker) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
      <div className="glass-card" style={{ width: 'min(95vw, 400px)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center', padding: '28px', border: '2px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)' }}>
          <img src="/icons/icon-192.png" alt="VESA" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
          <span style={{ fontSize: '13px', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase' }}>
            VESA Transit Bus Scanner Sticker
          </span>
        </div>
        
        <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
          <QRCodeImage 
            value={`VESA_BUS_${selectedBusForSticker.bus_number}`} 
            size={220} 
          />
        </div>

        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 4px 0', color: '#fff' }}>Bus {selectedBusForSticker.bus_number}</h2>
          <span style={{ fontSize: '13px', color: 'var(--accent-amber)', fontWeight: '700' }}>QR Code: VESA_BUS_{selectedBusForSticker.bus_number}</span>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Reg: {selectedBusForSticker.registration_number}</div>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
          Stick this physical QR code badge at the bus entrance door. Students scan this with their live camera on boarding to mark instant digital attendance.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%', marginTop: '8px' }}>
          <button onClick={() => window.print()} className="btn-secondary" style={{ padding: '10px', fontSize: '13px', fontWeight: '600' }}>
            Print Sticker
          </button>
          <button onClick={() => setSelectedBusForSticker(null)} className="btn-primary" style={{ padding: '10px', fontSize: '13px', fontWeight: '600' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
