-- VESA Transit Database Schema (SQLite)

PRAGMA foreign_keys = ON;

-- 1. Users table (authentication and authorization)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('student', 'driver', 'admin')) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Buses table (fleet management)
CREATE TABLE IF NOT EXISTS buses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bus_number TEXT UNIQUE NOT NULL,
    capacity INTEGER NOT NULL,
    registration_number TEXT UNIQUE NOT NULL,
    insurance_expiry TEXT NOT NULL,
    status TEXT CHECK(status IN ('active', 'maintenance', 'inactive')) DEFAULT 'active',
    total_mileage REAL DEFAULT 0.0
);

-- 3. Routes table (transit lines)
CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    start_location TEXT NOT NULL,
    end_location TEXT NOT NULL,
    distance_km REAL NOT NULL,
    estimated_duration_mins INTEGER NOT NULL
);

-- 4. Stops table (route pickup/dropoff points)
CREATE TABLE IF NOT EXISTS stops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    sequence_order INTEGER NOT NULL,
    scheduled_time TEXT NOT NULL,
    FOREIGN KEY(route_id) REFERENCES routes(id) ON DELETE CASCADE
);

-- 5. Students table (student profiles)
CREATE TABLE IF NOT EXISTS students (
    user_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    roll_number TEXT UNIQUE NOT NULL,
    bus_id INTEGER,
    route_id INTEGER,
    pickup_stop_id INTEGER,
    emergency_contact TEXT NOT NULL,
    fee_status TEXT CHECK(fee_status IN ('paid', 'pending', 'partial')) DEFAULT 'pending',
    qr_code_pass TEXT UNIQUE NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(bus_id) REFERENCES buses(id) ON DELETE SET NULL,
    FOREIGN KEY(route_id) REFERENCES routes(id) ON DELETE SET NULL,
    FOREIGN KEY(pickup_stop_id) REFERENCES stops(id) ON DELETE SET NULL
);

-- 6. Drivers table (driver profiles)
CREATE TABLE IF NOT EXISTS drivers (
    user_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    license_number TEXT UNIQUE NOT NULL,
    status TEXT CHECK(status IN ('active', 'inactive', 'on_trip')) DEFAULT 'inactive',
    active_bus_id INTEGER,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(active_bus_id) REFERENCES buses(id) ON DELETE SET NULL
);

-- 7. Admins table (admin profiles)
CREATE TABLE IF NOT EXISTS admins (
    user_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 8. Trips table (active running bus journeys)
CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bus_id INTEGER NOT NULL,
    route_id INTEGER NOT NULL,
    driver_id INTEGER NOT NULL,
    status TEXT CHECK(status IN ('scheduled', 'active', 'completed')) DEFAULT 'scheduled',
    started_at TEXT,
    ended_at TEXT,
    current_lat REAL,
    current_lng REAL,
    speed REAL DEFAULT 0.0,
    eta_mins INTEGER,
    current_stop_id INTEGER,
    next_stop_id INTEGER,
    FOREIGN KEY(bus_id) REFERENCES buses(id),
    FOREIGN KEY(route_id) REFERENCES routes(id),
    FOREIGN KEY(driver_id) REFERENCES drivers(user_id),
    FOREIGN KEY(current_stop_id) REFERENCES stops(id),
    FOREIGN KEY(next_stop_id) REFERENCES stops(id)
);

-- 9. GPS Logs table (telemetry data)
CREATE TABLE IF NOT EXISTS gps_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    speed REAL NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

-- 10. Attendance table (daily checklist verification)
CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL,
    student_id INTEGER NOT NULL,
    status TEXT CHECK(status IN ('present', 'absent', 'not_coming')) DEFAULT 'absent',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(trip_id) REFERENCES trips(id) ON DELETE CASCADE,
    FOREIGN KEY(student_id) REFERENCES students(user_id) ON DELETE CASCADE
);

-- 11. Wait Requests table (student delays requests)
CREATE TABLE IF NOT EXISTS wait_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    stop_id INTEGER NOT NULL,
    trip_id INTEGER NOT NULL,
    status TEXT CHECK(status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(user_id) ON DELETE CASCADE,
    FOREIGN KEY(stop_id) REFERENCES stops(id) ON DELETE CASCADE,
    FOREIGN KEY(trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

-- 12. Not Coming table (student daily absences)
CREATE TABLE IF NOT EXISTS not_coming (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    date TEXT NOT NULL, -- Format: YYYY-MM-DD
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(user_id) ON DELETE CASCADE
);

-- 13. Notifications table (broadcast messages and alerts)
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipient_type TEXT CHECK(recipient_type IN ('all', 'route', 'bus', 'student')) NOT NULL,
    recipient_id INTEGER, -- user_id, route_id, or bus_id
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT CHECK(status IN ('unread', 'read')) DEFAULT 'unread',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. Fees table (tuition bus charges)
CREATE TABLE IF NOT EXISTS fees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    paid_amount REAL DEFAULT 0.0,
    pending_amount REAL NOT NULL,
    due_date TEXT NOT NULL,
    FOREIGN KEY(student_id) REFERENCES students(user_id) ON DELETE CASCADE
);

-- 15. Payments table (fee transactions)
CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fee_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    transaction_id TEXT UNIQUE NOT NULL,
    status TEXT CHECK(status IN ('success', 'failed', 'pending')) DEFAULT 'success',
    receipt_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(fee_id) REFERENCES fees(id) ON DELETE CASCADE
);

-- 16. Complaints table (student feedback)
CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    category TEXT CHECK(category IN ('complaint', 'suggestion', 'bus_issue')) NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    status TEXT CHECK(status IN ('pending', 'resolved')) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(user_id) ON DELETE CASCADE
);

-- 17. Lost & Found table
CREATE TABLE IF NOT EXISTS lost_found (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_role TEXT CHECK(reporter_role IN ('student', 'driver', 'admin')) NOT NULL,
    reporter_id INTEGER NOT NULL,
    item_type TEXT CHECK(item_type IN ('lost', 'found')) NOT NULL,
    item_name TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    bus_number TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT CHECK(status IN ('reported', 'claimed')) DEFAULT 'reported',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(reporter_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 18. Emergency Alerts table (SOS signals)
CREATE TABLE IF NOT EXISTS emergency_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    status TEXT CHECK(status IN ('active', 'resolved')) DEFAULT 'active',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(student_id) REFERENCES students(user_id) ON DELETE CASCADE
);

-- 19. Maintenance table (vehicle servicing)
CREATE TABLE IF NOT EXISTS maintenance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bus_id INTEGER NOT NULL,
    service_date TEXT NOT NULL,
    description TEXT NOT NULL,
    cost REAL NOT NULL,
    status TEXT CHECK(status IN ('pending', 'completed')) DEFAULT 'completed',
    next_service_mileage REAL NOT NULL,
    FOREIGN KEY(bus_id) REFERENCES buses(id) ON DELETE CASCADE
);

-- 20. Analytics table (aggregate ridership reports)
CREATE TABLE IF NOT EXISTS analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE NOT NULL,
    daily_ridership INTEGER DEFAULT 0,
    total_revenue REAL DEFAULT 0.0,
    route_id INTEGER,
    delay_count INTEGER DEFAULT 0,
    FOREIGN KEY(route_id) REFERENCES routes(id) ON DELETE SET NULL
);

-- 21. Settings table (key-value parameters)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
