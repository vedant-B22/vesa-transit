import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, Clock, Navigation, AlertTriangle, HelpCircle, 
  CreditCard, QrCode, FileText, Send, User, LogOut, CheckCircle2, ShieldAlert,
  Bell, BellRing, Volume2, VolumeX, Camera, Lock, Unlock, Check, Sparkles,
  CalendarCheck, Calendar as CalendarIcon, ChevronLeft, ChevronRight, CheckCircle,
  Home, Menu, MoreHorizontal, X
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import QRCodeImage from './LocalQRCode';
import ThemeToggle from './ThemeToggle';

// Leaflet custom styled marker icons using DivIcon for zero asset errors and a high-tech pulse look
const createStopIcon = (num, isActive) => L.divIcon({
  className: 'custom-stop-marker',
  html: `<div style="
    width: 24px;
    height: 24px;
    background: ${isActive ? '#06b6d4' : '#1f2937'};
    border: 3px solid ${isActive ? '#fff' : '#4b5563'};
    color: #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: 700;
    font-family: sans-serif;
  ">${num}</div>`,
  iconSize: [24, 24]
});

const busIcon = L.divIcon({
  className: 'custom-bus-marker',
  html: `<div style="
    width: 32px;
    height: 32px;
    background: #06b6d4;
    border: 3px solid #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 15px rgba(6, 182, 212, 0.6);
  ">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <circle cx="7" cy="20" r="2" />
      <circle cx="17" cy="20" r="2" />
      <path d="M7 8h10M7 12h10" />
    </svg>
  </div>`,
  iconSize: [32, 32]
});

const studentHomeIcon = L.divIcon({
  className: 'custom-student-marker',
  html: `<div style="
    width: 28px;
    height: 28px;
    background: #6366f1;
    border: 3px solid #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
  ">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  </div>`,
  iconSize: [28, 28]
});

// Component to dynamically pan map to focus on coordinate shifts
function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.setView(coords, map.getZoom());
    }
  }, [coords, map]);
  return null;
}

export default function StudentApp({ userId, token, onLogout, theme, toggleTheme }) {
  const [activeTab, setActiveTab] = useState('home');
  const [profile, setProfile] = useState(null);
  const [trip, setTrip] = useState(null);
  const [stops, setStops] = useState([]);
  const [feeData, setFeeData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [isComingToday, setIsComingToday] = useState(true);
  const [waitRequestStatus, setWaitRequestStatus] = useState(null); // null, 'pending', 'accepted', 'rejected'
  const [dailyRequestsCount, setDailyRequestsCount] = useState(0);
  const [sosActive, setSosActive] = useState(false);
  const [notification, setNotification] = useState(null);

  // Authenticated fetch helper that automatically attaches JWT and handles 401
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

  // Proximity 10-minute Alarm State
  const [isAlarmRinging, setIsAlarmRinging] = useState(false);
  const [alarmModalOpen, setAlarmModalOpen] = useState(false);
  const [alarmDismissed, setAlarmDismissed] = useState(false);
  const alarmInterval = useRef(null);
  
  // Student Bus QR Camera Scanner State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [attendanceSuccess, setAttendanceSuccess] = useState(null);
  const scannerRef = useRef(null);

  // Complaints and Lost & Found
  const [complaintCat, setComplaintCat] = useState('complaint');
  const [complaintDesc, setComplaintDesc] = useState('');
  const [complaintSuccess, setComplaintSuccess] = useState(false);

  const [lfType, setLfType] = useState('lost');
  const [lfName, setLfName] = useState('');
  const [lfDesc, setLfDesc] = useState('');
  const [lfSuccess, setLfSuccess] = useState(false);

  // Student Attendance Records & Real Receipt State
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState(null);
  const [calendarViewDate, setCalendarViewDate] = useState(new Date());
  const [selectedCalendarDay, setSelectedCalendarDay] = useState(null);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // AI Chat Assistant
  const [chatMessages, setChatMessages] = useState([
    { sender: 'ai', text: "Hello! I'm your transit AI copilot. How can I help with your bus timing or stop route today?" }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatBottomRef = useRef(null);
  const ws = useRef(null);

  const isDev = window.location.port === '3000' || window.location.port === '3001' || window.location.port === '5173';
  const API_BASE = isDev ? 'http://localhost:5001/api' : '/api';
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const WS_BASE = isDev ? 'ws://localhost:5001' : `${wsProtocol}//${window.location.host}`;

  // High-Impact Web Audio Emergency Siren Synthesizer + Mobile Haptics
  const playAlarmTone = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Dynamics compressor for maximum loudness, presence and punch without clipping
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-14, ctx.currentTime);
      compressor.knee.setValueAtTime(30, ctx.currentTime);
      compressor.ratio.setValueAtTime(12, ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, ctx.currentTime);
      compressor.release.setValueAtTime(0.2, ctx.currentTime);
      compressor.connect(ctx.destination);

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.85, ctx.currentTime);
      masterGain.connect(compressor);

      // Multi-tone Emergency Warble Burst
      const createSirenPulse = (startTime, duration, baseFreq, peakFreq) => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const pulseGain = ctx.createGain();

        osc1.type = 'sawtooth';
        osc2.type = 'square';

        // Rapid dual pitch frequency warble sweep
        osc1.frequency.setValueAtTime(baseFreq, ctx.currentTime + startTime);
        osc1.frequency.linearRampToValueAtTime(peakFreq, ctx.currentTime + startTime + duration * 0.5);
        osc1.frequency.linearRampToValueAtTime(baseFreq, ctx.currentTime + startTime + duration);

        osc2.frequency.setValueAtTime(baseFreq * 1.5, ctx.currentTime + startTime);
        osc2.frequency.linearRampToValueAtTime(peakFreq * 1.5, ctx.currentTime + startTime + duration * 0.5);
        osc2.frequency.linearRampToValueAtTime(baseFreq * 1.5, ctx.currentTime + startTime + duration);

        pulseGain.gain.setValueAtTime(0, ctx.currentTime + startTime);
        pulseGain.gain.linearRampToValueAtTime(0.7, ctx.currentTime + startTime + 0.04);
        pulseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + duration);

        osc1.connect(pulseGain);
        osc2.connect(pulseGain);
        pulseGain.connect(masterGain);

        osc1.start(ctx.currentTime + startTime);
        osc2.start(ctx.currentTime + startTime);
        osc1.stop(ctx.currentTime + startTime + duration);
        osc2.stop(ctx.currentTime + startTime + duration);
      };

      // 3 Rapid urgent burst pulses
      createSirenPulse(0, 0.22, 880, 1320);
      createSirenPulse(0.24, 0.22, 987, 1480);
      createSirenPulse(0.48, 0.38, 1174, 1760);

      // Mobile haptic vibration alert pattern
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([400, 100, 400, 100, 500]);
      }
    } catch (e) {
      console.warn('Audio tone synthesis error:', e);
    }
  };

  const playChimeTone = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([150, 80, 150]);
      }
    } catch (e) {}
  };

  const startAlarm = (message = "Bus is approximately 10 minutes away from your pickup stop!") => {
    setIsAlarmRinging(true);
    setAlarmModalOpen(true);
    playAlarmTone();
    if (alarmInterval.current) clearInterval(alarmInterval.current);
    alarmInterval.current = setInterval(() => {
      playAlarmTone();
    }, 1800);
  };

  const stopAlarm = () => {
    setIsAlarmRinging(false);
    setAlarmModalOpen(false);
    setAlarmDismissed(true);
    if (alarmInterval.current) {
      clearInterval(alarmInterval.current);
      alarmInterval.current = null;
    }
  };

  // Automatically activate camera when student opens the Pass / QR tab
  useEffect(() => {
    if (activeTab === 'pass') {
      setIsCameraActive(true);
    } else {
      setIsCameraActive(false);
    }
  }, [activeTab]);

  // Camera scanner effect for Student scanning Bus QR sticker (Strict live camera feed only)
  useEffect(() => {
    if (isCameraActive) {
      import('html5-qrcode').then(({ Html5QrcodeScanner, Html5QrcodeScanType }) => {
        const scanner = new Html5QrcodeScanner(
          "student-bus-qr-reader",
          { 
            fps: 10, 
            qrbox: { width: 220, height: 220 },
            supportedScanTypes: [Html5QrcodeScanType ? Html5QrcodeScanType.SCAN_TYPE_CAMERA : 0],
            rememberLastUsedCamera: true
          },
          false
        );
        scanner.render(
          async (decodedText) => {
            setIsCameraActive(false);
            scanner.clear().catch(err => console.error(err));
            await handleScanBusQR(decodedText);
          },
          () => {}
        );
        scannerRef.current = scanner;
      });
    } else {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error(err));
        scannerRef.current = null;
      }
    }
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error(err));
      }
      if (alarmInterval.current) {
        clearInterval(alarmInterval.current);
      }
    };
  }, [isCameraActive]);

  // Check proximity to trigger 10-minute arrival alarm automatically
  useEffect(() => {
    if (trip && trip.status === 'active' && trip.eta_mins !== null && trip.eta_mins !== undefined && trip.eta_mins > 0 && trip.eta_mins <= 10) {
      if (!alarmDismissed && !isAlarmRinging) {
        startAlarm(`Bus ${profile?.bus_number || 'BUS-101'} is approximately ${trip.eta_mins} mins away from ${profile?.stop_name || 'your stop'}!`);
      }
    }
  }, [trip?.eta_mins, trip?.status, alarmDismissed, isAlarmRinging]);

  useEffect(() => {
    fetchProfile();
    fetchFees();
    fetchAttendanceHistory();
    initWebSocket();

    return () => {
      if (ws.current) ws.current.close();
      if (alarmInterval.current) clearInterval(alarmInterval.current);
    };
  }, [userId]);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  const fetchProfile = async () => {
    try {
      const res = await authFetch(`${API_BASE}/student/profile/${userId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProfile(data);
      fetchTripDetails();
    } catch (e) {
      console.error('Error fetching student profile:', e);
    }
  };

  const fetchTripDetails = async () => {
    try {
      const res = await authFetch(`${API_BASE}/student/trip/${userId}`);
      const data = await res.json();
      if (res.ok) {
        setTrip(data.trip || null);
        setStops(data.stops || []);
      }
    } catch (e) {
      console.error('Error fetching student trip details:', e);
    }
  };

  const fetchFees = async () => {
    try {
      const res = await authFetch(`${API_BASE}/student/fees/${userId}`);
      const data = await res.json();
      if (res.ok) {
        setFeeData(data.fee);
        setPayments(data.payments || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAttendanceHistory = async () => {
    try {
      const res = await authFetch(`${API_BASE}/student/attendance/${userId}`);
      const data = await res.json();
      if (res.ok) {
        setAttendanceRecords(data.attendance || []);
        setAttendanceStats(data.stats || null);
      }
    } catch (e) {
      console.error('Error fetching attendance history:', e);
    }
  };

  const handleDownloadReceipt = async (paymentId) => {
    setReceiptLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/student/receipt/${paymentId}`);
      const data = await res.json();
      if (res.ok) {
        setSelectedReceipt(data);
      } else {
        alert(data.error || 'Unable to load payment receipt.');
      }
    } catch (e) {
      console.error('Error fetching receipt:', e);
      alert('Failed to connect to receipt service.');
    } finally {
      setReceiptLoading(false);
    }
  };

  const initWebSocket = () => {
    ws.current = new WebSocket(WS_BASE);

    ws.current.onopen = () => {
      console.log('Student socket opened. Registering with JWT...');
      ws.current.send(JSON.stringify({
        type: 'register',
        token,
        role: 'student',
        userId: userId,
        busId: profile?.bus_id || 1
      }));
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Student received WS message:', data);

      if (data.type === 'gps_broadcast') {
        const myBusId = profile?.bus_id || 1;
        if (!data.busId || data.busId === myBusId) {
          setTrip(prev => prev ? {
            ...prev,
            status: 'active',
            current_lat: data.latitude,
            current_lng: data.longitude,
            speed: data.speed,
            eta_mins: data.etaMins
          } : {
            status: 'active',
            current_lat: data.latitude,
            current_lng: data.longitude,
            speed: data.speed,
            eta_mins: data.etaMins,
            bus_id: data.busId || myBusId,
            route_id: data.routeId || 1
          });
        }
      }

      if (data.type === 'trip_started') {
        showToast('Bus Started', 'Your transit bus has left the main terminal!');
        playChimeTone();
        fetchProfile();
      }

      if (data.type === 'stop_reached' || data.type === 'reached_stop') {
        const isMyPickup = 
          (profile?.pickup_stop_id && Number(data.stopId) === Number(profile.pickup_stop_id)) ||
          (profile?.stop_name && data.stopName && profile.stop_name.toLowerCase().trim() === data.stopName.toLowerCase().trim());

        if (isMyPickup) {
          showToast('📍 Bus Arrived at YOUR Pickup Stop!', `Bus ${profile?.bus_number || '101'} is now at ${data.stopName || profile?.stop_name}! Please be ready to board.`);
          playChimeTone();
        } else if (data.stopName) {
          showToast('🚏 Bus Stop Reached', `Bus arrived at ${data.stopName}.${data.nextStopName ? ` Next stop: ${data.nextStopName}` : ''}`);
          playChimeTone();
        } else {
          showToast('🚏 Bus Arrived', 'Your bus has arrived at an upcoming route stop.');
        }
        fetchProfile();
        fetchAttendanceHistory();
      }

      if (data.type === 'trip_ended') {
        showToast('Trip Completed', 'The bus has safely reached the college terminal.');
        setTrip(prev => prev ? { ...prev, status: 'completed' } : null);
        fetchAttendanceHistory();
      }

      if (data.type === 'wait_request_response' && data.studentId === userId) {
        setWaitRequestStatus(data.status);
        showToast(
          data.status === 'accepted' ? 'Request Approved' : 'Request Denied',
          data.status === 'accepted' 
            ? 'The driver will wait for 5 minutes at your stop!' 
            : 'Driver unable to hold bus. Please be on time.'
        );
      }

      if (data.type === 'admin_broadcast') {
        // Show announcement notifications
        if (data.recipientType === 'all' || 
           (data.recipientType === 'route' && data.recipientId === profile?.route_id)) {
          showToast('College Alert', data.message);
        }
      }
    };
  };

  const showToast = (title, message) => {
    setNotification({ title, message });
    setTimeout(() => {
      setNotification(null);
    }, 6000);
  };

  const toggleNotComing = async () => {
    const nextState = !isComingToday;
    const today = new Date().toISOString().split('T')[0];
    try {
      const res = await authFetch(`${API_BASE}/student/not-coming`, {
        method: 'POST',
        body: JSON.stringify({
          studentId: userId,
          date: today,
          isComing: nextState
        })
      });
      if (res.ok) {
        setIsComingToday(nextState);
        showToast('Status Updated', nextState ? "You're scheduled for pickup today." : "You've marked yourself as absent today.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleScanBusQR = async (code) => {
    try {
      const res = await authFetch(`${API_BASE}/student/scan-bus-qr`, {
        method: 'POST',
        body: JSON.stringify({
          studentId: userId,
          busQrCode: code || 'VESA_BUS_101',
          scanType: 'boarding'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setAttendanceSuccess(data);
        showToast('Attendance Marked!', data.message);
        playAlarmTone();
        fetchAttendanceHistory();
      } else {
        alert(data.message || 'Verification error');
      }
    } catch (err) {
      alert('Network error connecting to transit backend: ' + err.message);
    }
  };

  const handleWaitRequest = async () => {
    if (dailyRequestsCount >= 2) return;
    if (!trip || trip.status !== 'active') {
      alert('Wait requests are only active when the bus is in transit!');
      return;
    }
    
    try {
      const res = await authFetch(`${API_BASE}/student/wait-request`, {
        method: 'POST',
        body: JSON.stringify({
          studentId: userId,
          stopId: profile.pickup_stop_id,
          tripId: trip.id
        })
      });

      const data = await res.json();
      if (res.ok) {
        setWaitRequestStatus('pending');
        setDailyRequestsCount(prev => prev + 1);
        showToast('Request Sent', 'Waiting for driver response...');
      } else {
        alert(data.error || 'Unable to submit wait request.');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSOS = async () => {
    let lat = 18.5204;
    let lng = 73.8567;

    if (navigator.geolocation) {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000, enableHighAccuracy: true });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (geoErr) {
        console.warn('Geolocation fallback for SOS:', geoErr);
      }
    }

    setSosActive(true);

    try {
      await authFetch(`${API_BASE}/student/sos`, {
        method: 'POST',
        body: JSON.stringify({ studentId: userId, latitude: lat, longitude: lng })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const cancelSOS = async () => {
    setSosActive(false);
    try {
      await authFetch(`${API_BASE}/admin/sos-resolve`, {
        method: 'POST',
        body: JSON.stringify({ studentId: userId })
      });
      showToast('SOS Resolved', 'Emergency alert has been cleared.');
    } catch (e) {
      console.error(e);
    }
  };

  const handleAIChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userQuery = chatInput;
    setChatMessages(prev => [...prev, { sender: 'student', text: userQuery }]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await authFetch(`${API_BASE}/student/ai-chat`, {
        method: 'POST',
        body: JSON.stringify({ studentId: userId, message: userQuery })
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { sender: 'ai', text: data.answer }]);
    } catch (e) {
      setChatMessages(prev => [...prev, { sender: 'ai', text: 'I am experiencing connection issues. Please try again in a moment.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleComplaintSubmit = async (e) => {
    e.preventDefault();
    if (!complaintDesc.trim()) return;
    try {
      const res = await authFetch(`${API_BASE}/student/complaints`, {
        method: 'POST',
        body: JSON.stringify({
          studentId: userId,
          category: complaintCat,
          description: complaintDesc
        })
      });
      if (res.ok) {
        setComplaintSuccess(true);
        setComplaintDesc('');
        setTimeout(() => setComplaintSuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLFSubmit = async (e) => {
    e.preventDefault();
    if (!lfName.trim() || !lfDesc.trim()) return;
    try {
      const res = await authFetch(`${API_BASE}/student/lost-found`, {
        method: 'POST',
        body: JSON.stringify({
          reporterRole: 'student',
          reporterId: userId,
          itemType: lfType,
          itemName: lfName,
          description: lfDesc,
          busNumber: profile?.bus_number || 'BUS-101',
          date: new Date().toISOString().split('T')[0]
        })
      });
      if (res.ok) {
        setLfSuccess(true);
        setLfName('');
        setLfDesc('');
        setTimeout(() => setLfSuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const mockDownloadReceipt = (txnId) => {
    alert(`Downloading receipt for Transaction ${txnId} (PDF)...`);
  };

  if (!profile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-main)', color: 'var(--text-primary)' }}>
        <div className="pulse-badge">Connecting VESA Link...</div>
      </div>
    );
  }

  // Calculated variables
  const isTripActive = trip && trip.status === 'active';
  const busCoords = isTripActive && trip.current_lat ? [trip.current_lat, trip.current_lng] : null;
  const myStop = stops.find(s => s.id === profile.pickup_stop_id);
  const myStopCoords = myStop ? [myStop.latitude, myStop.longitude] : [18.5204, 73.8567];

  return (
    <div className="phone-screen" style={{ position: 'relative' }}>
      {/* 10-Minute Proximity Alarm Alert Modal */}
      {alarmModalOpen && (
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          right: 10,
          background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
          color: '#fff',
          padding: '14px',
          borderRadius: '12px',
          boxShadow: '0 8px 24px rgba(239, 68, 68, 0.5)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          animation: 'pulse 1.2s infinite ease-in-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BellRing size={20} />
              <span style={{ fontWeight: '800', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                10-Min Proximity Alarm!
              </span>
            </div>
            <Volume2 size={18} />
          </div>
          <div style={{ fontSize: '12px', lineHeight: '1.4', opacity: 0.95 }}>
            Bus <b>{profile.bus_number || 'BUS-101'}</b> is approximately <b>{trip?.eta_mins || 10} mins</b> away from <b>{profile.stop_name || 'your stop'}</b>! Get ready to board.
          </div>
          <button 
            onClick={stopAlarm}
            style={{
              background: '#fff',
              color: '#b91c1c',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 12px',
              fontWeight: '700',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              marginTop: '4px'
            }}
          >
            <VolumeX size={14} /> Dismiss & Stop Alarm
          </button>
        </div>
      )}

      {/* Toast Notification Banner */}
      {notification && (
        <div className="notification-banner">
          <AlertTriangle size={18} style={{ color: 'var(--accent-cyan)' }} />
          <div>
            <div style={{ fontWeight: '700', fontSize: '12px', color: '#fff' }}>{notification.title}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{notification.message}</div>
          </div>
        </div>
      )}

      {/* SOS Overlay Mode */}
      {sosActive && (
        <div className="sos-overlay">
          <ShieldAlert size={64} style={{ marginBottom: '16px', color: '#fff' }} />
          <h2 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '8px' }}>EMERGENCY SOS</h2>
          <p style={{ fontSize: '14px', opacity: 0.9, marginBottom: '24px' }}>
            Live location broadcasted to Driver and Campus Security. Help is on the way.
          </p>
          <button 
            className="btn-secondary" 
            style={{ width: 'auto', background: '#fff', color: '#dc2626', border: 'none', fontWeight: '700' }}
            onClick={cancelSOS}
          >
            Cancel SOS Alert
          </button>
        </div>
      )}

      {/* Emulator UI Top header */}
      <div className="emulator-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img src="/icons/icon-192.png" alt="VESA" style={{ width: '20px', height: '20px', borderRadius: '4px', objectFit: 'contain' }} />
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isTripActive ? 'var(--accent-emerald)' : 'var(--text-muted)' }}></div>
          <span style={{ fontSize: '13px', fontWeight: '800', fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>VESA Student</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {toggleTheme && <ThemeToggle theme={theme} onToggle={toggleTheme} compact />}
          <button onClick={handleSOS} style={{ background: '#dc2626', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 8px rgba(220,38,38,0.4)' }}>
            SOS
          </button>
        </div>
      </div>

      {/* Main Emulator Content */}
      <div className="emulator-content">
        
        {/* TAB 1: HOME */}
        {activeTab === 'home' && (
          <>
            {/* Bus Summary Card */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-cyan)', textTransform: 'uppercase' }}>Assigned Bus</span>
                <span className={isTripActive ? 'pulse-badge' : ''} style={{ fontSize: '10px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '10px' }}>
                  {isTripActive ? 'Live Transit' : 'Off Trip'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: '800' }}>{profile.bus_number}</h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{profile.route_name}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Pickup Stop</span>
                  <div style={{ fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={12} color="var(--accent-rose)" /> {profile.stop_name}
                  </div>
                </div>
              </div>

              {/* Progress timeline summary if bus is active */}
              {isTripActive ? (
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Speed: <b>{Math.round(trip.speed || 35)} km/h</b></span>
                    <span style={{ color: 'var(--accent-amber)' }}>ETA: <b>{trip.eta_mins || 12} mins</b></span>
                  </div>
                  <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: '60%', height: '100%', background: 'var(--accent-cyan)', borderRadius: '2px' }}></div>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0', borderTop: '1px dashed var(--border-color)' }}>
                  Today's route starts scheduled at 7:30 AM
                </div>
              )}

              {/* 10-Min Proximity Alarm Control Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '10px', color: (trip?.eta_mins <= 10 && isTripActive) ? 'var(--accent-rose)' : 'var(--accent-cyan)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Bell size={12} /> {(trip?.eta_mins <= 10 && isTripActive) ? '10m Alarm Active' : '10m Proximity Alarm Armed'}
                </span>
                <button 
                  onClick={() => isAlarmRinging ? stopAlarm() : startAlarm("Demo Alarm: Bus is 10 minutes from your pickup location!")}
                  style={{
                    background: isAlarmRinging ? 'rgba(239,68,68,0.2)' : 'rgba(6,182,212,0.1)',
                    border: '1px solid ' + (isAlarmRinging ? 'var(--accent-rose)' : 'var(--accent-cyan)'),
                    color: isAlarmRinging ? 'var(--accent-rose)' : 'var(--accent-cyan)',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  {isAlarmRinging ? 'Stop Alarm' : '🔔 Test 10m Alarm'}
                </button>
              </div>
            </div>

            {/* Quick Actions Toggles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="glass-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer' }} onClick={toggleNotComing}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Attending Today?</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: isComingToday ? 'var(--accent-emerald)' : 'var(--accent-rose)' }}></div>
                  <span style={{ fontSize: '13px', fontWeight: '700' }}>{isComingToday ? 'Yes, Picking Up' : 'No, Not Coming'}</span>
                </div>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Tap to toggle status</span>
              </div>

              <div className="glass-card" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer', opacity: (!isTripActive || dailyRequestsCount >= 2) ? 0.5 : 1 }} onClick={handleWaitRequest}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Wait 5 Mins</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={14} color="var(--accent-amber)" />
                  <span style={{ fontSize: '13px', fontWeight: '700' }}>
                    {waitRequestStatus === 'pending' ? 'Pending Approval' : 
                     waitRequestStatus === 'accepted' ? 'Accepted' : 'Send Request'}
                  </span>
                </div>
                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{2 - dailyRequestsCount} requests remaining today</span>
              </div>
            </div>

            {/* Driver Profile Summary Card */}
            <div className="glass-card" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-indigo) 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff', fontWeight: '700', fontSize: '18px' }}>
                DM
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '13px', fontWeight: '700' }}>{profile.driver_name || 'David Miller'}</h4>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Duty Driver • {profile.driver_phone || '+1 555-0199'}</span>
              </div>
            </div>

            {/* Route Timeline Progress */}
            <div className="glass-card" style={{ padding: '16px 20px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '16px' }}>Route Progress Timeline</h4>
              <div className="timeline-container">
                {stops.map((stop, index) => {
                  const isActive = isTripActive && trip.current_stop_id >= stop.id;
                  const isBusHere = isTripActive && trip.current_stop_id === stop.id;
                  let itemClass = 'timeline-item';
                  if (isActive) itemClass += ' passed';
                  if (isBusHere) itemClass += ' active';
                  
                  return (
                    <div key={stop.id} className={itemClass}>
                      <div className="timeline-node"></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '600', color: isBusHere ? 'var(--accent-cyan)' : 'inherit' }}>
                            {stop.name}
                          </div>
                          {stop.id === profile.pickup_stop_id && (
                            <span style={{ fontSize: '9px', background: 'rgba(99,102,241,0.15)', color: 'var(--accent-indigo)', padding: '1px 6px', borderRadius: '4px', display: 'inline-block', marginTop: '2px' }}>My Assigned Stop</span>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{stop.scheduled_time}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* TAB 2: LIVE MAP TRACKING */}
        {activeTab === 'tracking' && (
          <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: '600' }}>Live Tracking View</span>
              {isTripActive && <span className="pulse-badge">Bus Active</span>}
            </div>
            
            <div className="map-container" style={{ flex: 1, minHeight: '350px' }}>
              <MapContainer 
                center={busCoords || myStopCoords} 
                zoom={13} 
                scrollWheelZoom={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <Marker position={myStopCoords} icon={studentHomeIcon}>
                  <Popup>My Boarding Stop: {profile.stop_name}</Popup>
                </Marker>

                {busCoords && (
                  <Marker position={busCoords} icon={busIcon}>
                    <Popup>Bus {profile.bus_number}</Popup>
                  </Marker>
                )}

                {/* Recenter on bus coordinate ticks */}
                {busCoords && <RecenterMap coords={busCoords} />}
              </MapContainer>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Speed</span>
                <span style={{ fontSize: '13px', fontWeight: '700' }}>{isTripActive ? `${Math.round(trip.speed)} km/h` : '--'}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>ETA</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--accent-amber)' }}>{isTripActive ? `${trip.eta_mins} mins` : '--'}</span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FEES */}
        {activeTab === 'fees' && feeData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'linear-gradient(135deg, rgba(6,182,212,0.1) 0%, rgba(31,41,55,0.5) 100%)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Outstanding Balance</span>
              <h2 style={{ fontSize: '32px', fontWeight: '800', color: feeData.pending_amount > 0 ? 'var(--accent-amber)' : 'var(--accent-emerald)' }}>
                ₹{feeData.pending_amount}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '12px', fontSize: '12px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Total Term Fee</span>
                  <div style={{ fontWeight: '700', marginTop: '2px' }}>₹{feeData.total_amount}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Total Paid</span>
                  <div style={{ fontWeight: '700', color: 'var(--accent-emerald)', marginTop: '2px' }}>₹{feeData.paid_amount}</div>
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '4px solid var(--accent-cyan)' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                Official Fee Administration Notice
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                All tuition bus transport fees are reconciled manually by the college accounts department. Please pay at the campus accounts desk quoting your Roll Number ({profile?.roll_number}). Your fee status will update immediately upon administrator verification.
              </div>
            </div>

            <div className="glass-card">
              <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px' }}>Payment History</h4>
              {payments.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>No transactions recorded.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {payments.map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '600' }}>Amount: ₹{p.amount}</div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>TXN ID: {p.transaction_id}</span>
                      </div>
                      <button 
                        onClick={() => handleDownloadReceipt(p.id)} 
                        disabled={receiptLoading}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}
                      >
                        <FileText size={12} /> {receiptLoading ? 'Loading...' : 'Receipt (PDF)'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: PASS & DIGITAL ATTENDANCE */}
        {activeTab === 'pass' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Bus QR Scanner Card */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--accent-cyan)', margin: 0 }}>
                    Bus Attendance Scanner
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Scan the QR sticker inside your bus</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '10px', background: 'rgba(6,182,212,0.15)', color: 'var(--accent-cyan)', padding: '2px 8px', borderRadius: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Camera size={10} /> Direct Camera Scanner
                  </span>
                </div>
              </div>

              {/* Attendance Window Notice */}
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px', fontSize: '11px', lineHeight: '1.4' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span><b>Morning:</b> 07:00 – 09:30 AM</span>
                  <span><b>Evening:</b> 04:30 – 07:00 PM</span>
                </div>
              </div>

              {/* Camera Scanner Stream View */}
              {isCameraActive && (
                <div style={{ border: '2px solid var(--accent-cyan)', borderRadius: '12px', padding: '10px', background: '#000', overflow: 'hidden' }}>
                  <div id="student-bus-qr-reader" style={{ width: '100%' }}></div>
                </div>
              )}

              {/* Camera Trigger */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button 
                  onClick={() => setIsCameraActive(!isCameraActive)} 
                  className="btn-primary"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', fontSize: '13px' }}
                >
                  <Camera size={18} /> {isCameraActive ? 'Close Camera Scanner' : 'Open Camera to Scan Bus QR Sticker'}
                </button>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                  Point your camera at the official QR code sticker posted at the bus entrance.
                </span>
              </div>

              {/* Attendance Success Boarding Pass Ticket */}
              {attendanceSuccess && (
                <div style={{
                  background: 'rgba(16,185,129,0.1)',
                  border: '1px solid var(--accent-emerald)',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-emerald)', fontWeight: '700', fontSize: '13px' }}>
                    <CheckCircle2 size={16} /> Digital Attendance Verified
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-primary)' }}>{attendanceSuccess.message}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Boarded at: {attendanceSuccess.timestamp} • Status: <b>PRESENT</b>
                  </div>
                </div>
              )}
            </div>

            {/* Student Personal QR Identity Card */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center', padding: '20px' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Digital Student Bus ID
              </span>
              <div className="qr-pass-container">
                <div className="qr-box" style={{ background: '#fff', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                  <QRCodeImage 
                    value={profile.qr_code_pass || 'QR_PASS_DEFAULT'} 
                    size={140} 
                    alt="Student ID QR" 
                    style={{ zIndex: 1 }} 
                  />
                  <div className="scan-line" style={{ zIndex: 2 }}></div>
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '15px', fontWeight: '700' }}>{profile.name}</div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Roll: {profile.roll_number} • Bus {profile.bus_number}</span>
              </div>
            </div>

            {/* Student Personal Pass Info Card */}
            <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px' }}>
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: '700', margin: 0 }}>Attendance Log & Calendar</h4>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>View overall pie analytics & calendar breakdown</span>
              </div>
              <button 
                onClick={() => setActiveTab('attendance')} 
                className="btn-primary" 
                style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <CalendarCheck size={14} /> View Attendance
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: DEDICATED STUDENT ATTENDANCE SECTION */}
        {activeTab === 'attendance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Header & Overall Summary Counters */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CalendarCheck size={18} color="var(--accent-cyan)" /> My Attendance Calendar
                  </h3>
                  <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                    Daily boarding verification and monthly transit schedule log
                  </span>
                </div>
                {attendanceStats && (
                  <span style={{
                    fontSize: '12px',
                    fontWeight: '800',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    background: 'rgba(6,182,212,0.15)',
                    color: 'var(--accent-cyan)',
                    border: '1px solid rgba(6,182,212,0.3)'
                  }}>
                    {attendanceStats.attendanceRate || 100}% Boarded
                  </span>
                )}
              </div>

              {/* 3 Summary Metric Cards */}
              {(() => {
                const present = attendanceStats?.presentTrips || (attendanceRecords.filter(r => r.status === 'present').length) || 0;
                const absent = attendanceStats?.absentTrips || (attendanceRecords.filter(r => r.status === 'absent').length) || 0;
                const optedOut = attendanceStats?.optedOutTrips || (attendanceRecords.filter(r => r.status === 'not_coming').length) || 0;

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', width: '100%' }}>
                    <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#10b981' }}>
                        {present}
                      </div>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: '600' }}>● Boarded (Present)</span>
                    </div>
                    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#ef4444' }}>
                        {absent}
                      </div>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: '600' }}>● Absent</span>
                    </div>
                    <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', padding: '10px', borderRadius: '10px', textAlign: 'center' }}>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: '#f59e0b' }}>
                        {optedOut}
                      </div>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: '600' }}>● Opted-Out</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* MONTHLY COLOR-CODED CALENDAR */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px' }}>
              {/* Month Navigator Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(calendarViewDate);
                    d.setMonth(d.getMonth() - 1);
                    setCalendarViewDate(d);
                  }}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: '14px', fontWeight: '800' }}>
                  {calendarViewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const d = new Date(calendarViewDate);
                    d.setMonth(d.getMonth() + 1);
                    setCalendarViewDate(d);
                  }}
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Day of Week Headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center' }}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day, dIdx) => (
                  <span key={dIdx} style={{ fontSize: '10.5px', fontWeight: '700', color: 'var(--text-muted)' }}>
                    {day}
                  </span>
                ))}
              </div>

              {/* Calendar Days Matrix */}
              {(() => {
                const year = calendarViewDate.getFullYear();
                const month = calendarViewDate.getMonth();
                const firstDayIndex = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();

                const cells = [];
                // Empty padding cells before first day of month
                for (let i = 0; i < firstDayIndex; i++) {
                  cells.push({ empty: true, key: `empty-${i}` });
                }
                // Day cells
                for (let d = 1; d <= daysInMonth; d++) {
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  const record = attendanceRecords.find(r => {
                    if (!r.scanned_at && !r.recorded_at && !r.trip_date) return false;
                    const rDate = (r.scanned_at || r.recorded_at || r.trip_date).split('T')[0];
                    return rDate === dateStr;
                  });
                  cells.push({
                    dayNum: d,
                    dateStr,
                    record,
                    status: record?.status || null,
                    isWeekend: (new Date(year, month, d).getDay() === 0 || new Date(year, month, d).getDay() === 6),
                    key: `day-${d}`
                  });
                }

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                    {cells.map(c => {
                      if (c.empty) {
                        return <div key={c.key} style={{ height: '38px' }}></div>;
                      }

                      let bg = 'rgba(255,255,255,0.03)';
                      let color = 'var(--text-muted)';
                      let border = '1px solid var(--border-color)';
                      let shadow = 'none';

                      if (c.status === 'present') {
                        bg = '#10b981';
                        color = '#fff';
                        border = '1px solid #10b981';
                        shadow = '0 2px 8px rgba(16,185,129,0.35)';
                      } else if (c.status === 'absent') {
                        bg = '#ef4444';
                        color = '#fff';
                        border = '1px solid #ef4444';
                        shadow = '0 2px 8px rgba(239,68,68,0.35)';
                      } else if (c.status === 'not_coming') {
                        bg = '#f59e0b';
                        color = '#fff';
                        border = '1px solid #f59e0b';
                      } else if (c.isWeekend) {
                        bg = 'rgba(255,255,255,0.015)';
                        color = 'var(--text-muted)';
                        border = '1px dashed rgba(255,255,255,0.06)';
                      }

                      const isSelected = selectedCalendarDay?.dateStr === c.dateStr;

                      return (
                        <div
                          key={c.key}
                          onClick={() => setSelectedCalendarDay(c)}
                          style={{
                            height: '38px',
                            borderRadius: '8px',
                            background: bg,
                            color: color,
                            border: isSelected ? '2px solid var(--accent-cyan)' : border,
                            boxShadow: shadow,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            transform: isSelected ? 'scale(1.06)' : 'none',
                            transition: 'transform 0.15s ease'
                          }}
                        >
                          <span>{c.dayNum}</span>
                          {c.status === 'present' && <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#fff', marginTop: '1px' }}></div>}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Calendar Legend Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '10px', fontSize: '11px', flexWrap: 'wrap', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#10b981' }}></div>
                  <span>Present (Green)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#ef4444' }}></div>
                  <span>Absent (Red)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#f59e0b' }}></div>
                  <span>Opted-Out (Amber)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border-color)' }}></div>
                  <span>No Transit (Grey)</span>
                </div>
              </div>

              {/* Selected Day Inspector Card */}
              {selectedCalendarDay && (
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--accent-cyan)',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: 'var(--accent-cyan)' }}>
                      📅 Date: {selectedCalendarDay.dateStr}
                    </strong>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontSize: '10.5px',
                      fontWeight: '700',
                      background: selectedCalendarDay.status === 'present' ? 'rgba(16,185,129,0.15)' : selectedCalendarDay.status === 'absent' ? 'rgba(239,68,68,0.15)' : selectedCalendarDay.status === 'not_coming' ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.06)',
                      color: selectedCalendarDay.status === 'present' ? '#10b981' : selectedCalendarDay.status === 'absent' ? '#ef4444' : selectedCalendarDay.status === 'not_coming' ? '#f59e0b' : 'var(--text-secondary)'
                    }}>
                      {selectedCalendarDay.status ? selectedCalendarDay.status.toUpperCase() : (selectedCalendarDay.isWeekend ? 'WEEKEND' : 'NO TRIP')}
                    </span>
                  </div>
                  {selectedCalendarDay.record ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <div>Route: <b>{selectedCalendarDay.record.route_name || profile?.route_name || 'Assigned Route'}</b></div>
                      <div>Bus Unit: <b>Bus {selectedCalendarDay.record.bus_number || profile?.bus_number || '101'}</b></div>
                      <div>Stop: <b>{selectedCalendarDay.record.stop_name || profile?.stop_name || 'Pickup Point'}</b></div>
                      {selectedCalendarDay.record.scanned_at && (
                        <div>Checked in: <b>{new Date(selectedCalendarDay.record.scanned_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</b></div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      No transit activity or scan recorded on this day.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Recent Boarding Log */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '700', margin: 0 }}>Recent Boarding Log</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                {attendanceRecords.length === 0 ? (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>
                    No past boarding scans recorded.
                  </span>
                ) : (
                  attendanceRecords.slice(0, 10).map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'var(--bg-card)', borderRadius: '6px', fontSize: '11.5px' }}>
                      <div>
                        <span style={{ fontWeight: '600' }}>{r.route_name || 'Route Link'}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>
                          {r.scanned_at ? new Date(r.scanned_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : (r.trip_date || 'Recent')}
                        </span>
                      </div>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '10.5px',
                        fontWeight: '700',
                        background: r.status === 'present' ? 'rgba(16,185,129,0.15)' : r.status === 'absent' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                        color: r.status === 'present' ? '#10b981' : r.status === 'absent' ? '#ef4444' : '#f59e0b'
                      }}>
                        {r.status === 'present' ? '● Boarded' : r.status === 'absent' ? '● Absent' : '● Opted-Out'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

        {/* TAB 5: AI CHAT ASSISTANT */}
        {activeTab === 'assistant' && (
          <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '12px', gap: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--accent-cyan)' }}>VESA Transit AI Assistant</div>
            <div className="chat-window">
              <div className="chat-messages">
                {chatMessages.map((msg, index) => (
                  <div key={index} className={`chat-bubble ${msg.sender}`}>
                    {msg.text}
                  </div>
                ))}
                {isChatLoading && (
                  <div className="chat-bubble ai" style={{ opacity: 0.7 }}>typing...</div>
                )}
                <div ref={chatBottomRef}></div>
              </div>
              <form onSubmit={handleAIChat} className="chat-input-bar">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask 'Where is my bus?'" 
                />
                <button type="submit">
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 6: SUPPORT & REPORTS */}
        {activeTab === 'support' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Report Complaint */}
            <div className="glass-card">
              <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px' }}>Report Issue / Complaint</h4>
              {complaintSuccess ? (
                <div style={{ color: 'var(--accent-emerald)', fontSize: '12px', textAlign: 'center', padding: '12px' }}>
                  Complaint reported successfully! Admin notified.
                </div>
              ) : (
                <form onSubmit={handleComplaintSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <select 
                    className="input-field"
                    value={complaintCat}
                    onChange={(e) => setComplaintCat(e.target.value)}
                    style={{ background: 'var(--bg-main)' }}
                  >
                    <option value="complaint">Complaint</option>
                    <option value="suggestion">Suggestion</option>
                    <option value="bus_issue">Vehicle / Bus Issue</option>
                  </select>
                  <textarea 
                    className="input-field"
                    rows="3"
                    value={complaintDesc}
                    onChange={(e) => setComplaintDesc(e.target.value)}
                    placeholder="Describe your issue in detail..."
                    style={{ resize: 'none' }}
                  ></textarea>
                  <button type="submit" className="btn-primary">Submit Report</button>
                </form>
              )}
            </div>

            {/* Lost & Found */}
            <div className="glass-card">
              <h4 style={{ fontSize: '13px', fontWeight: '700', marginBottom: '12px' }}>Lost & Found Registry</h4>
              {lfSuccess ? (
                <div style={{ color: 'var(--accent-emerald)', fontSize: '12px', textAlign: 'center', padding: '12px' }}>
                  Item successfully added to registry!
                </div>
              ) : (
                <form onSubmit={handleLFSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <select 
                    className="input-field" 
                    value={lfType}
                    onChange={(e) => setLfType(e.target.value)}
                    style={{ background: 'var(--bg-main)' }}
                  >
                    <option value="lost">I Lost An Item</option>
                    <option value="found">I Found An Item</option>
                  </select>
                  <input 
                    type="text" 
                    className="input-field"
                    value={lfName}
                    onChange={(e) => setLfName(e.target.value)}
                    placeholder="Item Name (e.g. Waterbottle)" 
                  />
                  <textarea 
                    className="input-field"
                    rows="2"
                    value={lfDesc}
                    onChange={(e) => setLfDesc(e.target.value)}
                    placeholder="Provide details/bus number..."
                    style={{ resize: 'none' }}
                  ></textarea>
                  <button type="submit" className="btn-primary">Register Item</button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: PROFILE */}
        {activeTab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-indigo) 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff', fontSize: '24px', fontWeight: '800' }}>
                {profile.name.charAt(0)}
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700' }}>{profile.name}</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Roll Number: {profile.roll_number}</span>
              </div>
            </div>

            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Email Address</span>
                <span style={{ fontWeight: '600' }}>{profile.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Assigned Bus</span>
                <span style={{ fontWeight: '600' }}>{profile.bus_number}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Assigned Route</span>
                <span style={{ fontWeight: '600' }}>{profile.route_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Emergency Contact</span>
                <span style={{ fontWeight: '600', color: 'var(--accent-rose)' }}>{profile.emergency_contact}</span>
              </div>
            </div>

            <button className="btn-secondary" style={{ color: 'var(--accent-rose)' }} onClick={onLogout}>
              <LogOut size={16} style={{ marginRight: '6px', display: 'inline-block', verticalAlign: 'middle' }} /> Logout Session
            </button>
          </div>
        )}
      </div>

      {/* 5-Button Bottom Navbar (Mobile Reachable) */}
      <div className="emulator-footer">
        <button 
          className={`nav-button ${activeTab === 'home' ? 'active' : ''}`} 
          onClick={() => { setActiveTab('home'); setIsMoreOpen(false); }}
        >
          <Home size={19} />
          <span>Home</span>
        </button>
        <button 
          className={`nav-button ${activeTab === 'tracking' ? 'active' : ''}`} 
          onClick={() => { setActiveTab('tracking'); setIsMoreOpen(false); }}
        >
          <MapPin size={19} />
          <span>Live Map</span>
        </button>
        <button 
          className={`nav-button ${activeTab === 'pass' ? 'active' : ''}`} 
          onClick={() => { setActiveTab('pass'); setIsMoreOpen(false); }}
        >
          <QrCode size={19} />
          <span>Bus Pass</span>
        </button>
        <button 
          className={`nav-button ${activeTab === 'attendance' ? 'active' : ''}`} 
          onClick={() => { setActiveTab('attendance'); setIsMoreOpen(false); }}
        >
          <CalendarCheck size={19} />
          <span>Attendance</span>
        </button>
        <button 
          className={`nav-button ${['fees', 'assistant', 'support', 'profile'].includes(activeTab) || isMoreOpen ? 'active' : ''}`} 
          onClick={() => setIsMoreOpen(prev => !prev)}
        >
          <Menu size={19} />
          <span>{['fees', 'assistant', 'support', 'profile'].includes(activeTab) ? (activeTab === 'fees' ? 'Fees' : activeTab === 'assistant' ? 'AI Bot' : activeTab === 'support' ? 'Support' : 'Profile') : 'More'}</span>
        </button>
      </div>

      {/* More Options Drawer Modal */}
      {isMoreOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end'
          }}
          onClick={() => setIsMoreOpen(false)}
        >
          <div 
            style={{
              background: 'var(--bg-surface-solid)',
              borderTop: '1px solid var(--border-color)',
              borderTopLeftRadius: '20px',
              borderTopRightRadius: '20px',
              padding: '20px 16px 28px 16px',
              boxShadow: '0 -10px 30px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              maxWidth: '480px',
              margin: '0 auto',
              width: '100%',
              boxSizing: 'border-box'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-cyan)' }}></div>
                <span style={{ fontSize: '14px', fontWeight: '800', letterSpacing: '0.3px' }}>Transit Hub & Services</span>
              </div>
              <button 
                onClick={() => setIsMoreOpen(false)}
                style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text-secondary)', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                onClick={() => { setActiveTab('fees'); setIsMoreOpen(false); }}
                style={{
                  background: activeTab === 'fees' ? 'var(--accent-cyan-light)' : 'var(--bg-card)',
                  border: '1px solid ' + (activeTab === 'fees' ? 'var(--accent-cyan)' : 'var(--border-color)'),
                  borderRadius: '12px',
                  padding: '14px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '8px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <CreditCard size={20} color="var(--accent-cyan)" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700' }}>Fee Payments</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Receipts & dues</div>
                </div>
              </button>

              <button
                onClick={() => { setActiveTab('assistant'); setIsMoreOpen(false); }}
                style={{
                  background: activeTab === 'assistant' ? 'var(--accent-cyan-light)' : 'var(--bg-card)',
                  border: '1px solid ' + (activeTab === 'assistant' ? 'var(--accent-cyan)' : 'var(--border-color)'),
                  borderRadius: '12px',
                  padding: '14px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '8px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <HelpCircle size={20} color="var(--accent-emerald)" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700' }}>AI Assistant</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Ask transit AI</div>
                </div>
              </button>

              <button
                onClick={() => { setActiveTab('support'); setIsMoreOpen(false); }}
                style={{
                  background: activeTab === 'support' ? 'var(--accent-cyan-light)' : 'var(--bg-card)',
                  border: '1px solid ' + (activeTab === 'support' ? 'var(--accent-cyan)' : 'var(--border-color)'),
                  borderRadius: '12px',
                  padding: '14px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '8px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <AlertTriangle size={20} color="var(--accent-amber)" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700' }}>Help & Issues</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Lost & found / queries</div>
                </div>
              </button>

              <button
                onClick={() => { setActiveTab('profile'); setIsMoreOpen(false); }}
                style={{
                  background: activeTab === 'profile' ? 'var(--accent-cyan-light)' : 'var(--bg-card)',
                  border: '1px solid ' + (activeTab === 'profile' ? 'var(--accent-cyan)' : 'var(--border-color)'),
                  borderRadius: '12px',
                  padding: '14px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '8px',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <User size={20} color="var(--accent-rose)" />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700' }}>My Profile</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Route details & pass</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Payment Receipt Modal (Printable & Downloadable) */}
      {selectedReceipt && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px' }}>
          <div className="glass-card" style={{ width: 'min(95vw, 420px)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-surface-solid)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--accent-cyan)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--border-color)', paddingBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <img src="/icons/icon-192.png" alt="VESA" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                  <span style={{ fontSize: '13px', fontWeight: '800', letterSpacing: '0.5px' }}>VESA TRANSIT</span>
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>Official Fee Payment Receipt</div>
              </div>
              <button onClick={() => setSelectedReceipt(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Receipt #: </span>
                <strong style={{ color: 'var(--accent-cyan)' }}>{selectedReceipt.receiptNumber}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Date: </span>
                <strong>{new Date(selectedReceipt.date).toLocaleDateString()}</strong>
              </div>
            </div>

            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Student Name</span>
                <span style={{ fontWeight: '700' }}>{selectedReceipt.student.name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Roll Number</span>
                <span style={{ fontFamily: 'monospace' }}>{selectedReceipt.student.rollNumber}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Transit Route</span>
                <span>{selectedReceipt.transit.route}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Assigned Bus</span>
                <span>Bus {selectedReceipt.transit.busUnit}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Payment Mode</span>
                <span>{selectedReceipt.payment.method}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-color)', paddingTop: '8px' }}>
                <span style={{ fontWeight: '700' }}>Amount Received</span>
                <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--accent-emerald)' }}>₹{selectedReceipt.payment.amount}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Status: <b style={{ color: 'var(--accent-emerald)' }}>{selectedReceipt.payment.status.toUpperCase()}</b></span>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Txn: {selectedReceipt.transactionId}</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
              <button 
                onClick={() => window.print()} 
                className="btn-primary" 
                style={{ padding: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <FileText size={14} /> Print / PDF
              </button>
              <button 
                onClick={() => setSelectedReceipt(null)} 
                className="btn-secondary" 
                style={{ padding: '8px', fontSize: '12px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
