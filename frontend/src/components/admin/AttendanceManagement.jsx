import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, Shield, Filter, Calendar as CalendarIcon, X, CheckCircle, Phone, Search,
  Users, Bus, CheckCircle2, AlertTriangle, ArrowRight, Download, BarChart2,
  Clock, Sparkles, ChevronLeft, ChevronRight, Check, UserCheck, UserX, AlertCircle
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
  const [rateFilter, setRateFilter] = useState('all'); // 'all' | 'regular' | 'occasional'
  const [overrideLoadingId, setOverrideLoadingId] = useState(null);

  // Calendar Picker state
  const [calendarViewDate, setCalendarViewDate] = useState(() => new Date());

  const getAuthToken = () => localStorage.getItem('vesa_token') || localStorage.getItem('token') || '';

  // Format YYYY-MM-DD
  const formatYMD = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = formatYMD(new Date());

  const fetchSummary = async () => {
    try {
      setSummaryLoading(true);
      const token = getAuthToken();
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

  // Admin Manual Override Handler
  const handleOverrideStatus = async (studentId, attendanceId, newStatus) => {
    try {
      setOverrideLoadingId(studentId || attendanceId);
      const token = getAuthToken();
      const res = await fetch('/api/admin/attendance/override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          student_id: studentId,
          attendance_id: attendanceId,
          status: newStatus
        })
      });
      if (res.ok) {
        fetchAttendanceList();
        fetchSummary();
      }
    } catch (e) {
      console.error('Error overriding attendance status:', e);
    } finally {
      setOverrideLoadingId(null);
    }
  };

  // Calendar Day Generation
  const currentYear = calendarViewDate.getFullYear();
  const currentMonth = calendarViewDate.getMonth();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    setCalendarViewDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarViewDate(new Date(currentYear, currentMonth + 1, 1));
  };

  const handleSelectDay = (dayNum) => {
    const selected = new Date(currentYear, currentMonth, dayNum);
    const dateStr = formatYMD(selected);
    setAttendanceFilterDate(dateStr);
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
            Choose any date on the calendar to inspect logs, view boarding verification stats, or override student statuses.
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button 
            onClick={handleRefreshAll} 
            className="btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '12px' }}
            disabled={attendanceLoading || summaryLoading}
          >
            <RefreshCw size={14} className={attendanceLoading || summaryLoading ? 'animate-spin' : ''} />
            Refresh Logs
          </button>
        </div>
      </div>

      {/* 2. Interactive Calendar Day Selector */}
      <div className="glass-card" style={{
        padding: '20px',
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(99, 102, 241, 0.05) 100%)',
        border: '1px solid rgba(6, 182, 212, 0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'var(--accent-cyan-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-cyan)'
            }}>
              <CalendarIcon size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0 }}>
                {monthNames[currentMonth]} {currentYear}
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Click any day below to open that day's attendance log
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => {
                setCalendarViewDate(new Date());
                setAttendanceFilterDate(todayStr);
              }}
              className="btn-secondary"
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: '700',
                color: attendanceFilterDate === todayStr ? 'var(--accent-cyan)' : 'var(--text-primary)',
                borderColor: attendanceFilterDate === todayStr ? 'var(--accent-cyan)' : 'var(--border-color)'
              }}
            >
              Jump to Today
            </button>
            <button
              onClick={() => setAttendanceFilterDate('')}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '12px' }}
            >
              View All Dates
            </button>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button onClick={handlePrevMonth} className="btn-secondary" style={{ padding: '6px 10px', borderRadius: '6px' }}>
                <ChevronLeft size={16} />
              </button>
              <button onClick={handleNextMonth} className="btn-secondary" style={{ padding: '6px 10px', borderRadius: '6px' }}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* 7-column Calendar Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '8px',
          textAlign: 'center'
        }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', paddingBottom: '4px' }}>
              {d}
            </div>
          ))}

          {/* Empty cells for starting offset */}
          {Array.from({ length: firstDayIndex }).map((_, idx) => (
            <div key={`empty-${idx}`} style={{ opacity: 0.2, minHeight: '52px' }}></div>
          ))}

          {/* Day Cells */}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const thisDayDate = new Date(currentYear, currentMonth, dayNum);
            const dateString = formatYMD(thisDayDate);
            const isToday = dateString === todayStr;
            const isSelected = attendanceFilterDate === dateString;

            return (
              <button
                key={dayNum}
                type="button"
                onClick={() => handleSelectDay(dayNum)}
                style={{
                  position: 'relative',
                  minHeight: '56px',
                  borderRadius: '10px',
                  border: isSelected 
                    ? '2px solid var(--accent-cyan)' 
                    : isToday 
                    ? '2px solid var(--accent-emerald)' 
                    : '1px solid rgba(255,255,255,0.08)',
                  background: isSelected
                    ? 'rgba(6, 182, 212, 0.2)'
                    : isToday
                    ? 'rgba(16, 185, 129, 0.12)'
                    : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  padding: '6px 4px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '0 4px', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: isToday || isSelected ? '800' : '600',
                    color: isSelected ? 'var(--accent-cyan)' : isToday ? 'var(--accent-emerald)' : 'var(--text-primary)'
                  }}>
                    {dayNum}
                  </span>
                  {isSelected && (
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-cyan)' }}></span>
                  )}
                </div>

                {isToday && (
                  <span style={{
                    fontSize: '9px',
                    fontWeight: '800',
                    letterSpacing: '0.5px',
                    background: 'var(--accent-emerald)',
                    color: '#000',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    marginTop: '2px',
                    boxShadow: '0 2px 4px rgba(16,185,129,0.3)'
                  }}>
                    TODAY
                  </span>
                )}

                {isSelected && !isToday && (
                  <span style={{
                    fontSize: '8.5px',
                    fontWeight: '700',
                    color: 'var(--accent-cyan)',
                    marginTop: '2px'
                  }}>
                    SELECTED
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Date Status Banner */}
        <div style={{
          marginTop: '16px',
          padding: '10px 14px',
          borderRadius: '8px',
          background: 'rgba(255,255,255,0.04)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          fontSize: '12.5px'
        }}>
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>Viewing Log for: </span>
            <strong style={{ color: 'var(--accent-cyan)', fontWeight: '800' }}>
              {attendanceFilterDate ? (
                attendanceFilterDate === todayStr 
                  ? `Today (${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })})`
                  : new Date(attendanceFilterDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
              ) : (
                'All Recorded Dates (Aggregated View)'
              )}
            </strong>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Found {filteredAttendance.length} attendance records
          </span>
        </div>
      </div>

      {/* 3. Top Summary KPI Cards */}
      <div className="admin-stat-grid-4">
        <div className="glass-card" style={{ padding: '18px 20px', borderLeft: '4px solid var(--accent-cyan)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Boarding Rate</span>
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
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600' }}>Opted-Out</span>
          <div style={{ fontSize: '28px', fontWeight: '800', marginTop: '4px', color: 'var(--accent-rose)' }}>
            {optedOutCount}
          </div>
          <span style={{ fontSize: '11px', color: 'var(--accent-rose)' }}>● Not commuting</span>
        </div>
      </div>

      {/* 4. Scanning Window Override */}
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

      {/* 5. Section Navigation Tabs */}
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
          <Bus size={16} /> Selected Date Route Breakdown & Admin Override
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

      {/* TAB 1: ROUTE BREAKDOWN WITH INSTANT ADMIN OVERRIDE */}
      {activeAttendanceTab === 'live' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
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
                      background: rRate >= 60 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                      color: rRate >= 60 ? 'var(--accent-emerald)' : 'var(--accent-amber)'
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

                  {/* Student Checklist with Direct Admin Override Controls */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
                    {routeRecords.length === 0 ? (
                      <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
                        No students logged for this route on selected date.
                      </span>
                    ) : (
                      routeRecords.map(rec => (
                        <div key={rec.attendance_id || rec.student_id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 12px',
                          background: 'var(--bg-card)',
                          borderRadius: '8px',
                          fontSize: '12px',
                          border: '1px solid var(--border-color)',
                          gap: '8px',
                          flexWrap: 'wrap'
                        }}>
                          <div style={{ flex: '1 1 120px' }}>
                            <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{rec.student_name}</div>
                            <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                              Roll: {rec.roll_number} • Stop: {rec.stop_name || 'Pickup Stop'}
                            </span>
                          </div>

                          {/* Admin Quick Override Buttons */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              title="Mark Present (Override)"
                              onClick={() => handleOverrideStatus(rec.student_id, rec.attendance_id, 'present')}
                              disabled={overrideLoadingId === (rec.student_id || rec.attendance_id)}
                              style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                fontWeight: '700',
                                borderRadius: '6px',
                                border: '1px solid ' + (rec.attendance_status === 'present' ? 'var(--accent-emerald)' : 'rgba(255,255,255,0.1)'),
                                background: rec.attendance_status === 'present' ? 'rgba(16,185,129,0.2)' : 'transparent',
                                color: rec.attendance_status === 'present' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                                cursor: 'pointer'
                              }}
                            >
                              ✓ Present
                            </button>
                            <button
                              type="button"
                              title="Mark Absent (Override)"
                              onClick={() => handleOverrideStatus(rec.student_id, rec.attendance_id, 'absent')}
                              disabled={overrideLoadingId === (rec.student_id || rec.attendance_id)}
                              style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                fontWeight: '700',
                                borderRadius: '6px',
                                border: '1px solid ' + (rec.attendance_status === 'absent' ? 'var(--accent-amber)' : 'rgba(255,255,255,0.1)'),
                                background: rec.attendance_status === 'absent' ? 'rgba(245,158,11,0.2)' : 'transparent',
                                color: rec.attendance_status === 'absent' ? 'var(--accent-amber)' : 'var(--text-secondary)',
                                cursor: 'pointer'
                              }}
                            >
                              ⏳ Absent
                            </button>
                            <button
                              type="button"
                              title="Mark Opted-Out (Override)"
                              onClick={() => handleOverrideStatus(rec.student_id, rec.attendance_id, 'not_coming')}
                              disabled={overrideLoadingId === (rec.student_id || rec.attendance_id)}
                              style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                fontWeight: '700',
                                borderRadius: '6px',
                                border: '1px solid ' + (rec.attendance_status === 'not_coming' ? 'var(--accent-rose)' : 'rgba(255,255,255,0.1)'),
                                background: rec.attendance_status === 'not_coming' ? 'rgba(244,63,94,0.2)' : 'transparent',
                                color: rec.attendance_status === 'not_coming' ? 'var(--accent-rose)' : 'var(--text-secondary)',
                                cursor: 'pointer'
                              }}
                            >
                              ✕ Opt-Out
                            </button>
                          </div>
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
                  <th>Admin Override</th>
                </tr>
              </thead>
              <tbody>
                {studentRatesList.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
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
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              title="Mark Present for Today"
                              onClick={() => handleOverrideStatus(st.user_id, null, 'present')}
                              style={{ padding: '3px 6px', fontSize: '10px', fontWeight: '700', borderRadius: '4px', background: 'rgba(16,185,129,0.15)', color: 'var(--accent-emerald)', border: 'none', cursor: 'pointer' }}
                            >
                              ✓ Present
                            </button>
                            <button
                              type="button"
                              title="Mark Absent for Today"
                              onClick={() => handleOverrideStatus(st.user_id, null, 'absent')}
                              style={{ padding: '3px 6px', fontSize: '10px', fontWeight: '700', borderRadius: '4px', background: 'rgba(245,158,11,0.15)', color: 'var(--accent-amber)', border: 'none', cursor: 'pointer' }}
                            >
                              ⏳ Absent
                            </button>
                          </div>
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

      {/* TAB 3: HISTORICAL VERIFICATION LOGS WITH OVERRIDE */}
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
              <CalendarIcon size={14} color="var(--text-secondary)" />
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
                    <th>Admin Override</th>
                    <th>Emergency Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceLoading ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                        Loading verification logs...
                      </td>
                    </tr>
                  ) : filteredAttendance.length === 0 ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                        {attendanceSearchQuery ? `No verification records matching "${attendanceSearchQuery}"` : 'No verification logs found for this filter.'}
                      </td>
                    </tr>
                  ) : (
                    filteredAttendance.map((record) => (
                      <tr key={record.attendance_id || record.student_id}>
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
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              title="Mark Present"
                              onClick={() => handleOverrideStatus(record.student_id, record.attendance_id, 'present')}
                              style={{
                                padding: '3px 6px',
                                fontSize: '10.5px',
                                fontWeight: '700',
                                borderRadius: '4px',
                                border: '1px solid ' + (record.attendance_status === 'present' ? 'var(--accent-emerald)' : 'rgba(255,255,255,0.1)'),
                                background: record.attendance_status === 'present' ? 'rgba(16,185,129,0.2)' : 'transparent',
                                color: record.attendance_status === 'present' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                                cursor: 'pointer'
                              }}
                            >
                              ✓ Present
                            </button>
                            <button
                              type="button"
                              title="Mark Absent"
                              onClick={() => handleOverrideStatus(record.student_id, record.attendance_id, 'absent')}
                              style={{
                                padding: '3px 6px',
                                fontSize: '10.5px',
                                fontWeight: '700',
                                borderRadius: '4px',
                                border: '1px solid ' + (record.attendance_status === 'absent' ? 'var(--accent-amber)' : 'rgba(255,255,255,0.1)'),
                                background: record.attendance_status === 'absent' ? 'rgba(245,158,11,0.2)' : 'transparent',
                                color: record.attendance_status === 'absent' ? 'var(--accent-amber)' : 'var(--text-secondary)',
                                cursor: 'pointer'
                              }}
                            >
                              ⏳ Absent
                            </button>
                            <button
                              type="button"
                              title="Mark Not Coming"
                              onClick={() => handleOverrideStatus(record.student_id, record.attendance_id, 'not_coming')}
                              style={{
                                padding: '3px 6px',
                                fontSize: '10.5px',
                                fontWeight: '700',
                                borderRadius: '4px',
                                border: '1px solid ' + (record.attendance_status === 'not_coming' ? 'var(--accent-rose)' : 'rgba(255,255,255,0.1)'),
                                background: record.attendance_status === 'not_coming' ? 'rgba(244,63,94,0.2)' : 'transparent',
                                color: record.attendance_status === 'not_coming' ? 'var(--accent-rose)' : 'var(--text-secondary)',
                                cursor: 'pointer'
                              }}
                            >
                              ✕ Opt-Out
                            </button>
                          </div>
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
