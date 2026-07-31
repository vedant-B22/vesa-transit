import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, CheckCircle, Navigation, Users, AlertOctagon, 
  CornerUpRight, Check, X, ShieldAlert
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

const activeStopIcon = L.divIcon({
  className: 'driver-stop-marker',
  html: `<div style="width: 14px; height: 14px; background: #ef4444; border: 2px solid #fff; border-radius: 50%;"></div>`,
  iconSize: [14, 14]
});

// Interpolated coordinate paths for Route A simulation (Majestic Hub -> VESA Gate)
const routeAPath = [
  [12.9716, 77.5946], // Majestic Hub (Stop 1)
  [12.9780, 77.5900], [12.9850, 77.5850], [12.9910, 77.5780],
  [12.9982, 77.5714], // Malleswaram 8th Cross (Stop 2)
  [13.0040, 77.5670], [13.0100, 77.5620], [13.0160, 77.5560],
  [13.0234, 77.5501], // Yeshwanthpur Junction (Stop 3)
  [13.0320, 77.5550], [13.0400, 77.5600], [13.0500, 77.5680],
  [13.0601, 77.5750]  // VESA Campus Gate (Stop 4)
];

// Helper to find closest stop index
const stopCoordsIndices = {
  1: 0,  // Majestic
  2: 4,  // Malleswaram
  3: 8,  // Yeshwanthpur
  4: 12  // Campus Gate
};

export default function DriverApp({ userId, onLogout }) {
  const [trip, setTrip] = useState(null);
  const [stops, setStops] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [activeStopIndex, setActiveStopIndex] = useState(0); // Sequence of stop driver is heading to or arrived at
  const [tripStatus, setTripStatus] = useState('scheduled'); // 'scheduled', 'active', 'completed'
  
  // Real-time alerts
  const [waitAlert, setWaitAlert] = useState(null); // Incoming wait request alert object
  const [sosAlert, setSosAlert] = useState(null); // Active SOS alert details
  
  // GPS simulation tracking
  const [simStep, setSimStep] = useState(0);
  const simTimer = useRef(null);
  const ws = useRef(null);

  const isDev = window.location.port === '3000' || window.location.port === '3001' || window.location.port === '5173';
  const API_BASE = isDev ? 'http://localhost:5001/api' : '/api';
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const WS_BASE = isDev ? 'ws://localhost:5001' : `${wsProtocol}//${window.location.host}`;

  useEffect(() => {
    fetchTrip();
    initWebSocket();

    return () => {
      if (ws.current) ws.current.close();
      if (simTimer.current) clearInterval(simTimer.current);
    };
  }, [userId]);

  const fetchTrip = async () => {
    try {
      const res = await fetch(`${API_BASE}/driver/trip/${userId}`);
      const data = await res.json();
      if (res.ok) {
        setTrip(data.trip);
        setStops(data.stops || []);
        setTripStatus(data.trip.status);
        if (data.trip.status === 'active') {
          fetchAttendance(data.trip.id);
          resumeSimulation(data.trip);
        }
      }
    } catch (e) {
      console.error('Error fetching driver trip data:', e);
    }
  };

  const fetchAttendance = async (tripId) => {
    try {
      const res = await fetch(`${API_BASE}/driver/trip/${tripId}/attendance`);
      const data = await res.json();
      if (res.ok) setAttendance(data);
    } catch (e) {
      console.error(e);
    }
  };

  const initWebSocket = () => {
    ws.current = new WebSocket(WS_BASE);

    ws.current.onopen = () => {
      console.log('Driver socket opened. Registering...');
      ws.current.send(JSON.stringify({
        type: 'register',
        role: 'driver',
        userId: userId,
        routeId: 1, // Route A link
        busId: 1 // BUS-101
      }));
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Driver received WS message:', data);

      if (data.type === 'wait_request_alert' && data.driverId === userId) {
        setWaitAlert(data);
      }

      if (data.type === 'sos_alert' && data.driverId === userId) {
        setSosAlert(data);
      }

      if (data.type === 'sos_resolved' && sosAlert && sosAlert.studentId === data.studentId) {
        setSosAlert(null);
      }

      if (data.type === 'attendance_change') {
        if (trip) fetchAttendance(trip.id);
      }
    };
  };

  // Run or resume trip simulation increments
  const resumeSimulation = (activeTrip) => {
    if (simTimer.current) clearInterval(simTimer.current);
    
    // Attempt to guess current sim index from coordinates
    let index = 0;
    if (activeTrip.current_lat) {
      const distanceDiffs = routeAPath.map(coord => 
        Math.hypot(coord[0] - activeTrip.current_lat, coord[1] - activeTrip.current_lng)
      );
      index = distanceDiffs.indexOf(Math.min(...distanceDiffs));
    }
    setSimStep(index);
    startGPSTicking(activeTrip.id, index);
  };

  const startGPSTicking = (tripId, startIndex) => {
    let index = startIndex;
    
    simTimer.current = setInterval(() => {
      if (index >= routeAPath.length) {
        clearInterval(simTimer.current);
        return;
      }

      const coord = routeAPath[index];
      const nextLat = coord[0];
      const nextLng = coord[1];
      
      // Calculate speed
      const speed = index === 0 || index === routeAPath.length - 1 ? 0 : 35 + Math.random() * 15;

      // Send to server over socket
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: 'gps_update',
          tripId,
          latitude: nextLat,
          longitude: nextLng,
          speed: speed
        }));
      }

      setSimStep(index);
      index++;
    }, 4000); // Send coordinates updates every 4 seconds
  };

  const handleStartTrip = async () => {
    if (!trip) return;
    const startCoord = routeAPath[0];
    const firstStop = stops[0]?.id || 1;

    try {
      const res = await fetch(`${API_BASE}/driver/trip/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: trip.id,
          action: 'start',
          stopId: firstStop,
          lat: startCoord[0],
          lng: startCoord[1]
        })
      });
      if (res.ok) {
        setTripStatus('active');
        setActiveStopIndex(0);
        setSimStep(0);
        fetchAttendance(trip.id);
        startGPSTicking(trip.id, 0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReachStop = async () => {
    if (!trip || activeStopIndex >= stops.length) return;
    const stop = stops[activeStopIndex];
    const indexOnPath = stopCoordsIndices[stop.sequence_order] || simStep;
    const stopCoord = routeAPath[indexOnPath];

    try {
      const res = await fetch(`${API_BASE}/driver/trip/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: trip.id,
          action: 'reach_stop',
          stopId: stop.id,
          lat: stopCoord[0],
          lng: stopCoord[1]
        })
      });
      if (res.ok) {
        // Fetch refreshed attendance statuses (auto boards present students)
        fetchAttendance(trip.id);
        alert(`Arrived at stop: ${stop.name}. Boarding passengers.`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLeaveStop = async () => {
    if (!trip || activeStopIndex >= stops.length) return;
    const stop = stops[activeStopIndex];
    const indexOnPath = stopCoordsIndices[stop.sequence_order] || simStep;
    const stopCoord = routeAPath[indexOnPath];

    try {
      const res = await fetch(`${API_BASE}/driver/trip/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: trip.id,
          action: 'leave_stop',
          stopId: stop.id,
          lat: stopCoord[0],
          lng: stopCoord[1]
        })
      });
      if (res.ok) {
        // Move focus target to next scheduled stop sequence
        setActiveStopIndex(prev => Math.min(stops.length - 1, prev + 1));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEndTrip = async () => {
    if (!trip) return;
    const endCoord = routeAPath[routeAPath.length - 1];

    try {
      const res = await fetch(`${API_BASE}/driver/trip/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId: trip.id,
          action: 'end',
          lat: endCoord[0],
          lng: endCoord[1]
        })
      });
      if (res.ok) {
        setTripStatus('completed');
        if (simTimer.current) clearInterval(simTimer.current);
        alert('Trip ended successfully. Shift completed.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleAttendance = async (attId, currentStatus) => {
    const nextStatus = currentStatus === 'present' ? 'absent' : 'present';
    try {
      const res = await fetch(`${API_BASE}/driver/trip/attendance/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attendanceId: attId, status: nextStatus })
      });
      if (res.ok) {
        fetchAttendance(trip.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleWaitAction = async (action) => {
    if (!waitAlert) return;
    try {
      const res = await fetch(`${API_BASE}/driver/wait-request/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: waitAlert.requestId, action })
      });
      if (res.ok) {
        setWaitAlert(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const clearSOS = () => {
    setSosAlert(null);
  };

  if (!trip) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', background: '#0a0e17', color: '#fff' }}>
        <div className="pulse-badge">Synchronizing Driver Unit...</div>
      </div>
    );
  }

  const activeStop = stops[activeStopIndex];
  const busCoordinates = routeAPath[simStep] || routeAPath[0];

  return (
    <div className="phone-screen">
      {/* Wait Request Banner Notification Overlay */}
      {waitAlert && (
        <div className="notification-banner" style={{ background: '#1e293b', border: '1px solid var(--accent-amber)', color: '#fff' }}>
          <Clock size={20} style={{ color: 'var(--accent-amber)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: '700', fontSize: '12px' }}>Wait 5 Mins Request</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              <b>{waitAlert.studentName}</b> at <b>{waitAlert.stopName}</b>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button 
                onClick={() => handleWaitAction('accept')} 
                style={{ flex: 1, padding: '4px', background: 'var(--accent-emerald)', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
              >
                Accept
              </button>
              <button 
                onClick={() => handleWaitAction('reject')} 
                style={{ flex: 1, padding: '4px', background: 'var(--accent-rose)', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SOS Alert Emergency Overlay */}
      {sosAlert && (
        <div className="sos-overlay" style={{ background: '#991b1b' }}>
          <AlertOctagon size={56} style={{ animation: 'bounce 1s infinite', color: '#fff' }} />
          <h3 style={{ fontSize: '24px', fontWeight: '800', marginTop: '12px' }}>SOS DISTRESS</h3>
          <p style={{ fontSize: '13px', margin: '12px 0 20px 0', opacity: 0.9 }}>
            <b>{sosAlert.studentName}</b> triggered SOS emergency alert on Bus Route!
          </p>
          <button 
            onClick={clearSOS} 
            className="btn-secondary" 
            style={{ width: 'auto', background: '#fff', color: '#991b1b', border: 'none', fontWeight: '700' }}
          >
            Acknowledge SOS
          </button>
        </div>
      )}

      {/* Driver Header */}
      <div className="emulator-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Navigation size={14} color="var(--accent-cyan)" />
          <span style={{ fontSize: '13px', fontWeight: '700', fontFamily: 'var(--font-display)' }}>VESA driver console</span>
        </div>
        <button onClick={onLogout} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          Logout
        </button>
      </div>

      {/* Content Area */}
      <div className="emulator-content">
        
        {/* Route Details Card */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--accent-cyan)', fontWeight: '700' }}>Active Duty Duty Route</span>
            <h3 style={{ fontSize: '18px', fontWeight: '800', marginTop: '2px' }}>{trip.route_name}</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Assigned Bus</span>
              <div style={{ fontWeight: '700', marginTop: '2px' }}>{trip.bus_number}</div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Next Stop</span>
              <div style={{ fontWeight: '700', color: 'var(--accent-amber)', marginTop: '2px' }}>
                {tripStatus === 'active' && activeStop ? activeStop.name : 'Not started'}
              </div>
            </div>
          </div>
        </div>

        {/* Live Trip Controller Actions */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ fontSize: '13px', fontWeight: '700' }}>Trip Operations Console</h4>
          
          {tripStatus === 'scheduled' && (
            <button className="btn-primary" onClick={handleStartTrip}>
              <Play size={16} /> Start Daily Trip Shift
            </button>
          )}

          {tripStatus === 'active' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button className="btn-primary" onClick={handleReachStop}>
                  <CheckCircle size={14} /> Reach Stop
                </button>
                <button className="btn-secondary" onClick={handleLeaveStop}>
                  <CornerUpRight size={14} /> Leave Stop
                </button>
              </div>
              <button className="btn-secondary" style={{ color: 'var(--accent-rose)', border: '1px solid rgba(244,63,94,0.2)' }} onClick={handleEndTrip}>
                End Trip Shift
              </button>
            </div>
          )}

          {tripStatus === 'completed' && (
            <div style={{ color: 'var(--accent-emerald)', fontSize: '12px', textAlign: 'center', padding: '6px' }}>
              ✓ Shift Completed. GPS tracking disabled.
            </div>
          )}
        </div>

        {/* GPS Tracking Map Emulator */}
        {tripStatus === 'active' && (
          <div className="glass-card" style={{ padding: '8px', height: '220px' }}>
            <MapContainer 
              center={busCoordinates} 
              zoom={13} 
              scrollWheelZoom={false}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
              />
              <Marker position={busCoordinates} icon={activeStopIcon}>
                <Popup>Bus {trip.bus_number}</Popup>
              </Marker>
            </MapContainer>
          </div>
        )}

        {/* Student Passengers Checklist */}
        <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={14} /> Student Checklist
            </h4>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Total: {attendance.length}
            </span>
          </div>

          {tripStatus === 'scheduled' ? (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
              Student checklist will load once you start the trip.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '200px' }}>
              {attendance.map(st => (
                <div key={st.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: '600' }}>{st.name}</div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Boarding: {st.stop_name}</span>
                  </div>
                  
                  {st.status === 'not_coming' ? (
                    <span style={{ fontSize: '10px', background: 'rgba(244,63,94,0.1)', color: 'var(--accent-rose)', padding: '2px 8px', borderRadius: '4px', fontWeight: '600' }}>
                      Not Coming
                    </span>
                  ) : (
                    <button 
                      onClick={() => handleToggleAttendance(st.id, st.status)}
                      style={{ 
                        background: st.status === 'present' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.05)',
                        border: '1px solid ' + (st.status === 'present' ? 'var(--accent-emerald)' : 'var(--border-color)'),
                        color: st.status === 'present' ? 'var(--accent-emerald)' : 'var(--text-secondary)',
                        padding: '4px 10px', 
                        borderRadius: '6px', 
                        fontSize: '11px', 
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {st.status === 'present' ? <Check size={12} /> : null}
                      {st.status === 'present' ? 'Present' : 'Mark Present'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
