import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, Shield, Filter, Calendar, X, CheckCircle, Phone, Search,
  Users, Bus, CheckCircle2, AlertTriangle, ArrowRight, Download, BarChart2,
  Clock, Sparkles
} from 'lucide-react';

export default function AttendanceManagement({
  attendanceList = [],
  attendanceLoading,
  fetchAttendanceList,
  routes = [],
  buses = [],
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
  const [activeAttendanceTab, setActiveAttendanceTab] = useState('live'); // 'live' | 'directory' | 'logs'
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('');
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [rateFilter, setRateFilter] = useState('all'); // 'all' | 'at_risk' | 'good'

  const fetchSummary = async () => {
    try {
      setSummaryLoading(true);
      const token = localStorage.getItem('token') || '';
      const res = await fetch('/api/admin/attendance/summary', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch (e) {
      console.error('Error fetching attendance summary:', e);
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleRefreshAll = () => {
    fetchAttendanceList();
    fetchSummary();
  };

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

  const studentRatesList = (summaryData?.studentRates || []).filter(s => {
    if (rateFilter === 'regular' && Number(s.attendance_rate) < 60) return false;
    if (rateFilter === 'occasional' && Number(s.attendance_rate) >= 60) return false;
    if (!attendanceSearchQuery.trim()) return true;
    const q = attendanceSearchQuery.toLowerCase();
    return (
      (s.name && s.name.toLowerCase().includes(q)) ||
      (s.roll_number && s.roll_number.toLowerCase().includes(q)) ||
      (s.stop_name && s.stop_name.toLowerCase().includes(q)) ||
      (s.route_name && s.route_name.toLowerCase().includes(q))
    );
  });

  const presentCount = attendanceList.filter(a => a.attendance_status === 'present').length;
  const absentCount = attendanceList.filter(a => a.attendance_status === 'absent').length;
  const optedOutCount = attendanceList.filter(a => a.attendance_status === 'not_coming').length;
  const totalCount = attendanceList.length || 0;
  const boardingRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
            Student Attendance & Boarding Operations
          </h2>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Live verification scans, route progress tracking, and student attendance rate analytics.
          </span>
        </div>
        <button 
          onClick={handleRefreshAll} 
          className="btn-secondary" 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '12px' }}
          disabled={attendanceLoading || summaryLoading}
        >
          <RefreshCw size={14} className={attendanceLoading || summaryLoading ? 'animate-spin' : ''} />
          Refresh Live Logs
        </button>
      </div>

      {/* 2. Top Summary KPI Cards */}
      <div className="admin-stat-grid-4">
        <div className="glass-card" style={{ padding: '18px 20px', borderLeft: '4px solid var(--accent-cyan)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Active Boarding Rate</span>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '4px', color: 'var(--accent-cyan)' }}>
            {boardingRate}%
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{presentCount} of {totalCount} students checked in</span>
        </div>
        <div className="glass-card" style={{ padding: '18px 20px', borderLeft: '4px solid var(--accent-emerald)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Boarded / Present</span>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '4px', color: 'var(--accent-emerald)' }}>
            {presentCount}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--accent-emerald)' }}>● Verified on vehicle</span>
        </div>
        <div className="glass-card" style={{ padding: '18px 20px', borderLeft: '4px solid var(--accent-amber)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Awaiting / Absent</span>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '4px', color: 'var(--accent-amber)' }}>
            {absentCount}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--accent-amber)' }}>● Pending check-in</span>
        </div>
        <div className="glass-card" style={{ padding: '18px 20px', borderLeft: '4px solid var(--accent-rose)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Opted-Out (Today)</span>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '4px', color: 'var(--accent-rose)' }}>
            {optedOutCount}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--accent-rose)' }}>● Not commuting today</span>
        </div>
      </div>

      {/* 3. Attendance Scanning Window Override Control */}
      <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', border: '1px solid rgba(6,182,212,0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--accent-cyan-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)' }}>
            <Shield size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '14.5px', fontWeight: '700', margin: 0 }}>Scanning Window Security</h3>
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
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Standard Window: Morning 07:00–09:30 AM & Evening 04:30–07:00 PM.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => updateAttendanceWindowSetting('active')}
            disabled={attendanceWindowSaving}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '700',
              borderRadius: '6px',
              border: '1px solid ' + (attendanceWindowMode === 'active' ? 'var(--accent-emerald)' : 'var(--border-color)'),
              background: attendanceWindowMode === 'active' ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.03)',
              color: attendanceWindowMode === 'active' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            Active (24/7)
          </button>
          <button
            type="button"
            onClick={() => updateAttendanceWindowSetting('auto')}
            disabled={attendanceWindowSaving}
            style={{
              padding: '6px 12px',
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
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '700',
              borderRadius: '6px',
              border: '1px solid ' + (attendanceWindowMode === 'inactive' ? 'var(--accent-rose)' : 'var(--border-color)'),
              background: attendanceWindowMode === 'inactive' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.03)',
              color: attendanceWindowMode === 'inactive' ? 'var(--accent-rose)' : 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            Locked
          </button>
        </div>
      </div>

      {/* 4. Section Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
        <button
          type="button"
          onClick={() => setActiveAttendanceTab('live')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: '700',
            borderRadius: '8px',
            border: 'none',
            background: activeAttendanceTab === 'live' ? 'var(--accent-cyan-light)' : 'transparent',
            color: activeAttendanceTab === 'live' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            cursor: 'pointer'
          }}
        >
          <Bus size={16} /> Today's Live Boarding & Route Breakdown
        </button>
        <button
          type="button"
          onClick={() => setActiveAttendanceTab('directory')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: '700',
            borderRadius: '8px',
            border: 'none',
            background: activeAttendanceTab === 'directory' ? 'var(--accent-cyan-light)' : 'transparent',
            color: activeAttendanceTab === 'directory' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            cursor: 'pointer'
          }}
        >
          <Users size={16} /> Student Directory & Rates
        </button>
        <button
          type="button"
          onClick={() => setActiveAttendanceTab('logs')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 18px',
            fontSize: '13px',
            fontWeight: '700',
            borderRadius: '8px',
            border: 'none',
            background: activeAttendanceTab === 'logs' ? 'var(--accent-cyan-light)' : 'transparent',
            color: activeAttendanceTab === 'logs' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
            cursor: 'pointer'
          }}
        >
          <BarChart2 size={16} /> Verification Logs & Audit History
        </button>
      </div>

      {/* TAB 1: TODAY'S LIVE ROUTE BREAKDOWN */}
      {activeAttendanceTab === 'live' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {(routes.length > 0 ? routes : [{ id: 1, name: 'Route A (North Campus Link)' }, { id: 2, name: 'Route B (West City Corridor)' }]).map(route => {
              const routeRecords = attendanceList.filter(a => a.route_name === route.name || a.route_id === route.id);
              const rPresent = routeRecords.filter(a => a.attendance_status === 'present').length;
              const rTotal = routeRecords.length || 1;
              const rRate = Math.round((rPresent / rTotal) * 100);

              return (
                <div key={route.id} className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h4 style={{ fontSize: '15px', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>
                        {route.name}
                      </h4>
                      <span style={{ fontSize: '11.5px', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                        Assigned Bus {route.id === 1 ? '101 (KA-01-EA-1234)' : '102 (KA-01-EA-5678)'}
                      </span>
                    </div>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: '800',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: rRate >= 75 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                      color: rRate >= 75 ? 'var(--accent-emerald)' : 'var(--accent-amber)'
                    }}>
                      {rRate}% Boarded
                    </span>
                  </div>

                  {/* Visual Progress Bar */}
                  <div>
                    <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, Math.max(0, rRate))}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, var(--accent-cyan) 0%, var(--accent-emerald) 100%)',
                        transition: 'width 0.4s ease'
                      }}></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      <span>{rPresent} Students Checked In</span>
                      <span>{rTotal} Total Assigned</span>
                    </div>
                  </div>

                  {/* Student Checklist on Route */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                    {routeRecords.length === 0 ? (
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>
                        No students assigned or logged for this route today.
                      </span>
                    ) : (
                      routeRecords.map(rec => (
                        <div key={rec.attendance_id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 10px',
                          background: 'var(--bg-card)',
                          borderRadius: '6px',
                          fontSize: '12px'
                        }}>
                          <div>
                            <div style={{ fontWeight: '600' }}>{rec.student_name}</div>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              Roll: {rec.roll_number} • Stop: {rec.stop_name || 'Pickup Stop'}
                            </span>
                          </div>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '10px',
                            fontSize: '10.5px',
                            fontWeight: '700',
                            background: rec.attendance_status === 'present' ? 'rgba(16,185,129,0.15)' : rec.attendance_status === 'absent' ? 'rgba(245,158,11,0.15)' : 'rgba(244,63,94,0.15)',
                            color: rec.attendance_status === 'present' ? 'var(--accent-emerald)' : rec.attendance_status === 'absent' ? 'var(--accent-amber)' : 'var(--accent-rose)'
                          }}>
                            {rec.attendance_status === 'present' ? '● Boarded' : rec.attendance_status === 'absent' ? '● Awaiting' : '● Opted-Out'}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: STUDENT DIRECTORY & ATTENDANCE RATES */}
      {activeAttendanceTab === 'directory' && (
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input-field"
                placeholder="Search student, roll #, pickup stop..."
                value={attendanceSearchQuery}
                onChange={e => setAttendanceSearchQuery(e.target.value)}
                style={{ paddingLeft: '32px', fontSize: '12px', width: '100%', background: 'var(--bg-main)' }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setRateFilter('all')}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '700',
                  borderRadius: '6px',
                  border: '1px solid ' + (rateFilter === 'all' ? 'var(--accent-cyan)' : 'var(--border-color)'),
                  background: rateFilter === 'all' ? 'var(--accent-cyan-light)' : 'transparent',
                  color: rateFilter === 'all' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                All Students
              </button>
              <button
                type="button"
                onClick={() => setRateFilter('regular')}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '700',
                  borderRadius: '6px',
                  border: '1px solid ' + (rateFilter === 'regular' ? 'var(--accent-emerald)' : 'var(--border-color)'),
                  background: rateFilter === 'regular' ? 'rgba(16,185,129,0.15)' : 'transparent',
                  color: rateFilter === 'regular' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Regular Riders (≥60%)
              </button>
              <button
                type="button"
                onClick={() => setRateFilter('occasional')}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '700',
                  borderRadius: '6px',
                  border: '1px solid ' + (rateFilter === 'occasional' ? 'var(--accent-cyan)' : 'var(--border-color)'),
                  background: rateFilter === 'occasional' ? 'rgba(6,182,212,0.15)' : 'transparent',
                  color: rateFilter === 'occasional' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
              >
                Occasional Riders (&lt;60%)
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Roll Number</th>
                  <th>Pickup Stop</th>
                  <th>Assigned Route / Bus</th>
                  <th>Trips Attended</th>
                  <th>Boarding Rate</th>
                  <th>Transit Status</th>
                </tr>
              </thead>
              <tbody>
                {studentRatesList.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                      No student records found matching search filters.
                    </td>
                  </tr>
                ) : (
                  studentRatesList.map(st => {
                    const rate = Number(st.attendance_rate) || 100;
                    return (
                      <tr key={st.user_id}>
                        <td>
                          <div style={{ fontWeight: '700' }}>{st.name}</div>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontSize: '11.5px', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                            {st.roll_number}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '12px', color: 'var(--accent-cyan)' }}>
                            📍 {st.stop_name || 'Standard Stop'}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontSize: '12px' }}>{st.route_name || 'North Campus Link'}</div>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Bus {st.bus_number || '101'}</span>
                        </td>
                        <td>
                          <span style={{ fontWeight: '700', color: 'var(--accent-emerald)' }}>{st.present_count || 0}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}> / {st.total_trips || 0} trips</span>
                        </td>
                        <td>
                          <span style={{
                            fontSize: '12px',
                            fontWeight: '800',
                            padding: '3px 8px',
                            borderRadius: '10px',
                            background: 'rgba(6,182,212,0.15)',
                            color: 'var(--accent-cyan)'
                          }}>
                            {rate}%
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '11.5px', color: rate >= 60 ? 'var(--accent-emerald)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={13} /> {rate >= 60 ? 'Active Commuter' : 'Occasional Commuter'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: HISTORICAL VERIFICATION LOGS */}
      {activeAttendanceTab === 'logs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Filters Bar */}
          <div className="glass-card" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-cyan)', fontWeight: '700', fontSize: '13px' }}>
              <Filter size={16} /> Filters:
            </div>

            {/* Search */}
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
            </div>

            {/* Date */}
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

            {/* Route */}
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

            {/* Bus */}
            <div>
              <select 
                className="input-field" 
                value={attendanceFilterBus} 
                onChange={e => setAttendanceFilterBus(e.target.value)}
                style={{ padding: '6px 12px', fontSize: '13px', background: 'var(--bg-main)' }}
              >
                <option value="">All Buses</option>
                {buses.map(b => (
                  <option key={b.id} value={b.id}>Bus {b.bus_number}</option>
                ))}
              </select>
            </div>

            {/* Status */}
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

          {/* Table */}
          <div className="glass-card">
            <div className="table-responsive">
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Roll Number</th>
                    <th>Route / Stop</th>
                    <th>Bus Unit</th>
                    <th>Scan Timestamp</th>
                    <th>Status</th>
                    <th>Emergency Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceLoading ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                        Loading verification logs...
                      </td>
                    </tr>
                  ) : filteredAttendance.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                        {attendanceSearchQuery ? `No verification records matching "${attendanceSearchQuery}"` : 'No verification logs found.'}
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
                            📍 {record.stop_name || 'Standard Stop'}
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
      )}
    </div>
  );
}
