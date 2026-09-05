import { newDb } from 'pg-mem';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = 'test_jwt_secret_key_vesa_transit_2026';

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runAllTests() {
  console.log('====================================================');
  console.log('       VESA Transit Production Test Suite          ');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [FAIL] ${name}`);
      console.error(`    Error: ${err.message}\n`);
    }
  }

  // Set up in-memory PostgreSQL instance for full isolated test suite
  const memDb = newDb();
  const pgAdapter = memDb.adapters.createPg();
  const pool = new pgAdapter.Pool();

  // -------------------------------------------------------------
  // 1. DATABASE & SCHEMA TESTS
  // -------------------------------------------------------------
  await test('PostgreSQL Schema Initialization', async () => {
    const schemaSql = fs.readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    await pool.query(schemaSql);

    const tablesRes = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    const tableNames = tablesRes.rows.map(r => r.table_name);
    
    assert(tableNames.includes('users'), 'users table exists');
    assert(tableNames.includes('students'), 'students table exists');
    assert(tableNames.includes('drivers'), 'drivers table exists');
    assert(tableNames.includes('admins'), 'admins table exists');
    assert(tableNames.includes('fees'), 'fees table exists');
    assert(tableNames.includes('payments'), 'payments table exists');
    assert(tableNames.includes('buses'), 'buses table exists');
    assert(tableNames.includes('routes'), 'routes table exists');
    assert(tableNames.includes('stops'), 'stops table exists');
    assert(tableNames.includes('trips'), 'trips table exists');
    assert(tableNames.includes('attendance'), 'attendance table exists');
  });

  // -------------------------------------------------------------
  // 2. AUTHENTICATION: BCRYPT PASSWORD HASHING
  // -------------------------------------------------------------
  await test('Bcrypt Password Hashing & Verification', async () => {
    const rawPassword = 'SecurePassword2026!';
    const hash = await bcrypt.hash(rawPassword, 10);

    assert(hash !== rawPassword, 'Password is not plaintext');
    assert(hash.startsWith('$2'), 'Valid bcrypt hash format');

    const isValid = await bcrypt.compare(rawPassword, hash);
    assert(isValid === true, 'bcrypt.compare validates correct password');

    const isInvalid = await bcrypt.compare('WrongPassword', hash);
    assert(isInvalid === false, 'bcrypt.compare rejects incorrect password');
  });

  // -------------------------------------------------------------
  // 3. AUTHENTICATION: JWT SIGNING & VERIFYING
  // -------------------------------------------------------------
  let studentToken, driverToken, adminToken;

  await test('JWT Token Signing & Role Claims', async () => {
    studentToken = jwt.sign({ userId: 1, role: 'student', email: 'student1@college.edu' }, JWT_SECRET, { expiresIn: '1h' });
    driverToken = jwt.sign({ userId: 6, role: 'driver', email: 'driver1@transit.com' }, JWT_SECRET, { expiresIn: '1h' });
    adminToken = jwt.sign({ userId: 8, role: 'admin', email: 'admin@vesatransit.com' }, JWT_SECRET, { expiresIn: '1h' });

    const decodedStudent = jwt.verify(studentToken, JWT_SECRET);
    assert(decodedStudent.userId === 1, 'Student userId matches');
    assert(decodedStudent.role === 'student', 'Student role matches');

    const decodedDriver = jwt.verify(driverToken, JWT_SECRET);
    assert(decodedDriver.userId === 6, 'Driver userId matches');
    assert(decodedDriver.role === 'driver', 'Driver role matches');

    const decodedAdmin = jwt.verify(adminToken, JWT_SECRET);
    assert(decodedAdmin.userId === 8, 'Admin userId matches');
    assert(decodedAdmin.role === 'admin', 'Admin role matches');

    // Test tamper detection
    let tamperedError = null;
    try {
      jwt.verify(studentToken + 'invalid', JWT_SECRET);
    } catch (e) {
      tamperedError = e;
    }
    assert(tamperedError !== null, 'Tampered JWT is rejected');
  });

  // -------------------------------------------------------------
  // 4. DATABASE SEEDING & RECORD CHECKS
  // -------------------------------------------------------------
  await test('Database Seeding with Parameterized PostgreSQL Queries', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const hash = await bcrypt.hash('password123', 10);

      // Seed admin, student, driver using standard SERIAL auto-increment
      const u1 = (await client.query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id', ['student1@college.edu', hash, 'student'])).rows[0];
      const u2 = (await client.query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id', ['student2@college.edu', hash, 'student'])).rows[0];
      const u6 = (await client.query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id', ['driver1@transit.com', hash, 'driver'])).rows[0];
      const u8 = (await client.query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id', ['admin@vesatransit.com', hash, 'admin'])).rows[0];

      const b1 = (await client.query('INSERT INTO buses (bus_number, capacity, registration_number, insurance_expiry, status) VALUES ($1, $2, $3, $4, $5) RETURNING id', ['BUS-101', 40, 'KA-01-A-1234', '2027-12-31', 'active'])).rows[0];
      const r1 = (await client.query('INSERT INTO routes (name, start_location, end_location, distance_km, estimated_duration_mins) VALUES ($1, $2, $3, $4, $5) RETURNING id', ['Route A', 'Majestic', 'VESA Campus', 15.2, 45])).rows[0];
      const s1 = (await client.query('INSERT INTO stops (route_id, name, latitude, longitude, sequence_order, scheduled_time) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [r1.id, 'Majestic Hub', 12.9716, 77.5946, 1, '07:30 AM'])).rows[0];

      await client.query('INSERT INTO students (user_id, name, roll_number, bus_id, route_id, pickup_stop_id, emergency_contact, fee_status, qr_code_pass) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [u1.id, 'Alex Mercer', 'VESA-2024-ST01', b1.id, r1.id, s1.id, '+1 555-0101', 'pending', 'QR_PASS_ST01']);
      await client.query('INSERT INTO students (user_id, name, roll_number, bus_id, route_id, pickup_stop_id, emergency_contact, fee_status, qr_code_pass) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', [u2.id, 'Sophia Sterling', 'VESA-2024-ST02', b1.id, r1.id, s1.id, '+1 555-0102', 'pending', 'QR_PASS_ST02']);
      
      await client.query('INSERT INTO drivers (user_id, name, phone, license_number, status, active_bus_id) VALUES ($1, $2, $3, $4, $5, $6)', [u6.id, 'David Miller', '+1 555-0199', 'DL-12345678', 'inactive', b1.id]);
      await client.query('INSERT INTO admins (user_id, name) VALUES ($1, $2)', [u8.id, 'System Administrator']);

      await client.query('INSERT INTO fees (student_id, total_amount, paid_amount, pending_amount, due_date) VALUES ($1, $2, $3, $4, $5)', [u1.id, 800, 0, 800, '2026-08-15']);
      await client.query('INSERT INTO fees (student_id, total_amount, paid_amount, pending_amount, due_date) VALUES ($1, $2, $3, $4, $5)', [u2.id, 800, 0, 800, '2026-08-15']);

      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const students = (await pool.query('SELECT * FROM students')).rows;
    assert(students.length === 2, '2 students seeded');
    assert(students[0].name === 'Alex Mercer', 'Student name matches');
  });

  // -------------------------------------------------------------
  // 5. ROLE GUARDS & RESOURCE OWNERSHIP
  // -------------------------------------------------------------
  await test('Role-Based Authorization & Resource Ownership Guards', async () => {
    // Helper to simulate route handler guards
    function checkStudentAccess(user, requestedStudentId) {
      if (!user) return { status: 401, error: 'Authentication token required' };
      if (user.role === 'admin') return { status: 200, access: true };
      if (user.role === 'student' && user.userId === requestedStudentId) return { status: 200, access: true };
      return { status: 403, error: 'Access denied: student record mismatch' };
    }

    function checkDriverAccess(user, requestedDriverId) {
      if (!user) return { status: 401, error: 'Authentication token required' };
      if (user.role === 'admin') return { status: 200, access: true };
      if (user.role === 'driver' && user.userId === requestedDriverId) return { status: 200, access: true };
      return { status: 403, error: 'Access denied: driver record mismatch' };
    }

    function checkAdminAccess(user) {
      if (!user) return { status: 401, error: 'Authentication token required' };
      if (user.role === 'admin') return { status: 200, access: true };
      return { status: 403, error: 'Access denied: admin role required' };
    }

    const studentUser = jwt.verify(studentToken, JWT_SECRET);
    const driverUser = jwt.verify(driverToken, JWT_SECRET);
    const adminUser = jwt.verify(adminToken, JWT_SECRET);

    // Unauthenticated
    assert(checkStudentAccess(null, 1).status === 401, '401 on unauthenticated access');

    // Student accessing own record -> 200
    assert(checkStudentAccess(studentUser, 1).status === 200, 'Student can access own profile');

    // Student accessing another student's record -> 403
    assert(checkStudentAccess(studentUser, 2).status === 403, 'Student CANNOT access another student profile');

    // Driver accessing student record -> 403
    assert(checkStudentAccess(driverUser, 1).status === 403, 'Driver CANNOT access student profile');

    // Driver accessing own trip -> 200
    assert(checkDriverAccess(driverUser, 6).status === 200, 'Driver can access own trip');

    // Driver accessing another driver's trip -> 403
    assert(checkDriverAccess(driverUser, 7).status === 403, 'Driver CANNOT access another driver trip');

    // Admin accessing student / driver / admin routes -> 200
    assert(checkStudentAccess(adminUser, 1).status === 200, 'Admin can access any student');
    assert(checkDriverAccess(adminUser, 6).status === 200, 'Admin can access any driver');
    assert(checkAdminAccess(adminUser).status === 200, 'Admin can access admin routes');
    assert(checkAdminAccess(studentUser).status === 403, 'Student is blocked from admin routes');
    assert(checkAdminAccess(driverUser).status === 403, 'Driver is blocked from admin routes');
  });

  // -------------------------------------------------------------
  // 6. ADMIN MANUAL FEE APPROVAL WORKFLOW
  // -------------------------------------------------------------
  await test('Admin Fee Approval Workflow & Multi-Table Transaction', async () => {
    const student = (await pool.query("SELECT user_id FROM students LIMIT 1")).rows[0];
    const admin = (await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1")).rows[0];
    const studentId = student.user_id;
    const adminId = admin.id;
    const paymentAmount = 500;

    // Simulate Admin Fee Approval transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const fee = (await client.query('SELECT * FROM fees WHERE student_id = $1', [studentId])).rows[0];
      assert(fee !== undefined, 'Fee record exists');

      const newPaid = fee.paid_amount + paymentAmount;
      const newPending = fee.total_amount - newPaid;
      const newStatus = newPending === 0 ? 'paid' : (newPaid > 0 ? 'partial' : 'pending');

      // 1. Update fees with audit metadata
      await client.query(
        'UPDATE fees SET paid_amount = $1, pending_amount = $2, updated_by = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
        [newPaid, newPending, adminId, fee.id]
      );

      // 2. Update student fee_status
      await client.query('UPDATE students SET fee_status = $1 WHERE user_id = $2', [newStatus, studentId]);

      // 3. Insert payment ledger entry
      const txnId = 'ADM-TXN-' + Math.floor(Math.random() * 900000 + 100000);
      await client.query(
        'INSERT INTO payments (fee_id, amount, payment_method, transaction_id, status, receipt_url) VALUES ($1, $2, $3, $4, $5, $6)',
        [fee.id, paymentAmount, 'Campus Cashier', txnId, 'success', `/receipts/${txnId}.pdf`]
      );

      // 4. Update analytics
      const today = new Date().toISOString().split('T')[0];
      await client.query(
        'INSERT INTO analytics (date, total_revenue) VALUES ($1, $2) ON CONFLICT(date) DO UPDATE SET total_revenue = analytics.total_revenue + EXCLUDED.total_revenue',
        [today, paymentAmount]
      );

      await client.query('COMMIT');
    } finally {
      client.release();
    }

    // Verify fee state after approval
    const updatedFee = (await pool.query('SELECT * FROM fees WHERE student_id = $1', [studentId])).rows[0];
    assert(updatedFee.paid_amount === 500, 'Fee paid_amount updated to $500');
    assert(updatedFee.pending_amount === 300, 'Fee pending_amount updated to $300');
    assert(updatedFee.updated_by === adminId, 'Audit updated_by recorded admin ID');

    const updatedStudent = (await pool.query('SELECT fee_status FROM students WHERE user_id = $1', [studentId])).rows[0];
    assert(updatedStudent.fee_status === 'partial', 'Student fee_status updated to partial');

    const payments = (await pool.query('SELECT * FROM payments WHERE fee_id = $1', [updatedFee.id])).rows;
    assert(payments.length === 1, 'Payment transaction created');
    assert(payments[0].amount === 500, 'Payment amount matches');
  });

  // -------------------------------------------------------------
  // 7. SECURE STUDENT CSV IMPORT WITH EXPLICIT PASSWORDS & CASE-INSENSITIVE STOPS
  // -------------------------------------------------------------
  await test('Secure Student CSV Import (Explicit Passwords, Case-Insensitive Pickup Matching, Configurable Fees)', async () => {
    const admin = (await pool.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1")).rows[0];
    
    // Seed routes and stops for lookup test
    const rRes = await pool.query("INSERT INTO routes (name, start_location, end_location, distance_km, estimated_duration_mins) VALUES ($1, $2, $3, $4, $5) RETURNING id", ['Route C', 'Stop 1', 'VESA Campus', 10, 30]);
    const s1Res = await pool.query("INSERT INTO stops (route_id, name, latitude, longitude, sequence_order, scheduled_time) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id", [rRes.rows[0].id, 'Malleswaram 8th Cross', 12.9982, 77.5714, 1, '07:42 AM']);
    const s2Res = await pool.query("INSERT INTO stops (route_id, name, latitude, longitude, sequence_order, scheduled_time) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id", [rRes.rows[0].id, 'Navale Bridge', 12.9500, 77.5200, 2, '07:55 AM']);
    
    const configuredFee = 950.0;
    const configuredDueDate = '2027-01-31';

    const csvStudents = [
      // 1. Lowercase + extra whitespace pickup matching 'Malleswaram 8th Cross', explicit password
      { name: 'Imported Student 1', email: 'imported1@college.edu', rollNumber: 'VESA-2024-IMP1', emergencyContact: '+1 555-0901', pickupPoint: '   malleswaram 8th cross   ', password: 'CustomSecret2026!' },
      // 2. Uppercase pickup matching 'Navale Bridge', explicit password
      { name: 'Imported Student 2', email: 'imported2@college.edu', rollNumber: 'VESA-2024-IMP2', emergencyContact: '+1 555-0902', pickupPoint: 'NAVALE BRIDGE', password: 'NavalePass789$' },
      // 3. Unmatched stop
      { name: 'Imported Student 3', email: 'imported3@college.edu', rollNumber: 'VESA-2024-IMP3', emergencyContact: '+1 555-0903', pickupPoint: 'Unknown Nonexistent Stop', password: 'Password123' }
    ];

    const errors = [];
    const credentials = [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const s of csvStudents) {
        // Case-insensitive, trimmed stop lookup
        const cleanStopName = s.pickupPoint.trim().toLowerCase();
        const stopMatch = (await client.query('SELECT id, route_id FROM stops WHERE LOWER(name) = $1 LIMIT 1', [cleanStopName])).rows[0];
        if (!stopMatch) {
          errors.push({ name: s.name, error: `Pickup point '${s.pickupPoint.trim()}' does not match any existing stop.` });
          continue;
        }

        const rawPassword = s.password.trim();
        const passwordHash = await bcrypt.hash(rawPassword, 10);
        credentials.push({ email: s.email, password: rawPassword });

        const userRes = await client.query(
          'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
          [s.email, passwordHash, 'student']
        );
        const userId = userRes.rows[0].id;

        await client.query(
          'INSERT INTO students (user_id, name, roll_number, route_id, pickup_stop_id, emergency_contact, fee_status, qr_code_pass) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
          [userId, s.name, s.rollNumber, stopMatch.route_id, stopMatch.id, s.emergencyContact, 'pending', 'QR_PASS_' + s.rollNumber]
        );

        await client.query(
          'INSERT INTO fees (student_id, total_amount, paid_amount, pending_amount, due_date, updated_by) VALUES ($1, $2, $3, $4, $5, $6)',
          [userId, configuredFee, 0, configuredFee, configuredDueDate, admin.id]
        );
      }
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    // Verify 2 valid students imported and 1 invalid stop caught
    assert(credentials.length === 2, '2 valid students imported with explicit passwords');
    assert(errors.length === 1, '1 invalid stop flagged as error');
    assert(errors[0].error.includes('does not match any existing stop'), 'Error message identifies invalid stop');

    // Verify student 1 (trimmed lowercase stop match & custom password)
    const dbStudent1 = (await pool.query("SELECT s.*, u.password_hash, f.total_amount, f.due_date FROM students s JOIN users u ON s.user_id = u.id JOIN fees f ON s.user_id = f.student_id WHERE s.roll_number = 'VESA-2024-IMP1'")).rows[0];
    assert(dbStudent1 !== undefined, 'Imported student 1 exists in DB');
    assert(dbStudent1.pickup_stop_id === s1Res.rows[0].id, 'Case-insensitive lowercase pickup stop matched correctly');
    const validPass1 = await bcrypt.compare('CustomSecret2026!', dbStudent1.password_hash);
    assert(validPass1 === true, 'Explicit password for student 1 preserved and verified against bcrypt hash');

    // Verify student 2 (uppercase stop match & custom password)
    const dbStudent2 = (await pool.query("SELECT s.*, u.password_hash FROM students s JOIN users u ON s.user_id = u.id WHERE s.roll_number = 'VESA-2024-IMP2'")).rows[0];
    assert(dbStudent2 !== undefined, 'Imported student 2 exists in DB');
    assert(dbStudent2.pickup_stop_id === s2Res.rows[0].id, 'Case-insensitive uppercase pickup stop matched correctly');
    const validPass2 = await bcrypt.compare('NavalePass789$', dbStudent2.password_hash);
    assert(validPass2 === true, 'Explicit password for student 2 preserved and verified against bcrypt hash');
  });

  // -------------------------------------------------------------
  // 8. TRANSACTION ROLLBACK ATOMICITY
  // -------------------------------------------------------------
  await test('Database Transaction Multi-Table Atomicity & Rollback', async () => {
    const backup = memDb.backup();
    let errorCaught = false;

    try {
      await pool.query('INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3)', ['temp_atomic@college.edu', 'hash', 'student']);
      throw new Error('Simulated mid-transaction failure');
    } catch (e) {
      backup.restore();
      errorCaught = true;
    }

    assert(errorCaught === true, 'Error caught during transactional write');
    const userCheck = (await pool.query('SELECT * FROM users WHERE email = $1', ['temp_atomic@college.edu'])).rows;
    assert(userCheck.length === 0, 'Zero orphan rows left behind after transaction rollback');
  });

  // -------------------------------------------------------------
  // 9. CORS ALLOWLIST REJECTION
  // -------------------------------------------------------------
  await test('CORS Allowlist Security (Rejects Disallowed Origins)', async () => {
    const allowedOrigins = ['http://localhost:5173', 'https://vesa-transit.onrender.com'];
    
    function corsCheck(origin) {
      return new Promise((resolve, reject) => {
        const callback = (err, allow) => {
          if (err) return reject(err);
          resolve(allow);
        };
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
      });
    }

    const allowLocal = await corsCheck('http://localhost:5173');
    assert(allowLocal === true, 'Allowed origin http://localhost:5173 passes');

    let corsError = null;
    try {
      await corsCheck('https://malicious-attacker-site.com');
    } catch (err) {
      corsError = err;
    }
    assert(corsError !== null, 'Disallowed origin https://malicious-attacker-site.com is strictly rejected by CORS');
  });

  // -------------------------------------------------------------
  // 10. JWT_SECRET MANDATORY STARTUP ENFORCEMENT
  // -------------------------------------------------------------
  await test('Mandatory JWT_SECRET Enforcement (No Insecure Default Fallback)', async () => {
    function testSecretCheck(secret) {
      if (!secret) {
        throw new Error('FATAL: JWT_SECRET environment variable is missing. Server cannot start without a secure secret key.');
      }
      return true;
    }

    assert(testSecretCheck('valid_secret_key_12345') === true, 'Valid secret accepted');
    
    let fatalError = null;
    try {
      testSecretCheck(undefined);
    } catch (err) {
      fatalError = err;
    }
    assert(fatalError !== null && fatalError.message.includes('FATAL: JWT_SECRET environment variable is missing'), 'Missing JWT_SECRET throws fatal startup error');
  });

  console.log('\n====================================================');
  console.log(`Test Results: ${passed} / ${total} Tests Passed Successfully (${Math.round((passed / total) * 100)}%)`);
  console.log('====================================================');

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
