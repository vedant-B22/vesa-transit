import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

import * as db from './database.js';
import * as ai from './aiEngine.js';
import { signToken, verifyToken, authenticateToken, requireRole, verifyResourceOwnership } from './middleware/auth.js';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const port = process.env.PORT || 5001;

// 1. Helmet Security Headers (allow Leaflet map tiles and inline SVGs)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

// 2. CORS allowlist configuration
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5001',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5001'
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);

app.use(express.json({ limit: '5mb' }));

// 3. Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts from this IP, please try again after 15 minutes.' }
});

const alertLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests submitted. Please try again later.' }
});

// Initialize Database on server start
db.initDatabase();

// Keep track of connected authenticated WebSocket clients: ws -> { role, userId, routeId, busId }
const clients = new Map();

// Input sanitization helper
function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// Request validation helpers
function validateRequired(obj, fields) {
  for (const field of fields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      return `Missing required parameter: ${field}`;
    }
  }
  return null;
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// -------------------------------------------------------------
// PUBLIC HEALTH CHECK & AUTHENTICATION
// -------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({ status: 'OK', time: new Date() });
});

// Authentication: Login
app.post('/api/auth/login', authLimiter, async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await db.get('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = signToken({
      userId: user.id,
      role: user.role,
      email: user.email
    });

    let roleData = {};
    if (user.role === 'student') {
      roleData = await db.get(
        `SELECT s.*, r.name as route_name, b.bus_number, st.name as stop_name
         FROM students s
         LEFT JOIN routes r ON s.route_id = r.id
         LEFT JOIN buses b ON s.bus_id = b.id
         LEFT JOIN stops st ON s.pickup_stop_id = st.id
         WHERE s.user_id = $1`,
        [user.id]
      );
    } else if (user.role === 'driver') {
      roleData = await db.get('SELECT * FROM drivers WHERE user_id = $1', [user.id]);
    } else if (user.role === 'admin') {
      roleData = await db.get('SELECT * FROM admins WHERE user_id = $1', [user.id]);
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      token,
      profile: roleData
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// STUDENT ROUTES (Requires Student role & resource ownership)
// -------------------------------------------------------------

// Student Profile
app.get('/api/student/profile/:id', authenticateToken, requireRole('student', 'admin'), verifyResourceOwnership('student'), async (req, res, next) => {
  try {
    const student = await db.get(
      `SELECT s.*, u.email, r.name as route_name, r.start_location, r.end_location, b.bus_number, st.name as stop_name,
              d.name as driver_name, d.phone as driver_phone
       FROM students s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN routes r ON s.route_id = r.id
       LEFT JOIN buses b ON s.bus_id = b.id
       LEFT JOIN stops st ON s.pickup_stop_id = st.id
       LEFT JOIN drivers d ON b.id = d.active_bus_id
       WHERE s.user_id = $1`,
      [req.params.id]
    );
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) {
    next(err);
  }
});

// Student Fees (View fee status and payment history)
app.get('/api/student/fees/:id', authenticateToken, requireRole('student', 'admin'), verifyResourceOwnership('student'), async (req, res, next) => {
  try {
    const fee = await db.get('SELECT * FROM fees WHERE student_id = $1', [req.params.id]);
    if (!fee) return res.status(404).json({ error: 'No fee record found' });
    const payments = await db.query('SELECT * FROM payments WHERE fee_id = $1 ORDER BY created_at DESC', [fee.id]);
    res.json({ fee, payments });
  } catch (err) {
    next(err);
  }
});

// Student Not Coming Today Toggle
app.post('/api/student/not-coming', authenticateToken, requireRole('student', 'admin'), verifyResourceOwnership('student'), async (req, res, next) => {
  const { studentId, date, isComing } = req.body;
  if (!studentId) return res.status(400).json({ error: 'studentId is required' });

  try {
    const today = date || new Date().toISOString().split('T')[0];
    const student = await db.get(
      `SELECT s.*, st.name as stop_name 
       FROM students s 
       LEFT JOIN stops st ON s.pickup_stop_id = st.id 
       WHERE s.user_id = $1`,
      [studentId]
    );

    if (!isComing) {
      const existing = await db.get('SELECT id FROM not_coming WHERE student_id = $1 AND date = $2', [studentId, today]);
      if (!existing) {
        await db.run('INSERT INTO not_coming (student_id, date) VALUES ($1, $2)', [studentId, today]);
      }
      await db.run(
        `UPDATE attendance SET status = 'not_coming' 
         WHERE student_id = $1 AND trip_id IN (SELECT id FROM trips WHERE status IN ('active', 'started', 'en_route'))`,
        [studentId]
      );
    } else {
      await db.run('DELETE FROM not_coming WHERE student_id = $1 AND date = $2', [studentId, today]);
      await db.run(
        `UPDATE attendance SET status = 'absent' 
         WHERE student_id = $1 AND trip_id IN (SELECT id FROM trips WHERE status IN ('active', 'started', 'en_route'))`,
        [studentId]
      );
    }

    let optimizedRouteData = null;
    if (student && student.route_id) {
      const activeTrip = await db.get(
        'SELECT id FROM trips WHERE route_id = $1 AND status IN (\'active\', \'started\', \'en_route\')',
        [student.route_id]
      );
      if (activeTrip) {
        optimizedRouteData = await ai.optimizeRoute(activeTrip.id);
        broadcast({
          type: 'route_optimization',
          tripId: activeTrip.id,
          routeId: student.route_id,
          optimizedRouteData
        });
      }
    }

    broadcast({
      type: 'attendance_change',
      studentId,
      studentName: student?.name || `Student #${studentId}`,
      stopName: student?.stop_name || 'Pickup Stop',
      date: today,
      isComing,
      status: isComing ? 'absent' : 'not_coming'
    });

    broadcast({
      type: 'student_absence_alert',
      studentId,
      studentName: student?.name || `Student #${studentId}`,
      stopName: student?.stop_name || 'Pickup Stop',
      isComing,
      message: isComing 
        ? `${student?.name || 'Student'} cancelled absence and is COMING today (Stop: ${student?.stop_name || 'Assigned Stop'}).`
        : `Student ${student?.name || 'Passenger'} marked NOT COMING today (Stop: ${student?.stop_name || 'Assigned Stop'}).`
    });

    res.json({ success: true, isComing, optimizedRouteData });
  } catch (err) {
    next(err);
  }
});

// Student Wait Request
app.post('/api/student/wait-request', authenticateToken, requireRole('student', 'admin'), verifyResourceOwnership('student'), async (req, res, next) => {
  const { studentId, stopId, tripId } = req.body;
  const validationErr = validateRequired(req.body, ['studentId', 'stopId', 'tripId']);
  if (validationErr) return res.status(400).json({ error: validationErr });

  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Limit to 2 requests per student per day
    const requestCount = await db.get(
      `SELECT COUNT(*) as count FROM wait_requests 
       WHERE student_id = $1 AND DATE(timestamp) = DATE($2)`,
      [studentId, today]
    );

    if (parseInt(requestCount?.count || '0', 10) >= 2) {
      return res.status(400).json({ error: 'You have reached your daily limit of 2 wait requests.' });
    }

    const trip = await db.get('SELECT * FROM trips WHERE id = $1', [tripId]);
    if (!trip || trip.status !== 'active') {
      return res.status(400).json({ error: 'Wait requests are only available for active trips.' });
    }

    const stop = await db.get('SELECT sequence_order FROM stops WHERE id = $1', [stopId]);
    let currentStopOrder = 0;
    if (trip.current_stop_id) {
      const currentStop = await db.get('SELECT sequence_order FROM stops WHERE id = $1', [trip.current_stop_id]);
      currentStopOrder = currentStop ? currentStop.sequence_order : 0;
    }

    if (stop && stop.sequence_order <= currentStopOrder) {
      return res.status(400).json({ error: 'Bus has already passed your pickup stop. Cannot request wait.' });
    }

    const waitRes = await db.run(
      "INSERT INTO wait_requests (student_id, stop_id, trip_id, status) VALUES ($1, $2, $3, 'pending')",
      [studentId, stopId, tripId]
    );

    const studentInfo = await db.get('SELECT name FROM students WHERE user_id = $1', [studentId]);
    const stopInfo = await db.get('SELECT name FROM stops WHERE id = $1', [stopId]);

    broadcast({
      type: 'wait_request_alert',
      requestId: waitRes.id,
      studentId,
      studentName: studentInfo?.name || 'Student',
      stopName: stopInfo?.name || 'Stop',
      tripId,
      driverId: trip.driver_id
    });

    res.json({ success: true, requestId: waitRes.id });
  } catch (err) {
    next(err);
  }
});

// AI Chatbot endpoint
app.post('/api/student/ai-chat', authenticateToken, requireRole('student', 'admin'), verifyResourceOwnership('student'), async (req, res, next) => {
  const { studentId, message } = req.body;
  if (!studentId || !message) return res.status(400).json({ error: 'studentId and message are required' });

  try {
    const aiAnswer = await ai.answerStudentQuery(studentId, sanitizeInput(message));
    res.json({ answer: aiAnswer });
  } catch (err) {
    next(err);
  }
});

// Complaints
app.post('/api/student/complaints', alertLimiter, authenticateToken, requireRole('student', 'admin'), verifyResourceOwnership('student'), async (req, res, next) => {
  const { studentId, category, description } = req.body;
  const validationErr = validateRequired(req.body, ['studentId', 'category', 'description']);
  if (validationErr) return res.status(400).json({ error: validationErr });

  const sanitizedDesc = sanitizeInput(description);
  try {
    await db.run(
      "INSERT INTO complaints (student_id, category, description, status) VALUES ($1, $2, $3, 'pending')",
      [studentId, category, sanitizedDesc]
    );
    broadcast({
      type: 'new_complaint',
      studentId,
      category,
      description: sanitizedDesc
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Lost & Found
app.post('/api/student/lost-found', authenticateToken, requireRole('student', 'driver', 'admin'), async (req, res, next) => {
  const { reporterRole, reporterId, itemType, itemName, description, busNumber, date } = req.body;
  const validationErr = validateRequired(req.body, ['reporterRole', 'reporterId', 'itemType', 'itemName', 'description', 'busNumber', 'date']);
  if (validationErr) return res.status(400).json({ error: validationErr });

  const sanitizedItemName = sanitizeInput(itemName);
  const sanitizedDesc = sanitizeInput(description);
  try {
    await db.run(
      "INSERT INTO lost_found (reporter_role, reporter_id, item_type, item_name, description, bus_number, date, status) VALUES ($1, $2, $3, $4, $5, $6, $7, 'reported')",
      [reporterRole, reporterId, itemType, sanitizedItemName, sanitizedDesc, busNumber, date]
    );
    broadcast({
      type: 'new_lost_found',
      itemType,
      itemName: sanitizedItemName,
      busNumber
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Emergency SOS Trigger
app.post('/api/student/sos', alertLimiter, authenticateToken, requireRole('student', 'admin'), verifyResourceOwnership('student'), async (req, res, next) => {
  const { studentId, latitude, longitude } = req.body;
  const validationErr = validateRequired(req.body, ['studentId', 'latitude', 'longitude']);
  if (validationErr) return res.status(400).json({ error: validationErr });

  try {
    await db.run(
      "INSERT INTO emergency_alerts (student_id, latitude, longitude, status) VALUES ($1, $2, $3, 'active')",
      [studentId, latitude, longitude]
    );

    const studentInfo = await db.get(
      'SELECT name, bus_id, route_id FROM students WHERE user_id = $1',
      [studentId]
    );

    const activeTrip = await db.get(
      'SELECT id, driver_id FROM trips WHERE bus_id = $1 AND status = \'active\'',
      [studentInfo?.bus_id]
    );

    broadcast({
      type: 'sos_alert',
      studentId,
      studentName: studentInfo?.name || 'Student',
      latitude,
      longitude,
      driverId: activeTrip ? activeTrip.driver_id : null,
      busId: studentInfo?.bus_id
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Student scans Bus QR Code
app.post('/api/student/scan-bus-qr', authenticateToken, requireRole('student', 'admin'), verifyResourceOwnership('student'), async (req, res, next) => {
  const { studentId, busQrCode, scanType } = req.body;
  if (!studentId) return res.status(400).json({ error: 'studentId is required' });

  try {
    const student = await db.get(
      `SELECT s.*, st.name as stop_name, b.bus_number, b.id as bus_table_id 
       FROM students s
       LEFT JOIN stops st ON s.pickup_stop_id = st.id
       LEFT JOIN buses b ON s.bus_id = b.id
       WHERE s.user_id = $1`,
      [studentId]
    );

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student account not found in database.' });
    }

    const normalizedCode = (busQrCode || '').trim().toUpperCase();
    
    const matchedBus = await db.get(
      `SELECT * FROM buses 
       WHERE UPPER(bus_number) = $1 OR UPPER(registration_number) = $2 OR $3 LIKE ('%' || UPPER(bus_number) || '%')`,
      [normalizedCode, normalizedCode, normalizedCode]
    ) || await db.get('SELECT * FROM buses WHERE id = $1', [student.bus_id || 1]);

    const busNumber = matchedBus ? matchedBus.bus_number : (student.bus_number || '101');
    const busId = matchedBus ? matchedBus.id : (student.bus_id || 1);

    let activeTrip = await db.get(
      `SELECT * FROM trips 
       WHERE bus_id = $1 AND status IN ('active', 'started', 'en_route') 
       ORDER BY created_at DESC LIMIT 1`,
      [busId]
    );

    if (!activeTrip) {
      activeTrip = await db.get(
        `SELECT * FROM trips 
         WHERE route_id = $1 AND status IN ('active', 'started', 'en_route') 
         ORDER BY created_at DESC LIMIT 1`,
        [student.route_id || 1]
      );
    }

    const tripId = activeTrip ? activeTrip.id : 1;
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Multi-table write inside a single transaction
    await db.withTransaction(async (tx) => {
      const attRecord = await tx.get(
        'SELECT id FROM attendance WHERE trip_id = $1 AND student_id = $2',
        [tripId, student.user_id]
      );

      if (attRecord) {
        await tx.run('UPDATE attendance SET status = \'present\' WHERE id = $1', [attRecord.id]);
      } else {
        await tx.run('INSERT INTO attendance (trip_id, student_id, status) VALUES ($1, $2, \'present\')', [tripId, student.user_id]);
      }

      const today = new Date().toISOString().split('T')[0];
      await tx.run('DELETE FROM not_coming WHERE student_id = $1 AND date = $2', [student.user_id, today]);
    });

    broadcast({
      type: 'passenger_boarded',
      tripId,
      studentId: student.user_id,
      studentName: student.name,
      rollNumber: student.roll_number,
      stopName: student.stop_name || 'Pickup Stop',
      busNumber,
      time: nowTime,
      scanType: scanType || 'boarding'
    });

    broadcast({
      type: 'attendance_change',
      tripId,
      studentId: student.user_id,
      status: 'present'
    });

    res.json({
      success: true,
      message: `Digital Attendance Recorded! Welcome aboard Bus ${busNumber} (${student.name}).`,
      studentName: student.name,
      busNumber,
      timestamp: nowTime
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// DRIVER ROUTES (Requires Driver role & resource ownership)
// -------------------------------------------------------------

// Driver details and trip control
app.get('/api/driver/trip/:driverId', authenticateToken, requireRole('driver', 'admin'), verifyResourceOwnership('driver'), async (req, res, next) => {
  try {
    let trip = await db.get(
      'SELECT t.*, r.name as route_name, b.bus_number FROM trips t JOIN routes r ON t.route_id = r.id JOIN buses b ON t.bus_id = b.id WHERE t.driver_id = $1 AND t.status = \'active\'',
      [req.params.driverId]
    );

    if (!trip) {
      trip = await db.get(
        'SELECT t.*, r.name as route_name, b.bus_number FROM trips t JOIN routes r ON t.route_id = r.id JOIN buses b ON t.bus_id = b.id WHERE t.driver_id = $1 AND t.status = \'scheduled\' LIMIT 1',
        [req.params.driverId]
      );
    }

    if (!trip) {
      const driver = await db.get('SELECT active_bus_id FROM drivers WHERE user_id = $1', [req.params.driverId]);
      const busId = driver?.active_bus_id || 1;
      const routeId = busId === 1 ? 1 : 2;

      const newTripRes = await db.run(
        'INSERT INTO trips (bus_id, route_id, driver_id, status) VALUES ($1, $2, $3, \'scheduled\') RETURNING id',
        [busId, routeId, req.params.driverId]
      );

      trip = await db.get(
        'SELECT t.*, r.name as route_name, b.bus_number FROM trips t JOIN routes r ON t.route_id = r.id JOIN buses b ON t.bus_id = b.id WHERE t.id = $1',
        [newTripRes.id]
      );
    }

    const stops = await db.query(
      'SELECT * FROM stops WHERE route_id = $1 ORDER BY sequence_order ASC',
      [trip.route_id]
    );

    res.json({ trip, stops });
  } catch (err) {
    next(err);
  }
});

// Driver Trip Action
app.post('/api/driver/trip/action', authenticateToken, requireRole('driver', 'admin'), async (req, res, next) => {
  const { tripId, action, stopId, lat, lng } = req.body;
  const validationErr = validateRequired(req.body, ['tripId', 'action']);
  if (validationErr) return res.status(400).json({ error: validationErr });

  try {
    const today = new Date().toISOString().split('T')[0];
    const timestampStr = new Date().toLocaleTimeString();

    if (action === 'start') {
      await db.withTransaction(async (tx) => {
        await tx.run(
          'UPDATE trips SET status = \'active\', started_at = $1, current_lat = $2, current_lng = $3, current_stop_id = $4 WHERE id = $5',
          [timestampStr, lat || null, lng || null, stopId || null, tripId]
        );
        await tx.run('UPDATE drivers SET status = \'on_trip\' WHERE user_id = (SELECT driver_id FROM trips WHERE id = $1)', [tripId]);
        
        const trip = await tx.get('SELECT route_id FROM trips WHERE id = $1', [tripId]);
        if (trip) {
          const students = await tx.query('SELECT user_id FROM students WHERE route_id = $1', [trip.route_id]);
          for (const st of students) {
            const notComing = await tx.get('SELECT id FROM not_coming WHERE student_id = $1 AND date = $2', [st.user_id, today]);
            const status = notComing ? 'not_coming' : 'absent';
            await tx.run(
              'INSERT INTO attendance (trip_id, student_id, status) VALUES ($1, $2, $3)',
              [tripId, st.user_id, status]
            );
          }
        }
      });

      const trip = await db.get('SELECT route_id FROM trips WHERE id = $1', [tripId]);
      broadcast({ type: 'trip_started', tripId, routeId: trip?.route_id });
    } else if (action === 'reach_stop') {
      await db.withTransaction(async (tx) => {
        await tx.run(
          'UPDATE trips SET current_stop_id = $1, next_stop_id = $2, current_lat = $3, current_lng = $4 WHERE id = $5',
          [stopId, Number(stopId) + 1, lat, lng, tripId]
        );

        await tx.run(
          'UPDATE wait_requests SET status = \'rejected\' WHERE stop_id = $1 AND trip_id = $2 AND status = \'pending\'',
          [stopId, tripId]
        );

        const boardingStudents = await tx.query('SELECT user_id FROM students WHERE pickup_stop_id = $1', [stopId]);
        for (const st of boardingStudents) {
          const attRecord = await tx.get('SELECT id, status FROM attendance WHERE trip_id = $1 AND student_id = $2', [tripId, st.user_id]);
          if (attRecord && attRecord.status === 'absent') {
            await tx.run('UPDATE attendance SET status = \'present\' WHERE id = $1', [attRecord.id]);
          }
        }
      });

      broadcast({ type: 'reached_stop', tripId, stopId });
    } else if (action === 'leave_stop') {
      await db.run(
        'UPDATE trips SET current_lat = $1, current_lng = $2 WHERE id = $3',
        [lat, lng, tripId]
      );
      broadcast({ type: 'left_stop', tripId, stopId });
    } else if (action === 'end') {
      await db.withTransaction(async (tx) => {
        await tx.run(
          'UPDATE trips SET status = \'completed\', ended_at = $1, current_lat = NULL, current_lng = NULL, speed = 0 WHERE id = $2',
          [timestampStr, tripId]
        );

        const trip = await tx.get('SELECT driver_id, bus_id, route_id FROM trips WHERE id = $1', [tripId]);
        if (trip) {
          await tx.run('UPDATE drivers SET status = \'active\' WHERE user_id = $1', [trip.driver_id]);
          const ridershipCount = await tx.get('SELECT COUNT(*) as count FROM attendance WHERE trip_id = $1 AND status = \'present\'', [tripId]);
          await tx.run('UPDATE buses SET total_mileage = total_mileage + 15.0 WHERE id = $1', [trip.bus_id]);

          await tx.run(
            `INSERT INTO analytics (date, daily_ridership, route_id) VALUES ($1, $2, $3) 
             ON CONFLICT(date) DO UPDATE SET daily_ridership = analytics.daily_ridership + EXCLUDED.daily_ridership`,
            [today, parseInt(ridershipCount?.count || '0', 10), trip.route_id]
          );
        }
      });

      broadcast({ type: 'trip_ended', tripId });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Fetch checklist for driver
app.get('/api/driver/trip/:tripId/attendance', authenticateToken, requireRole('driver', 'admin'), async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const list = await db.query(
      `SELECT a.*, s.name, s.roll_number, st.name as stop_name, s.pickup_stop_id,
              CASE 
                WHEN nc.id IS NOT NULL THEN 'not_coming'
                ELSE a.status 
              END as effective_status
       FROM attendance a
       JOIN students s ON a.student_id = s.user_id
       JOIN stops st ON s.pickup_stop_id = st.id
       LEFT JOIN not_coming nc ON s.user_id = nc.student_id AND nc.date = $1
       WHERE a.trip_id = $2
       ORDER BY s.pickup_stop_id ASC, s.name ASC`,
      [today, req.params.tripId]
    );
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// Update student attendance manual checklist
app.post('/api/driver/trip/attendance/toggle', authenticateToken, requireRole('driver', 'admin'), async (req, res, next) => {
  const { attendanceId, status } = req.body;
  if (!attendanceId || !status) return res.status(400).json({ error: 'attendanceId and status are required' });

  try {
    await db.run('UPDATE attendance SET status = $1 WHERE id = $2', [status, attendanceId]);
    broadcast({ type: 'attendance_updated', attendanceId, status });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Handle Wait Request (Accept/Reject)
app.post('/api/driver/wait-request/action', authenticateToken, requireRole('driver', 'admin'), async (req, res, next) => {
  const { requestId, action } = req.body;
  if (!requestId || !action) return res.status(400).json({ error: 'requestId and action are required' });

  try {
    const status = action === 'accept' ? 'accepted' : 'rejected';
    await db.run('UPDATE wait_requests SET status = $1 WHERE id = $2', [status, requestId]);

    const request = await db.get('SELECT * FROM wait_requests WHERE id = $1', [requestId]);
    if (request && status === 'accepted') {
      await db.run('UPDATE trips SET eta_mins = COALESCE(eta_mins, 0) + 5 WHERE id = $1', [request.trip_id]);
    }

    if (request) {
      broadcast({
        type: 'wait_request_response',
        requestId,
        studentId: request.student_id,
        status,
        tripId: request.trip_id
      });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Driver Voice Assistant Endpoint
app.post('/api/driver/voice-assistant', authenticateToken, requireRole('driver', 'admin'), verifyResourceOwnership('driver'), async (req, res, next) => {
  const { driverId, query, lang } = req.body;
  if (!driverId) return res.status(400).json({ error: 'driverId is required' });

  try {
    const answer = await ai.answerDriverVoiceQuery(driverId, query, lang);
    res.json({ success: true, answer });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------------------
// ADMIN ROUTES (Guarded by requireRole('admin'))
// -------------------------------------------------------------

// Admin Dashboard stats
app.get('/api/admin/dashboard', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const activeTripsCount = await db.get('SELECT COUNT(*) as count FROM trips WHERE status = \'active\'');
    const totalStudents = await db.get('SELECT COUNT(*) as count FROM students');
    const totalDrivers = await db.get('SELECT COUNT(*) as count FROM drivers');
    const totalBuses = await db.get('SELECT COUNT(*) as count FROM buses');
    const pendingFeesSum = await db.get('SELECT SUM(pending_amount) as sum FROM fees');
    
    const delayedTrips = await db.get(
      `SELECT COUNT(*) as count FROM trips t 
       JOIN routes r ON t.route_id = r.id 
       WHERE t.status = 'active' AND t.eta_mins > r.estimated_duration_mins`
    );

    const activeSOS = await db.query(
      `SELECT e.*, s.name, s.emergency_contact, b.bus_number 
       FROM emergency_alerts e
       JOIN students s ON e.student_id = s.user_id
       LEFT JOIN buses b ON s.bus_id = b.id
       WHERE e.status = 'active'`
    );

    const maintenanceRecs = await ai.getPredictiveMaintenanceList();

    const complaints = await db.query(
      `SELECT c.*, s.name as student_name 
       FROM complaints c 
       JOIN students s ON c.student_id = s.user_id 
       ORDER BY c.created_at DESC LIMIT 5`
    );

    const lostFound = await db.query('SELECT * FROM lost_found ORDER BY created_at DESC LIMIT 5');
    const analytics = await db.query('SELECT * FROM analytics ORDER BY date ASC LIMIT 10');

    res.json({
      stats: {
        activeTrips: parseInt(activeTripsCount?.count || '0', 10),
        totalStudents: parseInt(totalStudents?.count || '0', 10),
        totalDrivers: parseInt(totalDrivers?.count || '0', 10),
        totalBuses: parseInt(totalBuses?.count || '0', 10),
        delayedRoutes: parseInt(delayedTrips?.count || '0', 10),
        pendingFees: parseFloat(pendingFeesSum?.sum || '0')
      },
      activeSOS,
      maintenanceRecs,
      complaints,
      lostFound,
      analytics
    });
  } catch (err) {
    next(err);
  }
});

// Admin Resolve SOS
app.post('/api/admin/sos-resolve', authenticateToken, requireRole('admin'), async (req, res, next) => {
  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ error: 'studentId is required' });

  try {
    await db.run(
      'UPDATE emergency_alerts SET status = \'resolved\' WHERE student_id = $1 AND status = \'active\'',
      [studentId]
    );
    broadcast({ type: 'sos_resolved', studentId });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Admin Broadcast Notification
app.post('/api/admin/broadcast', authenticateToken, requireRole('admin'), async (req, res, next) => {
  const { recipientType, recipientId, title, message } = req.body;
  const validationErr = validateRequired(req.body, ['recipientType', 'title', 'message']);
  if (validationErr) return res.status(400).json({ error: validationErr });

  const sanitizedTitle = sanitizeInput(title);
  const sanitizedMsg = sanitizeInput(message);

  try {
    await db.run(
      'INSERT INTO notifications (recipient_type, recipient_id, title, message, status) VALUES ($1, $2, $3, $4, \'unread\')',
      [recipientType, recipientId || null, sanitizedTitle, sanitizedMsg]
    );

    broadcast({
      type: 'admin_broadcast',
      recipientType,
      recipientId,
      title: sanitizedTitle,
      message: sanitizedMsg
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Admin Terminal QR scan verify
app.post('/api/admin/verify-scan', authenticateToken, requireRole('admin'), async (req, res, next) => {
  const { qrCodePass } = req.body;
  if (!qrCodePass) return res.status(400).json({ error: 'qrCodePass is required' });

  try {
    const student = await db.get(
      'SELECT id, name, roll_number, bus_id, user_id FROM students WHERE qr_code_pass = $1',
      [qrCodePass]
    );

    if (!student) {
      return res.status(404).json({
        success: false,
        message: `INVALID PASS: Code "${qrCodePass}" is not registered in the database.`
      });
    }

    const trip = await db.get(
      `SELECT t.id, t.status FROM trips t
       WHERE t.bus_id = $1 AND t.status IN ('started', 'en_route', 'active')
       ORDER BY t.created_at DESC LIMIT 1`,
      [student.bus_id]
    );

    if (!trip) {
      return res.json({
        success: true,
        studentName: student.name,
        rollNumber: student.roll_number,
        message: `VALID PASS: Welcome ${student.name}. No active trip is currently running for Bus ${student.bus_id}. Please scan when the trip has started.`
      });
    }

    await db.withTransaction(async (tx) => {
      const attRecord = await tx.get(
        'SELECT id FROM attendance WHERE trip_id = $1 AND student_id = $2',
        [trip.id, student.user_id]
      );

      if (attRecord) {
        await tx.run('UPDATE attendance SET status = \'present\' WHERE id = $1', [attRecord.id]);
      } else {
        await tx.run('INSERT INTO attendance (trip_id, student_id, status) VALUES ($1, $2, \'present\')', [trip.id, student.user_id]);
      }
    });

    broadcast({
      type: 'attendance_change',
      tripId: trip.id,
      studentId: student.user_id,
      status: 'present'
    });

    res.json({
      success: true,
      studentName: student.name,
      rollNumber: student.roll_number,
      message: `SUCCESS: ${student.name} checked in successfully for Trip #${trip.id}!`
    });
  } catch (err) {
    next(err);
  }
});

// Admin Fee Approval Endpoint (Manual payment verification)
app.post('/api/admin/fees/mark-paid', authenticateToken, requireRole('admin'), async (req, res, next) => {
  const { studentId, amount, status, paymentMethod, notes } = req.body;
  const validationErr = validateRequired(req.body, ['studentId']);
  if (validationErr) return res.status(400).json({ error: validationErr });

  const adminUserId = req.user.userId;
  const parsedAmount = parseFloat(amount) || 0;

  try {
    const fee = await db.get('SELECT * FROM fees WHERE student_id = $1', [studentId]);
    if (!fee) return res.status(404).json({ error: 'Fee record not found for student' });

    let newPaid = fee.paid_amount;
    let newPending = fee.pending_amount;
    let newStatus = status;

    if (parsedAmount > 0) {
      newPaid = Math.min(fee.total_amount, fee.paid_amount + parsedAmount);
      newPending = Math.max(0, fee.total_amount - newPaid);
      if (!newStatus) {
        newStatus = newPending === 0 ? 'paid' : newPaid > 0 ? 'partial' : 'pending';
      }
    } else if (status === 'paid') {
      newPaid = fee.total_amount;
      newPending = 0;
    } else if (status === 'pending') {
      newPaid = 0;
      newPending = fee.total_amount;
    }

    const transactionId = 'ADM-' + Math.floor(Math.random() * 900000 + 100000);
    const receiptUrl = `/receipts/admin_receipt_${transactionId}.pdf`;
    const today = new Date().toISOString().split('T')[0];

    await db.withTransaction(async (tx) => {
      // 1. Update fees with audit trail
      await tx.run(
        `UPDATE fees 
         SET paid_amount = $1, pending_amount = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $4`,
        [newPaid, newPending, adminUserId, fee.id]
      );

      // 2. Update student status
      await tx.run('UPDATE students SET fee_status = $1 WHERE user_id = $2', [newStatus, studentId]);

      // 3. Record payment transaction if amount was added or full payment was marked
      if (parsedAmount > 0 || status === 'paid') {
        const recordAmount = parsedAmount > 0 ? parsedAmount : (fee.total_amount - fee.paid_amount);
        if (recordAmount > 0) {
          await tx.run(
            `INSERT INTO payments (fee_id, amount, payment_method, transaction_id, status, receipt_url) 
             VALUES ($1, $2, $3, $4, 'success', $5)`,
            [fee.id, recordAmount, paymentMethod || 'Admin Verification', transactionId, receiptUrl]
          );

          await tx.run(
            `INSERT INTO analytics (date, total_revenue) VALUES ($1, $2) 
             ON CONFLICT(date) DO UPDATE SET total_revenue = analytics.total_revenue + EXCLUDED.total_revenue`,
            [today, recordAmount]
          );
        }
      }
    });

    broadcast({
      type: 'fee_update',
      studentId,
      paidAmount: newPaid,
      pendingAmount: newPending,
      status: newStatus,
      updatedBy: adminUserId
    });

    res.json({
      success: true,
      studentId,
      paidAmount: newPaid,
      pendingAmount: newPending,
      status: newStatus,
      transactionId,
      updatedBy: adminUserId
    });
  } catch (err) {
    next(err);
  }
});

// Admin Manage Students CRUD
app.get('/api/admin/students', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const list = await db.query(
      `SELECT s.*, u.email, r.name as route_name, b.bus_number, st.name as stop_name,
              f.total_amount, f.paid_amount, f.pending_amount, f.due_date, f.updated_at as fee_updated_at
       FROM students s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN routes r ON s.route_id = r.id
       LEFT JOIN buses b ON s.bus_id = b.id
       LEFT JOIN stops st ON s.pickup_stop_id = st.id
       LEFT JOIN fees f ON s.user_id = f.student_id
       ORDER BY s.user_id ASC`
    );
    res.json(list);
  } catch (err) {
    next(err);
  }
});

app.post('/api/admin/students', authenticateToken, requireRole('admin'), async (req, res, next) => {
  const { name, email, rollNumber, busId, routeId, pickupStopId, emergencyContact, initialPassword } = req.body;
  const validationErr = validateRequired(req.body, ['name', 'email', 'rollNumber', 'emergencyContact']);
  if (validationErr) return res.status(400).json({ error: validationErr });

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'A valid college email is required' });
  }

  try {
    const cleanEmail = email.trim().toLowerCase();
    const existing = await db.get('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existing) {
      return res.status(409).json({ error: 'A user with this email address already exists' });
    }

    // Secure initial password
    const rawPassword = initialPassword || crypto.randomBytes(6).toString('hex');
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const qrPass = 'QR_PASS_' + rollNumber.trim().toUpperCase();

    let createdUserId = null;
    await db.withTransaction(async (tx) => {
      const userRes = await tx.run(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, \'student\') RETURNING id',
        [cleanEmail, passwordHash]
      );
      createdUserId = userRes.id;

      await tx.run(
        `INSERT INTO students (user_id, name, roll_number, bus_id, route_id, pickup_stop_id, emergency_contact, fee_status, qr_code_pass) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)`,
        [createdUserId, name.trim(), rollNumber.trim(), busId || null, routeId || null, pickupStopId || null, emergencyContact.trim(), qrPass]
      );

      await tx.run(
        `INSERT INTO fees (student_id, total_amount, paid_amount, pending_amount, due_date, updated_by) 
         VALUES ($1, 800, 0, 800, '2026-08-15', $2)`,
        [createdUserId, req.user.userId]
      );
    });

    res.json({ success: true, userId: createdUserId, temporaryPassword: rawPassword });
  } catch (err) {
    next(err);
  }
});

app.put('/api/admin/students/:id', authenticateToken, requireRole('admin'), async (req, res, next) => {
  const { name, email, rollNumber, busId, routeId, pickupStopId, emergencyContact } = req.body;
  const validationErr = validateRequired(req.body, ['name', 'email', 'rollNumber', 'emergencyContact']);
  if (validationErr) return res.status(400).json({ error: validationErr });

  try {
    await db.withTransaction(async (tx) => {
      await tx.run(
        `UPDATE students 
         SET name = $1, roll_number = $2, bus_id = $3, route_id = $4, pickup_stop_id = $5, emergency_contact = $6 
         WHERE user_id = $7`,
        [name.trim(), rollNumber.trim(), busId || null, routeId || null, pickupStopId || null, emergencyContact.trim(), req.params.id]
      );
      await tx.run('UPDATE users SET email = $1 WHERE id = $2', [email.trim().toLowerCase(), req.params.id]);
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/admin/students/:id', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    await db.run('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// CSV Import
app.post('/api/admin/students/import-csv', authenticateToken, requireRole('admin'), async (req, res, next) => {
  const { students } = req.body;
  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ error: 'Valid array of students is required' });
  }

  try {
    let importedCount = 0;
    const generatedCredentials = [];

    await db.withTransaction(async (tx) => {
      for (const s of students) {
        if (!s.email || !s.name || !s.rollNumber) continue;

        const cleanEmail = s.email.trim().toLowerCase();
        const existing = await tx.get('SELECT id FROM users WHERE email = $1', [cleanEmail]);
        if (!existing) {
          // Generate secure random initial password
          const randomPassword = crypto.randomBytes(6).toString('hex');
          const passwordHash = await bcrypt.hash(randomPassword, 10);
          const qrPass = 'QR_PASS_' + s.rollNumber.trim().toUpperCase();

          const userRes = await tx.run(
            'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, \'student\') RETURNING id',
            [cleanEmail, passwordHash]
          );

          await tx.run(
            `INSERT INTO students (user_id, name, roll_number, bus_id, route_id, pickup_stop_id, emergency_contact, fee_status, qr_code_pass) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8)`,
            [
              userRes.id,
              s.name.trim(),
              s.rollNumber.trim(),
              s.busId || null,
              s.routeId || null,
              s.pickupStopId || null,
              s.emergencyContact || '+1 555-0100',
              qrPass
            ]
          );

          await tx.run(
            `INSERT INTO fees (student_id, total_amount, paid_amount, pending_amount, due_date, updated_by) 
             VALUES ($1, 800, 0, 800, '2026-08-15', $2)`,
            [userRes.id, req.user.userId]
          );

          importedCount++;
          generatedCredentials.push({ email: cleanEmail, temporaryPassword: randomPassword });
        }
      }
    });

    res.json({ success: true, count: importedCount, credentials: generatedCredentials });
  } catch (err) {
    next(err);
  }
});

// Admin Manage Drivers CRUD
app.get('/api/admin/drivers', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const list = await db.query(
      `SELECT d.*, u.email, b.bus_number
       FROM drivers d
       JOIN users u ON d.user_id = u.id
       LEFT JOIN buses b ON d.active_bus_id = b.id
       ORDER BY d.user_id ASC`
    );
    res.json(list);
  } catch (err) {
    next(err);
  }
});

app.post('/api/admin/drivers', authenticateToken, requireRole('admin'), async (req, res, next) => {
  const { name, email, phone, licenseNumber, activeBusId, initialPassword } = req.body;
  const validationErr = validateRequired(req.body, ['name', 'email', 'phone', 'licenseNumber']);
  if (validationErr) return res.status(400).json({ error: validationErr });

  try {
    const cleanEmail = email.trim().toLowerCase();
    const existing = await db.get('SELECT id FROM users WHERE email = $1', [cleanEmail]);
    if (existing) {
      return res.status(409).json({ error: 'A user with this email address already exists' });
    }

    const rawPassword = initialPassword || crypto.randomBytes(6).toString('hex');
    const passwordHash = await bcrypt.hash(rawPassword, 10);

    let createdUserId = null;
    await db.withTransaction(async (tx) => {
      const userRes = await tx.run(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, \'driver\') RETURNING id',
        [cleanEmail, passwordHash]
      );
      createdUserId = userRes.id;

      await tx.run(
        `INSERT INTO drivers (user_id, name, phone, license_number, status, active_bus_id) 
         VALUES ($1, $2, $3, $4, 'inactive', $5)`,
        [createdUserId, name.trim(), phone.trim(), licenseNumber.trim(), activeBusId || null]
      );
    });

    res.json({ success: true, userId: createdUserId, temporaryPassword: rawPassword });
  } catch (err) {
    next(err);
  }
});

app.put('/api/admin/drivers/:id', authenticateToken, requireRole('admin'), async (req, res, next) => {
  const { name, email, phone, licenseNumber, activeBusId } = req.body;
  const validationErr = validateRequired(req.body, ['name', 'email', 'phone', 'licenseNumber']);
  if (validationErr) return res.status(400).json({ error: validationErr });

  try {
    await db.withTransaction(async (tx) => {
      await tx.run(
        `UPDATE drivers 
         SET name = $1, phone = $2, license_number = $3, active_bus_id = $4 
         WHERE user_id = $5`,
        [name.trim(), phone.trim(), licenseNumber.trim(), activeBusId || null, req.params.id]
      );
      await tx.run('UPDATE users SET email = $1 WHERE id = $2', [email.trim().toLowerCase(), req.params.id]);
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/admin/drivers/:id', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    await db.run('DELETE FROM users WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Admin Manage Buses CRUD
app.get('/api/admin/buses', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const list = await db.query('SELECT * FROM buses ORDER BY id ASC');
    res.json(list);
  } catch (err) {
    next(err);
  }
});

app.post('/api/admin/buses', authenticateToken, requireRole('admin'), async (req, res, next) => {
  const { busNumber, capacity, registrationNumber, insuranceExpiry, status, totalMileage } = req.body;
  const validationErr = validateRequired(req.body, ['busNumber', 'capacity', 'registrationNumber', 'insuranceExpiry']);
  if (validationErr) return res.status(400).json({ error: validationErr });

  try {
    await db.run(
      'INSERT INTO buses (bus_number, capacity, registration_number, insurance_expiry, status, total_mileage) VALUES ($1, $2, $3, $4, $5, $6)',
      [busNumber.trim(), parseInt(capacity, 10), registrationNumber.trim(), insuranceExpiry.trim(), status || 'active', parseFloat(totalMileage) || 0.0]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.put('/api/admin/buses/:id', authenticateToken, requireRole('admin'), async (req, res, next) => {
  const { busNumber, capacity, registrationNumber, insuranceExpiry, status, totalMileage } = req.body;
  const validationErr = validateRequired(req.body, ['busNumber', 'capacity', 'registrationNumber', 'insuranceExpiry']);
  if (validationErr) return res.status(400).json({ error: validationErr });

  try {
    await db.run(
      'UPDATE buses SET bus_number = $1, capacity = $2, registration_number = $3, insurance_expiry = $4, status = $5, total_mileage = $6 WHERE id = $7',
      [busNumber.trim(), parseInt(capacity, 10), registrationNumber.trim(), insuranceExpiry.trim(), status || 'active', parseFloat(totalMileage) || 0.0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/admin/buses/:id', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    await db.run('DELETE FROM buses WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Admin Manage Routes CRUD
app.get('/api/admin/routes', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const list = await db.query('SELECT * FROM routes ORDER BY id ASC');
    for (const r of list) {
      const stops = await db.get('SELECT COUNT(*) as count FROM stops WHERE route_id = $1', [r.id]);
      r.stops_count = parseInt(stops?.count || '0', 10);
    }
    res.json(list);
  } catch (err) {
    next(err);
  }
});

app.post('/api/admin/routes', authenticateToken, requireRole('admin'), async (req, res, next) => {
  const { name, startLocation, endLocation, distanceKm, estimatedDurationMins } = req.body;
  const validationErr = validateRequired(req.body, ['name', 'startLocation', 'endLocation', 'distanceKm', 'estimatedDurationMins']);
  if (validationErr) return res.status(400).json({ error: validationErr });

  try {
    await db.run(
      'INSERT INTO routes (name, start_location, end_location, distance_km, estimated_duration_mins) VALUES ($1, $2, $3, $4, $5)',
      [name.trim(), startLocation.trim(), endLocation.trim(), parseFloat(distanceKm), parseInt(estimatedDurationMins, 10)]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/admin/routes/:id', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    await db.run('DELETE FROM routes WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// Admin Live Tracking
app.get('/api/admin/tracking/live', authenticateToken, requireRole('admin'), async (req, res, next) => {
  try {
    const activeTrips = await db.query(
      `SELECT t.*, d.name as driver_name, r.name as route_name, b.bus_number,
              s_curr.name as current_stop_name, s_next.name as next_stop_name
       FROM trips t
       JOIN drivers d ON t.driver_id = d.user_id
       JOIN routes r ON t.route_id = r.id
       JOIN buses b ON t.bus_id = b.id
       LEFT JOIN stops s_curr ON t.current_stop_id = s_curr.id
       LEFT JOIN stops s_next ON t.next_stop_id = s_next.id
       WHERE t.status = 'active'`
    );
    
    for (const t of activeTrips) {
      const checkedIn = await db.get('SELECT COUNT(*) as count FROM attendance WHERE trip_id = $1 AND status = \'present\'', [t.id]);
      t.student_count = parseInt(checkedIn?.count || '0', 10);
    }
    
    res.json(activeTrips);
  } catch (err) {
    next(err);
  }
});

// Admin Report Export
app.get('/api/admin/reports/export', authenticateToken, requireRole('admin'), async (req, res) => {
  const { format, reportType } = req.query;
  const today = new Date().toISOString().split('T')[0];
  const safeFormat = format === 'pdf' ? 'pdf' : 'xlsx';
  const safeType = sanitizeInput(reportType || 'transit');
  
  res.json({
    success: true,
    url: `/exports/${safeType}_report_${today}.${safeFormat}`,
    message: `Successfully generated ${safeType} report as ${safeFormat.toUpperCase()}`
  });
});

// -------------------------------------------------------------
// STATIC FRONTEND ASSETS IN PRODUCTION
// -------------------------------------------------------------
const frontendDistPath = join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

app.get('*', (req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(join(frontendDistPath, 'index.html'));
});

// -------------------------------------------------------------
// CENTRALIZED ERROR HANDLING MIDDLEWARE
// -------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('API Error:', {
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method
  });

  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || 500;
  const userMessage = status === 500 
    ? 'An unexpected error occurred. Please contact system support.' 
    : (err.message || 'Operation failed');

  res.status(status).json({ error: userMessage });
});

// -------------------------------------------------------------
// SERVER & WEBSOCKET SETUP
// -------------------------------------------------------------
const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('New WebSocket connection initiated.');

  ws.on('message', async (message) => {
    let msg;
    try {
      msg = JSON.parse(message);
    } catch (e) {
      console.error('Invalid socket JSON payload received');
      return;
    }

    switch (msg.type) {
      case 'register': {
        // Authenticate WebSocket connection using JWT
        if (!msg.token) {
          console.warn('WS register attempt rejected: missing JWT token.');
          ws.send(JSON.stringify({ type: 'auth_error', message: 'Authentication token required for WebSocket registration' }));
          return;
        }

        const decoded = verifyToken(msg.token);
        if (!decoded) {
          console.warn('WS register attempt rejected: invalid or expired JWT token.');
          ws.send(JSON.stringify({ type: 'auth_error', message: 'Invalid or expired token' }));
          return;
        }

        clients.set(ws, {
          role: decoded.role,
          userId: decoded.userId,
          email: decoded.email,
          routeId: msg.routeId,
          busId: msg.busId
        });
        console.log(`Authenticated WS client registered: Role=${decoded.role}, UserID=${decoded.userId}`);
        ws.send(JSON.stringify({ type: 'registered_success', userId: decoded.userId, role: decoded.role }));
        break;
      }

      case 'gps_update': {
        const clientInfo = clients.get(ws);
        if (!clientInfo) {
          console.warn('Unauthorized GPS update: Client socket is not registered.');
          return;
        }

        const { tripId, latitude, longitude, speed } = msg;
        if (!tripId || latitude === undefined || longitude === undefined) {
          return;
        }

        try {
          // Verify that this user is authorized to send GPS updates for this trip
          const trip = await db.get(
            `SELECT t.*, r.estimated_duration_mins, r.id as route_id
             FROM trips t 
             JOIN routes r ON t.route_id = r.id 
             WHERE t.id = $1`,
            [tripId]
          );

          if (!trip) {
            return;
          }

          // Strict driver check: only authenticated driver for this trip or admin can broadcast GPS
          if (clientInfo.role !== 'admin' && (clientInfo.role !== 'driver' || parseInt(clientInfo.userId, 10) !== parseInt(trip.driver_id, 10))) {
            console.warn(`Unauthorized GPS update rejected: User ${clientInfo.userId} (role: ${clientInfo.role}) is not the driver for Trip #${tripId} (driver: ${trip.driver_id})`);
            return;
          }

          const trafficCoefficient = 1.0 + (Math.sin(Date.now() / 100000) * 0.5 + 0.5) * 0.8;
          const prediction = ai.predictDelay(15.2, trip.estimated_duration_mins, trafficCoefficient, 'clear');
          
          await db.run(
            'UPDATE trips SET current_lat = $1, current_lng = $2, speed = $3, eta_mins = $4 WHERE id = $5',
            [latitude, longitude, speed || 0, prediction.predictedDurationMins, tripId]
          );

          await db.run(
            'INSERT INTO gps_logs (trip_id, latitude, longitude, speed) VALUES ($1, $2, $3, $4)',
            [tripId, latitude, longitude, speed || 0]
          );

          broadcast({
            type: 'gps_broadcast',
            tripId,
            routeId: trip.route_id,
            busId: trip.bus_id,
            latitude,
            longitude,
            speed,
            etaMins: prediction.predictedDurationMins,
            delayMins: prediction.delayMins,
            trafficLevel: prediction.trafficLevel
          });
        } catch (err) {
          console.error('Error handling GPS update:', err);
        }
        break;
      }

      default:
        console.log('Unrecognized socket message type:', msg.type);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('WebSocket client disconnected.');
  });
});

// Broadcast helper function
function broadcast(data) {
  const rawData = JSON.stringify(data);
  for (const [ws, client] of clients.entries()) {
    if (ws.readyState === WebSocket.OPEN) {
      if (data.type === 'sos_alert') {
        if (client.role === 'admin' || (client.role === 'driver' && client.userId === data.driverId)) {
          ws.send(rawData);
        }
      } else if (data.type === 'gps_broadcast') {
        if (client.role === 'admin' || (client.role === 'student' && client.busId === data.busId)) {
          ws.send(rawData);
        }
      } else if (data.type === 'wait_request_alert') {
        if (client.role === 'driver' && client.userId === data.driverId) {
          ws.send(rawData);
        }
      } else if (data.type === 'wait_request_response') {
        if (client.role === 'student' && client.userId === data.studentId) {
          ws.send(rawData);
        }
      } else {
        ws.send(rawData);
      }
    }
  }
}

server.listen(port, () => {
  console.log(`VESA Transit Production API Server running on port ${port}`);
});
