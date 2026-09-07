import React from 'react';
import { Plus, Edit, Trash2, X } from 'lucide-react';

export default function DriverManagement({
  drivers,
  buses,
  driverModal,
  setDriverModal,
  handleSaveDriver,
  handleDeleteDriver
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Driver Employment Register</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Manage transit drivers, credentials, phone lines, and bus assignments.</span>
        </div>
        <button 
          onClick={() => setDriverModal({
            isOpen: true,
            mode: 'add',
            data: { name: '', email: '', phone: '', licenseNumber: '', activeBusId: '', initialPassword: '' }
          })}
          className="btn-primary" 
          style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={16} /> Add New Driver
        </button>
      </div>

      <div className="glass-card">
        <div className="table-responsive">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Driver Name</th>
                <th>Email Address</th>
                <th>Phone Line</th>
                <th>License Number</th>
                <th>Bus Assigned</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map(d => (
                <tr key={d.user_id}>
                  <td style={{ fontWeight: '700' }}>{d.name}</td>
                  <td>{d.email}</td>
                  <td>{d.phone}</td>
                  <td>{d.license_number}</td>
                  <td>{d.bus_number || 'Unassigned'}</td>
                  <td>
                    <span style={{
                      padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
                      background: d.status === 'on_trip' ? 'rgba(6,182,212,0.1)' : d.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                      color: d.status === 'on_trip' ? 'var(--accent-cyan)' : d.status === 'active' ? 'var(--accent-emerald)' : 'var(--text-secondary)'
                    }}>
                      {d.status === 'on_trip' ? 'On Road' : d.status === 'active' ? 'Duty Ready' : 'Off duty'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button 
                        onClick={() => setDriverModal({
                          isOpen: true,
                          mode: 'edit',
                          data: { user_id: d.user_id, name: d.name, email: d.email, phone: d.phone, licenseNumber: d.license_number, activeBusId: d.active_bus_id || '' }
                        })}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: '4px' }}
                        title="Edit Driver"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteDriver(d.user_id)}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', padding: '4px' }}
                        title="Delete Driver"
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

      {/* Add / Edit Driver Modal */}
      {driverModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
          <div className="glass-card" style={{ width: '480px', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
                {driverModal.mode === 'add' ? 'Add New Transit Driver' : 'Edit Driver Details'}
              </h3>
              <button onClick={() => setDriverModal({ ...driverModal, isOpen: false })} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveDriver} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Driver Full Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="e.g. Ramesh Kumar"
                  value={driverModal.data.name} 
                  onChange={e => setDriverModal({ ...driverModal, data: { ...driverModal.data, name: e.target.value } })} 
                  required 
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Email Address</label>
                <input 
                  type="email" 
                  className="input-field" 
                  placeholder="driver@college.edu"
                  value={driverModal.data.email} 
                  onChange={e => setDriverModal({ ...driverModal, data: { ...driverModal.data, email: e.target.value } })} 
                  required 
                />
              </div>

              {driverModal.mode === 'add' && (
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Initial Login Password</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="Leave blank to auto-generate or set password"
                    value={driverModal.data.initialPassword || ''} 
                    onChange={e => setDriverModal({ ...driverModal, data: { ...driverModal.data, initialPassword: e.target.value } })} 
                  />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Phone Number</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="+91 9876543210"
                    value={driverModal.data.phone} 
                    onChange={e => setDriverModal({ ...driverModal, data: { ...driverModal.data, phone: e.target.value } })} 
                    required 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Commercial License Number</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="KA-DL-2022-9901"
                    value={driverModal.data.licenseNumber} 
                    onChange={e => setDriverModal({ ...driverModal, data: { ...driverModal.data, licenseNumber: e.target.value } })} 
                    required 
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Assign Active Bus</label>
                <select 
                  className="input-field"
                  value={driverModal.data.activeBusId || ''}
                  onChange={e => setDriverModal({ ...driverModal, data: { ...driverModal.data, activeBusId: e.target.value } })}
                  style={{ background: 'var(--bg-main)' }}
                >
                  <option value="">None / Floating Driver</option>
                  {buses.map(b => (
                    <option key={b.id} value={b.id}>{b.bus_number} ({b.registration_number})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
                <button type="submit" className="btn-primary">
                  {driverModal.mode === 'add' ? 'Create Driver Account' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setDriverModal({ ...driverModal, isOpen: false })} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
