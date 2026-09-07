import React from 'react';
import { Plus, Upload, Camera, Edit, Trash2, X } from 'lucide-react';

export default function StudentManagement({
  students,
  buses,
  routes,
  studentForm,
  setStudentForm,
  handleAddStudent,
  setIsCsvModalOpen,
  isScanning,
  setIsScanning,
  scannedPassCode,
  setScannedPassCode,
  handleVerifyQRPass,
  scanResult,
  stats,
  setFeeModalStudent,
  setFeeAmount,
  setFeeStatus,
  studentEditModal,
  setStudentEditModal,
  handleUpdateStudent,
  handleDeleteStudent
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Split layout: Form and Batch Utilities */}
      <div className="admin-grid">
        {/* Form creation */}
        <div className="glass-card" style={{ gridColumn: 'span 4' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Add Enrolled Student</h3>
          <form onSubmit={handleAddStudent} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input type="text" className="input-field" placeholder="Full Name" value={studentForm.name} onChange={e => setStudentForm({...studentForm, name: e.target.value})} required />
            <input type="email" className="input-field" placeholder="College Email (@college.edu)" value={studentForm.email} onChange={e => setStudentForm({...studentForm, email: e.target.value})} required />
            <input type="text" className="input-field" placeholder="Roll Number (e.g. VESA-2024-ST99)" value={studentForm.rollNumber} onChange={e => setStudentForm({...studentForm, rollNumber: e.target.value})} required />
            <input type="text" className="input-field" placeholder="Emergency Contact Phone" value={studentForm.emergencyContact} onChange={e => setStudentForm({...studentForm, emergencyContact: e.target.value})} required />
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Assigned Bus</label>
                <select 
                  className="input-field"
                  value={studentForm.busId}
                  onChange={e => setStudentForm({...studentForm, busId: parseInt(e.target.value)})}
                  style={{ background: 'var(--bg-main)', marginTop: '4px' }}
                >
                  {buses.map(b => (
                    <option key={b.id} value={b.id}>{b.bus_number}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Assigned Route</label>
                <select 
                  className="input-field"
                  value={studentForm.routeId}
                  onChange={e => setStudentForm({...studentForm, routeId: parseInt(e.target.value)})}
                  style={{ background: 'var(--bg-main)', marginTop: '4px' }}
                >
                  {routes.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>
              <Plus size={16} /> Enroll Student
            </button>
          </form>
        </div>

        {/* CSV Import / Bus pass scan check */}
        <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* CSV triggers */}
          <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Import Student Database (CSV)</h3>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Batch import students list with auto-matching pickup stops.</span>
            </div>
            <button onClick={() => setIsCsvModalOpen(true)} className="btn-secondary" style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Upload size={14} /> Open CSV Importer
            </button>
          </div>

          {/* QR Pass Verification Scanner */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Student QR Pass Verification Terminal</h3>
              <button 
                onClick={() => setIsScanning(!isScanning)} 
                className="btn-primary" 
                style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Camera size={14} /> {isScanning ? 'Stop Camera' : 'Live Camera Scanner'}
              </button>
            </div>

            {isScanning && (
              <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', background: '#000', overflow: 'hidden' }}>
                <div id="qr-reader" style={{ width: '100%' }}></div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Input student pass code (e.g. QR_PASS_ST01)..." 
                value={scannedPassCode}
                onChange={e => setScannedPassCode(e.target.value)}
              />
              <button onClick={() => handleVerifyQRPass(scannedPassCode)} className="btn-primary" style={{ width: '160px' }}>Verify Pass</button>
            </div>
            {scanResult && (
              <div style={{
                padding: '12px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                background: scanResult.success ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                color: scanResult.success ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                border: '1px solid ' + (scanResult.success ? 'var(--accent-emerald)' : 'var(--accent-rose)')
              }}>
                {scanResult.message}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Students roster grid */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Student Database & Fee Approval Registry</h3>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Total Pending Fees: <b style={{ color: 'var(--accent-amber)' }}>₹{stats.pendingFees || 0}</b>
          </span>
        </div>
        <div className="table-responsive">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Roll Number</th>
                <th>Email</th>
                <th>Bus Line</th>
                <th>Pickup Stop</th>
                <th>Fee Status</th>
                <th>Pending Due</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.user_id}>
                  <td style={{ fontWeight: '700' }}>{s.name}</td>
                  <td>{s.roll_number}</td>
                  <td>{s.email}</td>
                  <td>{s.bus_number || 'Unassigned'}</td>
                  <td>{s.stop_name || 'Unassigned'}</td>
                  <td>
                    <span style={{
                      padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
                      background: s.fee_status === 'paid' ? 'rgba(16,185,129,0.1)' : s.fee_status === 'partial' ? 'rgba(245,158,11,0.1)' : 'rgba(244,63,94,0.1)',
                      color: s.fee_status === 'paid' ? 'var(--accent-emerald)' : s.fee_status === 'partial' ? 'var(--accent-amber)' : 'var(--accent-rose)'
                    }}>
                      {s.fee_status?.toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontWeight: '600', color: (s.pending_amount > 0 ? 'var(--accent-amber)' : 'var(--text-secondary)') }}>
                    ₹{s.pending_amount !== undefined ? s.pending_amount : (s.fee_status === 'paid' ? 0 : 5000)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button 
                        onClick={() => {
                          setFeeModalStudent(s);
                          setFeeAmount(s.pending_amount ? String(s.pending_amount) : '5000');
                          setFeeStatus('paid');
                        }} 
                        className="btn-primary" 
                        style={{ padding: '4px 10px', fontSize: '11px', width: 'auto' }}
                        title="Manual Admin Fee Approval"
                      >
                        Fee Approval
                      </button>
                      <button 
                        onClick={() => setStudentEditModal({ isOpen: true, data: { ...s } })} 
                        style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: '4px' }}
                        title="Edit Student Profile"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDeleteStudent(s.user_id)} 
                        style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', padding: '4px' }}
                        title="Delete Student"
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

      {/* Student Edit Modal Overlay */}
      {studentEditModal.isOpen && studentEditModal.data && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
          <div className="glass-card" style={{ width: '500px', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Edit Student Details</h3>
              <button onClick={() => setStudentEditModal({ isOpen: false, data: null })} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUpdateStudent} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Full Name</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={studentEditModal.data.name || ''} 
                  onChange={e => setStudentEditModal({ ...studentEditModal, data: { ...studentEditModal.data, name: e.target.value } })} 
                  required 
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>College Email</label>
                <input 
                  type="email" 
                  className="input-field" 
                  value={studentEditModal.data.email || ''} 
                  onChange={e => setStudentEditModal({ ...studentEditModal, data: { ...studentEditModal.data, email: e.target.value } })} 
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Roll Number</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={studentEditModal.data.roll_number || ''} 
                    onChange={e => setStudentEditModal({ ...studentEditModal, data: { ...studentEditModal.data, roll_number: e.target.value } })} 
                    required 
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Emergency Contact Phone</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={studentEditModal.data.emergency_contact || ''} 
                    onChange={e => setStudentEditModal({ ...studentEditModal, data: { ...studentEditModal.data, emergency_contact: e.target.value } })} 
                    required 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Assigned Bus</label>
                  <select 
                    className="input-field"
                    value={studentEditModal.data.bus_id || ''}
                    onChange={e => setStudentEditModal({ ...studentEditModal, data: { ...studentEditModal.data, bus_id: e.target.value } })}
                    style={{ background: 'var(--bg-main)' }}
                  >
                    <option value="">Unassigned</option>
                    {buses.map(b => (
                      <option key={b.id} value={b.id}>{b.bus_number}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Assigned Route</label>
                  <select 
                    className="input-field"
                    value={studentEditModal.data.route_id || ''}
                    onChange={e => setStudentEditModal({ ...studentEditModal, data: { ...studentEditModal.data, route_id: e.target.value } })}
                    style={{ background: 'var(--bg-main)' }}
                  >
                    <option value="">Unassigned</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
                <button type="submit" className="btn-primary">Save Changes</button>
                <button type="button" onClick={() => setStudentEditModal({ isOpen: false, data: null })} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
