import React, { useState } from 'react';
import { 
  RefreshCw, Shield, Filter, Calendar, X, CheckCircle, Phone, Search 
} from 'lucide-react';

export default function AttendanceManagement({
  attendanceList,
  attendanceLoading,
  fetchAttendanceList,
  routes,
  buses,
  attendanceFilterDate,
  setAttendanceFilterDate,
  attendanceFilterRoute,
  setAttendanceFilterRoute,
  attendanceFilterBus,
  setAttendanceFilterBus,
  attendanceFilterStatus,
  setAttendanceFilterStatus,
  attendanceWindowStatus,
  attendanceWindowMode,
  attendanceWindowSaving,
  updateAttendanceWindowSetting
}) {
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('');

  const filteredAttendance = attendanceList.filter(record => {
    if (!attendanceSearchQuery.trim()) return true;
    const q = attendanceSearchQuery.toLowerCase();
    return (
      (record.student_name && record.student_name.toLowerCase().includes(q)) ||
      (record.roll_number && record.roll_number.toLowerCase().includes(q)) ||
      (record.stop_name && record.stop_name.toLowerCase().includes(q)) ||
      (record.route_name && record.route_name.toLowerCase().includes(q)) ||
      (record.bus_number && String(record.bus_number).toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>Student Attendance & Verification Log</h2>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Live boarding scans and attendance records across all college transit routes.
          </span>
        </div>
        <button 
          onClick={fetchAttendanceList} 
          className="btn-secondary" 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px' }}
          disabled={attendanceLoading}
        >
          <RefreshCw size={14} className={attendanceLoading ? 'animate-spin' : ''} />
          Refresh Logs
        </button>
      </div>

      {/* Attendance Metric Cards */}
      <div className="admin-stat-grid-4">
        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Records Logged</span>
          <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px', color: 'var(--text-primary)' }}>
            {attendanceList.length}
          </div>
        </div>
        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Boarded / Present</span>
          <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px', color: 'var(--accent-emerald)' }}>
            {attendanceList.filter(a => a.attendance_status === 'present').length}
          </div>
        </div>
        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Awaiting / Absent</span>
          <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px', color: 'var(--accent-amber)' }}>
            {attendanceList.filter(a => a.attendance_status === 'absent').length}
          </div>
        </div>
        <div className="glass-card" style={{ padding: '16px 20px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Not Coming (Opted-Out)</span>
          <div style={{ fontSize: '24px', fontWeight: '800', marginTop: '4px', color: 'var(--accent-rose)' }}>
            {attendanceList.filter(a => a.attendance_status === 'not_coming').length}
          </div>
        </div>
      </div>

      {/* Attendance Scanning Window Override Control */}
      <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderLeft: '4px solid var(--accent-cyan)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} color="var(--accent-cyan)" />
            <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0 }}>Attendance Scanning Window Enforcement</h3>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              padding: '2px 8px',
              borderRadius: '12px',
              background: attendanceWindowStatus?.isAllowed ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
              color: attendanceWindowStatus?.isAllowed ? 'var(--accent-emerald)' : 'var(--accent-rose)'
            }}>
              {attendanceWindowStatus?.isAllowed ? '● Scanning OPEN' : '● Scanning LOCKED'}
            </span>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Controls when students can scan the bus QR code to log digital attendance. Scheduled hours: Morning 07:00–09:30 AM & Evening 04:30–07:00 PM.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => updateAttendanceWindowSetting('active')}
            disabled={attendanceWindowSaving}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '700',
              borderRadius: '6px',
              border: '1px solid ' + (attendanceWindowMode === 'active' ? 'var(--accent-emerald)' : 'var(--border-color)'),
              background: attendanceWindowMode === 'active' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.03)',
              color: attendanceWindowMode === 'active' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            Active (24/7 Open)
          </button>
          <button
            type="button"
            onClick={() => updateAttendanceWindowSetting('auto')}
            disabled={attendanceWindowSaving}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '700',
              borderRadius: '6px',
              border: '1px solid ' + (attendanceWindowMode === 'auto' ? 'var(--accent-cyan)' : 'var(--border-color)'),
              background: attendanceWindowMode === 'auto' ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.03)',
              color: attendanceWindowMode === 'auto' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            Auto (Trip Hours)
          </button>
          <button
            type="button"
            onClick={() => updateAttendanceWindowSetting('inactive')}
            disabled={attendanceWindowSaving}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: '700',
              borderRadius: '6px',
              border: '1px solid ' + (attendanceWindowMode === 'inactive' ? 'var(--accent-rose)' : 'var(--border-color)'),
              background: attendanceWindowMode === 'inactive' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.03)',
              color: attendanceWindowMode === 'inactive' ? 'var(--accent-rose)' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            Inactive (Locked)
          </button>
        </div>
      </div>

      {/* Filter Bar with Real-time Search */}
      <div className="glass-card" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)', fontWeight: '700', fontSize: '13px' }}>
          <Filter size={16} /> Filters:
        </div>

        {/* Search by student name / roll number / stop */}
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input-field"
            placeholder="Search student, roll #, stop..."
            value={attendanceSearchQuery}
            onChange={e => setAttendanceSearchQuery(e.target.value)}
            style={{ paddingLeft: '32px', fontSize: '12px', width: '100%', background: 'var(--bg-main)' }}
          />
          {attendanceSearchQuery && (
            <button
              type="button"
              onClick={() => setAttendanceSearchQuery('')}
              style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Date Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={14} color="var(--text-secondary)" />
          <input 
            type="date" 
            className="input-field" 
            value={attendanceFilterDate} 
            onChange={e => setAttendanceFilterDate(e.target.value)} 
            style={{ padding: '6px 12px', fontSize: '13px', background: 'var(--bg-main)' }}
          />
        </div>

        {/* Route Filter */}
        <div>
          <select 
            className="input-field" 
            value={attendanceFilterRoute} 
            onChange={e => setAttendanceFilterRoute(e.target.value)}
            style={{ padding: '6px 12px', fontSize: '13px', background: 'var(--bg-main)' }}
          >
            <option value="">All Routes</option>
            {routes.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        {/* Bus Filter */}
        <div>
          <select 
            className="input-field" 
            value={attendanceFilterBus} 
            onChange={e => setAttendanceFilterBus(e.target.value)}
            style={{ padding: '6px 12px', fontSize: '13px', background: 'var(--bg-main)' }}
          >
            <option value="">All Buses</option>
            {buses.map(b => (
              <option key={b.id} value={b.id}>Bus {b.bus_number} ({b.registration_number})</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select 
            className="input-field" 
            value={attendanceFilterStatus} 
            onChange={e => setAttendanceFilterStatus(e.target.value)}
            style={{ padding: '6px 12px', fontSize: '13px', background: 'var(--bg-main)' }}
          >
            <option value="">All Statuses</option>
            <option value="present">Boarded / Present</option>
            <option value="absent">Awaiting / Absent</option>
            <option value="not_coming">Not Coming</option>
          </select>
        </div>

        {/* Clear filters */}
        {(attendanceFilterDate || attendanceFilterRoute || attendanceFilterBus || attendanceFilterStatus || attendanceSearchQuery) && (
          <button 
            onClick={() => {
              setAttendanceFilterDate('');
              setAttendanceFilterRoute('');
              setAttendanceFilterBus('');
              setAttendanceFilterStatus('');
              setAttendanceSearchQuery('');
            }}
            style={{ background: 'transparent', border: 'none', color: 'var(--accent-rose)', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <X size={14} /> Reset Filters
          </button>
        )}
      </div>

      {/* Attendance Records Table */}
      <div className="glass-card">
        <div className="table-responsive">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll Number</th>
                <th>Route / Stop</th>
                <th>Bus Unit</th>
                <th>Verification Time</th>
                <th>Status</th>
                <th>Emergency Contact</th>
              </tr>
            </thead>
            <tbody>
              {attendanceLoading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                    Loading attendance records...
                  </td>
                </tr>
              ) : filteredAttendance.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                    {attendanceSearchQuery ? `No attendance records matching "${attendanceSearchQuery}"` : 'No attendance records found for the selected filters.'}
                  </td>
                </tr>
              ) : (
                filteredAttendance.map((record) => (
                  <tr key={record.attendance_id}>
                    <td>
                      <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{record.student_name}</div>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ID #{record.student_id}</span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                        {record.roll_number}
                      </span>
                    </td>
                    <td>
                      <div>{record.route_name || 'Unassigned'}</div>
                      <span style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>
                        Stop: {record.stop_name || 'Standard Stop'}
                      </span>
                    </td>
                    <td>
                      {record.bus_number ? (
                        <div>
                          <strong>Bus {record.bus_number}</strong>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{record.registration_number}</div>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td>
                      {record.recorded_at ? (
                        (() => {
                          const d = new Date(record.recorded_at);
                          const isValid = !isNaN(d.getTime());
                          return isValid ? (
                            <div>
                              <div style={{ fontWeight: '600' }}>{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                {d.toLocaleDateString()}
                              </span>
                            </div>
                          ) : (
                            <div>{String(record.recorded_at)}</div>
                          );
                        })()
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td>
                      {record.attendance_status === 'present' && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700',
                          background: 'rgba(16,185,129,0.15)', color: 'var(--accent-emerald)', border: '1px solid rgba(16,185,129,0.3)'
                        }}>
                          <CheckCircle size={12} /> Boarded
                        </span>
                      )}
                      {record.attendance_status === 'absent' && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700',
                          background: 'rgba(245,158,11,0.15)', color: 'var(--accent-amber)', border: '1px solid rgba(245,158,11,0.3)'
                        }}>
                          Awaiting / Absent
                        </span>
                      )}
                      {record.attendance_status === 'not_coming' && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700',
                          background: 'rgba(244,63,94,0.15)', color: 'var(--accent-rose)', border: '1px solid rgba(244,63,94,0.3)'
                        }}>
                          <X size={12} /> Not Coming
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Phone size={12} color="var(--text-secondary)" />
                        {record.emergency_contact || 'N/A'}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
