import React from 'react';
import { Wrench, Download } from 'lucide-react';

export default function DashboardOverview({ stats, analytics, maintenanceRecs, triggerExport }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* KPI grid */}
      <div className="admin-grid">
        {[
          { label: 'Active Trips', value: stats.activeTrips, color: 'var(--accent-cyan)' },
          { label: 'Total Enrolled Students', value: stats.totalStudents, color: 'var(--accent-indigo)' },
          { label: 'Licensed Drivers', value: stats.totalDrivers, color: 'var(--accent-indigo)' },
          { label: 'Active Transit Buses', value: stats.totalBuses, color: 'var(--accent-cyan)' },
          { label: 'Delayed Shifts', value: stats.delayedRoutes, color: 'var(--accent-amber)' },
          { label: 'Dues Pending', value: `₹${stats.pendingFees}`, color: 'var(--accent-rose)' }
        ].map((stat, i) => (
          <div key={i} className="glass-card admin-card-stat" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{stat.label}</span>
            <h2 style={{ fontSize: '28px', fontWeight: '800', color: stat.color }}>{stat.value}</h2>
          </div>
        ))}
      </div>

      {/* Custom SVG Charts Panel */}
      <div className="admin-grid">
        <div className="glass-card" style={{ gridColumn: 'span 8' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '24px' }}>Ridership Tracking (Daily Log)</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '200px', padding: '0 20px', borderBottom: '2px solid var(--border-color)' }}>
            {analytics.map((an, idx) => (
              <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-cyan)' }}>{an.daily_ridership}</span>
                <div style={{ width: '32px', height: `${(an.daily_ridership / 200) * 150}px`, background: 'linear-gradient(180deg, var(--accent-cyan) 0%, rgba(6,182,212,0.1) 100%)', borderRadius: '4px 4px 0 0', minHeight: '10px' }}></div>
                <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{an.date.split('-')[2]} Jul</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fee Collection gauge */}
        <div className="glass-card" style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>Revenue & Fee Collection</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Overall collection status for this term.</span>
          </div>
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: '36px', fontWeight: '800', color: 'var(--accent-emerald)' }}>
              {stats.feeCollectionPercentage !== undefined ? `${stats.feeCollectionPercentage}%` : '0%'}
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Target Collected</span>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '10px', fontSize: '12px' }}>
              <div><span style={{ color: 'var(--text-secondary)' }}>Collected: </span><strong style={{ color: 'var(--accent-emerald)' }}>₹{Number(stats.totalFeesPaid || 0).toLocaleString('en-IN')}</strong></div>
              <div><span style={{ color: 'var(--text-secondary)' }}>Target: </span><strong style={{ color: 'var(--accent-cyan)' }}>₹{Number(stats.totalFeesExpected || 0).toLocaleString('en-IN')}</strong></div>
            </div>
          </div>
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, Math.max(0, stats.feeCollectionPercentage || 0))}%`, height: '100%', background: 'var(--accent-emerald)', transition: 'width 0.4s ease' }}></div>
          </div>
        </div>
      </div>

      {/* AI Predictive Maintenance Checkups */}
      <div className="glass-card">
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wrench size={18} color="var(--accent-cyan)" /> AI Predictive Maintenance Recommendations
        </h3>
        <div className="table-responsive">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Bus Unit</th>
                <th>Mileage (Odometer)</th>
                <th>Service Forecast</th>
                <th>Risk Indicator</th>
                <th>Diagnostics Message</th>
              </tr>
            </thead>
            <tbody>
              {maintenanceRecs.map(rec => (
                <tr key={rec.busId}>
                  <td style={{ fontWeight: '700' }}>{rec.busNumber}</td>
                  <td>{Math.round(rec.totalMileage)} km</td>
                  <td>In {rec.remainingKm} km</td>
                  <td>
                    <span style={{
                      padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700',
                      background: rec.priority === 'Critical' || rec.priority === 'High' ? 'rgba(244,63,94,0.1)' : 'rgba(255,255,255,0.05)',
                      color: rec.priority === 'Critical' || rec.priority === 'High' ? 'var(--accent-rose)' : 'var(--text-secondary)'
                    }}>
                      {rec.priority}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{rec.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Analytical Reports Downloader */}
      <div className="glass-card">
        <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Reports & Analytics Export Center</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {[
            { title: 'Attendance Log', type: 'attendance' },
            { title: 'Route Performance', type: 'route' },
            { title: 'Driver Operations', type: 'driver' },
            { title: 'Fee Collection', type: 'fees' }
          ].map((rep, idx) => (
            <div key={idx} style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: '600' }}>{rep.title}</span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button onClick={() => triggerExport('pdf', rep.type)} style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <Download size={10} /> PDF
                </button>
                <button onClick={() => triggerExport('excel', rep.type)} style={{ background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '6px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                  <Download size={10} /> Excel
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
