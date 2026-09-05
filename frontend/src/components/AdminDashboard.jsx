import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart2, Users, Truck, Route as RouteIcon, AlertTriangle, ShieldAlert, 
  Plus, Edit, Trash2, Upload, Search, Bell, Download, Check, Wrench,
  Camera, QrCode, MapPin, X, Eye, Phone, Mail, FileText, CheckCircle, Navigation
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

export default function AdminDashboard({ token, onLogout }) {
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
  const [defaultFeeAmount, setDefaultFeeAmount] = useState('800');
  const [feeDueDate, setFeeDueDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split('T')[0];
  });

  // Fee Approval State
  const [feeModalStudent, setFeeModalStudent] = useState(null);
  const [feeAmount, setFeeAmount] = useState('');
  const [feeStatus, setFeeStatus] = useState('paid');
  const [feePaymentMethod, setFeePaymentMethod] = useState('Campus Cashier Counter');
  const [feeNotes, setFeeNotes] = useState('');
  const [feeSubmitting, setFeeSubmitting] = useState(false);

  // Student Edit Modal
  const [studentEditModal, setStudentEditModal] = useState({ isOpen: false, data: null });

  // Driver CRUD State
  const [driverModal, setDriverModal] = useState({
    isOpen: false,
    mode: 'add',
    data: { name: '', email: '', phone: '', licenseNumber: '', activeBusId: '', initialPassword: '' }
  });

  // Bus CRUD State
  const [busModal, setBusModal] = useState({
    isOpen: false,
    mode: 'add',
    data: { id: null, busNumber: '', registrationNumber: '', capacity: 45, totalMileage: 0, insuranceExpiry: '', status: 'active' }
  });

  // Route CRUD State
  const [routeModal, setRouteModal] = useState({
    isOpen: false,
    mode: 'add',
    data: { id: null, name: '', startLocation: '', endLocation: '', distanceKm: 15, estimatedDurationMins: 45 }
  });

  // Stops Management State (for selected route)
  const [stopsRoute, setStopsRoute] = useState(null);
  const [stopsList, setStopsList] = useState([]);
  const [stopModal, setStopModal] = useState({
    isOpen: false,
    mode: 'add',
    data: { id: null, name: '', latitude: 12.9716, longitude: 77.5946, sequenceOrder: 1, scheduledTime: '07:30 AM' }
  });

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

  useEffect(() => {
    if (isScanning) {
      import('html5-qrcode').then(({ Html5QrcodeScanner, Html5QrcodeScanType }) => {
        const scanner = new Html5QrcodeScanner(
          "qr-reader",
          { 
            fps: 10, 
            qrbox: { width: 220, height: 220 },
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
          },
          false
        );

        scanner.render(
          (decodedText) => {
            setScannedPassCode(decodedText);
            handleVerifyQRPass(decodedText);
            setIsScanning(false);
            scanner.clear().catch(err => console.error("Error clearing scanner", err));
          },
          () => {}
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
      const res = await authFetch(`${API_BASE}/admin/dashboard`);
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
      const res = await authFetch(`${API_BASE}/admin/tracking/live`);
      const data = await res.json();
      if (res.ok) setLiveTrips(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStudentList = async () => {
    try {
      const res = await authFetch(`${API_BASE}/admin/students`);
      const data = await res.json();
      if (res.ok) setStudents(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchDriverList = async () => {
    try {
      const res = await authFetch(`${API_BASE}/admin/drivers`);
      const data = await res.json();
      if (res.ok) setDrivers(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchBusList = async () => {
    try {
      const res = await authFetch(`${API_BASE}/admin/buses`);
      const data = await res.json();
      if (res.ok) setBuses(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRouteList = async () => {
    try {
      const res = await authFetch(`${API_BASE}/admin/routes`);
      const data = await res.json();
      if (res.ok) setRoutes(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchStopsForRoute = async (routeId) => {
    try {
      const res = await authFetch(`${API_BASE}/admin/routes/${routeId}/stops`);
      const data = await res.json();
      if (res.ok) setStopsList(data);
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
        role: 'admin',
        userId: 8
      }));
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'sos_alert' || data.type === 'wait_request_alert' || data.type === 'route_optimization') {
        fetchDashboardData();
        fetchLiveTracking();
      }
      if (data.type === 'gps_broadcast') {
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
      const res = await authFetch(`${API_BASE}/admin/sos-resolve`, {
        method: 'POST',
        body: JSON.stringify({ studentId })
      });
      if (res.ok) fetchDashboardData();
    } catch (e) {
      console.error(e);
    }
  };

  // --- STUDENT ACTIONS ---
  const handleAddStudent = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch(`${API_BASE}/admin/students`, {
        method: 'POST',
        body: JSON.stringify(studentForm)
      });
      if (res.ok) {
        fetchStudentList();
        fetchDashboardData();
        setStudentForm({ name: '', email: '', rollNumber: '', busId: 1, routeId: 1, pickupStopId: 1, emergencyContact: '' });
        alert('Student successfully created.');
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to create student');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    if (!studentEditModal.data) return;
    try {
      const s = studentEditModal.data;
      const res = await authFetch(`${API_BASE}/admin/students/${s.user_id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: s.name,
          email: s.email,
          rollNumber: s.roll_number,
          busId: s.bus_id ? parseInt(s.bus_id) : null,
          routeId: s.route_id ? parseInt(s.route_id) : null,
          pickupStopId: s.pickup_stop_id ? parseInt(s.pickup_stop_id) : null,
          emergencyContact: s.emergency_contact
        })
      });
      if (res.ok) {
        setStudentEditModal({ isOpen: false, data: null });
        fetchStudentList();
        alert('Student updated successfully.');
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to update student');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteStudent = async (id) => {
    if (!confirm('Are you sure you want to delete this student?')) return;
    try {
      const res = await authFetch(`${API_BASE}/admin/students/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchStudentList();
        fetchDashboardData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleImportCSV = async () => {
    if (!csvText.trim()) return;
    const lines = csvText.split('\n');
    const importList = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      const parts = line.split(',');
      if (parts.length >= 5) {
        importList.push({
          name: parts[0]?.trim() || '',
          email: parts[1]?.trim() || '',
          rollNumber: parts[2]?.trim() || '',
          emergencyContact: parts[3]?.trim() || '',
          pickupPoint: parts[4]?.trim() || '',
          password: parts[5]?.trim() || ''
        });
      }
    }

    if (importList.length === 0) {
      alert('No valid student rows found. Please check CSV format.');
      return;
    }

    try {
      const res = await authFetch(`${API_BASE}/admin/students/import-csv`, {
        method: 'POST',
        body: JSON.stringify({
          students: importList,
          defaultFeeAmount: parseFloat(defaultFeeAmount) || 800,
          feeDueDate: feeDueDate || new Date().toISOString().split('T')[0]
        })
      });
      const data = await res.json();
      if (res.ok) {
        fetchStudentList();
        fetchDashboardData();
        setIsCsvModalOpen(false);
        setCsvText('');
        let message = `Successfully imported ${data.count || 0} student(s)!`;
        if (data.errors && data.errors.length > 0) {
          message += `\n\n${data.errors.length} row(s) had errors and were skipped:\n` +
            data.errors.map(err => `• ${err.name || err.email || 'Row'}: ${err.error}`).join('\n');
        }
        alert(message);
      } else {
        alert(data.error || 'Import failed.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error during CSV import.');
    }
  };

  const handleVerifyQRPass = async (code = scannedPassCode) => {
    const codeToVerify = typeof code === 'string' ? code.trim() : '';
    if (!codeToVerify) return;
    try {
      const res = await authFetch(`${API_BASE}/admin/verify-scan`, {
        method: 'POST',
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
      const res = await authFetch(`${API_BASE}/admin/broadcast`, {
        method: 'POST',
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

  const handleMarkFeePaid = async (e) => {
    e.preventDefault();
    if (!feeModalStudent) return;
    setFeeSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE}/admin/fees/mark-paid`, {
        method: 'POST',
        body: JSON.stringify({
          studentId: feeModalStudent.user_id || feeModalStudent.id,
          amount: parseFloat(feeAmount) || 0,
          status: feeStatus,
          paymentMethod: feePaymentMethod,
          notes: feeNotes
        })
      });
      const data = await res.json();
      if (res.ok) {
        setFeeModalStudent(null);
        setFeeAmount('');
        setFeeNotes('');
        fetchStudentList();
        fetchDashboardData();
        alert(`Fee status updated to: ${data.status.toUpperCase()}`);
      } else {
        alert(data.error || 'Failed to update fee record');
      }
    } catch (err) {
      console.error(err);
      alert('Network error updating fee');
    } finally {
      setFeeSubmitting(false);
    }
  };

  // --- DRIVER ACTIONS ---
  const handleSaveDriver = async (e) => {
    e.preventDefault();
    const d = driverModal.data;
    try {
      let res;
      if (driverModal.mode === 'add') {
        res = await authFetch(`${API_BASE}/admin/drivers`, {
          method: 'POST',
          body: JSON.stringify({
            name: d.name,
            email: d.email,
            phone: d.phone,
            licenseNumber: d.licenseNumber,
            activeBusId: d.activeBusId ? parseInt(d.activeBusId) : null,
            initialPassword: d.initialPassword || 'Driver@123'
          })
        });
      } else {
        res = await authFetch(`${API_BASE}/admin/drivers/${d.user_id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: d.name,
            email: d.email,
            phone: d.phone,
            licenseNumber: d.licenseNumber,
            activeBusId: d.activeBusId ? parseInt(d.activeBusId) : null
          })
        });
      }
      const data = await res.json();
      if (res.ok) {
        setDriverModal({ isOpen: false, mode: 'add', data: { name: '', email: '', phone: '', licenseNumber: '', activeBusId: '', initialPassword: '' } });
        fetchDriverList();
        fetchDashboardData();
        alert(driverModal.mode === 'add' ? `Driver enrolled! Temporary Password: ${data.temporaryPassword || d.initialPassword}` : 'Driver updated successfully.');
      } else {
        alert(data.error || 'Failed to save driver');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteDriver = async (userId) => {
    if (!confirm('Are you sure you want to remove this driver?')) return;
    try {
      const res = await authFetch(`${API_BASE}/admin/drivers/${userId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchDriverList();
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- BUS ACTIONS ---
  const handleSaveBus = async (e) => {
    e.preventDefault();
    const b = busModal.data;
    try {
      let res;
      if (busModal.mode === 'add') {
        res = await authFetch(`${API_BASE}/admin/buses`, {
          method: 'POST',
          body: JSON.stringify({
            busNumber: b.busNumber,
            registrationNumber: b.registrationNumber,
            capacity: parseInt(b.capacity),
            totalMileage: parseFloat(b.totalMileage) || 0,
            insuranceExpiry: b.insuranceExpiry,
            status: b.status || 'active'
          })
        });
      } else {
        res = await authFetch(`${API_BASE}/admin/buses/${b.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            busNumber: b.busNumber,
            registrationNumber: b.registrationNumber,
            capacity: parseInt(b.capacity),
            totalMileage: parseFloat(b.totalMileage) || 0,
            insuranceExpiry: b.insuranceExpiry,
            status: b.status || 'active'
          })
        });
      }
      const data = await res.json();
      if (res.ok) {
        setBusModal({ isOpen: false, mode: 'add', data: { id: null, busNumber: '', registrationNumber: '', capacity: 45, totalMileage: 0, insuranceExpiry: '', status: 'active' } });
        fetchBusList();
        fetchDashboardData();
        alert(busModal.mode === 'add' ? 'Bus unit added to fleet!' : 'Bus details updated.');
      } else {
        alert(data.error || 'Failed to save bus');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBus = async (busId) => {
    if (!confirm('Are you sure you want to delete this bus unit?')) return;
    try {
      const res = await authFetch(`${API_BASE}/admin/buses/${busId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchBusList();
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- ROUTE ACTIONS ---
  const handleSaveRoute = async (e) => {
    e.preventDefault();
    const r = routeModal.data;
    try {
      let res;
      if (routeModal.mode === 'add') {
        res = await authFetch(`${API_BASE}/admin/routes`, {
          method: 'POST',
          body: JSON.stringify({
            name: r.name,
            startLocation: r.startLocation,
            endLocation: r.endLocation,
            distanceKm: parseFloat(r.distanceKm),
            estimatedDurationMins: parseInt(r.estimatedDurationMins)
          })
        });
      } else {
        res = await authFetch(`${API_BASE}/admin/routes/${r.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: r.name,
            startLocation: r.startLocation,
            endLocation: r.endLocation,
            distanceKm: parseFloat(r.distanceKm),
            estimatedDurationMins: parseInt(r.estimatedDurationMins)
          })
        });
      }
      const data = await res.json();
      if (res.ok) {
        setRouteModal({ isOpen: false, mode: 'add', data: { id: null, name: '', startLocation: '', endLocation: '', distanceKm: 15, estimatedDurationMins: 45 } });
        fetchRouteList();
        alert(routeModal.mode === 'add' ? 'Route created successfully!' : 'Route updated.');
      } else {
        alert(data.error || 'Failed to save route');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRoute = async (routeId) => {
    if (!confirm('Are you sure you want to delete this route and its stops?')) return;
    try {
      const res = await authFetch(`${API_BASE}/admin/routes/${routeId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchRouteList();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- STOP ACTIONS ---
  const handleOpenManageStops = (route) => {
    setStopsRoute(route);
    fetchStopsForRoute(route.id);
  };

  const handleSaveStop = async (e) => {
    e.preventDefault();
    const s = stopModal.data;
    try {
      let res;
      if (stopModal.mode === 'add') {
        res = await authFetch(`${API_BASE}/admin/stops`, {
          method: 'POST',
          body: JSON.stringify({
            routeId: stopsRoute.id,
            name: s.name,
            latitude: parseFloat(s.latitude) || 12.9716,
            longitude: parseFloat(s.longitude) || 77.5946,
            sequenceOrder: parseInt(s.sequenceOrder) || 1,
            scheduledTime: s.scheduledTime
          })
        });
      } else {
        res = await authFetch(`${API_BASE}/admin/stops/${s.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: s.name,
            latitude: parseFloat(s.latitude) || 12.9716,
            longitude: parseFloat(s.longitude) || 77.5946,
            sequenceOrder: parseInt(s.sequenceOrder) || 1,
            scheduledTime: s.scheduledTime
          })
        });
      }
      const data = await res.json();
      if (res.ok) {
        setStopModal({ isOpen: false, mode: 'add', data: { id: null, name: '', latitude: 12.9716, longitude: 77.5946, sequenceOrder: 1, scheduledTime: '07:30 AM' } });
        fetchStopsForRoute(stopsRoute.id);
        fetchRouteList();
      } else {
        alert(data.error || 'Failed to save stop');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteStop = async (stopId) => {
    if (!confirm('Are you sure you want to delete this stop?')) return;
    try {
      const res = await authFetch(`${API_BASE}/admin/stops/${stopId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchStopsForRoute(stopsRoute.id);
        fetchRouteList();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const triggerExport = async (format, reportType) => {
    try {
      const res = await authFetch(`${API_BASE}/admin/reports/export?format=${format}&reportType=${reportType}`);
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
            { id: 'tracking', label: 'Live Tracking Map', icon: <Navigation size={16} /> },
            { id: 'students', label: 'Students Console', icon: <Users size={16} /> },
            { id: 'drivers', label: 'Drivers Register', icon: <Users size={16} /> },
            { id: 'buses', label: 'Fleet Registry', icon: <Wrench size={16} /> },
            { id: 'routes', label: 'Route Planners & Stops', icon: <RouteIcon size={16} /> },
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
        
        {/* Active Emergency SOS Alerts Banner */}
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
            <div className="glass-card" style={{ height: '480px', padding: '12px' }}>
              <MapContainer 
                center={[12.9716, 77.5946]} 
                zoom={12} 
                scrollWheelZoom={false}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
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
            
            {/* Split layout: Form and Batch Utilities */}
            <div className="admin-grid">
              {/* Form creation */}
              <div className="glass-card" style={{ gridColumn: 'span 4' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Add Enrolled Student</h3>
                <form onSubmit={handleAddStudent} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <input type="text" className="input-field" placeholder="Full Name" value={studentForm.name} onChange={e => setStudentForm({...studentForm, name: e.target.value})} required />
                  <input type="email" className="input-field" placeholder="College Email (@college.edu)" value={studentForm.email} onChange={e => setStudentForm({...studentForm, email: e.target.value})} required />
                  <input type="text" className="input-field" placeholder="Roll Number (e.g. VESA-2024-ST99)" value={studentForm.rollNumber} onChange={e => setStudentForm({...studentForm, rollNumber: e.target.value})} required />
                  <input type="text" className="input-field" placeholder="Emergency Contact Phone" value={studentForm.emergencyContact} onChange={e => setStudentForm({...studentForm, emergencyContact: e.target.value})} required />
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Assigned Bus</label>
                      <select 
                        className="input-field"
                        value={studentForm.busId}
                        onChange={e => setStudentForm({...studentForm, busId: parseInt(e.target.value)})}
                        style={{ background: 'var(--bg-main)', marginTop: '4px' }}
                      >
                        {buses.map(b => (
                          <option key={b.id} value={b.id}>{b.bus_number}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Assigned Route</label>
                      <select 
                        className="input-field"
                        value={studentForm.routeId}
                        onChange={e => setStudentForm({...studentForm, routeId: parseInt(e.target.value)})}
                        style={{ background: 'var(--bg-main)', marginTop: '4px' }}
                      >
                        {routes.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>
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
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Batch import students list with auto-matching pickup stops.</span>
                  </div>
                  <button onClick={() => setIsCsvModalOpen(true)} className="btn-secondary" style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Upload size={14} /> Open CSV Importer
                  </button>
                </div>

                {/* QR Pass Verification Scanner */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>Student QR Pass Verification Terminal</h3>
                    <button 
                      onClick={() => setIsScanning(!isScanning)} 
                      className="btn-primary" 
                      style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Camera size={14} /> {isScanning ? 'Stop Camera' : 'Live Camera Scanner'}
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
                      placeholder="Input student pass code (e.g. QR_PASS_ST01)..." 
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700' }}>Student Database & Fee Approval Registry</h3>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Total Pending Fees: <b style={{ color: 'var(--accent-amber)' }}>₹{stats.pendingFees || 0}</b>
                </span>
              </div>
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
                      <th>Pending Due</th>
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
                            {s.fee_status?.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ fontWeight: '600', color: (s.pending_amount > 0 ? 'var(--accent-amber)' : 'var(--text-secondary)') }}>
                          ₹{s.pending_amount !== undefined ? s.pending_amount : (s.fee_status === 'paid' ? 0 : 800)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button 
                              onClick={() => {
                                setFeeModalStudent(s);
                                setFeeAmount(s.pending_amount ? String(s.pending_amount) : '800');
                                setFeeStatus('paid');
                              }} 
                              className="btn-primary" 
                              style={{ padding: '4px 10px', fontSize: '11px', width: 'auto' }}
                              title="Manual Admin Fee Approval"
                            >
                              Fee Approval
                            </button>
                            <button 
                              onClick={() => setStudentEditModal({ isOpen: true, data: { ...s } })} 
                              style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: '4px' }}
                              title="Edit Student Profile"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteStudent(s.user_id)} 
                              style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', padding: '4px' }}
                              title="Delete Student"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Student Edit Modal Overlay */}
            {studentEditModal.isOpen && studentEditModal.data && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
                <div className="glass-card" style={{ width: '500px', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Edit Student Details</h3>
                    <button onClick={() => setStudentEditModal({ isOpen: false, data: null })} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <X size={20} />
                    </button>
                  </div>

                  <form onSubmit={handleUpdateStudent} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Full Name</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        value={studentEditModal.data.name || ''} 
                        onChange={e => setStudentEditModal({ ...studentEditModal, data: { ...studentEditModal.data, name: e.target.value } })} 
                        required 
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>College Email</label>
                      <input 
                        type="email" 
                        className="input-field" 
                        value={studentEditModal.data.email || ''} 
                        onChange={e => setStudentEditModal({ ...studentEditModal, data: { ...studentEditModal.data, email: e.target.value } })} 
                        required 
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Roll Number</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          value={studentEditModal.data.roll_number || ''} 
                          onChange={e => setStudentEditModal({ ...studentEditModal, data: { ...studentEditModal.data, roll_number: e.target.value } })} 
                          required 
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Emergency Contact Phone</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          value={studentEditModal.data.emergency_contact || ''} 
                          onChange={e => setStudentEditModal({ ...studentEditModal, data: { ...studentEditModal.data, emergency_contact: e.target.value } })} 
                          required 
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Assigned Bus</label>
                        <select 
                          className="input-field"
                          value={studentEditModal.data.bus_id || ''}
                          onChange={e => setStudentEditModal({ ...studentEditModal, data: { ...studentEditModal.data, bus_id: e.target.value } })}
                          style={{ background: 'var(--bg-main)' }}
                        >
                          <option value="">Unassigned</option>
                          {buses.map(b => (
                            <option key={b.id} value={b.id}>{b.bus_number}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Assigned Route</label>
                        <select 
                          className="input-field"
                          value={studentEditModal.data.route_id || ''}
                          onChange={e => setStudentEditModal({ ...studentEditModal, data: { ...studentEditModal.data, route_id: e.target.value } })}
                          style={{ background: 'var(--bg-main)' }}
                        >
                          <option value="">Unassigned</option>
                          {routes.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
                      <button type="submit" className="btn-primary">Save Changes</button>
                      <button type="button" onClick={() => setStudentEditModal({ isOpen: false, data: null })} className="btn-secondary">Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Fee Approval Modal Overlay */}
            {feeModalStudent && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
                <div className="glass-card" style={{ width: '480px', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Admin Fee Payment Approval</h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Student: <b>{feeModalStudent.name}</b> ({feeModalStudent.roll_number})
                    </span>
                  </div>

                  <form onSubmit={handleMarkFeePaid} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Payment Status</label>
                      <select 
                        className="input-field"
                        value={feeStatus}
                        onChange={e => setFeeStatus(e.target.value)}
                        style={{ background: 'var(--bg-main)' }}
                      >
                        <option value="paid">Paid (Fully Cleared)</option>
                        <option value="partial">Partial Payment</option>
                        <option value="pending">Pending / Unpaid</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Amount to Credit (₹)</label>
                      <input 
                        type="number"
                        step="0.01"
                        className="input-field"
                        placeholder="e.g. 800"
                        value={feeAmount}
                        onChange={e => setFeeAmount(e.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Payment Method / Verification Source</label>
                      <select 
                        className="input-field"
                        value={feePaymentMethod}
                        onChange={e => setFeePaymentMethod(e.target.value)}
                        style={{ background: 'var(--bg-main)' }}
                      >
                        <option value="Campus Cashier Counter">Campus Cashier Counter</option>
                        <option value="UPI / QR Payment">UPI / QR Payment</option>
                        <option value="Bank Direct Deposit / NEFT">Bank Direct Deposit / NEFT</option>
                        <option value="Official College Cheque">Official College Cheque</option>
                        <option value="Admin Scholarship / Fee Waiver">Admin Scholarship / Fee Waiver</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Admin Audit Notes (Optional)</label>
                      <input 
                        type="text"
                        className="input-field"
                        placeholder="Receipt # / Approval reference"
                        value={feeNotes}
                        onChange={e => setFeeNotes(e.target.value)}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
                      <button type="submit" disabled={feeSubmitting} className="btn-primary">
                        {feeSubmitting ? 'Recording...' : 'Confirm & Approve Fee'}
                      </button>
                      <button type="button" onClick={() => setFeeModalStudent(null)} className="btn-secondary">Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* CSV Import Modal Overlay */}
            {isCsvModalOpen && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
                <div className="glass-card" style={{ width: '580px', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '90vh', overflowY: 'auto' }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '700' }}>CSV Database Importer</h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Input comma-separated values (One student per line):<br/>
                    <b>Format: Full Name, Email, Roll Number, Contact Number, Pickup Point, Password</b>
                  </span>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Default Fee Amount (₹)</label>
                      <input 
                        type="number" 
                        className="input-field" 
                        placeholder="800" 
                        value={defaultFeeAmount} 
                        onChange={e => setDefaultFeeAmount(e.target.value)} 
                        min="0"
                        required 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Fee Due Date</label>
                      <input 
                        type="date" 
                        className="input-field" 
                        value={feeDueDate} 
                        onChange={e => setFeeDueDate(e.target.value)} 
                        required 
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Student CSV Data</label>
                    <textarea 
                      className="input-field" 
                      rows="6"
                      value={csvText}
                      onChange={e => setCsvText(e.target.value)}
                      placeholder="Alex Mercer, alex@college.edu, VESA-2024-ST01, +91 9876543210, Malleswaram 8th Cross, Password123&#10;Sophia Sterling, sophia@college.edu, VESA-2024-ST02, +91 9876543211, Majestic Hub, SecurePass456"
                      style={{ resize: 'none', fontFamily: 'monospace', fontSize: '12px' }}
                    ></textarea>
                  </div>

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Driver Employment Register</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Manage transit drivers, credentials, phone lines, and bus assignments.</span>
              </div>
              <button 
                onClick={() => setDriverModal({
                  isOpen: true,
                  mode: 'add',
                  data: { name: '', email: '', phone: '', licenseNumber: '', activeBusId: '', initialPassword: '' }
                })}
                className="btn-primary" 
                style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Plus size={16} /> Add New Driver
              </button>
            </div>

            <div className="glass-card">
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
                      <th>Actions</th>
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
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button 
                              onClick={() => setDriverModal({
                                isOpen: true,
                                mode: 'edit',
                                data: { user_id: d.user_id, name: d.name, email: d.email, phone: d.phone, licenseNumber: d.license_number, activeBusId: d.active_bus_id || '' }
                              })}
                              style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: '4px' }}
                              title="Edit Driver"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteDriver(d.user_id)}
                              style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', padding: '4px' }}
                              title="Delete Driver"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Add / Edit Driver Modal */}
            {driverModal.isOpen && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
                <div className="glass-card" style={{ width: '480px', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
                      {driverModal.mode === 'add' ? 'Add New Transit Driver' : 'Edit Driver Details'}
                    </h3>
                    <button onClick={() => setDriverModal({ ...driverModal, isOpen: false })} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <X size={20} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveDriver} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Driver Full Name</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="e.g. Ramesh Kumar"
                        value={driverModal.data.name} 
                        onChange={e => setDriverModal({ ...driverModal, data: { ...driverModal.data, name: e.target.value } })} 
                        required 
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Email Address</label>
                      <input 
                        type="email" 
                        className="input-field" 
                        placeholder="driver@college.edu"
                        value={driverModal.data.email} 
                        onChange={e => setDriverModal({ ...driverModal, data: { ...driverModal.data, email: e.target.value } })} 
                        required 
                      />
                    </div>

                    {driverModal.mode === 'add' && (
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Initial Login Password</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          placeholder="Leave blank to auto-generate or set password"
                          value={driverModal.data.initialPassword || ''} 
                          onChange={e => setDriverModal({ ...driverModal, data: { ...driverModal.data, initialPassword: e.target.value } })} 
                        />
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Phone Number</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          placeholder="+91 9876543210"
                          value={driverModal.data.phone} 
                          onChange={e => setDriverModal({ ...driverModal, data: { ...driverModal.data, phone: e.target.value } })} 
                          required 
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Commercial License Number</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          placeholder="KA-DL-2022-9901"
                          value={driverModal.data.licenseNumber} 
                          onChange={e => setDriverModal({ ...driverModal, data: { ...driverModal.data, licenseNumber: e.target.value } })} 
                          required 
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Assign Active Bus</label>
                      <select 
                        className="input-field"
                        value={driverModal.data.activeBusId || ''}
                        onChange={e => setDriverModal({ ...driverModal, data: { ...driverModal.data, activeBusId: e.target.value } })}
                        style={{ background: 'var(--bg-main)' }}
                      >
                        <option value="">None / Floating Driver</option>
                        {buses.map(b => (
                          <option key={b.id} value={b.id}>{b.bus_number} ({b.registration_number})</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
                      <button type="submit" className="btn-primary">
                        {driverModal.mode === 'add' ? 'Create Driver Account' : 'Save Changes'}
                      </button>
                      <button type="button" onClick={() => setDriverModal({ ...driverModal, isOpen: false })} className="btn-secondary">Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MENU 5: FLEET REGISTER */}
        {activeMenu === 'buses' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Active Transit Fleet Registry</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Manage bus units, seating capacities, vehicle insurance, and print QR stickers.</span>
              </div>
              <button 
                onClick={() => setBusModal({
                  isOpen: true,
                  mode: 'add',
                  data: { id: null, busNumber: '', registrationNumber: '', capacity: 45, totalMileage: 0, insuranceExpiry: new Date().toISOString().split('T')[0], status: 'active' }
                })}
                className="btn-primary" 
                style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Plus size={16} /> Add New Bus
              </button>
            </div>

            <div className="glass-card">
              <div className="table-responsive">
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>Bus Unit</th>
                      <th>Registration Plate</th>
                      <th>Capacity</th>
                      <th>Mileage (Odometer)</th>
                      <th>Insurance Renewal</th>
                      <th>Status</th>
                      <th>Bus Attendance QR</th>
                      <th>Actions</th>
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
                            style={{ padding: '4px 10px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <QrCode size={14} /> View QR Sticker
                          </button>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button 
                              onClick={() => setBusModal({
                                isOpen: true,
                                mode: 'edit',
                                data: {
                                  id: b.id,
                                  busNumber: b.bus_number,
                                  registrationNumber: b.registration_number,
                                  capacity: b.capacity,
                                  totalMileage: b.total_mileage,
                                  insuranceExpiry: b.insurance_expiry,
                                  status: b.status
                                }
                              })}
                              style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: '4px' }}
                              title="Edit Bus"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteBus(b.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', padding: '4px' }}
                              title="Delete Bus"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Add / Edit Bus Modal */}
            {busModal.isOpen && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
                <div className="glass-card" style={{ width: '480px', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
                      {busModal.mode === 'add' ? 'Register New Bus Unit' : 'Edit Bus Details'}
                    </h3>
                    <button onClick={() => setBusModal({ ...busModal, isOpen: false })} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <X size={20} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveBus} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Bus Unit / Identifier</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          placeholder="e.g. BUS-105"
                          value={busModal.data.busNumber} 
                          onChange={e => setBusModal({ ...busModal, data: { ...busModal.data, busNumber: e.target.value } })} 
                          required 
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Registration Plate</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          placeholder="e.g. KA-01-EQ-9921"
                          value={busModal.data.registrationNumber} 
                          onChange={e => setBusModal({ ...busModal, data: { ...busModal.data, registrationNumber: e.target.value } })} 
                          required 
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Seating Capacity</label>
                        <input 
                          type="number" 
                          className="input-field" 
                          placeholder="45"
                          value={busModal.data.capacity} 
                          onChange={e => setBusModal({ ...busModal, data: { ...busModal.data, capacity: e.target.value } })} 
                          required 
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Total Mileage (km)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          className="input-field" 
                          placeholder="0"
                          value={busModal.data.totalMileage} 
                          onChange={e => setBusModal({ ...busModal, data: { ...busModal.data, totalMileage: e.target.value } })} 
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Insurance Expiry Date</label>
                        <input 
                          type="date" 
                          className="input-field" 
                          value={busModal.data.insuranceExpiry} 
                          onChange={e => setBusModal({ ...busModal, data: { ...busModal.data, insuranceExpiry: e.target.value } })} 
                          required 
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Operational Status</label>
                        <select 
                          className="input-field"
                          value={busModal.data.status}
                          onChange={e => setBusModal({ ...busModal, data: { ...busModal.data, status: e.target.value } })}
                          style={{ background: 'var(--bg-main)' }}
                        >
                          <option value="active">Active / Operational</option>
                          <option value="maintenance">Under Maintenance</option>
                          <option value="inactive">Inactive / Reserve</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
                      <button type="submit" className="btn-primary">
                        {busModal.mode === 'add' ? 'Register Bus' : 'Save Changes'}
                      </button>
                      <button type="button" onClick={() => setBusModal({ ...busModal, isOpen: false })} className="btn-secondary">Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Bus QR Attendance Sticker Modal */}
            {selectedBusForSticker && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
                <div className="glass-card" style={{ width: '400px', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center', padding: '28px', border: '2px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)' }}>
                    <Truck size={20} />
                    <span style={{ fontSize: '13px', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase' }}>
                      VESA Transit Bus Scanner Sticker
                    </span>
                  </div>
                  
                  <div style={{ background: '#fff', padding: '16px', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=VESA_BUS_${selectedBusForSticker.bus_number}`} 
                      alt={`Bus ${selectedBusForSticker.bus_number} QR Code`} 
                      style={{ width: '220px', height: '220px', display: 'block' }}
                    />
                  </div>

                  <div>
                    <h2 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 4px 0', color: '#fff' }}>Bus {selectedBusForSticker.bus_number}</h2>
                    <span style={{ fontSize: '13px', color: 'var(--accent-amber)', fontWeight: '700' }}>QR Code: VESA_BUS_{selectedBusForSticker.bus_number}</span>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Reg: {selectedBusForSticker.registration_number}</div>
                  </div>

                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                    Stick this physical QR code badge at the bus entrance door. Students scan this with their live camera on boarding to mark instant digital attendance.
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', width: '100%', marginTop: '8px' }}>
                    <button onClick={() => window.print()} className="btn-secondary" style={{ padding: '10px', fontSize: '13px', fontWeight: '600' }}>
                      Print Sticker
                    </button>
                    <button onClick={() => setSelectedBusForSticker(null)} className="btn-primary" style={{ padding: '10px', fontSize: '13px', fontWeight: '600' }}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MENU 6: ROUTES & STOPS */}
        {activeMenu === 'routes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Active Transit Route Planners & Stops</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Create and edit transit routes, configure pickup stops, coordinates, and schedules.</span>
              </div>
              <button 
                onClick={() => setRouteModal({
                  isOpen: true,
                  mode: 'add',
                  data: { id: null, name: '', startLocation: '', endLocation: '', distanceKm: 15, estimatedDurationMins: 45 }
                })}
                className="btn-primary" 
                style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <Plus size={16} /> Add New Route
              </button>
            </div>

            <div className="glass-card">
              <div className="table-responsive">
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>Route Title</th>
                      <th>Hub Departure</th>
                      <th>Campus Arrival</th>
                      <th>Distance (km)</th>
                      <th>Est Duration</th>
                      <th>Pickups Stops</th>
                      <th>Actions</th>
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
                        <td>
                          <button 
                            onClick={() => handleOpenManageStops(r)}
                            className="btn-secondary"
                            style={{ padding: '3px 8px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <MapPin size={12} color="var(--accent-cyan)" /> {r.stops_count || 0} Stops (Manage)
                          </button>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button 
                              onClick={() => setRouteModal({
                                isOpen: true,
                                mode: 'edit',
                                data: {
                                  id: r.id,
                                  name: r.name,
                                  startLocation: r.start_location,
                                  endLocation: r.end_location,
                                  distanceKm: r.distance_km,
                                  estimatedDurationMins: r.estimated_duration_mins
                                }
                              })}
                              style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: '4px' }}
                              title="Edit Route"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => handleDeleteRoute(r.id)}
                              style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', padding: '4px' }}
                              title="Delete Route"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Add / Edit Route Modal */}
            {routeModal.isOpen && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
                <div className="glass-card" style={{ width: '480px', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
                      {routeModal.mode === 'add' ? 'Create Transit Route' : 'Edit Route Details'}
                    </h3>
                    <button onClick={() => setRouteModal({ ...routeModal, isOpen: false })} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <X size={20} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveRoute} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Route Name / Title</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="e.g. North Hub - Campus Express"
                        value={routeModal.data.name} 
                        onChange={e => setRouteModal({ ...routeModal, data: { ...routeModal.data, name: e.target.value } })} 
                        required 
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Hub Departure (Start)</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          placeholder="e.g. North Terminal"
                          value={routeModal.data.startLocation} 
                          onChange={e => setRouteModal({ ...routeModal, data: { ...routeModal.data, startLocation: e.target.value } })} 
                          required 
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Campus Arrival (End)</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          placeholder="e.g. Main Engineering Campus"
                          value={routeModal.data.endLocation} 
                          onChange={e => setRouteModal({ ...routeModal, data: { ...routeModal.data, endLocation: e.target.value } })} 
                          required 
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Total Distance (km)</label>
                        <input 
                          type="number" 
                          step="0.1"
                          className="input-field" 
                          placeholder="15.5"
                          value={routeModal.data.distanceKm} 
                          onChange={e => setRouteModal({ ...routeModal, data: { ...routeModal.data, distanceKm: e.target.value } })} 
                          required 
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Estimated Duration (mins)</label>
                        <input 
                          type="number" 
                          className="input-field" 
                          placeholder="45"
                          value={routeModal.data.estimatedDurationMins} 
                          onChange={e => setRouteModal({ ...routeModal, data: { ...routeModal.data, estimatedDurationMins: e.target.value } })} 
                          required 
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
                      <button type="submit" className="btn-primary">
                        {routeModal.mode === 'add' ? 'Create Route' : 'Save Changes'}
                      </button>
                      <button type="button" onClick={() => setRouteModal({ ...routeModal, isOpen: false })} className="btn-secondary">Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Manage Stops Drawer / Modal */}
            {stopsRoute && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 10000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
                <div className="glass-card" style={{ width: '640px', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '85vh', overflowY: 'auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Manage Stops: {stopsRoute.name}</h3>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Configure pickup stop sequence, scheduled times, and GPS coordinates.</span>
                    </div>
                    <button onClick={() => setStopsRoute(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <X size={20} />
                    </button>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => setStopModal({
                        isOpen: true,
                        mode: 'add',
                        data: { id: null, name: '', latitude: 12.9716, longitude: 77.5946, sequenceOrder: stopsList.length + 1, scheduledTime: '07:30 AM' }
                      })}
                      className="btn-primary"
                      style={{ width: 'auto', padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Plus size={14} /> Add Pickup Stop
                    </button>
                  </div>

                  <div className="table-responsive">
                    <table className="premium-table">
                      <thead>
                        <tr>
                          <th>Seq #</th>
                          <th>Stop Name</th>
                          <th>Scheduled Pickup</th>
                          <th>Coordinates (Lat, Lng)</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stopsList.length === 0 ? (
                          <tr>
                            <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No pickup stops created yet.</td>
                          </tr>
                        ) : (
                          stopsList.map(stop => (
                            <tr key={stop.id}>
                              <td style={{ fontWeight: '700', color: 'var(--accent-cyan)' }}>#{stop.sequence_order}</td>
                              <td style={{ fontWeight: '600' }}>{stop.name}</td>
                              <td>{stop.scheduled_time}</td>
                              <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{stop.latitude}, {stop.longitude}</td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <button 
                                    onClick={() => setStopModal({
                                      isOpen: true,
                                      mode: 'edit',
                                      data: {
                                        id: stop.id,
                                        name: stop.name,
                                        latitude: stop.latitude,
                                        longitude: stop.longitude,
                                        sequenceOrder: stop.sequence_order,
                                        scheduledTime: stop.scheduled_time
                                      }
                                    })}
                                    style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', cursor: 'pointer', padding: '4px' }}
                                    title="Edit Stop"
                                  >
                                    <Edit size={14} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteStop(stop.id)}
                                    style={{ background: 'none', border: 'none', color: 'var(--accent-rose)', cursor: 'pointer', padding: '4px' }}
                                    title="Delete Stop"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button onClick={() => setStopsRoute(null)} className="btn-secondary" style={{ width: 'auto' }}>Close</button>
                  </div>
                </div>
              </div>
            )}

            {/* Add / Edit Stop Modal */}
            {stopModal.isOpen && (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 10001, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
                <div className="glass-card" style={{ width: '420px', background: 'var(--bg-surface-solid)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>
                      {stopModal.mode === 'add' ? 'Add Pickup Stop' : 'Edit Pickup Stop'}
                    </h3>
                    <button onClick={() => setStopModal({ ...stopModal, isOpen: false })} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                      <X size={18} />
                    </button>
                  </div>

                  <form onSubmit={handleSaveStop} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Stop Name</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="e.g. Navale Bridge / Malleswaram"
                        value={stopModal.data.name} 
                        onChange={e => setStopModal({ ...stopModal, data: { ...stopModal.data, name: e.target.value } })} 
                        required 
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Sequence Order</label>
                        <input 
                          type="number" 
                          className="input-field" 
                          placeholder="1"
                          value={stopModal.data.sequenceOrder} 
                          onChange={e => setStopModal({ ...stopModal, data: { ...stopModal.data, sequenceOrder: e.target.value } })} 
                          required 
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Scheduled Pickup Time</label>
                        <input 
                          type="text" 
                          className="input-field" 
                          placeholder="07:30 AM"
                          value={stopModal.data.scheduledTime} 
                          onChange={e => setStopModal({ ...stopModal, data: { ...stopModal.data, scheduledTime: e.target.value } })} 
                          required 
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Latitude</label>
                        <input 
                          type="number" 
                          step="0.0001"
                          className="input-field" 
                          value={stopModal.data.latitude} 
                          onChange={e => setStopModal({ ...stopModal, data: { ...stopModal.data, latitude: e.target.value } })} 
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Longitude</label>
                        <input 
                          type="number" 
                          step="0.0001"
                          className="input-field" 
                          value={stopModal.data.longitude} 
                          onChange={e => setStopModal({ ...stopModal, data: { ...stopModal.data, longitude: e.target.value } })} 
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                      <button type="submit" className="btn-primary">Save Stop</button>
                      <button type="button" onClick={() => setStopModal({ ...stopModal, isOpen: false })} className="btn-secondary">Cancel</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
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
