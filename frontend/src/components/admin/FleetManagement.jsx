import React from 'react';
import { Plus, QrCode, Edit, Trash2, X } from 'lucide-react';

export default function FleetManagement({
  buses,
  busModal,
  setBusModal,
  handleSaveBus,
  handleDeleteBus,
  setSelectedBusForSticker
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Active Transit Fleet Registry</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Manage bus units, seating capacities, vehicle insurance, and print QR stickers.</span>
        </div>
        <button 
          onClick={() => setBusModal({
            isOpen: true,
            mode: 'add',
            data: { id: null, busNumber: '', registrationNumber: '', capacity: 45, totalMileage: 0, insuranceExpiry: new Date().toISOString().split('T')[0], status: 'active' }
          })}
          className="btn-primary" 
          style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={16} /> Add New Bus
        </button>
      </div>

      <div className="glass-card">
        <div className="table-responsive">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Bus Unit</th>
                <th>Registration Plate</th>
                <th>Capacity</th>
                <th>Mileage (Odometer)</th>
                <th>Insurance Renewal</th>
                <th>Status</th>
                <th>Bus Attendance QR</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {buses.map(b => (
                <tr key={b.id}>
                  <td style={{ fontWeight: '700' }}>{b.bus_number}</td>
                  <td>{b.registration_number}</td>
                  <td>{b.capacity} seats</td>
                  <td>{b.total_mileage} km</td>
                  <td>{b.insurance_expiry}</td>
                  <td>
                    <span style={{
                      padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
                      background: b.status === 'active' ? 'rgba(16,185,129,0.1)' : b.status === 'maintenance' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)',
                      color: b.status === 'active' ? 'var(--accent-emerald)' : b.status === 'maintenance' ? 'var(--accent-amber)' : 'var(--text-secondary)'
                    }}>
                      {b.status}
                    </span>
                  </td>
                  <td>
                    <button 
                      onClick={() => setSelectedBusForSticker(b)}
                      className="btn-secondary"
                      style={{ padding: '4px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <QrCode size={14} /> View QR Sticker
                    </button>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button 
                        onClick={() => setBusModal({
                          isOpen: true,
                          mode: 'edit',
                          data: {
                            id: b.id,
                            busNumber: b.bus_number,
                            registrationNumber: b.registration_number,
                            capacity: b.capacity,
                            totalMileage: b.total_mileage,
                            insuranceExpiry: b.insurance_expiry,
                            status: b.status
                          }
                        })}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: '4px' }}
                        title="Edit Bus"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteBus(b.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', padding: '4px' }}
                        title="Delete Bus"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Bus Modal */}
      {busModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
          <div className="glass-card" style={{ width: 'min(95vw, 480px)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
                {busModal.mode === 'add' ? 'Register New Bus Unit' : 'Edit Bus Details'}
              </h3>
              <button onClick={() => setBusModal({ ...busModal, isOpen: false })} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveBus} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Bus Unit / Identifier</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. BUS-105"
                    value={busModal.data.busNumber} 
                    onChange={e => setBusModal({ ...busModal, data: { ...busModal.data, busNumber: e.target.value } })} 
                    required 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Registration Plate</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="e.g. KA-01-EQ-9921"
                    value={busModal.data.registrationNumber} 
                    onChange={e => setBusModal({ ...busModal, data: { ...busModal.data, registrationNumber: e.target.value } })} 
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Seating Capacity</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    placeholder="45"
                    value={busModal.data.capacity} 
                    onChange={e => setBusModal({ ...busModal, data: { ...busModal.data, capacity: e.target.value } })} 
                    required 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Total Mileage (km)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    className="input-field" 
                    placeholder="0"
                    value={busModal.data.totalMileage} 
                    onChange={e => setBusModal({ ...busModal, data: { ...busModal.data, totalMileage: e.target.value } })} 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Insurance Expiry Date</label>
                  <input 
                    type="date" 
                    className="input-field" 
                    value={busModal.data.insuranceExpiry} 
                    onChange={e => setBusModal({ ...busModal, data: { ...busModal.data, insuranceExpiry: e.target.value } })} 
                    required 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Operational Status</label>
                  <select 
                    className="input-field"
                    value={busModal.data.status}
                    onChange={e => setBusModal({ ...busModal, data: { ...busModal.data, status: e.target.value } })}
                    style={{ background: 'var(--bg-main)' }}
                  >
                    <option value="active">Active / Operational</option>
                    <option value="maintenance">Under Maintenance</option>
                    <option value="inactive">Inactive / Reserve</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
                <button type="submit" className="btn-primary">
                  {busModal.mode === 'add' ? 'Register Bus' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setBusModal({ ...busModal, isOpen: false })} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
