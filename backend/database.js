import pg from 'pg';
import bcrypt from 'bcryptjs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL || '';

// SSL configuration for Render / managed PostgreSQL
const sslConfig = connectionString.includes('render.com') || connectionString.includes('sslmode=require') || process.env.NODE_ENV === 'production'
  ? { rejectUnauthorized: false }
  : false;

export const pool = new Pool(
  connectionString
    ? { connectionString, ssl: sslConfig }
    : {
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432', 10),
        database: process.env.PGDATABASE || 'vesa_transit',
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        ssl: sslConfig
      }
);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client pool:', err);
});

// Wrap DB methods for standard async/await usage
export const query = async (sql, params = []) => {
  const res = await pool.query(sql, params);
  return res.rows;
};

export const get = async (sql, params = []) => {
  const res = await pool.query(sql, params);
  return res.rows[0] || null;
};

export const run = async (sql, params = []) => {
  let modifiedSql = sql;
  const insertMatch = sql.match(/^\s*INSERT\s+INTO\s+([a-zA-Z0-9_]+)/i);
  const hasReturning = /RETURNING\s+/i.test(sql);
  const tablesWithoutId = new Set(['students', 'drivers', 'admins', 'settings']);
  
  if (insertMatch && !hasReturning) {
    const table = insertMatch[1].toLowerCase();
    if (!tablesWithoutId.has(table)) {
      modifiedSql = `${sql} RETURNING id`;
    }
  }

  const res = await pool.query(modifiedSql, params);
  const id = res.rows?.[0]?.id !== undefined ? res.rows[0].id : (res.rows?.[0]?.user_id !== undefined ? res.rows[0].user_id : null);
  return { id, changes: res.rowCount };
};

export const exec = async (sql) => {
  await pool.query(sql);
};

// Execute multiple queries inside a single database transaction
export const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create scoped wrappers using the transactional client
    const txRunner = {
      query: async (sql, params = []) => {
        const res = await client.query(sql, params);
        return res.rows;
      },
      get: async (sql, params = []) => {
        const res = await client.query(sql, params);
        return res.rows[0] || null;
      },
      run: async (sql, params = []) => {
        let modifiedSql = sql;
        const insertMatch = sql.match(/^\s*INSERT\s+INTO\s+([a-zA-Z0-9_]+)/i);
        const hasReturning = /RETURNING\s+/i.test(sql);
        const tablesWithoutId = new Set(['students', 'drivers', 'admins', 'settings']);
        
        if (insertMatch && !hasReturning) {
          const table = insertMatch[1].toLowerCase();
          if (!tablesWithoutId.has(table)) {
            modifiedSql = `${sql} RETURNING id`;
          }
        }

        const res = await client.query(modifiedSql, params);
        const id = res.rows?.[0]?.id !== undefined ? res.rows[0].id : (res.rows?.[0]?.user_id !== undefined ? res.rows[0].user_id : null);
        return { id, changes: res.rowCount };
      }
    };

    const result = await callback(txRunner);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Initialize schema and seed data
export const initDatabase = async () => {
  try {
    // 1. Run schema DDL (Always ensures tables exist in PostgreSQL)
    const schemaSql = fs.readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    await pool.query(schemaSql);
    console.log('PostgreSQL database schema initialized.');

    // 1b. Migration-safe cleanup: remove duplicate attendance rows per (trip_id, student_id), keeping earliest
    try {
      await pool.query(`
        DELETE FROM attendance a USING attendance b
        WHERE a.id > b.id AND a.trip_id = b.trip_id AND a.student_id = b.student_id;
      `);
      await pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_trip_student ON attendance (trip_id, student_id);
      `);
      await pool.query(`
        ALTER TABLE trips ADD COLUMN IF NOT EXISTS direction TEXT CHECK(direction IN ('forward', 'reverse')) DEFAULT 'forward';
      `);
    } catch (migErr) {
      console.warn('Attendance unique index migration note:', migErr.message);
    }

    // 2. Guard demo seeding with SEED_DEMO_DATA flag
    if (process.env.SEED_DEMO_DATA !== 'true') {
      console.log('Demo data seeding disabled (SEED_DEMO_DATA is not set to true). Production mode active.');
      return;
    }

    // 3. Check if database is already seeded
    const usersCount = await get('SELECT COUNT(*) as count FROM users');
    if (parseInt(usersCount?.count || '0', 10) > 0) {
      console.log('Database already has data. Skipping seed.');
      return;
    }

    console.log('SEED_DEMO_DATA=true: Seeding initial demo data into PostgreSQL...');

    await withTransaction(async (tx) => {
      // 3. Seed Users with bcrypt hashed passwords
      const defaultPasswordHash = await bcrypt.hash('password123', 10);
      const seedUsers = [
        { id: 1, email: 'student1@college.edu', role: 'student' },
        { id: 2, email: 'student2@college.edu', role: 'student' },
        { id: 3, email: 'student3@college.edu', role: 'student' },
        { id: 4, email: 'student4@college.edu', role: 'student' },
        { id: 5, email: 'student5@college.edu', role: 'student' },
        { id: 6, email: 'driver1@transit.com', role: 'driver' },
        { id: 7, email: 'driver2@transit.com', role: 'driver' },
        { id: 8, email: 'admin@vesatransit.com', role: 'admin' }
      ];

      for (const u of seedUsers) {
        await tx.run(
          'INSERT INTO users (id, email, password_hash, role) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
          [u.id, u.email, defaultPasswordHash, u.role]
        );
      }
      await tx.query("SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT coalesce(max(id), 1) FROM users))");

      // 4. Seed Buses
      const seedBuses = [
        { id: 1, bus_number: 'BUS-101', capacity: 40, registration_number: 'KA-01-A-1234', insurance_expiry: '2027-12-31', status: 'active', total_mileage: 12450.5 },
        { id: 2, bus_number: 'BUS-102', capacity: 35, registration_number: 'KA-01-B-5678', insurance_expiry: '2027-10-15', status: 'active', total_mileage: 14820.2 },
        { id: 3, bus_number: 'BUS-103', capacity: 50, registration_number: 'KA-01-C-9012', insurance_expiry: '2027-06-20', status: 'active', total_mileage: 19680.8 }
      ];

      for (const b of seedBuses) {
        await tx.run(
          'INSERT INTO buses (id, bus_number, capacity, registration_number, insurance_expiry, status, total_mileage) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
          [b.id, b.bus_number, b.capacity, b.registration_number, b.insurance_expiry, b.status, b.total_mileage]
        );
      }
      await tx.query("SELECT setval(pg_get_serial_sequence('buses', 'id'), (SELECT coalesce(max(id), 1) FROM buses))");

      // 5. Seed Routes
      const seedRoutes = [
        { id: 1, name: 'Route A (North Campus Link)', start_location: 'Majestic Station', end_location: 'VESA Campus Main Gate', distance_km: 15.2, estimated_duration_mins: 45 },
        { id: 2, name: 'Route B (West City Corridor)', start_location: 'Indiranagar Metro', end_location: 'VESA Campus Main Gate', distance_km: 22.5, estimated_duration_mins: 60 }
      ];

      for (const r of seedRoutes) {
        await tx.run(
          'INSERT INTO routes (id, name, start_location, end_location, distance_km, estimated_duration_mins) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
          [r.id, r.name, r.start_location, r.end_location, r.distance_km, r.estimated_duration_mins]
        );
      }
      await tx.query("SELECT setval(pg_get_serial_sequence('routes', 'id'), (SELECT coalesce(max(id), 1) FROM routes))");

      // 6. Seed Stops
      const seedStops = [
        // Route A stops
        { id: 1, route_id: 1, name: 'Majestic Hub', latitude: 12.9716, longitude: 77.5946, sequence_order: 1, scheduled_time: '07:30 AM' },
        { id: 2, route_id: 1, name: 'Malleswaram 8th Cross', latitude: 12.9982, longitude: 77.5714, sequence_order: 2, scheduled_time: '07:42 AM' },
        { id: 3, route_id: 1, name: 'Yeshwanthpur Junction', latitude: 13.0234, longitude: 77.5501, sequence_order: 3, scheduled_time: '07:55 AM' },
        { id: 4, route_id: 1, name: 'VESA Campus Gate', latitude: 13.0601, longitude: 77.5750, sequence_order: 4, scheduled_time: '08:15 AM' },

        // Route B stops
        { id: 5, route_id: 2, name: 'Indiranagar Metro Terminal', latitude: 12.9784, longitude: 77.6408, sequence_order: 1, scheduled_time: '07:15 AM' },
        { id: 6, route_id: 2, name: 'Koramangala Sony World', latitude: 12.9348, longitude: 77.6189, sequence_order: 2, scheduled_time: '07:35 AM' },
        { id: 7, route_id: 2, name: 'HSR Ring Road', latitude: 12.9116, longitude: 77.6389, sequence_order: 3, scheduled_time: '07:50 AM' },
        { id: 8, route_id: 2, name: 'VESA Campus Gate', latitude: 13.0601, longitude: 77.5750, sequence_order: 4, scheduled_time: '08:15 AM' }
      ];

      for (const s of seedStops) {
        await tx.run(
          'INSERT INTO stops (id, route_id, name, latitude, longitude, sequence_order, scheduled_time) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING',
          [s.id, s.route_id, s.name, s.latitude, s.longitude, s.sequence_order, s.scheduled_time]
        );
      }
      await tx.query("SELECT setval(pg_get_serial_sequence('stops', 'id'), (SELECT coalesce(max(id), 1) FROM stops))");

      // 7. Seed Students
      const seedStudents = [
        { user_id: 1, name: 'Alex Mercer', roll_number: 'VESA-2024-ST01', bus_id: 1, route_id: 1, pickup_stop_id: 1, emergency_contact: '+1 555-0101', fee_status: 'paid', qr_code_pass: 'QR_PASS_ST01' },
        { user_id: 2, name: 'Sophia Sterling', roll_number: 'VESA-2024-ST02', bus_id: 1, route_id: 1, pickup_stop_id: 2, emergency_contact: '+1 555-0102', fee_status: 'partial', qr_code_pass: 'QR_PASS_ST02' },
        { user_id: 3, name: 'Liam Vance', roll_number: 'VESA-2024-ST03', bus_id: 1, route_id: 1, pickup_stop_id: 3, emergency_contact: '+1 555-0103', fee_status: 'pending', qr_code_pass: 'QR_PASS_ST03' },
        { user_id: 4, name: 'Emily Thorne', roll_number: 'VESA-2024-ST04', bus_id: 2, route_id: 2, pickup_stop_id: 6, emergency_contact: '+1 555-0104', fee_status: 'paid', qr_code_pass: 'QR_PASS_ST04' },
        { user_id: 5, name: 'Nathan Drake', roll_number: 'VESA-2024-ST05', bus_id: 2, route_id: 2, pickup_stop_id: 7, emergency_contact: '+1 555-0105', fee_status: 'pending', qr_code_pass: 'QR_PASS_ST05' }
      ];

      for (const s of seedStudents) {
        await tx.run(
          'INSERT INTO students (user_id, name, roll_number, bus_id, route_id, pickup_stop_id, emergency_contact, fee_status, qr_code_pass) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (user_id) DO NOTHING',
          [s.user_id, s.name, s.roll_number, s.bus_id, s.route_id, s.pickup_stop_id, s.emergency_contact, s.fee_status, s.qr_code_pass]
        );
      }

      // 8. Seed Drivers
      const seedDrivers = [
        { user_id: 6, name: 'David Miller', phone: '+1 555-0199', license_number: 'DL-12345678', status: 'inactive', active_bus_id: 1 },
        { user_id: 7, name: 'Robert Hook', phone: '+1 555-0188', license_number: 'DL-87654321', status: 'inactive', active_bus_id: 2 }
      ];

      for (const d of seedDrivers) {
        await tx.run(
          'INSERT INTO drivers (user_id, name, phone, license_number, status, active_bus_id) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (user_id) DO NOTHING',
          [d.user_id, d.name, d.phone, d.license_number, d.status, d.active_bus_id]
        );
      }

      // 9. Seed Admins
      await tx.run('INSERT INTO admins (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING', [8, 'System Administrator']);

      // 10. Seed Fees & Payments
      const seedFees = [
        { student_id: 1, total_amount: 5000, paid_amount: 5000, pending_amount: 0, due_date: '2026-08-15' },
        { student_id: 2, total_amount: 5000, paid_amount: 3000, pending_amount: 2000, due_date: '2026-08-15' },
        { student_id: 3, total_amount: 5000, paid_amount: 0, pending_amount: 5000, due_date: '2026-08-15' },
        { student_id: 4, total_amount: 5500, paid_amount: 5500, pending_amount: 0, due_date: '2026-08-15' },
        { student_id: 5, total_amount: 5500, paid_amount: 0, pending_amount: 5500, due_date: '2026-08-15' }
      ];

      for (const f of seedFees) {
        const res = await tx.run(
          'INSERT INTO fees (student_id, total_amount, paid_amount, pending_amount, due_date, updated_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
          [f.student_id, f.total_amount, f.paid_amount, f.pending_amount, f.due_date, 8]
        );
        
        if (f.paid_amount > 0 && res.id) {
          await tx.run(
            'INSERT INTO payments (fee_id, amount, payment_method, transaction_id, status, receipt_url) VALUES ($1, $2, $3, $4, $5, $6)',
            [res.id, f.paid_amount, 'Credit Card / Cashier', 'TXN-' + Math.floor(Math.random() * 900000 + 100000), 'success', '/receipts/' + res.id + '.pdf']
          );
        }
      }

      // 11. Seed Maintenance records
      await tx.run(
        'INSERT INTO maintenance (bus_id, service_date, description, cost, status, next_service_mileage) VALUES ($1, $2, $3, $4, $5, $6)',
        [3, '2026-04-10', 'Brake replacement and oil change', 450.00, 'completed', 20000.0]
      );

      // 12. Seed settings
      await tx.run("INSERT INTO settings (key, value) VALUES ('company_name', 'VESA Transit') ON CONFLICT (key) DO NOTHING");
      await tx.run("INSERT INTO settings (key, value) VALUES ('notification_sound', 'enabled') ON CONFLICT (key) DO NOTHING");

      // 13. Seed analytics
      const seedAnalytics = [
        { date: '2026-07-26', daily_ridership: 124, total_revenue: 1300.0, route_id: 1, delay_count: 1 },
        { date: '2026-07-27', daily_ridership: 135, total_revenue: 1450.0, route_id: 1, delay_count: 0 },
        { date: '2026-07-28', daily_ridership: 142, total_revenue: 1800.0, route_id: 2, delay_count: 2 }
      ];

      for (const a of seedAnalytics) {
        await tx.run(
          'INSERT INTO analytics (date, daily_ridership, total_revenue, route_id, delay_count) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (date) DO NOTHING',
          [a.date, a.daily_ridership, a.total_revenue, a.route_id, a.delay_count]
        );
      }
    });

    console.log('PostgreSQL database successfully seeded.');
  } catch (err) {
    console.error('Error during PostgreSQL database initialization/seeding:', {
      message: err.message,
      code: err.code,
      detail: err.detail,
      position: err.position,
      table: err.table,
      constraint: err.constraint,
      stack: err.stack
    });
  }
};

/**
 * Resolves a driver's assigned bus and real route strictly from the database relationship:
 * drivers.active_bus_id -> buses -> (active/recent trips OR students route).
 * Contains NO hardcoded numeric fallbacks.
 */
export const resolveDriverRoute = async (driverId) => {
  if (!driverId) {
    return { error: 'driverId is required', driver: null, bus: null, route: null };
  }

  const driver = await get(
    `SELECT d.*, u.email, b.bus_number, b.capacity, b.registration_number, b.status as bus_status
     FROM drivers d
     JOIN users u ON d.user_id = u.id
     LEFT JOIN buses b ON d.active_bus_id = b.id
     WHERE d.user_id = $1`,
    [driverId]
  );

  if (!driver) {
    return { error: 'Driver account not found in database', driver: null, bus: null, route: null };
  }

  if (!driver.active_bus_id || !driver.bus_number) {
    return { error: 'No bus assigned to this driver yet — contact your admin', driver, bus: null, route: null };
  }

  const bus = {
    id: driver.active_bus_id,
    bus_number: driver.bus_number,
    capacity: driver.capacity,
    registration_number: driver.registration_number,
    status: driver.bus_status
  };

  // 1. Check if there is an active or scheduled trip for this driver/bus
  const trip = await get(
    `SELECT t.route_id, r.name as route_name, r.start_location, r.end_location, r.distance_km, r.estimated_duration_mins
     FROM trips t
     JOIN routes r ON t.route_id = r.id
     WHERE (t.driver_id = $1 OR t.bus_id = $2)
     ORDER BY CASE WHEN t.status = 'active' THEN 1 WHEN t.status = 'scheduled' THEN 2 ELSE 3 END, t.id DESC
     LIMIT 1`,
    [driverId, driver.active_bus_id]
  );

  if (trip && trip.route_id) {
    const route = {
      id: trip.route_id,
      name: trip.route_name,
      start_location: trip.start_location,
      end_location: trip.end_location,
      distance_km: trip.distance_km,
      estimated_duration_mins: trip.estimated_duration_mins
    };
    return { error: null, driver, bus, route };
  }

  // 2. Check if students assigned to this bus have a designated route
  const studentRoute = await get(
    `SELECT r.id, r.name, r.start_location, r.end_location, r.distance_km, r.estimated_duration_mins
     FROM students s
     JOIN routes r ON s.route_id = r.id
     WHERE s.bus_id = $1 AND s.route_id IS NOT NULL
     LIMIT 1`,
    [driver.active_bus_id]
  );

  if (studentRoute && studentRoute.id) {
    return { error: null, driver, bus, route: studentRoute };
  }

  return { error: 'No route assigned for this bus yet — contact your admin', driver, bus, route: null };
};

export default {
  pool,
  query,
  get,
  run,
  exec,
  withTransaction,
  initDatabase,
  resolveDriverRoute
};
