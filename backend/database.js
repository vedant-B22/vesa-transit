import sqlite3 from 'sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'vesa_transit.db');

// Create SQLite Database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening SQLite database:', err.message);
  } else {
    console.log('Connected to the SQLite database at:', dbPath);
  }
});

// Wrap DB methods in Promises for async/await usage
export const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

export const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const exec = (sql) => {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

// Initialize schema and seed data
export const initDatabase = async () => {
  try {
    // 1. Run schema DDL
    const schemaSql = fs.readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    await exec(schemaSql);
    console.log('Database tables successfully initialized.');

    // 2. Check if database is already seeded
    const usersCount = await get('SELECT COUNT(*) as count FROM users');
    if (usersCount.count > 0) {
      console.log('Database already has data. Skipping seed.');
      return;
    }

    console.log('Seeding initial data...');

    // 3. Seed Users
    // Hash password is plain text for this demo backend
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
      await run(
        'INSERT INTO users (id, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [u.id, u.email, 'password123', u.role]
      );
    }

    // 4. Seed Buses
    const seedBuses = [
      { id: 1, bus_number: 'BUS-101', capacity: 40, registration_number: 'KA-01-A-1234', insurance_expiry: '2027-12-31', status: 'active', total_mileage: 12450.5 },
      { id: 2, bus_number: 'BUS-102', capacity: 35, registration_number: 'KA-01-B-5678', insurance_expiry: '2027-10-15', status: 'active', total_mileage: 14820.2 },
      { id: 3, bus_number: 'BUS-103', capacity: 50, registration_number: 'KA-01-C-9012', insurance_expiry: '2027-06-20', status: 'active', total_mileage: 19680.8 } // triggers predictive maintenance alert soon
    ];

    for (const b of seedBuses) {
      await run(
        'INSERT INTO buses (id, bus_number, capacity, registration_number, insurance_expiry, status, total_mileage) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [b.id, b.bus_number, b.capacity, b.registration_number, b.insurance_expiry, b.status, b.total_mileage]
      );
    }

    // 5. Seed Routes
    const seedRoutes = [
      { id: 1, name: 'Route A (North Campus Link)', start_location: 'Majestic Station', end_location: 'VESA Campus Main Gate', distance_km: 15.2, estimated_duration_mins: 45 },
      { id: 2, name: 'Route B (West City Corridor)', start_location: 'Indiranagar Metro', end_location: 'VESA Campus Main Gate', distance_km: 22.5, estimated_duration_mins: 60 }
    ];

    for (const r of seedRoutes) {
      await run(
        'INSERT INTO routes (id, name, start_location, end_location, distance_km, estimated_duration_mins) VALUES (?, ?, ?, ?, ?, ?)',
        [r.id, r.name, r.start_location, r.end_location, r.distance_km, r.estimated_duration_mins]
      );
    }

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
      await run(
        'INSERT INTO stops (id, route_id, name, latitude, longitude, sequence_order, scheduled_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [s.id, s.route_id, s.name, s.latitude, s.longitude, s.sequence_order, s.scheduled_time]
      );
    }

    // 7. Seed Students
    const seedStudents = [
      { user_id: 1, name: 'Alex Mercer', roll_number: 'VESA-2024-ST01', bus_id: 1, route_id: 1, pickup_stop_id: 1, emergency_contact: '+1 555-0101', fee_status: 'paid', qr_code_pass: 'QR_PASS_ST01' },
      { user_id: 2, name: 'Sophia Sterling', roll_number: 'VESA-2024-ST02', bus_id: 1, route_id: 1, pickup_stop_id: 2, emergency_contact: '+1 555-0102', fee_status: 'partial', qr_code_pass: 'QR_PASS_ST02' },
      { user_id: 3, name: 'Liam Vance', roll_number: 'VESA-2024-ST03', bus_id: 1, route_id: 1, pickup_stop_id: 3, emergency_contact: '+1 555-0103', fee_status: 'pending', qr_code_pass: 'QR_PASS_ST03' },
      { user_id: 4, name: 'Emily Thorne', roll_number: 'VESA-2024-ST04', bus_id: 2, route_id: 2, pickup_stop_id: 6, emergency_contact: '+1 555-0104', fee_status: 'paid', qr_code_pass: 'QR_PASS_ST04' },
      { user_id: 5, name: 'Nathan Drake', roll_number: 'VESA-2024-ST05', bus_id: 2, route_id: 2, pickup_stop_id: 7, emergency_contact: '+1 555-0105', fee_status: 'pending', qr_code_pass: 'QR_PASS_ST05' }
    ];

    for (const s of seedStudents) {
      await run(
        'INSERT INTO students (user_id, name, roll_number, bus_id, route_id, pickup_stop_id, emergency_contact, fee_status, qr_code_pass) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [s.user_id, s.name, s.roll_number, s.bus_id, s.route_id, s.pickup_stop_id, s.emergency_contact, s.fee_status, s.qr_code_pass]
      );
    }

    // 8. Seed Drivers
    const seedDrivers = [
      { user_id: 6, name: 'David Miller', phone: '+1 555-0199', license_number: 'DL-12345678', status: 'inactive', active_bus_id: 1 },
      { user_id: 7, name: 'Robert Hook', phone: '+1 555-0188', license_number: 'DL-87654321', status: 'inactive', active_bus_id: 2 }
    ];

    for (const d of seedDrivers) {
      await run(
        'INSERT INTO drivers (user_id, name, phone, license_number, status, active_bus_id) VALUES (?, ?, ?, ?, ?, ?)',
        [d.user_id, d.name, d.phone, d.license_number, d.status, d.active_bus_id]
      );
    }

    // 9. Seed Admins
    await run('INSERT INTO admins (user_id, name) VALUES (?, ?)', [8, 'System Administrator']);

    // 10. Seed Fees & Payments
    const seedFees = [
      { student_id: 1, total_amount: 800, paid_amount: 800, pending_amount: 0, due_date: '2026-08-15' },
      { student_id: 2, total_amount: 800, paid_amount: 500, pending_amount: 300, due_date: '2026-08-15' },
      { student_id: 3, total_amount: 800, paid_amount: 0, pending_amount: 800, due_date: '2026-08-15' },
      { student_id: 4, total_amount: 950, paid_amount: 950, pending_amount: 0, due_date: '2026-08-15' },
      { student_id: 5, total_amount: 950, paid_amount: 0, pending_amount: 950, due_date: '2026-08-15' }
    ];

    for (const f of seedFees) {
      const res = await run(
        'INSERT INTO fees (student_id, total_amount, paid_amount, pending_amount, due_date) VALUES (?, ?, ?, ?, ?)',
        [f.student_id, f.total_amount, f.paid_amount, f.pending_amount, f.due_date]
      );
      
      if (f.paid_amount > 0) {
        await run(
          'INSERT INTO payments (fee_id, amount, payment_method, transaction_id, status, receipt_url) VALUES (?, ?, ?, ?, ?, ?)',
          [res.id, f.paid_amount, 'Credit Card', 'TXN-' + Math.floor(Math.random() * 900000 + 100000), 'success', '/receipts/' + res.id + '.pdf']
        );
      }
    }

    // 11. Seed Maintenance records
    await run(
      'INSERT INTO maintenance (bus_id, service_date, description, cost, status, next_service_mileage) VALUES (?, ?, ?, ?, ?, ?)',
      [3, '2026-04-10', 'Brake replacement and oil change', 450.00, 'completed', 20000.0]
    );

    // 12. Seed settings
    await run("INSERT INTO settings (key, value) VALUES ('company_name', 'VESA Transit')");
    await run("INSERT INTO settings (key, value) VALUES ('notification_sound', 'enabled')");

    // 13. Seed analytics
    const seedAnalytics = [
      { date: '2026-07-26', daily_ridership: 124, total_revenue: 1300.0, route_id: 1, delay_count: 1 },
      { date: '2026-07-27', daily_ridership: 135, total_revenue: 1450.0, route_id: 1, delay_count: 0 },
      { date: '2026-07-28', daily_ridership: 142, total_revenue: 1800.0, route_id: 2, delay_count: 2 }
    ];

    for (const a of seedAnalytics) {
      await run(
        'INSERT INTO analytics (date, daily_ridership, total_revenue, route_id, delay_count) VALUES (?, ?, ?, ?, ?)',
        [a.date, a.daily_ridership, a.total_revenue, a.route_id, a.delay_count]
      );
    }

    console.log('Database successfully seeded.');
  } catch (err) {
    console.error('Error during database initialization/seeding:', err);
  }
};
export default db;
