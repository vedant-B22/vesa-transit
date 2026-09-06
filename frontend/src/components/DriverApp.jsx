import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, CheckCircle, Navigation, Users, AlertOctagon, AlertTriangle,
  CornerUpRight, Check, X, ShieldAlert, QrCode, Bell, UserCheck, UserX, Clock, Sparkles,
  Mic, MicOff, Volume2, VolumeX, Bot, Radio, MessageSquare, MapPin
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import QRCodeImage from './LocalQRCode';

const activeStopIcon = L.divIcon({
  className: 'driver-stop-marker',
  html: `<div style="width: 14px; height: 14px; background: #ef4444; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 0 6px rgba(239,68,68,0.8);"></div>`,
  iconSize: [14, 14]
});

const driverBusIcon = L.divIcon({
  className: 'driver-bus-marker',
  html: `<div style="
    width: 28px;
    height: 28px;
    background: #06b6d4;
    border: 3px solid #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 12px rgba(6,182,212,0.8);
  ">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <circle cx="7" cy="20" r="2" />
      <circle cx="17" cy="20" r="2" />
    </svg>
  </div>`,
  iconSize: [28, 28]
});

export default function DriverApp({ userId, token, onLogout }) {
  const [trip, setTrip] = useState(null);
  const [stops, setStops] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [activeStopIndex, setActiveStopIndex] = useState(0);
  const [tripStatus, setTripStatus] = useState('scheduled'); // 'scheduled', 'active', 'completed'
  
  // Real-time alerts
  const [waitAlert, setWaitAlert] = useState(null);
  const [sosAlert, setSosAlert] = useState(null);
  const [driverToast, setDriverToast] = useState(null);
  const [showQrStickerModal, setShowQrStickerModal] = useState(false);

  // Real GPS Geolocation States
  const [currentLocation, setCurrentLocation] = useState({
    latitude: null,
    longitude: null,
    speed: 0,
    accuracy: null
  });
  const [geoError, setGeoError] = useState(null);
  const [isGpsActive, setIsGpsActive] = useState(false);
  const watchIdRef = useRef(null);
  const lastGpsSentTimeRef = useRef(0);
  const tripRef = useRef(trip);
  tripRef.current = trip;

  // Voice Assistant States
  const [voiceLang, setVoiceLang] = useState('en');
  const [isListening, setIsListening] = useState(false);
  const [voiceQuery, setVoiceQuery] = useState('');
  const [aiVoiceResponse, setAiVoiceResponse] = useState("Hi! I'm your transit copilot. Tap the mic or ask a quick question hands-free.");
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const recognitionRef = useRef(null);
  const ws = useRef(null);

  const isDev = window.location.port === '3000' || window.location.port === '3001' || window.location.port === '5173';
  const API_BASE = isDev ? 'http://localhost:5001/api' : '/api';
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const WS_BASE = isDev ? 'ws://localhost:5001' : `${wsProtocol}//${window.location.host}`;

  const authFetch = async (url, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
    try {
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401 && onLogout) {
        onLogout();
      }
      return res;
    } catch (err) {
      console.error('Fetch error:', err);
      throw err;
    }
  };

  const showDriverToast = (title, message) => {
    setDriverToast({ title, message });
    setTimeout(() => {
      setDriverToast(null);
    }, 6000);
  };

  // Speech Synthesis Output
  const speakText = (text, langCode = voiceLang) => {
    if (voiceMuted || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const cleanText = text.replace(/[*_#`]/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      
      if (langCode === 'mr') {
        utterance.lang = 'mr-IN';
      } else if (langCode === 'hi') {
        utterance.lang = 'hi-IN';
      } else {
        utterance.lang = 'en-IN';
      }

      utterance.rate = 1.0;
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
  const handleVoiceQuery = async (queryText, langCode = voiceLang) => {
    if (!queryText || !queryText.trim()) return;
    setVoiceQuery(queryText);
    setIsVoiceLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/driver/voice-assistant`, {
        method: 'POST',
        body: JSON.stringify({
          driverId: userId,
          query: queryText,
          lang: langCode
        })
      });
      const data = await res.json();
      if (res.ok) {
        setAiVoiceResponse(data.answer);
        speakText(data.answer, langCode);
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
      recognition.lang = voiceLang === 'mr' ? 'mr-IN' : voiceLang === 'hi' ? 'hi-IN' : 'en-IN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
        handleVoiceQuery(transcript, voiceLang);
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

  // Real GPS Geolocation Watcher
  const startRealGpsTracking = (tripId) => {
    if (!('geolocation' in navigator)) {
      setGeoError('GPS / Geolocation hardware is not supported on this device/browser.');
      return;
    }

    setGeoError(null);
    setIsGpsActive(true);

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 3000
    };

    const handleSuccess = (position) => {
      const { latitude, longitude, speed, accuracy } = position.coords;
      const currentSpeedKmh = speed !== null && speed !== undefined ? Math.max(0, speed * 3.6) : 0;

      setCurrentLocation({
        latitude,
        longitude,
        speed: currentSpeedKmh,
        accuracy
      });
      setGeoError(null);

      // Throttled WebSocket broadcast (send every 5 seconds)
      const now = Date.now();
      if (now - lastGpsSentTimeRef.current >= 5000) {
        lastGpsSentTimeRef.current = now;
        const currentTripId = tripId || (tripRef.current ? tripRef.current.id : null);
        if (currentTripId && ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
            type: 'gps_update',
            tripId: currentTripId,
            latitude,
            longitude,
            speed: currentSpeedKmh
          }));
        }
      }
    };

    const handleError = (error) => {
      let errorMsg = 'Failed to acquire GPS location.';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMsg = 'GPS Location Permission Denied. Please enable location permissions in your browser or device settings to broadcast live bus position.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMsg = 'GPS signal unavailable. Please ensure location services are enabled on your device.';
          break;
        case error.TIMEOUT:
          errorMsg = 'GPS location request timed out. Retrying...';
          break;
        default:
          errorMsg = error.message || 'GPS location error.';
      }
      setGeoError(errorMsg);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, options);
  };

  const stopRealGpsTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsGpsActive(false);
  };

  useEffect(() => {
    fetchTrip();
    initWebSocket();

    return () => {
      stopRealGpsTracking();
      if (ws.current) ws.current.close();
    };
  }, [userId]);

  const fetchTrip = async () => {
    try {
      const res = await authFetch(`${API_BASE}/driver/trip/${userId}`);
      const data = await res.json();
      if (res.ok) {
        setTrip(data.trip);
        setStops(data.stops || []);
        setTripStatus(data.trip.status);
        if (data.trip.status === 'active') {
          fetchAttendance(data.trip.id);
          startRealGpsTracking(data.trip.id);
        }
      }
    } catch (e) {
      console.error('Error fetching driver trip data:', e);
    }
  };

  const fetchAttendance = async (tripId) => {
    try {
      const res = await authFetch(`${API_BASE}/driver/trip/${tripId}/attendance`);
      const data = await res.json();
      if (res.ok) setAttendance(data);
    } catch (e) {
      console.error(e);
    }
  };

  const initWebSocket = () => {
    ws.current = new WebSocket(WS_BASE);

    ws.current.onopen = () => {
      ws.current.send(JSON.stringify({
        type: 'register',
        token,
        role: 'driver',
        userId: userId,
        routeId: trip ? trip.route_id : 1,
        busId: trip ? trip.bus_id : 1
      }));
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

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

  const handleStartTrip = async () => {
    if (!trip) return;
    const firstStop = stops[0]?.id || 1;
    const lat = currentLocation.latitude || stops[0]?.latitude || 12.9716;
    const lng = currentLocation.longitude || stops[0]?.longitude || 77.5946;

    try {
      const res = await authFetch(`${API_BASE}/driver/trip/action`, {
        method: 'POST',
        body: JSON.stringify({
          tripId: trip.id,
          action: 'start',
          stopId: firstStop,
          lat,
          lng
        })
      });
      if (res.ok) {
        setTripStatus('active');
        setActiveStopIndex(0);
        fetchAttendance(trip.id);
        startRealGpsTracking(trip.id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReachStop = async () => {
    if (!trip || activeStopIndex >= stops.length) return;
    const stop = stops[activeStopIndex];
    const lat = currentLocation.latitude || stop.latitude;
    const lng = currentLocation.longitude || stop.longitude;

    try {
      const res = await authFetch(`${API_BASE}/driver/trip/action`, {
        method: 'POST',
        body: JSON.stringify({
          tripId: trip.id,
          action: 'reach_stop',
          stopId: stop.id,
          lat,
          lng
        })
      });
      if (res.ok) {
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
    const lat = currentLocation.latitude || stop.latitude;
    const lng = currentLocation.longitude || stop.longitude;

    try {
      const res = await authFetch(`${API_BASE}/driver/trip/action`, {
        method: 'POST',
        body: JSON.stringify({
          tripId: trip.id,
          action: 'leave_stop',
          stopId: stop.id,
          lat,
          lng
        })
      });
      if (res.ok) {
        setActiveStopIndex(prev => Math.min(stops.length - 1, prev + 1));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEndTrip = async () => {
    if (!trip) return;
    const lastStop = stops[stops.length - 1];
    const lat = currentLocation.latitude || lastStop?.latitude || 12.9716;
    const lng = currentLocation.longitude || lastStop?.longitude || 77.5946;

    try {
      const res = await authFetch(`${API_BASE}/driver/trip/action`, {
        method: 'POST',
        body: JSON.stringify({
          tripId: trip.id,
          action: 'end',
          lat,
          lng
        })
      });
      if (res.ok) {
        setTripStatus('completed');
        stopRealGpsTracking();
        alert('Trip ended successfully. Shift completed.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleAttendance = async (attId, currentStatus) => {
    const nextStatus = currentStatus === 'present' ? 'absent' : 'present';
    try {
      const res = await authFetch(`${API_BASE}/driver/trip/attendance/toggle`, {
        method: 'POST',
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
      const res = await authFetch(`${API_BASE}/driver/wait-request/action`, {
        method: 'POST',
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
  const busCoordinates = currentLocation.latitude && currentLocation.longitude
    ? [currentLocation.latitude, currentLocation.longitude]
    : (stops[0] ? [stops[0].latitude, stops[0].longitude] : [12.9716, 77.5946]);

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

      {/* Bus QR Sticker Display Modal (Generated locally without third-party requests) */}
      {showQrStickerModal && (
        <div className="sos-overlay" style={{ background: 'rgba(10,14,23,0.95)', zIndex: 99999 }}>
          <div className="glass-card" style={{ maxWidth: '300px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '20px', textAlign: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent-cyan)', letterSpacing: '0.5px' }}>
              Bus QR Attendance Sticker
            </span>
            <div className="qr-box" style={{ background: '#fff', padding: '12px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <QRCodeImage 
                value={`VESA_BUS_${trip.bus_number || '101'}`} 
                size={160} 
                alt={`Bus ${trip.bus_number} QR Code`} 
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
        
        {/* Real GPS Status Banner or Warning */}
        {geoError && (
          <div style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid var(--accent-rose)', color: '#fff', padding: '10px 14px', borderRadius: '8px', fontSize: '11px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <AlertOctagon size={16} color="var(--accent-rose)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: '700', color: 'var(--accent-rose)' }}>GPS Live Tracking Alert</div>
              <div>{geoError}</div>
            </div>
          </div>
        )}

        {isGpsActive && currentLocation.latitude && (
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: 'var(--accent-emerald)', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-emerald)', display: 'inline-block', boxShadow: '0 0 6px var(--accent-emerald)' }}></span>
              Live GPS Transmitting
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
              {currentLocation.latitude.toFixed(4)}, {currentLocation.longitude.toFixed(4)} ({Math.round(currentLocation.speed)} km/h)
            </span>
          </div>
        )}

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

        {/* DRIVER AI VOICE COPILOT (MULTILINGUAL: ENGLISH / HINDI / MARATHI) */}
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
            
            {/* Language Switcher & Mute Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '2px', border: '1px solid var(--border-color)' }}>
                {[
                  { code: 'en', label: 'EN' },
                  { code: 'hi', label: 'हिन्दी' },
                  { code: 'mr', label: 'मराठी' }
                ].map(l => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setVoiceLang(l.code);
                      const welcome = l.code === 'mr' 
                        ? 'नमस्कार! मी तुमचा ड्रायव्हर व्हॉईस असिस्टंट आहे. बोला किंवा खालील बटण दाबा.'
                        : l.code === 'hi'
                        ? 'नमस्ते! मैं आपका ड्राइवर वॉइस असिस्टेंट हूँ। बोलें या नीचे दिए गए बटन दबाएं।'
                        : "Hi! I'm your transit copilot. Tap the mic or ask a quick question hands-free.";
                      setAiVoiceResponse(welcome);
                      speakText(welcome, l.code);
                    }}
                    style={{
                      background: voiceLang === l.code ? 'var(--accent-cyan)' : 'transparent',
                      color: voiceLang === l.code ? '#000' : 'var(--text-secondary)',
                      border: 'none',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '9px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    {l.label}
                  </button>
                ))}
              </div>

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
                <span style={{ opacity: 0.7 }}>{voiceLang === 'mr' ? 'विचार करत आहे...' : voiceLang === 'hi' ? 'सोच रहा हूँ...' : 'Thinking...'}</span>
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
                  <MicOff size={16} /> {voiceLang === 'mr' ? 'ऐकत आहे... (बोला)' : voiceLang === 'hi' ? 'सुन रहा हूँ... (बोलें)' : 'Listening... (Speak Now)'}
                </>
              ) : (
                <>
                  <Mic size={16} color="var(--accent-cyan)" /> {voiceLang === 'mr' ? 'माईक दाबा (मराठीत बोला)' : voiceLang === 'hi' ? 'माइक दबाएं (हिंदी में बोलें)' : 'Tap to Speak (Hands-Free)'}
                </>
              )}
            </button>
          </div>

          {/* Quick Voice Command Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
            {(voiceLang === 'mr' ? [
              { label: '👥 आज कोण येत नाही?', query: 'आज कोण येत नाही?' },
              { label: '🔢 एकूण प्रवासी?', query: 'एकूण किती प्रवासी आहेत?' },
              { label: '📍 पुढचा थांबा?', query: 'पुढचा थांबा कोणता आहे?' },
              { label: '🚦 रूट स्थिती?', query: 'रूट आणि ट्रॅफिक स्थिती काय आहे?' }
            ] : voiceLang === 'hi' ? [
              { label: '👥 आज कौन नहीं आ रहा?', query: 'आज कौन नहीं आ रहा है?' },
              { label: '🔢 कुल यात्री?', query: 'कुल कितने यात्री हैं?' },
              { label: '📍 अगला स्टॉप?', query: 'अगला स्टॉप कौन सा है?' },
              { label: '🚦 रूट स्थिति?', query: 'रूट और ट्रैफिक स्थिति क्या है?' }
            ] : [
              { label: '👥 Who is absent?', query: 'Who is not coming today?' },
              { label: '🔢 Headcount?', query: 'What is the passenger headcount?' },
              { label: '📍 Next stop?', query: 'What is the next stop?' },
              { label: '🚦 Route status?', query: 'What is the route and transit status?' }
            ]).map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleVoiceQuery(chip.query, voiceLang)}
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

        {/* Real Live GPS Tracking Map */}
        {tripStatus === 'active' && (
          <div className="glass-card" style={{ padding: '8px', height: '220px' }}>
            <MapContainer 
              center={busCoordinates} 
              zoom={13} 
              scrollWheelZoom={false}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {stops.map(st => (
                <Marker key={st.id} position={[st.latitude, st.longitude]} icon={activeStopIcon}>
                  <Popup>Stop #{st.sequence_order}: {st.name}</Popup>
                </Marker>
              ))}
              {currentLocation.latitude && currentLocation.longitude && (
                <Marker position={[currentLocation.latitude, currentLocation.longitude]} icon={driverBusIcon}>
                  <Popup>Your Bus (Speed: {Math.round(currentLocation.speed)} km/h)</Popup>
                </Marker>
              )}
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
