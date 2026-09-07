import { Router } from 'express';
import * as db from '../database.js';
import * as ai from '../aiEngine.js';
import { authenticateToken, requireRole, verifyResourceOwnership } from '../middleware/auth.js';
import { validateRequired } from '../utils/helpers.js';
import { broadcast } from '../services/websocket.js';

export function createDriverRouter() {
  const router = Router();

  // Get active or scheduled trip for driver
  router.get('/trip/:driverId', authenticateToken, requireRole('driver', 'admin'), verifyResourceOwnership('driver'), async (req, res, next) => {
    try {
      const resolved = await db.resolveDriverRoute(req.params.driverId);
      if (resolved.error || !resolved.bus || !resolved.route) {
        return res.status(404).json({ error: resolved.error || 'No route assigned for this bus yet — contact your admin.' });
      }

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
        const newTripRes = await db.run(
          'INSERT INTO trips (bus_id, route_id, driver_id, status) VALUES ($1, $2, $3, \'scheduled\') RETURNING id',
          [resolved.bus.id, resolved.route.id, req.params.driverId]
        );

        trip = await db.get(
          'SELECT t.*, r.name as route_name, b.bus_number FROM trips t JOIN routes r ON t.route_id = r.id JOIN buses b ON t.bus_id = b.id WHERE t.id = $1',
          [newTripRes.id]
        );
      }

      if (!trip) {
        return res.status(404).json({ error: 'Could not initialize transit trip for this driver.' });
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
  router.post('/trip/action', authenticateToken, requireRole('driver', 'admin'), async (req, res, next) => {
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
                'INSERT INTO attendance (trip_id, student_id, status) VALUES ($1, $2, $3) ON CONFLICT (trip_id, student_id) DO NOTHING',
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
  router.get('/trip/:tripId/attendance', authenticateToken, requireRole('driver', 'admin'), async (req, res, next) => {
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
  router.post('/trip/attendance/toggle', authenticateToken, requireRole('driver', 'admin'), async (req, res, next) => {
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
  router.post('/wait-request/action', authenticateToken, requireRole('driver', 'admin'), async (req, res, next) => {
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
  router.post('/voice-assistant', authenticateToken, requireRole('driver', 'admin'), verifyResourceOwnership('driver'), async (req, res, next) => {
    const { driverId, query, lang } = req.body;
    if (!driverId) return res.status(400).json({ error: 'driverId is required' });

    try {
      const answer = await ai.answerDriverVoiceQuery(driverId, query, lang);
      res.json({ success: true, answer });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
