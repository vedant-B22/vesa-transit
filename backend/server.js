import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import * as db from './database.js';
import * as ai from './aiEngine.js';

const app = express();
const port = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Initialize Database on server start
db.initDatabase();

// Keep track of connected WebSocket clients
const clients = new Map(); // ws -> { role, userId, routeId, busId }

// Input sanitization helper to protect against XSS
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


// REST APIs
app.get('/health', (req, res) => {
  res.json({ status: 'OK', time: new Date() });
});

// Authentication
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user || user.password_hash !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    let roleData = {};
    if (user.role === 'student') {
      roleData = await db.get(
        `SELECT s.*, r.name as route_name, b.bus_number, st.name as stop_name
         FROM students s
         LEFT JOIN routes r ON s.route_id = r.id
         LEFT JOIN buses b ON s.bus_id = b.id
         LEFT JOIN stops st ON s.pickup_stop_id = st.id
         WHERE s.user_id = ?`,
        [user.id]
      );
    } else if (user.role === 'driver') {
      roleData = await db.get('SELECT * FROM drivers WHERE user_id = ?', [user.id]);
    } else if (user.role === 'admin') {
      roleData = await db.get('SELECT * FROM admins WHERE user_id = ?', [user.id]);
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      },
      profile: roleData
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student Profile
app.get('/api/student/profile/:id', async (req, res) => {
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
       WHERE s.user_id = ?`,
      [req.params.id]
    );
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student Fees
app.get('/api/student/fees/:id', async (req, res) => {
  try {
    const fee = await db.get('SELECT * FROM fees WHERE student_id = ?', [req.params.id]);
    if (!fee) return res.status(404).json({ error: 'No fee record found' });
    const payments = await db.query('SELECT * FROM payments WHERE fee_id = ? ORDER BY created_at DESC', [fee.id]);
    res.json({ fee, payments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Pay Fees (Simulated payment gateway integration)
app.post('/api/student/fees/pay', async (req, res) => {
  const { studentId, amount, paymentMethod } = req.body;
  try {
    const fee = await db.get('SELECT * FROM fees WHERE student_id = ?', [studentId]);
    if (!fee) return res.status(404).json({ error: 'Fee record not found' });

    if (amount <= 0 || amount > fee.pending_amount) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    const newPaid = fee.paid_amount + amount;
    const newPending = fee.pending_amount - amount;
    const newStatus = newPending === 0 ? 'paid' : newPaid > 0 ? 'partial' : 'pending';

    await db.run(
      'UPDATE fees SET paid_amount = ?, pending_amount = ? WHERE id = ?',
      [newPaid, newPending, fee.id]
    );

    await db.run(
      'UPDATE students SET fee_status = ? WHERE user_id = ?',
      [newStatus, studentId]
    );

    const transactionId = 'TXN-' + Math.floor(Math.random() * 900000 + 100000);
    const receiptUrl = `/receipts/receipt_${transactionId}.pdf`;
    
    await db.run(
      'INSERT INTO payments (fee_id, amount, payment_method, transaction_id, status, receipt_url) VALUES (?, ?, ?, ?, ?, ?)',
      [fee.id, amount, paymentMethod, transactionId, 'success', receiptUrl]
    );

    // Update Admin dashboard aggregates
    const today = new Date().toISOString().split('T')[0];
    await db.run(
      'INSERT INTO analytics (date, total_revenue) VALUES (?, ?) ON CONFLICT(date) DO UPDATE SET total_revenue = total_revenue + ?',
      [today, amount, amount]
    );

    // Broadcast fee update to student and admin
    broadcast({
      type: 'fee_update',
      studentId,
      paidAmount: newPaid,
      pendingAmount: newPending,
      status: newStatus
    });

    res.json({ success: true, transactionId, receiptUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student Not Coming Today Toggle
app.post('/api/student/not-coming', async (req, res) => {
  const { studentId, date, isComing } = req.body;
  try {
    if (!isComing) {
      // Record not coming today
      await db.run('INSERT INTO not_coming (student_id, date) VALUES (?, ?)', [studentId, date]);
    } else {
      // Cancel absence
      await db.run('DELETE FROM not_coming WHERE student_id = ? AND date = ?', [studentId, date]);
    }

    // Recalculate route optimization for that student's route
    const student = await db.get('SELECT route_id, bus_id FROM students WHERE user_id = ?', [studentId]);
    
    // Find active trip for that route
    const activeTrip = await db.get('SELECT id FROM trips WHERE route_id = ? AND status = "active"', [student.route_id]);
    
    let optimizedRouteData = null;
    if (activeTrip) {
      optimizedRouteData = await ai.optimizeRoute(activeTrip.id);
      
      // Update checklist and broadcast optimization details to driver and admin
      broadcast({
        type: 'route_optimization',
        tripId: activeTrip.id,
        routeId: student.route_id,
        optimizedRouteData
      });
    }

    // Broadcast attendance update to driver
    broadcast({
      type: 'attendance_change',
      studentId,
      date,
      isComing
    });

    res.json({ success: true, optimizedRouteData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student Wait Request
app.post('/api/student/wait-request', async (req, res) => {
  const { studentId, stopId, tripId } = req.body;
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // Limit to 2 requests per student per day
    const requestCount = await db.get(
      `SELECT COUNT(*) as count FROM wait_requests 
       WHERE student_id = ? AND DATE(timestamp) = DATE(?)`,
      [studentId, today]
    );

    if (requestCount.count >= 2) {
      return res.status(400).json({ error: 'You have reached your daily limit of 2 wait requests.' });
    }

    // Verify trip exists and is active
    const trip = await db.get('SELECT * FROM trips WHERE id = ?', [tripId]);
    if (!trip || trip.status !== 'active') {
      return res.status(400).json({ error: 'Wait requests are only available for active trips.' });
    }

    // Verify bus has not already passed this stop
    const stop = await db.get('SELECT sequence_order FROM stops WHERE id = ?', [stopId]);
    let currentStopOrder = 0;
    if (trip.current_stop_id) {
      const currentStop = await db.get('SELECT sequence_order FROM stops WHERE id = ?', [trip.current_stop_id]);
      currentStopOrder = currentStop ? currentStop.sequence_order : 0;
    }

    if (stop.sequence_order <= currentStopOrder) {
      return res.status(400).json({ error: 'Bus has already passed your pickup stop. Cannot request wait.' });
    }

    const waitRes = await db.run(
      'INSERT INTO wait_requests (student_id, stop_id, trip_id, status) VALUES (?, ?, ?, "pending")',
      [studentId, stopId, tripId]
    );

    const studentInfo = await db.get('SELECT name FROM students WHERE user_id = ?', [studentId]);
    const stopInfo = await db.get('SELECT name FROM stops WHERE id = ?', [stopId]);

    // Send to Driver via socket
    broadcast({
      type: 'wait_request_alert',
      requestId: waitRes.id,
      studentId,
      studentName: studentInfo.name,
      stopName: stopInfo.name,
      tripId,
      driverId: trip.driver_id
    });

    res.json({ success: true, requestId: waitRes.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Chatbot endpoint
app.post('/api/student/ai-chat', async (req, res) => {
  const { studentId, message } = req.body;
  try {
    const aiAnswer = await ai.answerStudentQuery(studentId, message);
    res.json({ answer: aiAnswer });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Complaints
app.post('/api/student/complaints', async (req, res) => {
  const { studentId, category, description } = req.body;
  const sanitizedDesc = sanitizeInput(description);
  try {
    await db.run(
      'INSERT INTO complaints (student_id, category, description, status) VALUES (?, ?, ?, "pending")',
      [studentId, category, sanitizedDesc]
    );
    // Broadcast notification to admin
    broadcast({
      type: 'new_complaint',
      studentId,
      category,
      description: sanitizedDesc
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lost & Found
app.post('/api/student/lost-found', async (req, res) => {
  const { reporterRole, reporterId, itemType, itemName, description, busNumber, date } = req.body;
  const sanitizedItemName = sanitizeInput(itemName);
  const sanitizedDesc = sanitizeInput(description);
  try {
    await db.run(
      'INSERT INTO lost_found (reporter_role, reporter_id, item_type, item_name, description, bus_number, date, status) VALUES (?, ?, ?, ?, ?, ?, ?, "reported")',
      [reporterRole, reporterId, itemType, sanitizedItemName, sanitizedDesc, busNumber, date]
    );
    // Broadcast notification to admin
    broadcast({
      type: 'new_lost_found',
      itemType,
      itemName: sanitizedItemName,
      busNumber
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Emergency SOS Trigger
app.post('/api/student/sos', async (req, res) => {
  const { studentId, latitude, longitude } = req.body;
  try {
    await db.run(
      'INSERT INTO emergency_alerts (student_id, latitude, longitude, status) VALUES (?, ?, ?, "active")',
      [studentId, latitude, longitude]
    );

    const studentInfo = await db.get(
      'SELECT name, bus_id, route_id FROM students WHERE user_id = ?',
      [studentId]
    );

    // Get active trip details for this student's bus to notify driver
    const activeTrip = await db.get(
      'SELECT id, driver_id FROM trips WHERE bus_id = ? AND status = "active"',
      [studentInfo.bus_id]
    );

    // Broadcast panic alarm to Admin and Driver
    broadcast({
      type: 'sos_alert',
      studentId,
      studentName: studentInfo.name,
      latitude,
      longitude,
      driverId: activeTrip ? activeTrip.driver_id : null,
      busId: studentInfo.bus_id
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Resolve SOS
app.post('/api/admin/sos-resolve', async (req, res) => {
  const { studentId } = req.body;
  try {
    await db.run(
      'UPDATE emergency_alerts SET status = "resolved" WHERE student_id = ? AND status = "active"',
      [studentId]
    );
    broadcast({
      type: 'sos_resolved',
      studentId
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Driver details and trip control
app.get('/api/driver/trip/:driverId', async (req, res) => {
  try {
    // Find active trip or scheduled trip
    let trip = await db.get(
      'SELECT t.*, r.name as route_name, b.bus_number FROM trips t JOIN routes r ON t.route_id = r.id JOIN buses b ON t.bus_id = b.id WHERE t.driver_id = ? AND t.status = "active"',
      [req.params.driverId]
    );

    if (!trip) {
      trip = await db.get(
        'SELECT t.*, r.name as route_name, b.bus_number FROM trips t JOIN routes r ON t.route_id = r.id JOIN buses b ON t.bus_id = b.id WHERE t.driver_id = ? AND t.status = "scheduled" LIMIT 1',
        [req.params.driverId]
      );
    }

    // If no trip matches, let's create a default scheduled trip for demo purposes
    if (!trip) {
      const driver = await db.get('SELECT active_bus_id FROM drivers WHERE user_id = ?', [req.params.driverId]);
      const busId = driver ? driver.active_bus_id : 1;
      const routeId = busId === 1 ? 1 : 2;

      const newTripId = await db.run(
        'INSERT INTO trips (bus_id, route_id, driver_id, status) VALUES (?, ?, ?, "scheduled")',
        [busId, routeId, req.params.driverId]
      );

      trip = await db.get(
        'SELECT t.*, r.name as route_name, b.bus_number FROM trips t JOIN routes r ON t.route_id = r.id JOIN buses b ON t.bus_id = b.id WHERE t.id = ?',
        [newTripId.id]
      );
    }

    const stops = await db.query(
      'SELECT * FROM stops WHERE route_id = ? ORDER BY sequence_order ASC',
      [trip.route_id]
    );

    res.json({ trip, stops });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/driver/trip/action', async (req, res) => {
  const { tripId, action, stopId, lat, lng } = req.body;
  try {
    const today = new Date().toISOString().split('T')[0];
    const timestampStr = new Date().toLocaleTimeString();

    if (action === 'start') {
      await db.run(
        'UPDATE trips SET status = "active", started_at = ?, current_lat = ?, current_lng = ?, current_stop_id = ? WHERE id = ?',
        [timestampStr, lat, lng, stopId, tripId]
      );
      await db.run('UPDATE drivers SET status = "on_trip" WHERE user_id = (SELECT driver_id FROM trips WHERE id = ?)', [tripId]);
      
      // Seed default attendance for assigned students as absent initially
      const trip = await db.get('SELECT route_id FROM trips WHERE id = ?', [tripId]);
      const students = await db.query('SELECT user_id FROM students WHERE route_id = ?', [trip.route_id]);
      
      for (const st of students) {
        // If not already marked "not_coming"
        const notComing = await db.get('SELECT id FROM not_coming WHERE student_id = ? AND date = ?', [st.user_id, today]);
        const status = notComing ? 'not_coming' : 'absent';
        
        await db.run(
          'INSERT INTO attendance (trip_id, student_id, status) VALUES (?, ?, ?)',
          [tripId, st.user_id, status]
        );
      }

      broadcast({ type: 'trip_started', tripId, routeId: trip.route_id });
    } else if (action === 'reach_stop') {
      await db.run(
        'UPDATE trips SET current_stop_id = ?, next_stop_id = ?, current_lat = ?, current_lng = ? WHERE id = ?',
        [stopId, stopId + 1, lat, lng, tripId]
      );

      // Trigger automatic wait-request invalidation for this stop
      await db.run(
        'UPDATE wait_requests SET status = "rejected" WHERE stop_id = ? AND trip_id = ? AND status = "pending"',
        [stopId, tripId]
      );

      // Auto-update student attendance for students at this stop to "present" (for demo convenience)
      const boardingStudents = await db.query(
        'SELECT user_id FROM students WHERE pickup_stop_id = ?',
        [stopId]
      );
      for (const st of boardingStudents) {
        const attRecord = await db.get('SELECT id, status FROM attendance WHERE trip_id = ? AND student_id = ?', [tripId, st.user_id]);
        if (attRecord && attRecord.status === 'absent') {
          await db.run('UPDATE attendance SET status = "present" WHERE id = ?', [attRecord.id]);
        }
      }

      broadcast({ type: 'reached_stop', tripId, stopId });
    } else if (action === 'leave_stop') {
      await db.run(
        'UPDATE trips SET current_lat = ?, current_lng = ? WHERE id = ?',
        [lat, lng, tripId]
      );
      broadcast({ type: 'left_stop', tripId, stopId });
    } else if (action === 'end') {
      await db.run(
        'UPDATE trips SET status = "completed", ended_at = ?, current_lat = NULL, current_lng = NULL, speed = 0 WHERE id = ?',
        [timestampStr, tripId]
      );

      const trip = await db.get('SELECT driver_id, bus_id, route_id FROM trips WHERE id = ?', [tripId]);
      await db.run('UPDATE drivers SET status = "active" WHERE user_id = ?', [trip.driver_id]);

      // Add analytics entry
      const ridershipCount = await db.get('SELECT COUNT(*) as count FROM attendance WHERE trip_id = ? AND status = "present"', [tripId]);
      
      // Update bus mileage (simulate adding 15km)
      await db.run('UPDATE buses SET total_mileage = total_mileage + 15.0 WHERE id = ?', [trip.bus_id]);

      await db.run(
        'INSERT INTO analytics (date, daily_ridership, route_id) VALUES (?, ?, ?) ON CONFLICT(date) DO UPDATE SET daily_ridership = daily_ridership + ?',
        [today, ridershipCount.count, trip.route_id, ridershipCount.count]
      );

      broadcast({ type: 'trip_ended', tripId });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch checklist for driver
app.get('/api/driver/trip/:tripId/attendance', async (req, res) => {
  try {
    const list = await db.query(
      `SELECT a.*, s.name, st.name as stop_name, s.pickup_stop_id
       FROM attendance a
       JOIN students s ON a.student_id = s.user_id
       JOIN stops st ON s.pickup_stop_id = st.id
       WHERE a.trip_id = ?`,
      [req.params.tripId]
    );
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update student attendance manual checklist
app.post('/api/driver/trip/attendance/toggle', async (req, res) => {
  const { attendanceId, status } = req.body;
  try {
    await db.run('UPDATE attendance SET status = ? WHERE id = ?', [status, attendanceId]);
    broadcast({ type: 'attendance_updated', attendanceId, status });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Handle Wait Request (Accept/Reject)
app.post('/api/driver/wait-request/action', async (req, res) => {
  const { requestId, action } = req.body;
  try {
    const status = action === 'accept' ? 'accepted' : 'rejected';
    await db.run('UPDATE wait_requests SET status = ? WHERE id = ?', [status, requestId]);

    const request = await db.get('SELECT * FROM wait_requests WHERE id = ?', [requestId]);
    
    // If accepted, add 5 minutes delay to the active trip ETA
    if (status === 'accepted') {
      await db.run('UPDATE trips SET eta_mins = eta_mins + 5 WHERE id = ?', [request.trip_id]);
    }

    // Notify the student
    broadcast({
      type: 'wait_request_response',
      requestId,
      studentId: request.student_id,
      status,
      tripId: request.trip_id
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Dashboard stats
app.get('/api/admin/dashboard', async (req, res) => {
  try {
    const activeTripsCount = await db.get('SELECT COUNT(*) as count FROM trips WHERE status = "active"');
    const totalStudents = await db.get('SELECT COUNT(*) as count FROM students');
    const totalDrivers = await db.get('SELECT COUNT(*) as count FROM drivers');
    const totalBuses = await db.get('SELECT COUNT(*) as count FROM buses');
    const pendingFeesSum = await db.get('SELECT SUM(pending_amount) as sum FROM fees');
    
    // Delayed routes: routes where trip ETA is larger than scheduled duration
    const delayedTrips = await db.get(
      `SELECT COUNT(*) as count FROM trips t 
       JOIN routes r ON t.route_id = r.id 
       WHERE t.status = "active" AND t.eta_mins > r.estimated_duration_mins`
    );

    // Open SOS alerts
    const activeSOS = await db.query(
      `SELECT e.*, s.name, s.emergency_contact, b.bus_number 
       FROM emergency_alerts e
       JOIN students s ON e.student_id = s.user_id
       LEFT JOIN buses b ON s.bus_id = b.id
       WHERE e.status = "active"`
    );

    // AI Predictive maintenance
    const maintenanceRecs = await ai.getPredictiveMaintenanceList();

    // Complaints list
    const complaints = await db.query(
      `SELECT c.*, s.name as student_name 
       FROM complaints c 
       JOIN students s ON c.student_id = s.user_id 
       ORDER BY c.created_at DESC LIMIT 5`
    );

    // Lost & found list
    const lostFound = await db.query('SELECT * FROM lost_found ORDER BY created_at DESC LIMIT 5');

    // Chart analytics data
    const analytics = await db.query('SELECT * FROM analytics ORDER BY date ASC LIMIT 10');

    res.json({
      stats: {
        activeTrips: activeTripsCount.count,
        totalStudents: totalStudents.count,
        totalDrivers: totalDrivers.count,
        totalBuses: totalBuses.count,
        delayedRoutes: delayedTrips.count,
        pendingFees: pendingFeesSum.sum || 0
      },
      activeSOS,
      maintenanceRecs,
      complaints,
      lostFound,
      analytics
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Broadcast Notification
app.post('/api/admin/broadcast', async (req, res) => {
  const { recipientType, recipientId, title, message } = req.body;
  const sanitizedTitle = sanitizeInput(title);
  const sanitizedMsg = sanitizeInput(message);
  try {
    await db.run(
      'INSERT INTO notifications (recipient_type, recipient_id, title, message, status) VALUES (?, ?, ?, ?, "unread")',
      [recipientType, recipientId, sanitizedTitle, sanitizedMsg]
    );

    // Broadcast WebSocket event
    broadcast({
      type: 'admin_broadcast',
      recipientType,
      recipientId,
      title: sanitizedTitle,
      message: sanitizedMsg
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Manage Students CRUD
app.get('/api/admin/students', async (req, res) => {
  try {
    const list = await db.query(
      `SELECT s.*, u.email, r.name as route_name, b.bus_number, st.name as stop_name
       FROM students s
       JOIN users u ON s.user_id = u.id
       LEFT JOIN routes r ON s.route_id = r.id
       LEFT JOIN buses b ON s.bus_id = b.id
       LEFT JOIN stops st ON s.pickup_stop_id = st.id`
    );
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/students', async (req, res) => {
  const { name, email, rollNumber, busId, routeId, pickupStopId, emergencyContact } = req.body;
  try {
    // Create user record
    const userRes = await db.run(
      'INSERT INTO users (email, password_hash, role) VALUES (?, "password123", "student")',
      [email]
    );
    
    const qrPass = 'QR_PASS_' + rollNumber;
    await db.run(
      'INSERT INTO students (user_id, name, roll_number, bus_id, route_id, pickup_stop_id, emergency_contact, fee_status, qr_code_pass) VALUES (?, ?, ?, ?, ?, ?, ?, "pending", ?)',
      [userRes.id, name, rollNumber, busId, routeId, pickupStopId, emergencyContact, qrPass]
    );

    // Create fee record
    await db.run(
      'INSERT INTO fees (student_id, total_amount, paid_amount, pending_amount, due_date) VALUES (?, 800, 0, 800, "2026-08-15")',
      [userRes.id]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/students/:id', async (req, res) => {
  const { name, email, rollNumber, busId, routeId, pickupStopId, emergencyContact } = req.body;
  try {
    await db.run(
      'UPDATE students SET name = ?, roll_number = ?, bus_id = ?, route_id = ?, pickup_stop_id = ?, emergency_contact = ? WHERE user_id = ?',
      [name, rollNumber, busId, routeId, pickupStopId, emergencyContact, req.params.id]
    );
    await db.run('UPDATE users SET email = ? WHERE id = ?', [email, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/students/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CSV Import simulation
app.post('/api/admin/students/import-csv', async (req, res) => {
  const { students } = req.body; // Array of student objects
  try {
    for (const s of students) {
      const existing = await db.get('SELECT id FROM users WHERE email = ?', [s.email]);
      if (!existing) {
        const userRes = await db.run(
          'INSERT INTO users (email, password_hash, role) VALUES (?, "password123", "student")',
          [s.email]
        );
        const qrPass = 'QR_PASS_' + s.rollNumber;
        await db.run(
          'INSERT INTO students (user_id, name, roll_number, bus_id, route_id, pickup_stop_id, emergency_contact, fee_status, qr_code_pass) VALUES (?, ?, ?, ?, ?, ?, ?, "pending", ?)',
          [userRes.id, s.name, s.rollNumber, s.busId || null, s.routeId || null, s.pickupStopId || null, s.emergencyContact || '911', qrPass]
        );
        await db.run(
          'INSERT INTO fees (student_id, total_amount, paid_amount, pending_amount, due_date) VALUES (?, 800, 0, 800, "2026-08-15")',
          [userRes.id]
        );
      }
    }
    res.json({ success: true, count: students.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Manage Drivers CRUD
app.get('/api/admin/drivers', async (req, res) => {
  try {
    const list = await db.query(
      `SELECT d.*, u.email, b.bus_number
       FROM drivers d
       JOIN users u ON d.user_id = u.id
       LEFT JOIN buses b ON d.active_bus_id = b.id`
    );
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/drivers', async (req, res) => {
  const { name, email, phone, licenseNumber, activeBusId } = req.body;
  try {
    const userRes = await db.run(
      'INSERT INTO users (email, password_hash, role) VALUES (?, "password123", "driver")',
      [email]
    );
    await db.run(
      'INSERT INTO drivers (user_id, name, phone, license_number, status, active_bus_id) VALUES (?, ?, ?, ?, "inactive", ?)',
      [userRes.id, name, phone, licenseNumber, activeBusId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/drivers/:id', async (req, res) => {
  const { name, email, phone, licenseNumber, activeBusId } = req.body;
  try {
    await db.run(
      'UPDATE drivers SET name = ?, phone = ?, license_number = ?, active_bus_id = ? WHERE user_id = ?',
      [name, phone, licenseNumber, activeBusId, req.params.id]
    );
    await db.run('UPDATE users SET email = ? WHERE id = ?', [email, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/drivers/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Manage Buses CRUD
app.get('/api/admin/buses', async (req, res) => {
  try {
    const list = await db.query('SELECT * FROM buses');
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/buses', async (req, res) => {
  const { busNumber, capacity, registrationNumber, insuranceExpiry, status, totalMileage } = req.body;
  try {
    await db.run(
      'INSERT INTO buses (bus_number, capacity, registration_number, insurance_expiry, status, total_mileage) VALUES (?, ?, ?, ?, ?, ?)',
      [busNumber, capacity, registrationNumber, insuranceExpiry, status, totalMileage || 0.0]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/buses/:id', async (req, res) => {
  const { busNumber, capacity, registrationNumber, insuranceExpiry, status, totalMileage } = req.body;
  try {
    await db.run(
      'UPDATE buses SET bus_number = ?, capacity = ?, registration_number = ?, insurance_expiry = ?, status = ?, total_mileage = ? WHERE id = ?',
      [busNumber, capacity, registrationNumber, insuranceExpiry, status, totalMileage, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/buses/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM buses WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Manage Routes CRUD
app.get('/api/admin/routes', async (req, res) => {
  try {
    const list = await db.query('SELECT * FROM routes');
    // Map with stops count
    for (const r of list) {
      const stops = await db.get('SELECT COUNT(*) as count FROM stops WHERE route_id = ?', [r.id]);
      r.stops_count = stops.count;
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/routes', async (req, res) => {
  const { name, startLocation, endLocation, distanceKm, estimatedDurationMins } = req.body;
  try {
    await db.run(
      'INSERT INTO routes (name, start_location, end_location, distance_km, estimated_duration_mins) VALUES (?, ?, ?, ?, ?)',
      [name, startLocation, endLocation, distanceKm, estimatedDurationMins]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/routes/:id', async (req, res) => {
  try {
    await db.run('DELETE FROM routes WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch active bus tracking metrics for admin live tracking screen
app.get('/api/admin/tracking/live', async (req, res) => {
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
       WHERE t.status = "active"`
    );
    
    for (const t of activeTrips) {
      // Get student count currently checked in as present
      const checkedIn = await db.get('SELECT COUNT(*) as count FROM attendance WHERE trip_id = ? AND status = "present"', [t.id]);
      t.student_count = checkedIn.count;
    }
    
    res.json(activeTrips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Report Export simulation
app.get('/api/admin/reports/export', async (req, res) => {
  const { format, reportType } = req.query;
  // Simulates creating a file download
  res.json({
    success: true,
    url: `/exports/${reportType}_report_${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : 'xlsx'}`,
    message: `Successfully generated ${reportType} report as ${format.toUpperCase()}`
  });
});

// Create Server
const server = createServer(app);

// WebSocket Setup
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('New WebSocket connection established.');

  ws.on('message', async (message) => {
    let msg;
    try {
      msg = JSON.parse(message);
    } catch (e) {
      console.error('Invalid socket JSON message received:', message);
      return;
    }

    switch (msg.type) {
      case 'register':
        clients.set(ws, {
          role: msg.role,
          userId: msg.userId,
          routeId: msg.routeId,
          busId: msg.busId
        });
        console.log(`Registered WS client: Role=${msg.role}, ID=${msg.userId}`);
        break;

      case 'gps_update':
        // Update trip database with lat, lng, speed
        try {
          const { tripId, latitude, longitude, speed } = msg;
          
          // Fetch route duration for ETA calculations
          const trip = await db.get(
            `SELECT t.*, r.estimated_duration_mins, r.id as route_id
             FROM trips t 
             JOIN routes r ON t.route_id = r.id 
             WHERE t.id = ?`,
            [tripId]
          );

          if (trip) {
            // Find current active sequence stop
            let currentStopId = trip.current_stop_id;
            let nextStopId = trip.next_stop_id;
            
            // Calculate delay using AI Engine
            const trafficCoefficient = 1.0 + (Math.sin(Date.now() / 100000) * 0.5 + 0.5) * 0.8; // Cycle traffic multiplier 1.0 -> 1.8
            const prediction = ai.predictDelay(15.2, trip.estimated_duration_mins, trafficCoefficient, 'clear');
            
            await db.run(
              'UPDATE trips SET current_lat = ?, current_lng = ?, speed = ?, eta_mins = ? WHERE id = ?',
              [latitude, longitude, speed, prediction.predictedDurationMins, tripId]
            );

            // Log details in gps_logs for analytical reports
            await db.run(
              'INSERT INTO gps_logs (trip_id, latitude, longitude, speed) VALUES (?, ?, ?, ?)',
              [tripId, latitude, longitude, speed]
            );

            // Broadcast GPS update to all related student maps and admin dashboards
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
          }
        } catch (err) {
          console.error('Error handling GPS update:', err);
        }
        break;

      default:
        console.log('Unrecognized socket message type:', msg.type);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('WebSocket client disconnected.');
  });
});

// Broadcast helper functions
function broadcast(data) {
  const rawData = JSON.stringify(data);
  for (const [ws, client] of clients.entries()) {
    if (ws.readyState === WebSocket.OPEN) {
      // 1. SOS Broadcast (Always send to driver and admin)
      if (data.type === 'sos_alert') {
        if (client.role === 'admin' || (client.role === 'driver' && client.userId === data.driverId)) {
          ws.send(rawData);
        }
      } 
      // 2. Attendance alerts or GPS broadcasts
      else if (data.type === 'gps_broadcast') {
        if (client.role === 'admin' || (client.role === 'student' && client.busId === data.busId)) {
          ws.send(rawData);
        }
      } 
      // 3. Wait request alerting
      else if (data.type === 'wait_request_alert') {
        if (client.role === 'driver' && client.userId === data.driverId) {
          ws.send(rawData);
        }
      } 
      // 4. Wait request responses
      else if (data.type === 'wait_request_response') {
        if (client.role === 'student' && client.userId === data.studentId) {
          ws.send(rawData);
        }
      }
      // 5. Admin broadcasts or general routing optimizations
      else {
        ws.send(rawData);
      }
    }
  }
}

// Start Server
server.listen(port, () => {
  console.log(`VESA Transit API Server is running on port ${port}`);
});
