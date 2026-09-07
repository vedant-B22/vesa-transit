import React, { useState, useEffect, useRef } from 'react';
import { ShieldAlert } from 'lucide-react';
import AdminSidebar from './admin/AdminSidebar';
import DashboardOverview from './admin/DashboardOverview';
import LiveTrackingMap from './admin/LiveTrackingMap';
import AttendanceManagement from './admin/AttendanceManagement';
import StudentManagement from './admin/StudentManagement';
import DriverManagement from './admin/DriverManagement';
import FleetManagement from './admin/FleetManagement';
import RouteManagement from './admin/RouteManagement';
import BroadcastAlerts from './admin/BroadcastAlerts';
import FeeApprovalModal from './admin/FeeApprovalModal';
import CsvImportModal from './admin/CsvImportModal';
import BulkStopsModal from './admin/BulkStopsModal';
import BusScannerModal from './admin/BusScannerModal';

export default function AdminDashboard({ token, onLogout, theme, toggleTheme }) {
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
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
  const [defaultFeeAmount, setDefaultFeeAmount] = useState('5000');
  const [feeDueDate, setFeeDueDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split('T')[0];
  });

  // Bulk Stops Import State
  const [isBulkStopsModalOpen, setIsBulkStopsModalOpen] = useState(false);
  const [bulkStopsRouteId, setBulkStopsRouteId] = useState('');
  const [bulkStopsCsvText, setBulkStopsCsvText] = useState('');
  const [bulkStopsLoading, setBulkStopsLoading] = useState(false);

  // Attendance Scanning Window Override State
  const [attendanceWindowMode, setAttendanceWindowMode] = useState('auto');
  const [attendanceWindowStatus, setAttendanceWindowStatus] = useState(null);
  const [attendanceWindowSaving, setAttendanceWindowSaving] = useState(false);

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

  // Attendance Management State
  const [attendanceList, setAttendanceList] = useState([]);
  const [attendanceFilterDate, setAttendanceFilterDate] = useState('');
  const [attendanceFilterRoute, setAttendanceFilterRoute] = useState('');
  const [attendanceFilterBus, setAttendanceFilterBus] = useState('');
  const [attendanceFilterStatus, setAttendanceFilterStatus] = useState('');
  const [attendanceLoading, setAttendanceLoading] = useState(false);

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
    fetchAttendanceWindowSetting();
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

  const fetchAttendanceList = async () => {
    try {
      setAttendanceLoading(true);
      const params = new URLSearchParams();
      if (attendanceFilterDate) params.append('date', attendanceFilterDate);
      if (attendanceFilterRoute) params.append('routeId', attendanceFilterRoute);
      if (attendanceFilterBus) params.append('busId', attendanceFilterBus);
      if (attendanceFilterStatus) params.append('status', attendanceFilterStatus);

      const res = await authFetch(`${API_BASE}/admin/attendance?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setAttendanceList(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Error fetching attendance list:', e);
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    if (activeMenu === 'attendance') {
      fetchAttendanceList();
      fetchAttendanceWindowSetting();
    }
  }, [activeMenu, attendanceFilterDate, attendanceFilterRoute, attendanceFilterBus, attendanceFilterStatus]);

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
          defaultFeeAmount: parseFloat(defaultFeeAmount) || 5000,
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

  const handleBulkImportStops = async (e) => {
    e?.preventDefault();
    if (!bulkStopsRouteId) {
      alert('Please select a target route for the stops.');
      return;
    }
    if (!bulkStopsCsvText.trim()) {
      alert('Please enter CSV data for stops.');
      return;
    }
    try {
      setBulkStopsLoading(true);
      const res = await authFetch(`${API_BASE}/admin/stops/bulk-import`, {
        method: 'POST',
        body: JSON.stringify({
          routeId: bulkStopsRouteId,
          csvText: bulkStopsCsvText
        })
      });
      const data = await res.json();
      if (res.ok) {
        setIsBulkStopsModalOpen(false);
        setBulkStopsCsvText('');
        fetchRouteList();
        if (stopsRoute && String(stopsRoute.id) === String(bulkStopsRouteId)) {
          fetchStopsForRoute(stopsRoute.id);
        }
        let msg = `Successfully imported ${data.count || 0} stop(s) for ${data.route?.name || 'the route'}!`;
        if (data.errors && data.errors.length > 0) {
          msg += `\n\n${data.errors.length} row(s) had errors and were skipped:\n` +
            data.errors.map(err => `• Row ${err.row}: ${err.error}`).join('\n');
        }
        alert(msg);
      } else {
        alert(data.error || 'Failed to import stops.');
      }
    } catch (err) {
      console.error('Error bulk importing stops:', err);
      alert('Network error during bulk stops import.');
    } finally {
      setBulkStopsLoading(false);
    }
  };

  const fetchAttendanceWindowSetting = async () => {
    try {
      const res = await authFetch(`${API_BASE}/admin/settings/attendance-window`);
      const data = await res.json();
      if (res.ok) {
        setAttendanceWindowMode(data.mode || 'auto');
        setAttendanceWindowStatus(data);
      }
    } catch (e) {
      console.error('Error fetching attendance window setting:', e);
    }
  };

  const updateAttendanceWindowSetting = async (newMode) => {
    try {
      setAttendanceWindowSaving(true);
      const res = await authFetch(`${API_BASE}/admin/settings/attendance-window`, {
        method: 'POST',
        body: JSON.stringify({ mode: newMode })
      });
      const data = await res.json();
      if (res.ok) {
        setAttendanceWindowMode(data.mode);
        setAttendanceWindowStatus(data);
      } else {
        alert(data.error || 'Failed to update attendance window mode');
      }
    } catch (e) {
      console.error('Error updating attendance window setting:', e);
      alert('Network error while updating attendance window setting');
    } finally {
      setAttendanceWindowSaving(false);
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
      <AdminSidebar
        activeMenu={activeMenu}
        setActiveMenu={setActiveMenu}
        onLogout={onLogout}
        theme={theme}
        toggleTheme={toggleTheme}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
      />

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
          <DashboardOverview
            stats={stats}
            analytics={analytics}
            maintenanceRecs={maintenanceRecs}
            triggerExport={triggerExport}
          />
        )}

        {/* MENU 2: LIVE TRACKING */}
        {activeMenu === 'tracking' && (
          <LiveTrackingMap
            liveTrips={liveTrips}
          />
        )}

        {/* MENU: STUDENT ATTENDANCE */}
        {activeMenu === 'attendance' && (
          <AttendanceManagement
            attendanceList={attendanceList}
            attendanceLoading={attendanceLoading}
            fetchAttendanceList={fetchAttendanceList}
            routes={routes}
            buses={buses}
            attendanceFilterDate={attendanceFilterDate}
            setAttendanceFilterDate={setAttendanceFilterDate}
            attendanceFilterRoute={attendanceFilterRoute}
            setAttendanceFilterRoute={setAttendanceFilterRoute}
            attendanceFilterBus={attendanceFilterBus}
            setAttendanceFilterBus={setAttendanceFilterBus}
            attendanceFilterStatus={attendanceFilterStatus}
            setAttendanceFilterStatus={setAttendanceFilterStatus}
            attendanceWindowStatus={attendanceWindowStatus}
            attendanceWindowMode={attendanceWindowMode}
            attendanceWindowSaving={attendanceWindowSaving}
            updateAttendanceWindowSetting={updateAttendanceWindowSetting}
          />
        )}

        {/* MENU 3: STUDENTS MANAGEMENT */}
        {activeMenu === 'students' && (
          <StudentManagement
            students={students}
            buses={buses}
            routes={routes}
            studentForm={studentForm}
            setStudentForm={setStudentForm}
            handleAddStudent={handleAddStudent}
            setIsCsvModalOpen={setIsCsvModalOpen}
            isScanning={isScanning}
            setIsScanning={setIsScanning}
            scannedPassCode={scannedPassCode}
            setScannedPassCode={setScannedPassCode}
            handleVerifyQRPass={handleVerifyQRPass}
            scanResult={scanResult}
            stats={stats}
            setFeeModalStudent={setFeeModalStudent}
            setFeeAmount={setFeeAmount}
            setFeeStatus={setFeeStatus}
            studentEditModal={studentEditModal}
            setStudentEditModal={setStudentEditModal}
            handleUpdateStudent={handleUpdateStudent}
            handleDeleteStudent={handleDeleteStudent}
          />
        )}

        {/* MENU 4: DRIVERS REGISTER */}
        {activeMenu === 'drivers' && (
          <DriverManagement
            drivers={drivers}
            buses={buses}
            driverModal={driverModal}
            setDriverModal={setDriverModal}
            handleSaveDriver={handleSaveDriver}
            handleDeleteDriver={handleDeleteDriver}
          />
        )}

        {/* MENU 5: FLEET REGISTER */}
        {activeMenu === 'buses' && (
          <FleetManagement
            buses={buses}
            busModal={busModal}
            setBusModal={setBusModal}
            handleSaveBus={handleSaveBus}
            handleDeleteBus={handleDeleteBus}
            setSelectedBusForSticker={setSelectedBusForSticker}
          />
        )}

        {/* MENU 6: ROUTES & STOPS */}
        {activeMenu === 'routes' && (
          <RouteManagement
            routes={routes}
            routeModal={routeModal}
            setRouteModal={setRouteModal}
            handleSaveRoute={handleSaveRoute}
            handleDeleteRoute={handleDeleteRoute}
            stopsRoute={stopsRoute}
            setStopsRoute={setStopsRoute}
            stopsList={stopsList}
            stopModal={stopModal}
            setStopModal={setStopModal}
            handleSaveStop={handleSaveStop}
            handleDeleteStop={handleDeleteStop}
            handleOpenManageStops={handleOpenManageStops}
            setIsBulkStopsModalOpen={setIsBulkStopsModalOpen}
            setBulkStopsRouteId={setBulkStopsRouteId}
          />
        )}

        {/* MENU 7: ALERTS AND BROADCASTS */}
        {activeMenu === 'broadcast' && (
          <BroadcastAlerts
            broadcastType={broadcastType}
            setBroadcastType={setBroadcastType}
            broadcastTargetId={broadcastTargetId}
            setBroadcastTargetId={setBroadcastTargetId}
            broadcastTitle={broadcastTitle}
            setBroadcastTitle={setBroadcastTitle}
            broadcastMsg={broadcastMsg}
            setBroadcastMsg={setBroadcastMsg}
            handleSendBroadcast={handleSendBroadcast}
            complaints={complaints}
          />
        )}

        {/* Modals */}
        <FeeApprovalModal
          feeModalStudent={feeModalStudent}
          setFeeModalStudent={setFeeModalStudent}
          feeStatus={feeStatus}
          setFeeStatus={setFeeStatus}
          feeAmount={feeAmount}
          setFeeAmount={setFeeAmount}
          feePaymentMethod={feePaymentMethod}
          setFeePaymentMethod={setFeePaymentMethod}
          feeNotes={feeNotes}
          setFeeNotes={setFeeNotes}
          feeSubmitting={feeSubmitting}
          handleMarkFeePaid={handleMarkFeePaid}
        />

        <CsvImportModal
          isCsvModalOpen={isCsvModalOpen}
          setIsCsvModalOpen={setIsCsvModalOpen}
          defaultFeeAmount={defaultFeeAmount}
          setDefaultFeeAmount={setDefaultFeeAmount}
          feeDueDate={feeDueDate}
          setFeeDueDate={setFeeDueDate}
          csvText={csvText}
          setCsvText={setCsvText}
          handleImportCSV={handleImportCSV}
        />

        <BulkStopsModal
          isBulkStopsModalOpen={isBulkStopsModalOpen}
          setIsBulkStopsModalOpen={setIsBulkStopsModalOpen}
          bulkStopsRouteId={bulkStopsRouteId}
          setBulkStopsRouteId={setBulkStopsRouteId}
          routes={routes}
          bulkStopsCsvText={bulkStopsCsvText}
          setBulkStopsCsvText={setBulkStopsCsvText}
          bulkStopsLoading={bulkStopsLoading}
          handleBulkImportStops={handleBulkImportStops}
        />

        <BusScannerModal
          selectedBusForSticker={selectedBusForSticker}
          setSelectedBusForSticker={setSelectedBusForSticker}
        />

      </div>
    </div>
  );
}
