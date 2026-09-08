import React from 'react';
import { 
  Download, Navigation, Users, Bus, AlertCircle, 
  CheckCircle, ArrowRight, Shield, Bell, TrendingUp, Sparkles,
  CalendarCheck, DollarSign, Activity
} from 'lucide-react';

export default function DashboardOverview({ 
  stats, 
  analytics = [], 
  maintenanceRecs = [], 
  triggerExport,
  setActiveMenu,
  buses = [],
  routes = [],
  liveTrips = []
}) {
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* 1. Hero Operations Command Header */}
      <div className="glass-card" style={{
        padding: '24px',
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(99, 102, 241, 0.08) 100%)',
        border: '1px solid rgba(6, 182, 212, 0.3)',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '20px',
                background: stats.activeTrips > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(6, 182, 212, 0.2)',
                color: stats.activeTrips > 0 ? 'var(--accent-emerald)' : 'var(--accent-cyan)',
                fontSize: '12px',
                fontWeight: '700',
                border: '1px solid ' + (stats.activeTrips > 0 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(6, 182, 212, 0.4)')
              }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: stats.activeTrips > 0 ? '#10b981' : '#06b6d4', display: 'inline-block' }}></span>
                {stats.activeTrips > 0 ? `${stats.activeTrips} Live Transit In Motion` : 'Fleet Operational • Ready for Dispatch'}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{currentDate}</span>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', margin: 0, fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
              VESA Transit Operations Command
            </h1>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Real-time monitoring of campus routes, student boarding verification, and fleet telemetry.
            </span>
          </div>

          {/* Quick Action Navigation Buttons for Beginners */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              onClick={() => setActiveMenu && setActiveMenu('students')}
              className="btn-primary"
              style={{ padding: '8px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <Users size={14} /> Quick Enroll Student
            </button>
            <button
              onClick={() => setActiveMenu && setActiveMenu('tracking')}
              className="btn-secondary"
              style={{ padding: '8px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <Navigation size={14} /> Live Map View
            </button>
            <button
              onClick={() => setActiveMenu && setActiveMenu('attendance')}
              className="btn-secondary"
              style={{ padding: '8px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <CalendarCheck size={14} /> Attendance Log
            </button>
            <button
              onClick={() => setActiveMenu && setActiveMenu('broadcast')}
              className="btn-secondary"
              style={{ padding: '8px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <Bell size={14} /> Send Alert
            </button>
          </div>
        </div>
      </div>

      {/* 2. Visual KPI Stat Grid */}
      <div className="admin-stat-grid-4">
        {[
          {
            title: 'Active Buses',
            value: stats.totalBuses || 2,
            subtitle: `${stats.activeTrips || 0} currently on route`,
            icon: <Bus size={22} color="var(--accent-cyan)" />,
            color: 'var(--accent-cyan)',
            bg: 'rgba(6, 182, 212, 0.1)'
          },
          {
            title: 'Enrolled Students',
            value: stats.totalStudents || 0,
            subtitle: 'Transit pass holders',
            icon: <Users size={22} color="var(--accent-indigo)" />,
            color: 'var(--accent-indigo)',
            bg: 'rgba(99, 102, 241, 0.1)'
          },
          {
            title: 'Licensed Drivers',
            value: stats.totalDrivers || 0,
            subtitle: 'Assigned to active fleet',
            icon: <Activity size={22} color="var(--accent-emerald)" />,
            color: 'var(--accent-emerald)',
            bg: 'rgba(16, 185, 129, 0.1)'
          },
          {
            title: 'Fee Revenue Target',
            value: `${stats.feeCollectionPercentage || 0}%`,
            subtitle: `₹${Number(stats.totalFeesPaid || 0).toLocaleString('en-IN')} of ₹${Number(stats.totalFeesExpected || 0).toLocaleString('en-IN')}`,
            icon: <DollarSign size={22} color="var(--accent-emerald)" />,
            color: 'var(--accent-emerald)',
            bg: 'rgba(16, 185, 129, 0.1)'
          }
        ].map((item, i) => (
          <div key={i} className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: item.bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {item.icon}
            </div>
            <div>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>{item.title}</span>
              <div style={{ fontSize: '26px', fontWeight: '800', color: item.color, lineHeight: '1.2' }}>
                {item.value}
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.subtitle}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Live Fleet Snapshot & Active Bus Cards */}
      <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bus size={18} color="var(--accent-cyan)" /> Live Fleet Status & Driver Assignments
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Real-time snapshot of transit vehicles, assigned routes, and operational drivers.
            </span>
          </div>
          <button
            onClick={() => setActiveMenu && setActiveMenu('buses')}
            className="btn-secondary"
            style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            Manage Fleet <ArrowRight size={12} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
          {buses.length > 0 ? (
            buses.map(bus => {
              const busTrip = liveTrips.find(t => t.bus_id === bus.id);
              const isLive = busTrip && busTrip.status === 'active';
              return (
                <div key={bus.id} style={{
                  background: 'var(--bg-card)',
                  border: isLive ? '1px solid var(--accent-cyan)' : '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '800' }}>{bus.bus_number}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({bus.registration_number})</span>
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: isLive ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
                      color: isLive ? 'var(--accent-emerald)' : 'var(--text-secondary)'
                    }}>
                      {isLive ? '● Live Transit' : '● Idle / In Bay'}
                    </span>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Capacity:</span>
                      <span style={{ fontWeight: '600' }}>{bus.capacity || 40} Seats</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Assigned Route:</span>
                      <span style={{ fontWeight: '600', color: 'var(--accent-cyan)' }}>
                        {routes.find(r => r.id === bus.assigned_route_id)?.name || 'North Campus Link'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveMenu && setActiveMenu('tracking')}
                    style={{
                      marginTop: '4px',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-primary)',
                      padding: '6px',
                      borderRadius: '6px',
                      fontSize: '11.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    <Navigation size={12} /> View on GPS Map
                  </button>
                </div>
              );
            })
          ) : (
            <div style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px' }}>Loading fleet registry...</div>
          )}
        </div>
      </div>

      {/* 4. Analytics & Revenue Panels */}
      <div className="admin-grid">
        {/* Ridership Tracking Log */}
        <div className="glass-card" style={{ gridColumn: 'span 8', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} color="var(--accent-cyan)" /> Daily Ridership Tracking
              </h3>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Daily passenger counts recorded across all trips</span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--accent-cyan)', fontWeight: '700', background: 'var(--accent-cyan-light)', padding: '3px 8px', borderRadius: '6px' }}>
              Last 7 Operational Days
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '180px', padding: '0 10px', borderBottom: '2px solid var(--border-color)' }}>
            {(analytics.length > 0 ? analytics : [
              { date: '2026-07-01', daily_ridership: 145 },
              { date: '2026-07-02', daily_ridership: 168 },
              { date: '2026-07-03', daily_ridership: 182 },
              { date: '2026-07-04', daily_ridership: 174 },
              { date: '2026-07-05', daily_ridership: 190 },
              { date: '2026-07-06', daily_ridership: 160 },
              { date: '2026-07-07', daily_ridership: 195 }
            ]).map((an, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-cyan)' }}>{an.daily_ridership}</span>
                <div style={{
                  width: '32px',
                  height: `${Math.max(16, (an.daily_ridership / 220) * 130)}px`,
                  background: 'linear-gradient(180deg, var(--accent-cyan) 0%, rgba(6,182,212,0.15) 100%)',
                  borderRadius: '6px 6px 0 0',
                  borderTop: '2px solid var(--accent-cyan)'
                }}></div>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  {an.date.split('-')[2]} Jul
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue & Fee Collection Radial Gauge */}
        <div className="glass-card" style={{ gridColumn: 'span 4', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Fee Revenue Collection</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Term fee clearance status</span>
          </div>

          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: '42px', fontWeight: '800', color: 'var(--accent-emerald)', lineHeight: '1' }}>
              {stats.feeCollectionPercentage !== undefined ? `${stats.feeCollectionPercentage}%` : '85%'}
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Target Cleared</span>
            
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '14px', fontSize: '12px' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Collected</span>
                <strong style={{ color: 'var(--accent-emerald)', fontSize: '14px' }}>
                  ₹{Number(stats.totalFeesPaid || 0).toLocaleString('en-IN')}
                </strong>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'block' }}>Expected</span>
                <strong style={{ color: 'var(--accent-cyan)', fontSize: '14px' }}>
                  ₹{Number(stats.totalFeesExpected || 0).toLocaleString('en-IN')}
                </strong>
              </div>
            </div>
          </div>

          <div>
            <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, Math.max(0, stats.feeCollectionPercentage || 85))}%`, height: '100%', background: 'var(--accent-emerald)', transition: 'width 0.4s ease' }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              <span>Dues Pending: ₹{Number(stats.pendingFees || 0).toLocaleString('en-IN')}</span>
              <span style={{ color: 'var(--accent-emerald)' }}>Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Reports & Export Center */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>
              Official Operations & Export Center
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Download official compliance reports in formatted PDF or Excel spreadsheet formats.
            </span>
          </div>
        </div>
        <div className="admin-stat-grid-4">
          {[
            { title: 'Student Attendance Log', type: 'attendance', desc: 'Daily boarding and scan verification logs' },
            { title: 'Route Performance', type: 'route', desc: 'Transit route timings, distance and stops' },
            { title: 'Driver Operations', type: 'driver', desc: 'Driver duty hours and status' },
            { title: 'Fee Collection Records', type: 'fees', desc: 'Tuition transit fee payment log' }
          ].map((rep, idx) => (
            <div key={idx} style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: '700' }}>{rep.title}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>{rep.desc}</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button 
                  onClick={() => triggerExport('pdf', rep.type)} 
                  className="btn-secondary"
                  style={{ padding: '6px', fontSize: '11.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <Download size={12} /> PDF
                </button>
                <button 
                  onClick={() => triggerExport('excel', rep.type)} 
                  className="btn-secondary"
                  style={{ padding: '6px', fontSize: '11.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <Download size={12} /> Excel
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
