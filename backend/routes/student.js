import { Router } from 'express';
import * as db from '../database.js';
import * as ai from '../aiEngine.js';
import { authenticateToken, requireRole, verifyResourceOwnership } from '../middleware/auth.js';
import { sanitizeInput, validateRequired } from '../utils/helpers.js';
import { broadcast } from '../services/websocket.js';
import { isAttendanceScanningAllowed } from '../services/attendanceWindow.js';

export function createStudentRouter(alertLimiter) {
  const router = Router();

  // Student Profile
  router.get('/profile/:id', authenticateToken, requireRole('student', 'admin'), verifyResourceOwnership('student'), async (req, res, next) => {
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
  router.get('/fees/:id', authenticateToken, requireRole('student', 'admin'), verifyResourceOwnership('student'), async (req, res, next) => {
    try {
      const fee = await db.get('SELECT * FROM fees WHERE student_id = $1', [req.params.id]);
      if (!fee) return res.status(404).json({ error: 'No fee record found' });
      const payments = await db.query('SELECT * FROM payments WHERE fee_id = $1 ORDER BY created_at DESC', [fee.id]);
      res.json({ fee, payments });
    } catch (err) {
      next(err);
    }
  });

  // Student Attendance History (View own boarding logs)
  router.get('/attendance/:id', authenticateToken, requireRole('student', 'admin'), verifyResourceOwnership('student'), async (req, res, next) => {
    try {
      const records = await db.query(
        `SELECT a.id, a.trip_id, a.status, a.scanned_at,
                t.date as trip_date, t.start_time, t.end_time, t.direction,
                r.name as route_name, b.bus_number,
                st.name as stop_name
         FROM attendance a
         JOIN trips t ON a.trip_id = t.id
         LEFT JOIN routes r ON t.route_id = r.id
         LEFT JOIN buses b ON t.bus_id = b.id
         LEFT JOIN students s ON a.student_id = s.user_id
         LEFT JOIN stops st ON s.pickup_stop_id = st.id
         WHERE a.student_id = $1
         ORDER BY a.scanned_at DESC, a.id DESC
         LIMIT 60`,
        [req.params.id]
      );

      const totalCount = records.length;
      const presentCount = records.filter(r => r.status === 'present').length;
      const attendanceRate = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 100;

      res.json({
        attendance: records,
        stats: {
          totalTrips: totalCount,
          presentTrips: presentCount,
          absentTrips: records.filter(r => r.status === 'absent').length,
          optedOutTrips: records.filter(r => r.status === 'not_coming').length,
          attendanceRate
        }
      });
    } catch (err) {
      next(err);
    }
  });

  // Official Student Payment Receipt
  router.get('/receipt/:paymentId', authenticateToken, requireRole('student', 'admin'), async (req, res, next) => {
    try {
      const payment = await db.get(
        `SELECT p.*, f.student_id, f.total_amount, f.paid_amount, f.pending_amount, f.status as fee_status,
                s.name as student_name, s.roll_number, s.emergency_contact,
                r.name as route_name, b.bus_number, u.email as student_email
         FROM payments p
         JOIN fees f ON p.fee_id = f.id
         JOIN students s ON f.student_id = s.user_id
         JOIN users u ON s.user_id = u.id
         LEFT JOIN routes r ON s.route_id = r.id
         LEFT JOIN buses b ON s.bus_id = b.id
         WHERE p.id = $1`,
        [req.params.paymentId]
      );

      if (!payment) return res.status(404).json({ error: 'Receipt record not found' });

      if (req.user.role === 'student' && String(payment.student_id) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Unauthorized to view this receipt' });
      }

      const receiptData = {
        receiptNumber: `REC-VESA-${String(payment.id).padStart(6, '0')}`,
        transactionId: payment.transaction_id || `TXN-${payment.id}-${Date.now()}`,
        date: payment.created_at || new Date().toISOString(),
        student: {
          name: payment.student_name,
          rollNumber: payment.roll_number,
          email: payment.student_email,
          contact: payment.emergency_contact
        },
        transit: {
          route: payment.route_name || 'Standard Transit Route',
          busUnit: payment.bus_number || 'VESA Bus'
        },
        payment: {
          amount: payment.amount,
          method: payment.payment_method || 'Online Transfer (UPI/Card)',
          status: payment.status || 'verified',
          remarks: payment.remarks || 'Term Transit Fee Payment'
        },
        summary: {
          totalFee: payment.total_amount,
          totalPaidToDate: payment.paid_amount,
          balanceRemaining: payment.pending_amount,
          status: payment.fee_status
        },
        institution: {
          name: 'VESA Transit & Transport Department',
          campus: 'VESA Engineering & Technology Campus, Pune',
          supportEmail: 'transport-support@vesatransit.edu',
          helpline: '+91 (020) 2432-8900'
        }
      };

      res.json(receiptData);
    } catch (err) {
      next(err);
    }
  });

  // Student Not Coming Today Toggle
  router.post('/not-coming', authenticateToken, requireRole('student', 'admin'), verifyResourceOwnership('student'), async (req, res, next) => {
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
  router.post('/wait-request', authenticateToken, requireRole('student', 'admin'), verifyResourceOwnership('student'), async (req, res, next) => {
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
  router.post('/ai-chat', authenticateToken, requireRole('student', 'admin'), verifyResourceOwnership('student'), async (req, res, next) => {
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
  router.post('/complaints', alertLimiter, authenticateToken, requireRole('student', 'admin'), verifyResourceOwnership('student'), async (req, res, next) => {
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
  router.post('/lost-found', authenticateToken, requireRole('student', 'driver', 'admin'), async (req, res, next) => {
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
  router.post('/sos', alertLimiter, authenticateToken, requireRole('student', 'admin'), verifyResourceOwnership('student'), async (req, res, next) => {
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
  router.post('/scan-bus-qr', authenticateToken, requireRole('student', 'admin'), verifyResourceOwnership('student'), async (req, res, next) => {
    const { studentId, busQrCode, scanType } = req.body;
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });

    try {
      const scanWindow = await isAttendanceScanningAllowed();
      if (!scanWindow.allowed) {
        return res.status(403).json({ success: false, message: scanWindow.message });
      }

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
      
      // Match bus by QR code or student's assigned bus
      let matchedBus = null;
      if (normalizedCode) {
        matchedBus = await db.get(
          `SELECT * FROM buses 
           WHERE UPPER(bus_number) = $1 OR UPPER(registration_number) = $2 OR $3 LIKE ('%' || UPPER(bus_number) || '%')`,
          [normalizedCode, normalizedCode, normalizedCode]
        );
      }

      if (!matchedBus && student.bus_id) {
        matchedBus = await db.get('SELECT * FROM buses WHERE id = $1', [student.bus_id]);
      }

      if (!matchedBus) {
        return res.status(400).json({ success: false, message: 'Invalid bus QR code and no bus is assigned to your account.' });
      }

      const busNumber = matchedBus.bus_number;
      const busId = matchedBus.id;

      // Find active trip for this bus or student's route
      let activeTrip = await db.get(
        `SELECT * FROM trips 
         WHERE bus_id = $1 AND status IN ('active', 'started', 'en_route') 
         ORDER BY created_at DESC LIMIT 1`,
        [busId]
      );

      if (!activeTrip && student.route_id) {
        activeTrip = await db.get(
          `SELECT * FROM trips 
           WHERE route_id = $1 AND status IN ('active', 'started', 'en_route') 
           ORDER BY created_at DESC LIMIT 1`,
          [student.route_id]
        );
      }

      if (!activeTrip) {
        activeTrip = await db.get(
          `SELECT * FROM trips 
           WHERE bus_id = $1 AND status = 'scheduled' 
           ORDER BY created_at DESC LIMIT 1`,
          [busId]
        );
      }

      if (!activeTrip) {
        const busDriver = await db.get('SELECT user_id FROM drivers WHERE active_bus_id = $1 LIMIT 1', [busId]);
        const targetRouteId = student.route_id || (await db.get('SELECT id FROM routes LIMIT 1'))?.id;
        
        if (busDriver && targetRouteId) {
          const newTrip = await db.run(
            'INSERT INTO trips (bus_id, route_id, driver_id, status) VALUES ($1, $2, $3, \'active\') RETURNING id',
            [busId, targetRouteId, busDriver.user_id]
          );
          activeTrip = await db.get('SELECT * FROM trips WHERE id = $1', [newTrip.id]);
        }
      }

      if (!activeTrip) {
        return res.status(404).json({ success: false, message: `No active or scheduled trip found for Bus ${busNumber}.` });
      }

      const tripId = activeTrip.id;
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Multi-table write inside a single transaction with ON CONFLICT deduplication
      await db.withTransaction(async (tx) => {
        await tx.run(
          `INSERT INTO attendance (trip_id, student_id, status) 
           VALUES ($1, $2, 'present')
           ON CONFLICT (trip_id, student_id) 
           DO UPDATE SET status = 'present', timestamp = CURRENT_TIMESTAMP`,
          [tripId, student.user_id]
        );

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

  // Student Trip & Stops
  router.get('/trip/:id', authenticateToken, requireRole('student', 'admin'), verifyResourceOwnership('student'), async (req, res, next) => {
    try {
      const student = await db.get('SELECT bus_id, route_id FROM students WHERE user_id = $1', [req.params.id]);
      if (!student) return res.status(404).json({ error: 'Student not found' });

      let trip = null;
      if (student.bus_id) {
        trip = await db.get(
          'SELECT t.*, r.name as route_name, b.bus_number FROM trips t JOIN routes r ON t.route_id = r.id JOIN buses b ON t.bus_id = b.id WHERE t.bus_id = $1 AND t.status = \'active\' ORDER BY t.id DESC LIMIT 1',
          [student.bus_id]
        );
        if (!trip) {
          trip = await db.get(
            'SELECT t.*, r.name as route_name, b.bus_number FROM trips t JOIN routes r ON t.route_id = r.id JOIN buses b ON t.bus_id = b.id WHERE t.bus_id = $1 AND t.status = \'scheduled\' ORDER BY t.id DESC LIMIT 1',
            [student.bus_id]
          );
        }
      }

      const routeId = trip?.route_id || student.route_id;
      let stops = [];
      if (routeId) {
        stops = await db.query('SELECT * FROM stops WHERE route_id = $1 ORDER BY sequence_order ASC', [routeId]);
      }

      res.json({ trip, stops });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
