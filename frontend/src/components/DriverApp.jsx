import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, CheckCircle, Navigation, Users, AlertOctagon, 
  CornerUpRight, Check, X, ShieldAlert, QrCode, Bell, UserCheck, UserX, Clock, Sparkles,
  Mic, MicOff, Volume2, VolumeX, Bot, Radio, MessageSquare
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
  const [driverToast, setDriverToast] = useState(null); // Real-time notification banners
  const [showQrStickerModal, setShowQrStickerModal] = useState(false); // Bus QR Sticker modal

  // Voice Assistant States
  const [isListening, setIsListening] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState('');
  const [aiVoiceResponse, setAiVoiceResponse] = useState("Hi David! I'm your transit copilot. Tap the mic or ask a quick question hands-free.");
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const recognitionRef = useRef(null);
  
  // GPS simulation tracking
  const [simStep, setSimStep] = useState(0);
  const simTimer = useRef(null);
  const ws = useRef(null);

  const isDev = window.location.port === '3000' || window.location.port === '3001' || window.location.port === '5173';
  const API_BASE = isDev ? 'http://localhost:5001/api' : '/api';
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const WS_BASE = isDev ? 'ws://localhost:5001' : `${wsProtocol}//${window.location.host}`;

  const showDriverToast = (title, message) => {
    setDriverToast({ title, message });
    setTimeout(() => {
      setDriverToast(null);
    }, 6000);
  };

  // Speech Synthesis Output
  const speakText = (text) => {
    if (voiceMuted || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*_#`]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  };

  // Voice Query Submission
  const handleVoiceQuery = async (queryText) => {
    if (!queryText || !queryText.trim()) return;
    setVoiceQuery(queryText);
    setIsVoiceLoading(true);
    try {
      const res = await fetch(`${API_BASE}/driver/voice-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: userId,
          query: queryText
        })
      });
      const data = await res.json();
      if (res.ok) {
        setAiVoiceResponse(data.answer);
        speakText(data.answer);
      }
    } catch (err) {
      setAiVoiceResponse("Unable to reach voice assistant server.");
    } finally {
      setIsVoiceLoading(false);
    }
  };

  // Microphone Speech Recognition Toggle
  const toggleListen = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser environment. You can tap any of the quick voice query buttons below!");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
        handleVoiceQuery(transcript);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
    }
  };

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

      if (data.type === 'student_absence_alert') {
        showDriverToast(
          data.isComing ? 'Student Coming' : 'Student Absence Alert',
          data.message || `Student #${data.studentId} updated status`
        );
        if (trip) fetchAttendance(trip.id);
      }

      if (data.type === 'passenger_boarded') {
        showDriverToast(
          'Passenger Boarded',
          `${data.studentName} scanned Bus QR and checked in at ${data.stopName}!`
        );
        if (trip) fetchAttendance(trip.id);
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

  // Calculate live passenger breakdown
  const boardedList = attendance.filter(st => (st.effective_status || st.status) === 'present');
  const notComingList = attendance.filter(st => (st.effective_status || st.status) === 'not_coming');
  const awaitingList = attendance.filter(st => (st.effective_status || st.status) === 'absent');

  return (
    <div className="phone-screen" style={{ position: 'relative' }}>
      {/* Real-time Driver Toast Notification Banner */}
      {driverToast && (
        <div className="notification-banner" style={{ background: '#1e293b', border: '1px solid var(--accent-cyan)', color: '#fff' }}>
          <Bell size={18} style={{ color: 'var(--accent-cyan)' }} />
          <div>
            <div style={{ fontWeight: '700', fontSize: '12px', color: 'var(--accent-cyan)' }}>{driverToast.title}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{driverToast.message}</div>
          </div>
        </div>
      )}

      {/* Bus QR Sticker Display Modal (for students to scan from driver screen if needed) */}
      {showQrStickerModal && (
        <div className="sos-overlay" style={{ background: 'rgba(10,14,23,0.95)', zIndex: 99999 }}>
          <div className="glass-card" style={{ maxWidth: '300px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '20px', textAlign: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent-cyan)', letterSpacing: '0.5px' }}>
              Bus QR Attendance Sticker
            </span>
            <div className="qr-box" style={{ background: '#fff', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=VESA_BUS_${trip.bus_number || '101'}`} 
                alt="Bus QR Sticker" 
                style={{ width: '160px', height: '160px', display: 'block' }} 
              />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>Bus #{trip.bus_number}</h3>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Code: VESA_BUS_{trip.bus_number}</span>
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
              Students point their Student App camera at this QR code to log their digital attendance upon boarding.
            </p>
            <button 
              className="btn-primary" 
              style={{ width: '100%', padding: '8px' }}
              onClick={() => setShowQrStickerModal(false)}
            >
              Close Sticker
            </button>
          </div>
        </div>
      )}

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
            <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--accent-cyan)', fontWeight: '700' }}>Active Duty Route</span>
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

        {/* DRIVER AI VOICE COPILOT */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '14px', background: 'linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(99,102,241,0.08) 100%)', border: '1px solid rgba(6,182,212,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bot size={16} color="var(--accent-cyan)" />
              <span style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--accent-cyan)', letterSpacing: '0.5px' }}>
                Driver Voice Copilot
              </span>
              {isSpeaking && (
                <span className="pulse-badge" style={{ fontSize: '9px', background: 'rgba(16,185,129,0.2)', color: 'var(--accent-emerald)', padding: '1px 6px' }}>
                  Speaking
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button 
                onClick={() => setVoiceMuted(!voiceMuted)} 
                title={voiceMuted ? "Unmute Voice" : "Mute Voice"}
                style={{ background: 'none', border: 'none', color: voiceMuted ? 'var(--accent-rose)' : 'var(--accent-cyan)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                {voiceMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </button>
            </div>
          </div>

          {/* Assistant Voice Bubble */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '8px',
            padding: '10px 12px',
            border: '1px solid var(--border-color)',
            fontSize: '11px',
            lineHeight: '1.45',
            color: '#fff',
            minHeight: '40px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            {voiceQuery && (
              <div style={{ fontSize: '10px', color: 'var(--accent-cyan)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Radio size={10} /> "{voiceQuery}"
              </div>
            )}
            <div>
              {isVoiceLoading ? (
                <span style={{ opacity: 0.7 }}>Thinking...</span>
              ) : (
                aiVoiceResponse
              )}
            </div>
          </div>

          {/* Push to Talk Mic Button */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={toggleListen}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '8px',
                border: isListening ? '1px solid var(--accent-rose)' : '1px solid var(--accent-cyan)',
                background: isListening ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : 'linear-gradient(135deg, rgba(6,182,212,0.2) 0%, rgba(99,102,241,0.2) 100%)',
                color: '#fff',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isListening ? (
                <>
                  <MicOff size={16} /> Listening... (Speak Now)
                </>
              ) : (
                <>
                  <Mic size={16} color="var(--accent-cyan)" /> Tap to Speak (Hands-Free)
                </>
              )}
            </button>
          </div>

          {/* Quick Voice Command Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
            {[
              { label: '👥 Who is absent?', query: 'Who is not coming today?' },
              { label: '🔢 Headcount?', query: 'What is the passenger headcount?' },
              { label: '📍 Next stop?', query: 'What is the next stop?' },
              { label: '🚦 Route status?', query: 'What is the route and transit status?' }
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleVoiceQuery(chip.query)}
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-secondary)',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* GPS Tracking Map Emulator */}
        {tripStatus === 'active' && (
          <div className="glass-card" style={{ padding: '8px', height: '200px' }}>
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

        {/* Live Passenger Roster & Presence Dashboard */}
        <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
              <Users size={14} /> Live Passenger Roster
            </h4>
            <button 
              onClick={() => setShowQrStickerModal(true)} 
              className="btn-secondary" 
              style={{ width: 'auto', padding: '4px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <QrCode size={12} /> Show Bus QR Sticker
            </button>
          </div>

          {/* Real-time Headcount Metrics Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', fontSize: '11px' }}>
            <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', padding: '6px 8px', borderRadius: '6px', textAlign: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '9px', display: 'block' }}>BOARDED</span>
              <span style={{ fontWeight: '800', color: 'var(--accent-emerald)', fontSize: '13px' }}>{boardedList.length}</span>
            </div>
            <div style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)', padding: '6px 8px', borderRadius: '6px', textAlign: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '9px', display: 'block' }}>AWAITING</span>
              <span style={{ fontWeight: '800', color: 'var(--accent-cyan)', fontSize: '13px' }}>{awaitingList.length}</span>
            </div>
            <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)', padding: '6px 8px', borderRadius: '6px', textAlign: 'center' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '9px', display: 'block' }}>NOT COMING</span>
              <span style={{ fontWeight: '800', color: 'var(--accent-rose)', fontSize: '13px' }}>{notComingList.length}</span>
            </div>
          </div>

          {tripStatus === 'scheduled' ? (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
              Passenger roster will activate automatically once you start the daily trip shift.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '220px' }}>
              {attendance.length === 0 ? (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                  No students assigned to this route.
                </div>
              ) : (
                attendance.map(st => {
                  const effectiveStatus = st.effective_status || st.status;
                  const isBoarded = effectiveStatus === 'present';
                  const isNotComing = effectiveStatus === 'not_coming';
                  const isAwaiting = !isBoarded && !isNotComing;

                  return (
                    <div 
                      key={st.id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '8px 10px', 
                        borderRadius: '8px',
                        background: isNotComing ? 'rgba(244,63,94,0.05)' : isBoarded ? 'rgba(16,185,129,0.05)' : 'rgba(255,255,255,0.02)',
                        border: '1px solid ' + (isNotComing ? 'rgba(244,63,94,0.2)' : isBoarded ? 'rgba(16,185,129,0.2)' : 'var(--border-color)')
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {st.name}
                          {st.roll_number && (
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                              ({st.roll_number})
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          Stop: <b>{st.stop_name}</b>
                        </span>
                      </div>
                      
                      {isNotComing ? (
                        <span style={{ fontSize: '10px', background: 'rgba(244,63,94,0.15)', color: 'var(--accent-rose)', padding: '3px 8px', borderRadius: '4px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <X size={11} /> Not Coming Today
                        </span>
                      ) : isBoarded ? (
                        <span style={{ fontSize: '10px', background: 'rgba(16,185,129,0.15)', color: 'var(--accent-emerald)', padding: '3px 8px', borderRadius: '4px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Check size={11} /> Boarded (Scanned)
                        </span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '10px', background: 'rgba(6,182,212,0.1)', color: 'var(--accent-cyan)', padding: '3px 6px', borderRadius: '4px', fontWeight: '600' }}>
                            Awaiting Pickup
                          </span>
                          <button 
                            onClick={() => handleToggleAttendance(st.id, 'absent')}
                            title="Manual Check-in fallback"
                            style={{ 
                              background: 'rgba(255,255,255,0.05)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-secondary)',
                              padding: '3px 6px', 
                              borderRadius: '4px', 
                              fontSize: '10px', 
                              fontWeight: '600',
                              cursor: 'pointer'
                            }}
                          >
                            + Board
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
