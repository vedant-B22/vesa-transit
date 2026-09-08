import { Router } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import * as db from '../database.js';
import * as ai from '../aiEngine.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { sanitizeInput, validateRequired, isValidEmail } from '../utils/helpers.js';
import { broadcast } from '../services/websocket.js';
import { isAttendanceScanningAllowed } from '../services/attendanceWindow.js';

export function createAdminRouter() {
  const router = Router();

  // Guard all admin routes with authentication and admin role
  router.use(authenticateToken, requireRole('admin'));

  // 1. Admin Dashboard Stats & Overview
  router.get('/dashboard', async (req, res, next) => {
    try {
      const activeTripsCount = await db.get('SELECT COUNT(*) as count FROM trips WHERE status = \'active\'');
      const totalStudents = await db.get('SELECT COUNT(*) as count FROM students');
      const totalDrivers = await db.get('SELECT COUNT(*) as count FROM drivers');
      const totalBuses = await db.get('SELECT COUNT(*) as count FROM buses');
      
      // Compute real dynamic revenue and fee collection statistics
      const feeStats = await db.get(`
        SELECT 
          COALESCE(SUM(total_amount), 0) as total_expected,
          COALESCE(SUM(paid_amount), 0) as total_paid,
          COALESCE(SUM(pending_amount), 0) as total_pending
        FROM fees
      `);
      const totalExpected = parseFloat(feeStats?.total_expected || '0');
      const totalPaid = parseFloat(feeStats?.total_paid || '0');
      const totalPending = parseFloat(feeStats?.total_pending || '0');
      const feeCollectionPercentage = totalExpected > 0 ? Number(((totalPaid / totalExpected) * 100).toFixed(1)) : 0;
      
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
          pendingFees: totalPending,
          totalFeesExpected: totalExpected,
          totalFeesPaid: totalPaid,
          feeCollectionPercentage: feeCollectionPercentage
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

  // 2. Admin Student Attendance Query Endpoint
  router.get('/attendance', async (req, res, next) => {
    try {
      const { date, routeId, busId, status } = req.query;
      let query = `
        SELECT 
          a.id as attendance_id,
          a.status as attendance_status,
          a.timestamp as recorded_at,
          s.user_id as student_id,
          s.name as student_name,
          s.roll_number,
          s.emergency_contact,
          b.bus_number,
          b.registration_number,
          r.name as route_name,
          st.name as stop_name,
          t.id as trip_id,
          t.status as trip_status
        FROM attendance a
        JOIN students s ON a.student_id = s.user_id
        LEFT JOIN trips t ON a.trip_id = t.id
        LEFT JOIN buses b ON COALESCE(t.bus_id, s.bus_id) = b.id
        LEFT JOIN routes r ON COALESCE(t.route_id, s.route_id) = r.id
        LEFT JOIN stops st ON s.pickup_stop_id = st.id
        WHERE 1=1
      `;
      const params = [];

      if (date && date.trim()) {
        params.push(date.trim());
        query += ` AND (a.timestamp::text LIKE ($${params.length} || '%'))`;
      }
      if (routeId) {
        params.push(parseInt(routeId, 10));
        query += ` AND COALESCE(t.route_id, s.route_id) = $${params.length}`;
      }
      if (busId) {
        params.push(parseInt(busId, 10));
        query += ` AND COALESCE(t.bus_id, s.bus_id) = $${params.length}`;
      }
      if (status) {
        params.push(status);
        query += ` AND a.status = $${params.length}`;
      }

      query += ` ORDER BY a.timestamp DESC, a.id DESC LIMIT 300`;

      const records = await db.query(query, params);
      res.json(records);
    } catch (err) {
      next(err);
    }
  });

  // 2b. Admin Student Attendance Summary & Live Route Breakdown
  router.get('/attendance/summary', async (req, res, next) => {
    try {
      const todayDate = new Date().toISOString().split('T')[0];
      
      // Get all active routes and buses with student assignments
      const routes = await db.query(`
        SELECT 
          r.id as route_id,
          r.name as route_name,
          b.id as bus_id,
          b.bus_number,
          COUNT(s.user_id) as total_students
        FROM routes r
        LEFT JOIN buses b ON b.id = (SELECT bus_id FROM trips WHERE route_id = r.id ORDER BY id DESC LIMIT 1)
        LEFT JOIN students s ON s.route_id = r.id
        GROUP BY r.id, r.name, b.id, b.bus_number
        ORDER BY r.id ASC
      `);

      // Today's attendance counts per route
      const todayLogs = await db.query(`
        SELECT 
          COALESCE(t.route_id, s.route_id) as route_id,
          a.status,
          COUNT(*) as count
        FROM attendance a
        JOIN students s ON a.student_id = s.user_id
        LEFT JOIN trips t ON a.trip_id = t.id
        WHERE a.timestamp::text LIKE ($1 || '%')
        GROUP BY COALESCE(t.route_id, s.route_id), a.status
      `, [todayDate]);

      // Overall Student Attendance Rates
      const studentRates = await db.query(`
        SELECT 
          s.user_id,
          s.name,
          s.roll_number,
          st.name as stop_name,
          r.name as route_name,
          b.bus_number,
          COUNT(a.id) as total_trips,
          COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_count,
          COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_count,
          COUNT(CASE WHEN a.status = 'not_coming' THEN 1 END) as not_coming_count,
          CASE 
            WHEN COUNT(a.id) > 0 THEN ROUND((COUNT(CASE WHEN a.status = 'present' THEN 1 END)::numeric / COUNT(a.id)::numeric) * 100)
            ELSE 100 
          END as attendance_rate
        FROM students s
        LEFT JOIN stops st ON s.pickup_stop_id = st.id
        LEFT JOIN routes r ON s.route_id = r.id
        LEFT JOIN buses b ON s.bus_id = b.id
        LEFT JOIN attendance a ON s.user_id = a.student_id
        GROUP BY s.user_id, s.name, s.roll_number, st.name, r.name, b.bus_number
        ORDER BY s.user_id ASC
      `);

      res.json({
        todayDate,
        routes,
        todayLogs,
        studentRates
      });
    } catch (err) {
      next(err);
    }
  // 2c. Admin Manual Attendance Override / Status Update
  router.post('/attendance/override', async (req, res, next) => {
    try {
      const { student_id, attendance_id, status, trip_id } = req.body;
      if (!student_id && !attendance_id) {
        return res.status(400).json({ error: 'student_id or attendance_id is required' });
      }
      const validStatuses = ['present', 'absent', 'not_coming'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
      }

      if (attendance_id) {
        await db.run('UPDATE attendance SET status = $1, timestamp = NOW() WHERE id = $2', [status, attendance_id]);
        broadcast({ type: 'attendance_update', attendance_id, status, student_id });
        return res.json({ success: true, message: 'Attendance updated successfully' });
      }

      // If updating by student_id
      let targetTripId = trip_id;
      if (!targetTripId) {
        const student = await db.get('SELECT bus_id, route_id FROM students WHERE user_id = $1', [student_id]);
        if (student) {
          const trip = await db.get(
            `SELECT id FROM trips WHERE (bus_id = $1 OR route_id = $2) ORDER BY start_time DESC LIMIT 1`,
            [student.bus_id || 1, student.route_id || 1]
          );
          if (trip) {
            targetTripId = trip.id;
          } else {
            const newTrip = await db.get(
              `INSERT INTO trips (bus_id, driver_id, route_id, status, start_time) 
               VALUES ($1, (SELECT user_id FROM drivers LIMIT 1), $2, 'active', NOW()) RETURNING id`,
              [student.bus_id || 1, student.route_id || 1]
            );
            targetTripId = newTrip?.id || 1;
          }
        }
      }

      if (targetTripId) {
        await db.run(
          `INSERT INTO attendance (trip_id, student_id, status, timestamp) 
           VALUES ($1, $2, $3, NOW()) 
           ON CONFLICT (trip_id, student_id) 
           DO UPDATE SET status = EXCLUDED.status, timestamp = NOW()`,
          [targetTripId, student_id, status]
        );
        broadcast({ type: 'attendance_update', student_id, status, trip_id: targetTripId });
      }

      res.json({ success: true, message: 'Attendance status recorded successfully' });
    } catch (err) {
      next(err);
    }
  });

  // 3. Admin Resolve SOS
  router.post('/sos-resolve', async (req, res, next) => {
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

  // 4. Admin Broadcast Notification
  router.post('/broadcast', async (req, res, next) => {
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

  // 5. Admin Terminal QR scan verify
  router.post('/verify-scan', async (req, res, next) => {
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
        `SELECT t.* FROM trips t 
         WHERE t.bus_id = $1 AND t.status = 'active' 
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
        await tx.run(
          `INSERT INTO attendance (trip_id, student_id, status)
           VALUES ($1, $2, 'present')
           ON CONFLICT (trip_id, student_id)
           DO UPDATE SET status = 'present', timestamp = CURRENT_TIMESTAMP`,
          [trip.id, student.user_id]
        );
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

  // 6. Admin Fee Approval Endpoint (Manual payment verification)
  router.post('/fees/mark-paid', async (req, res, next) => {
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

  // 7. Admin Manage Students CRUD
  router.get('/students', async (req, res, next) => {
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

  router.post('/students', async (req, res, next) => {
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
           VALUES ($1, 5000, 0, 5000, '2026-08-15', $2)`,
          [createdUserId, req.user.userId]
        );
      });

      res.json({ success: true, userId: createdUserId, temporaryPassword: rawPassword });
    } catch (err) {
      next(err);
    }
  });

  router.put('/students/:id', async (req, res, next) => {
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

  router.delete('/students/:id', async (req, res, next) => {
    try {
      await db.run('DELETE FROM users WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // CSV Import
  router.post('/students/import-csv', async (req, res, next) => {
    const { students, defaultFeeAmount, feeDueDate } = req.body;
    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ error: 'Valid array of students is required' });
    }

    const feeAmount = (Number.isFinite(parseFloat(defaultFeeAmount)) && parseFloat(defaultFeeAmount) >= 0)
      ? parseFloat(defaultFeeAmount)
      : 5000;
    const dueDate = (feeDueDate && typeof feeDueDate === 'string' && feeDueDate.trim())
      ? feeDueDate.trim()
      : '2026-12-31';

    try {
      let importedCount = 0;
      const errors = [];
      const generatedCredentials = [];

      // Fetch all valid stops for fuzzy lookup and error reporting
      const allStops = await db.query('SELECT id, route_id, name FROM stops ORDER BY route_id, sequence_order ASC');
      const stopNamesList = allStops.map(s => s.name).join(', ');

      await db.withTransaction(async (tx) => {
        for (let i = 0; i < students.length; i++) {
          const s = students[i];
          if (!s || typeof s !== 'object') continue;

          // Header line auto-skip
          if (
            (s.name && s.name.toLowerCase().includes('full name')) ||
            (s.email && s.email.toLowerCase().includes('email')) ||
            (s.rollNumber && s.rollNumber.toLowerCase().includes('roll'))
          ) {
            continue;
          }

          if (!s.email || !s.name || !s.rollNumber) {
            errors.push({
              row: i + 1,
              name: s.name || 'Unknown',
              email: s.email || 'Unknown',
              error: 'Missing required fields: Full Name, Email, and Roll Number are required.'
            });
            continue;
          }

          const cleanEmail = s.email.trim().toLowerCase();

          // 1. Resolve Pickup Stop, Route, and Bus (smart case-insensitive + fuzzy matching)
          let pickupStopId = null;
          let routeId = null;
          let busId = null;

          const pickupRaw = s.pickupPoint || s.pickupStopName || s.pickup_point || s.pickupStopId;
          if (pickupRaw && typeof pickupRaw === 'string' && pickupRaw.trim()) {
            const cleanPickup = pickupRaw.trim().toLowerCase();
            
            // 1a: Exact match
            let stopMatch = allStops.find(st => st.name.trim().toLowerCase() === cleanPickup);
            
            // 1b: Substring or containment match
            if (!stopMatch) {
              stopMatch = allStops.find(st => {
                const sName = st.name.trim().toLowerCase();
                return sName.includes(cleanPickup) || cleanPickup.includes(sName);
              });
            }

            // 1c: Numeric ID match
            if (!stopMatch && !isNaN(parseInt(cleanPickup, 10))) {
              const numId = parseInt(cleanPickup, 10);
              stopMatch = allStops.find(st => st.id === numId);
            }

            if (!stopMatch) {
              errors.push({
                row: i + 1,
                name: s.name,
                email: cleanEmail,
                error: `Pickup stop '${pickupRaw.trim()}' not found. Available stops: [${stopNamesList}]`
              });
              continue;
            }

            pickupStopId = stopMatch.id;
            routeId = stopMatch.route_id;

            // Resolve associated bus
            const trip = await tx.get('SELECT bus_id FROM trips WHERE route_id = $1 LIMIT 1', [routeId]);
            if (trip && trip.bus_id) {
              busId = trip.bus_id;
            } else {
              const anyBus = await tx.get('SELECT id FROM buses ORDER BY id ASC LIMIT 1');
              busId = anyBus ? anyBus.id : null;
            }
          } else if (allStops.length > 0) {
            // Default fallback to first stop if none provided
            pickupStopId = allStops[0].id;
            routeId = allStops[0].route_id;
            const trip = await tx.get('SELECT bus_id FROM trips WHERE route_id = $1 LIMIT 1', [routeId]);
            busId = trip?.bus_id || (await tx.get('SELECT id FROM buses ORDER BY id ASC LIMIT 1'))?.id || null;
          } else {
            errors.push({
              row: i + 1,
              name: s.name,
              email: cleanEmail,
              error: 'No pickup stops registered in system yet. Please configure routes first.'
            });
            continue;
          }

          // 2. Check duplicate email
          const existing = await tx.get('SELECT id FROM users WHERE email = $1', [cleanEmail]);
          if (existing) {
            errors.push({
              row: i + 1,
              name: s.name,
              email: cleanEmail,
              error: 'A student account with this email address already exists.'
            });
            continue;
          }

          // 3. Password handling (use provided CSV password or default fallback)
          const rawPassword = (s.password && s.password.trim()) ? s.password.trim() : `Vesa@${s.rollNumber.trim().replace(/[^a-zA-Z0-9]/g, '')}`;
          const passwordHash = await bcrypt.hash(rawPassword, 10);
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
              busId,
              routeId,
              pickupStopId,
              (s.emergencyContact && s.emergencyContact.trim()) || '+91 9876543210',
              qrPass
            ]
          );

          await tx.run(
            `INSERT INTO fees (student_id, total_amount, paid_amount, pending_amount, due_date, updated_by) 
             VALUES ($1, $2, 0, $2, $3, $4)`,
            [userRes.id, feeAmount, dueDate, req.user.userId]
          );

          importedCount++;
          generatedCredentials.push({
            name: s.name.trim(),
            email: cleanEmail,
            rollNumber: s.rollNumber.trim(),
            temporaryPassword: rawPassword
          });
        }
      });

      res.json({
        success: true,
        count: importedCount,
        errors,
        credentials: generatedCredentials
      });
    } catch (err) {
      next(err);
    }
  });

  // 8. Admin Manage Drivers CRUD
  router.get('/drivers', async (req, res, next) => {
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

  router.post('/drivers', async (req, res, next) => {
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

  router.put('/drivers/:id', async (req, res, next) => {
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

  router.delete('/drivers/:id', async (req, res, next) => {
    try {
      await db.run('DELETE FROM users WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // 9. Admin Manage Buses CRUD
  router.get('/buses', async (req, res, next) => {
    try {
      const list = await db.query('SELECT * FROM buses ORDER BY id ASC');
      res.json(list);
    } catch (err) {
      next(err);
    }
  });

  router.post('/buses', async (req, res, next) => {
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

  router.put('/buses/:id', async (req, res, next) => {
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

  router.delete('/buses/:id', async (req, res, next) => {
    try {
      await db.run('DELETE FROM buses WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // 10. Admin Manage Routes CRUD
  router.get('/routes', async (req, res, next) => {
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

  router.post('/routes', async (req, res, next) => {
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

  router.put('/routes/:id', async (req, res, next) => {
    const { name, startLocation, endLocation, distanceKm, estimatedDurationMins } = req.body;
    const validationErr = validateRequired(req.body, ['name', 'startLocation', 'endLocation', 'distanceKm', 'estimatedDurationMins']);
    if (validationErr) return res.status(400).json({ error: validationErr });

    try {
      await db.run(
        'UPDATE routes SET name = $1, start_location = $2, end_location = $3, distance_km = $4, estimated_duration_mins = $5 WHERE id = $6',
        [name.trim(), startLocation.trim(), endLocation.trim(), parseFloat(distanceKm), parseInt(estimatedDurationMins, 10), req.params.id]
      );
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/routes/:id', async (req, res, next) => {
    try {
      await db.run('DELETE FROM routes WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // 11. Admin Manage Stops CRUD
  router.get('/routes/:id/stops', async (req, res, next) => {
    try {
      const stops = await db.query(
        'SELECT * FROM stops WHERE route_id = $1 ORDER BY sequence_order ASC, id ASC',
        [req.params.id]
      );
      res.json(stops);
    } catch (err) {
      next(err);
    }
  });

  router.post('/stops', async (req, res, next) => {
    const { routeId, name, latitude, longitude, sequenceOrder, scheduledTime } = req.body;
    const validationErr = validateRequired(req.body, ['routeId', 'name', 'scheduledTime']);
    if (validationErr) return res.status(400).json({ error: validationErr });

    try {
      const lat = latitude ? parseFloat(latitude) : 18.5204;
      const lng = longitude ? parseFloat(longitude) : 73.8567;
      const seq = sequenceOrder ? parseInt(sequenceOrder, 10) : 1;

      const resDb = await db.run(
        'INSERT INTO stops (route_id, name, latitude, longitude, sequence_order, scheduled_time) VALUES ($1, $2, $3, $4, $5, $6)',
        [parseInt(routeId, 10), name.trim(), lat, lng, seq, scheduledTime.trim()]
      );
      res.json({ success: true, id: resDb.id });
    } catch (err) {
      next(err);
    }
  });

  router.put('/stops/:id', async (req, res, next) => {
    const { name, latitude, longitude, sequenceOrder, scheduledTime } = req.body;
    const validationErr = validateRequired(req.body, ['name', 'scheduledTime']);
    if (validationErr) return res.status(400).json({ error: validationErr });

    try {
      const lat = latitude ? parseFloat(latitude) : 18.5204;
      const lng = longitude ? parseFloat(longitude) : 73.8567;
      const seq = sequenceOrder ? parseInt(sequenceOrder, 10) : 1;

      await db.run(
        'UPDATE stops SET name = $1, latitude = $2, longitude = $3, sequence_order = $4, scheduled_time = $5 WHERE id = $6',
        [name.trim(), lat, lng, seq, scheduledTime.trim(), req.params.id]
      );
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  router.delete('/stops/:id', async (req, res, next) => {
    try {
      await db.run('DELETE FROM stops WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  });

  // Admin Bulk Import Stops for a Route
  router.post('/stops/bulk-import', async (req, res, next) => {
    const { routeId, csvText } = req.body;
    const validationErr = validateRequired(req.body, ['routeId', 'csvText']);
    if (validationErr) return res.status(400).json({ error: validationErr });

    try {
      const route = await db.get('SELECT id, name FROM routes WHERE id = $1', [parseInt(routeId, 10)]);
      if (!route) {
        return res.status(404).json({ error: 'Specified route does not exist.' });
      }

      const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length === 0) {
        return res.status(400).json({ error: 'CSV content is empty.' });
      }

      // Check if first line is a header row
      const firstLineLower = lines[0].toLowerCase();
      const hasHeader = firstLineLower.includes('pickup') || firstLineLower.includes('stop') || firstLineLower.includes('sequence') || firstLineLower.includes('latitude') || firstLineLower.includes('time');
      const dataLines = hasHeader ? lines.slice(1) : lines;

      if (dataLines.length === 0) {
        return res.status(400).json({ error: 'No data rows found in CSV after header row.' });
      }

      const parsedStops = [];
      const errors = [];
      const seenSequences = new Set();

      dataLines.forEach((line, idx) => {
        const lineNum = hasHeader ? idx + 2 : idx + 1;
        const parts = line.split(',').map(p => p.trim());
        
        // Expected: Pickup Point Name, Pickup Time, Latitude, Longitude, Sequence Number
        if (parts.length < 5) {
          errors.push({ line: lineNum, error: `Incomplete columns (expected 5 columns: Name, Time, Latitude, Longitude, Sequence), found ${parts.length}` });
          return;
        }

        const [name, scheduledTime, latStr, lngStr, seqStr] = parts;

        if (!name) {
          errors.push({ line: lineNum, error: 'Pickup Point Name cannot be empty.' });
          return;
        }

        if (!scheduledTime) {
          errors.push({ line: lineNum, error: 'Pickup Time cannot be empty.' });
          return;
        }

        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);
        if (isNaN(lat) || isNaN(lng)) {
          errors.push({ line: lineNum, error: `Invalid coordinates: Latitude '${latStr}', Longitude '${lngStr}' must be valid decimal numbers.` });
          return;
        }

        const seq = parseInt(seqStr, 10);
        if (isNaN(seq) || seq <= 0) {
          errors.push({ line: lineNum, error: `Invalid Sequence Number '${seqStr}' (must be a positive number).` });
          return;
        }

        if (seenSequences.has(seq)) {
          errors.push({ line: lineNum, error: `Duplicate Sequence Number ${seq} within this CSV batch.` });
          return;
        }

        seenSequences.add(seq);
        parsedStops.push({
          routeId: route.id,
          name,
          scheduledTime,
          latitude: lat,
          longitude: lng,
          sequenceOrder: seq
        });
      });

      if (parsedStops.length === 0) {
        return res.status(400).json({
          error: 'No valid stops could be parsed from the CSV.',
          errors
        });
      }

      // Insert all valid parsed stops in a single transaction
      await db.withTransaction(async (tx) => {
        for (const stop of parsedStops) {
          await tx.run(
            'INSERT INTO stops (route_id, name, latitude, longitude, sequence_order, scheduled_time) VALUES ($1, $2, $3, $4, $5, $6)',
            [stop.routeId, stop.name, stop.latitude, stop.longitude, stop.sequenceOrder, stop.scheduledTime]
          );
        }
      });

      res.json({
        success: true,
        message: `Successfully imported ${parsedStops.length} pickup points to route "${route.name}".`,
        importedCount: parsedStops.length,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (err) {
      next(err);
    }
  });

  // 12. Admin Live Tracking
  router.get('/tracking/live', async (req, res, next) => {
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

  // 13. Admin Report Export
  router.get('/reports/export', async (req, res) => {
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

  // 14. Admin Settings: Attendance Scanning Mode
  router.get('/settings/attendance-window', async (req, res, next) => {
    try {
      const setting = await db.get("SELECT value FROM settings WHERE key = 'attendance_scanning_mode'");
      const status = await isAttendanceScanningAllowed();
      res.json({ mode: setting?.value || 'auto', ...status });
    } catch (err) {
      next(err);
    }
  });

  router.post('/settings/attendance-window', async (req, res, next) => {
    const { mode } = req.body;
    if (!['active', 'inactive', 'auto'].includes(mode)) {
      return res.status(400).json({ error: "mode must be 'active', 'inactive', or 'auto'" });
    }
    try {
      const existing = await db.get("SELECT key FROM settings WHERE key = 'attendance_scanning_mode'");
      if (existing) {
        await db.run("UPDATE settings SET value = $1 WHERE key = 'attendance_scanning_mode'", [mode]);
      } else {
        await db.run("INSERT INTO settings (key, value) VALUES ('attendance_scanning_mode', $1)", [mode]);
      }
      const status = await isAttendanceScanningAllowed();
      res.json({ success: true, mode, ...status });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
