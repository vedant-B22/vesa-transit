import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart2, Users, Truck, Route, AlertTriangle, ShieldAlert, 
  Plus, Edit, Trash2, Upload, Search, Bell, Download, Check, Wrench,
  Camera, QrCode
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

const adminBusIcon = L.divIcon({
  className: 'admin-bus-marker',
  html: `<div style="
    width: 30px;
    height: 30px;
    background: #eab308;
    border: 3px solid #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 12px rgba(234, 179, 8, 0.6);
  ">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <circle cx="7" cy="20" r="2" />
      <circle cx="17" cy="20" r="2" />
    </svg>
  </div>`,
  iconSize: [30, 30]
});

export default function AdminDashboard({ onLogout }) {
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [stats, setStats] = useState({
    activeTrips: 0,
    totalStudents: 0,
    totalDrivers: 0,
    totalBuses: 0,
    delayedRoutes: 0,
    pendingFees: 0
  });

  const [activeSOS, setActiveSOS] = useState([]);
  const [maintenanceRecs, setMaintenanceRecs] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [lostFound, setLostFound] = useState([]);
  const [analytics, setAnalytics] = useState([]);

  // Data lists for CRUD panels
  const [students, setStudents] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);

  // Form states
  const [studentForm, setStudentForm] = useState({
    name: '', email: '', rollNumber: '', busId: 1, routeId: 1, pickupStopId: 1, emergencyContact: ''
  });
  const [csvText, setCsvText] = useState('');
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  // Broadcast settings
  const [broadcastType, setBroadcastType] = useState('all');
  const [broadcastTargetId, setBroadcastTargetId] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');

  // Active trips live tracking coordinates
  const [liveTrips, setLiveTrips] = useState([]);

  // QR Pass Scanner Emulation & Bus Sticker View
  const [selectedBusForSticker, setSelectedBusForSticker] = useState(null);
  const [scannedPassCode, setScannedPassCode] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef(null);

  const isDev = window.location.port === '3000' || window.location.port === '3001' || window.location.port === '5173';
  const API_BASE = isDev ? 'http://localhost:5001/api' : '/api';
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const WS_BASE = isDev ? 'ws://localhost:5001' : `${wsProtocol}//${window.location.host}`;
  const ws = useRef(null);

  useEffect(() => {
    if (isScanning) {
      import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
        const scanner = new Html5QrcodeScanner(
          "qr-reader",
          { fps: 10, qrbox: { width: 200, height: 200 } },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText) => {
            setScannedPassCode(decodedText);
            handleVerifyQRPass(decodedText);
            setIsScanning(false);
            scanner.clear().catch(err => console.error("Error clearing scanner", err));
          },
          (error) => {
            // Ignore scan failures
          }
        );
        scannerRef.current = scanner;
      });
    } else {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Error clearing scanner", err));
        scannerRef.current = null;
      }
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Error clearing scanner", err));
      }
    };
  }, [isScanning]);

  useEffect(() => {
    fetchDashboardData();
    fetchStudentList();
    fetchDriverList();
    fetchBusList();
    fetchRouteList();
    initWebSocket();

    const interval = setInterval(() => {
      fetchDashboardData();
      fetchLiveTracking();
    }, 5000);

    return () => {
      clearInterval(interval);
      if (ws.current) ws.current.close();
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/dashboard`);
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats);
        setActiveSOS(data.activeSOS || []);
        setMaintenanceRecs(data.maintenanceRecs || []);
        setComplaints(data.complaints || []);
        setLostFound(data.lostFound || []);
        setAnalytics(data.analytics || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchLiveTracking = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/tracking/live`);
      const data = await res.json();
      if (res.ok) setLiveTrips(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStudentList = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/students`);
      const data = await res.json();
      if (res.ok) setStudents(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDriverList = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/drivers`);
      const data = await res.json();
      if (res.ok) setDrivers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBusList = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/buses`);
      const data = await res.json();
      if (res.ok) setBuses(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRouteList = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/routes`);
      const data = await res.json();
      if (res.ok) setRoutes(data);
    } catch (e) {
      console.error(e);
    }
  };

  const initWebSocket = () => {
    ws.current = new WebSocket(WS_BASE);

    ws.current.onopen = () => {
      ws.current.send(JSON.stringify({
        type: 'register',
        role: 'admin',
        userId: 99
      }));
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'sos_alert' || data.type === 'wait_request_alert' || data.type === 'route_optimization') {
        fetchDashboardData();
        fetchLiveTracking();
      }
      if (data.type === 'gps_broadcast') {
        // Live updates for admin tracking list
        setLiveTrips(prev => prev.map(t => {
          if (t.id === data.tripId) {
            return {
              ...t,
              current_lat: data.latitude,
              current_lng: data.longitude,
              speed: data.speed,
              eta_mins: data.etaMins
            };
          }
          return t;
        }));
      }
    };
  };

  const handleResolveSOS = async (studentId) => {
    try {
      const res = await fetch(`${API_BASE}/admin/sos-resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId })
      });
      if (res.ok) fetchDashboardData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddStudent = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/admin/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentForm)
      });
      if (res.ok) {
        fetchStudentList();
        setStudentForm({ name: '', email: '', rollNumber: '', busId: 1, routeId: 1, pickupStopId: 1, emergencyContact: '' });
        alert('Student successfully created.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteStudent = async (id) => {
    if (!confirm('Are you sure you want to delete this student?')) return;
    try {
      const res = await fetch(`${API_BASE}/admin/students/${id}`, { method: 'DELETE' });
      if (res.ok) fetchStudentList();
    } catch (e) {
      console.error(e);
    }
  };

  const handleImportCSV = async () => {
    if (!csvText.trim()) return;
    // Format expected: name,email,rollNumber,emergencyContact
    const lines = csvText.split('\n');
    const importList = [];
    for (const line of lines) {
      const parts = line.split(',');
      if (parts.length >= 4) {
        importList.push({
          name: parts[0].trim(),
          email: parts[1].trim(),
          rollNumber: parts[2].trim(),
          emergencyContact: parts[3].trim(),
          busId: 1,
          routeId: 1,
          pickupStopId: 1
        });
      }
    }

    try {
      const res = await fetch(`${API_BASE}/admin/students/import-csv`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students: importList })
      });
      if (res.ok) {
        fetchStudentList();
        setIsCsvModalOpen(false);
        setCsvText('');
        alert(`Successfully imported ${importList.length} students.`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleVerifyQRPass = async (code = scannedPassCode) => {
    const codeToVerify = typeof code === 'string' ? code.trim() : '';
    if (!codeToVerify) return;
    try {
      const res = await fetch(`${API_BASE}/admin/verify-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCodePass: codeToVerify })
      });
      const data = await res.json();
      if (res.ok) {
        setScanResult({
          success: data.success,
          message: data.message
        });
        fetchDashboardData();
        fetchStudentList();
      } else {
        setScanResult({
          success: false,
          message: data.message || 'Verification failed.'
        });
      }
    } catch (err) {
      setScanResult({
        success: false,
        message: 'Could not reach backend API.'
      });
    }
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMsg.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/admin/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientType: broadcastType,
          recipientId: broadcastTargetId ? parseInt(broadcastTargetId) : null,
          title: broadcastTitle,
          message: broadcastMsg
        })
      });
      if (res.ok) {
        setBroadcastTitle('');
        setBroadcastMsg('');
        setBroadcastTargetId('');
        alert('Alert notice broadcasted successfully!');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const triggerExport = async (format, reportType) => {
    try {
      const res = await fetch(`${API_BASE}/admin/reports/export?format=${format}&reportType=${reportType}`);
      const data = await res.json();
      if (res.ok) {
        alert(`${data.message}\nDownloading from: ${data.url}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
      {/* Admin Sidebar Navigation */}
      <div style={{ width: '260px', background: 'var(--bg-surface-solid)', borderRight: '1px solid var(--border-color)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div className="brand-title">
          <Truck size={24} color="var(--accent-cyan)" />
          <span>VESA Transit</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            { id: 'dashboard', label: 'Dashboard Control', icon: <BarChart2 size={16} /> },
            { id: 'tracking', label: 'Live Tracking Map', icon: <Truck size={16} /> },
            { id: 'students', label: 'Students Console', icon: <Users size={16} /> },
            { id: 'drivers', label: 'Drivers Register', icon: <Users size={16} /> },
            { id: 'buses', label: 'Fleet Registry', icon: <Wrench size={16} /> },
            { id: 'routes', label: 'Route Planners', icon: <Route size={16} /> },
            { id: 'broadcast', label: 'Alert Broadcasting', icon: <Bell size={16} /> }
          ].map(item => (
            <button 
              key={item.id}
              onClick={() => setActiveMenu(item.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                background: activeMenu === item.id ? 'rgba(6,182,212,0.1)' : 'transparent',
                border: 'none', borderRadius: '8px', color: activeMenu === item.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                fontSize: '14px', fontWeight: '600', cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.2s'
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 'auto' }}>
          <button onClick={onLogout} className="btn-secondary" style={{ width: '100%', borderColor: 'rgba(244,63,94,0.3)', color: 'var(--accent-rose)' }}>
            Logout Admin
          </button>
        </div>
      </div>

      {/* Main Panel Content */}
      <div style={{ flex: 1, padding: '40px', overflowY: 'auto' }}>
        
        {/* Active Emergency SOS Alerts Alert Banner (Appears at top if active) */}
        {activeSOS.length > 0 && (
          <div className="glass-card" style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid var(--accent-rose)', color: '#fff', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldAlert size={24} style={{ color: 'var(--accent-rose)', animation: 'pulse 1s infinite' }} />
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '800' }}>ACTIVE EMERGENCY SOS SIGNAL DETECTED</h3>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Immediate attention requested for active student route!</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
              {activeSOS.map(sos => (
                <div key={sos.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                  <span>Student: <b>{sos.name}</b> | Bus: <b>{sos.bus_number || 'BUS-101'}</b> | Location: ({sos.latitude}, {sos.longitude}) | Contact: {sos.emergency_contact}</span>
                  <button onClick={() => handleResolveSOS(sos.student_id)} style={{ background: 'var(--accent-emerald)', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', fontWeight: '700' }}>
                    Resolve Emergency
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MENU 1: DASHBOARD */}
        {activeMenu === 'dashboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* KPI grid */}
            <div className="admin-grid">
              {[
                { label: 'Active Trips', value: stats.activeTrips, color: 'var(--accent-cyan)' },
                { label: 'Total Enrolled Students', value: stats.totalStudents, color: 'var(--accent-indigo)' },
                { label: 'Licensed Drivers', value: stats.totalDrivers, color: 'var(--accent-indigo)' },
                { label: 'Active Transit Buses', value: stats.totalBuses, color: 'var(--accent-cyan)' },
                { label: 'Delayed Shifts', value: stats.delayedRoutes, color: 'var(--accent-amber)' },
                { label: 'Dues Pending', value: `$${stats.pendingFees}`, color: 'var(--accent-rose)' }
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
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <div style={{ fontSize: '36px', fontWeight: '800', color: 'var(--accent-emerald)' }}>76.4%</div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Target Collected</span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '76.4%', height: '100%', background: 'var(--accent-emerald)' }}></div>
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
        )}

        {/* MENU 2: LIVE TRACKING */}
        {activeMenu === 'tracking' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-card" style={{ height: '450px', padding: '12px' }}>
              <MapContainer 
                center={[13.0234, 77.5501]} 
                zoom={12} 
                scrollWheelZoom={false}
              >
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
                />
                
                {liveTrips.map(trip => {
                  if (!trip.current_lat) return null;
                  return (
                    <Marker key={trip.id} position={[trip.current_lat, trip.current_lng]} icon={adminBusIcon}>
                      <Popup>
                        <div style={{ color: '#000', fontSize: '12px' }}>
                          <div style={{ fontWeight: '700' }}>Bus: {trip.bus_number} ({trip.route_name})</div>
                          <div>Driver: {trip.driver_name}</div>
                          <div>Speed: {Math.round(trip.speed)} km/h</div>
                          <div>ETA: {trip.eta_mins} mins</div>
                          <div>Checked-in Students: {trip.student_count}</div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>

            {/* Active Trips telemetry table */}
            <div className="glass-card">
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Active Transit Fleet Details</h3>
              <div className="table-responsive">
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>Bus Unit</th>
                      <th>Route Name</th>
                      <th>Driver Name</th>
                      <th>Current Position</th>
                      <th>Speed</th>
                      <th>Route ETA</th>
                      <th>Checked-In</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveTrips.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>No active transit routes on road.</td>
                      </tr>
                    ) : (
                      liveTrips.map(trip => (
                        <tr key={trip.id}>
                          <td style={{ fontWeight: '700' }}>{trip.bus_number}</td>
                          <td>{trip.route_name}</td>
                          <td>{trip.driver_name}</td>
                          <td>{trip.current_stop_name || 'En Route'} → {trip.next_stop_name || 'Terminal'}</td>
                          <td>{Math.round(trip.speed)} km/h</td>
                          <td style={{ color: 'var(--accent-amber)', fontWeight: '700' }}>{trip.eta_mins} mins</td>
                          <td>{trip.student_count} passengers</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MENU 3: STUDENTS MANAGEMENT */}
        {activeMenu === 'students' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Split layout: CRUD and Utilities */}
            <div className="admin-grid">
              {/* Form creation */}
              <div className="glass-card" style={{ gridColumn: 'span 4' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Add Enrolled Student</h3>
                <form onSubmit={handleAddStudent} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input type="text" className="input-field" placeholder="Full Name" value={studentForm.name} onChange={e => setStudentForm({...studentForm, name: e.target.value})} required />
                  <input type="email" className="input-field" placeholder="College Email (@college.edu)" value={studentForm.email} onChange={e => setStudentForm({...studentForm, email: e.target.value})} required />
                  <input type="text" className="input-field" placeholder="Roll Number (e.g. VESA-2024-ST99)" value={studentForm.rollNumber} onChange={e => setStudentForm({...studentForm, rollNumber: e.target.value})} required />
                  <input type="text" className="input-field" placeholder="Emergency Contact Phone" value={studentForm.emergencyContact} onChange={e => setStudentForm({...studentForm, emergencyContact: e.target.value})} required />
                  <button type="submit" className="btn-primary">
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
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Batch import students list using CSV files formatting.</span>
                  </div>
                  <button onClick={() => setIsCsvModalOpen(true)} className="btn-secondary" style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Upload size={14} /> Open CSV Importer
                  </button>
                </div>

                {/* QR Pass Verification Scanner */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>QR Bus Pass Scanner Terminal</h3>
                    <button 
                      onClick={() => setIsScanning(!isScanning)} 
                      className="btn-primary" 
                      style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Camera size={14} /> {isScanning ? 'Stop Camera' : 'Start Camera Scanner'}
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
                      placeholder="Input scanned pass code (e.g. QR_PASS_ST01)..." 
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
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Student Database Registry</h3>
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
                            {s.fee_status}
                          </span>
                        </td>
                        <td>
                          <button onClick={() => handleDeleteStudent(s.user_id)} style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer' }}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* CSV Import Modal Overlay */}
            {isCsvModalOpen && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
                <div className="glass-card" style={{ width: '500px', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '700' }}>CSV Database Importer</h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Input comma-separated values (One student per line):<br/><b>Format: Full Name, Email, Roll Number, Emergency Phone</b></span>
                  <textarea 
                    className="input-field" 
                    rows="6"
                    value={csvText}
                    onChange={e => setCsvText(e.target.value)}
                    placeholder="John Doe, john@college.edu, VESA-2024-ST80, 555-0987"
                    style={{ resize: 'none' }}
                  ></textarea>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <button onClick={handleImportCSV} className="btn-primary">Import Batch</button>
                    <button onClick={() => setIsCsvModalOpen(false)} className="btn-secondary">Cancel</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MENU 4: DRIVERS REGISTER */}
        {activeMenu === 'drivers' && (
          <div className="glass-card">
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Driver Employment Register</h3>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MENU 5: FLEET REGISTER */}
        {activeMenu === 'buses' && (
          <div className="glass-card">
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Active Transit Fleet Registry</h3>
            <div className="table-responsive">
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Bus Unit</th>
                    <th>Registration Plate</th>
                    <th>Capacity</th>
                    <th>Mileage (Odometer)</th>
                    <th>Insurance Renewal</th>
                    <th>Operational Status</th>
                    <th>Bus QR Sticker</th>
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
                          style={{ padding: '3px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <QrCode size={12} /> View Sticker
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bus QR Sticker Modal */}
            {selectedBusForSticker && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
                <div className="glass-card" style={{ width: '380px', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center', padding: '24px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>
                    In-Bus Physical QR Sticker
                  </span>
                  <div style={{ background: '#fff', padding: '16px', borderRadius: '12px' }}>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=VESA_BUS_${selectedBusForSticker.bus_number}`} 
                      alt={`Bus ${selectedBusForSticker.bus_number} QR Code`} 
                      style={{ width: '200px', height: '200px', display: 'block' }}
                    />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>Bus #{selectedBusForSticker.bus_number}</h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Code: VESA_BUS_{selectedBusForSticker.bus_number}</span>
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                    Stick this QR code at the bus entrance. Boarding students scan this with their Student App camera to record digital attendance.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%' }}>
                    <button onClick={() => window.print()} className="btn-secondary" style={{ padding: '8px', fontSize: '12px' }}>
                      Print Sticker
                    </button>
                    <button onClick={() => setSelectedBusForSticker(null)} className="btn-primary" style={{ padding: '8px', fontSize: '12px' }}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MENU 6: ROUTES */}
        {activeMenu === 'routes' && (
          <div className="glass-card">
            <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Active Transit Route Planners</h3>
            <div className="table-responsive">
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Route Title</th>
                    <th>Hub Departure</th>
                    <th>Campus Arrival</th>
                    <th>Distance (km)</th>
                    <th>Est Duration</th>
                    <th>Pickups stops</th>
                  </tr>
                </thead>
                <tbody>
                  {routes.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: '700' }}>{r.name}</td>
                      <td>{r.start_location}</td>
                      <td>{r.end_location}</td>
                      <td>{r.distance_km} km</td>
                      <td>{r.estimated_duration_mins} mins</td>
                      <td>{r.stops_count} boarding stops</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MENU 7: ALERTS AND BROADCASTS */}
        {activeMenu === 'broadcast' && (
          <div className="admin-grid">
            {/* Form */}
            <div className="glass-card" style={{ gridColumn: 'span 6' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Dispatch Alert Broadcast Notification</h3>
              <form onSubmit={handleSendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Recipient Scope</label>
                  <select className="input-field" value={broadcastType} onChange={e => setBroadcastType(e.target.value)} style={{ background: 'var(--bg-main)' }}>
                    <option value="all">Entire College Scope</option>
                    <option value="route">Selected Transit Route</option>
                    <option value="student">Targeted Student User</option>
                  </select>
                </div>

                {broadcastType !== 'all' && (
                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Target ID (Route ID or Student User ID)</label>
                    <input type="number" className="input-field" placeholder="Input target ID..." value={broadcastTargetId} onChange={e => setBroadcastTargetId(e.target.value)} required />
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Notification Subject</label>
                  <input type="text" className="input-field" placeholder="Subject line..." value={broadcastTitle} onChange={e => setBroadcastTitle(e.target.value)} required />
                </div>

                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Broadcasting Message Body</label>
                  <textarea className="input-field" rows="4" placeholder="Notification details..." value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} style={{ resize: 'none' }} required></textarea>
                </div>

                <button type="submit" className="btn-primary">
                  <Bell size={16} /> Broadcast Push Alerts
                </button>
              </form>
            </div>

            {/* Suggestions & Complaints feed */}
            <div className="glass-card" style={{ gridColumn: 'span 6', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Recent Student Feedback Reports</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {complaints.length === 0 ? (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No recent reports registered.</span>
                ) : (
                  complaints.map(comp => (
                    <div key={comp.id} style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{
                          padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: '700',
                          background: comp.category === 'bus_issue' ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)',
                          color: comp.category === 'bus_issue' ? 'var(--accent-amber)' : 'var(--text-primary)'
                        }}>
                          {comp.category}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Student: {comp.student_name}</span>
                      </div>
                      <p style={{ fontSize: '12px', marginTop: '6px', color: 'var(--text-secondary)' }}>{comp.description}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
