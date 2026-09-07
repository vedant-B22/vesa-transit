import { WebSocketServer, WebSocket } from 'ws';
import * as db from '../database.js';
import * as ai from '../aiEngine.js';
import { verifyToken } from '../middleware/auth.js';

// Connected authenticated WebSocket clients: ws -> { role, userId, email, routeId, busId }
export const clients = new Map();

// Broadcast helper function
export function broadcast(data) {
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

export function setupWebSocket(server) {
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

  return wss;
}
