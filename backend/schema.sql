-- VESA Transit Database Schema (PostgreSQL)

-- 1. Users table (authentication and authorization)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('student', 'driver', 'admin')) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Buses table (fleet management)
CREATE TABLE IF NOT EXISTS buses (
    id SERIAL PRIMARY KEY,
    bus_number TEXT UNIQUE NOT NULL,
    capacity INTEGER NOT NULL,
    registration_number TEXT UNIQUE NOT NULL,
    insurance_expiry TEXT NOT NULL,
    status TEXT CHECK(status IN ('active', 'maintenance', 'inactive')) DEFAULT 'active',
    total_mileage DOUBLE PRECISION DEFAULT 0.0
);

-- 3. Routes table (transit lines)
CREATE TABLE IF NOT EXISTS routes (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    start_location TEXT NOT NULL,
    end_location TEXT NOT NULL,
    distance_km DOUBLE PRECISION NOT NULL,
    estimated_duration_mins INTEGER NOT NULL
);

-- 4. Stops table (route pickup/dropoff points)
CREATE TABLE IF NOT EXISTS stops (
    id SERIAL PRIMARY KEY,
    route_id INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    sequence_order INTEGER NOT NULL,
    scheduled_time TEXT NOT NULL
);

-- 5. Students table (student profiles)
CREATE TABLE IF NOT EXISTS students (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    roll_number TEXT UNIQUE NOT NULL,
    bus_id INTEGER REFERENCES buses(id) ON DELETE SET NULL,
    route_id INTEGER REFERENCES routes(id) ON DELETE SET NULL,
    pickup_stop_id INTEGER REFERENCES stops(id) ON DELETE SET NULL,
    emergency_contact TEXT NOT NULL,
    fee_status TEXT CHECK(fee_status IN ('paid', 'pending', 'partial')) DEFAULT 'pending',
    qr_code_pass TEXT UNIQUE NOT NULL
);

-- 6. Drivers table (driver profiles)
CREATE TABLE IF NOT EXISTS drivers (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    license_number TEXT UNIQUE NOT NULL,
    status TEXT CHECK(status IN ('active', 'inactive', 'on_trip')) DEFAULT 'inactive',
    active_bus_id INTEGER REFERENCES buses(id) ON DELETE SET NULL
);

-- 7. Admins table (admin profiles)
CREATE TABLE IF NOT EXISTS admins (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL
);

-- 8. Trips table (active running bus journeys)
CREATE TABLE IF NOT EXISTS trips (
    id SERIAL PRIMARY KEY,
    bus_id INTEGER NOT NULL REFERENCES buses(id),
    route_id INTEGER NOT NULL REFERENCES routes(id),
    driver_id INTEGER NOT NULL REFERENCES drivers(user_id),
    status TEXT CHECK(status IN ('scheduled', 'active', 'completed')) DEFAULT 'scheduled',
    started_at TEXT,
    ended_at TEXT,
    current_lat DOUBLE PRECISION,
    current_lng DOUBLE PRECISION,
    speed DOUBLE PRECISION DEFAULT 0.0,
    eta_mins INTEGER,
    current_stop_id INTEGER REFERENCES stops(id),
    next_stop_id INTEGER REFERENCES stops(id),
    direction TEXT CHECK(direction IN ('forward', 'reverse')) DEFAULT 'forward',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. GPS Logs table (telemetry data)
CREATE TABLE IF NOT EXISTS gps_logs (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 10. Attendance table (daily checklist verification)
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    student_id INTEGER NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
    status TEXT CHECK(status IN ('present', 'absent', 'not_coming')) DEFAULT 'absent',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_trip_student UNIQUE (trip_id, student_id)
);

-- 11. Wait Requests table (student delays requests)
CREATE TABLE IF NOT EXISTS wait_requests (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
    stop_id INTEGER NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
    trip_id INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    status TEXT CHECK(status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. Not Coming table (student daily absences)
CREATE TABLE IF NOT EXISTS not_coming (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
    date TEXT NOT NULL, -- Format: YYYY-MM-DD
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Notifications table (broadcast messages and alerts)
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    recipient_type TEXT CHECK(recipient_type IN ('all', 'route', 'bus', 'student')) NOT NULL,
    recipient_id INTEGER, -- user_id, route_id, or bus_id
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT CHECK(status IN ('unread', 'read')) DEFAULT 'unread',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. Fees table (tuition bus charges)
CREATE TABLE IF NOT EXISTS fees (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
    total_amount DOUBLE PRECISION NOT NULL,
    paid_amount DOUBLE PRECISION DEFAULT 0.0,
    pending_amount DOUBLE PRECISION NOT NULL,
    due_date TEXT NOT NULL,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 15. Payments table (fee transactions)
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    fee_id INTEGER NOT NULL REFERENCES fees(id) ON DELETE CASCADE,
    amount DOUBLE PRECISION NOT NULL,
    payment_method TEXT NOT NULL,
    transaction_id TEXT UNIQUE NOT NULL,
    status TEXT CHECK(status IN ('success', 'failed', 'pending')) DEFAULT 'success',
    receipt_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 16. Complaints table (student feedback)
CREATE TABLE IF NOT EXISTS complaints (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
    category TEXT CHECK(category IN ('complaint', 'suggestion', 'bus_issue')) NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    status TEXT CHECK(status IN ('pending', 'resolved')) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 17. Lost & Found table
CREATE TABLE IF NOT EXISTS lost_found (
    id SERIAL PRIMARY KEY,
    reporter_role TEXT CHECK(reporter_role IN ('student', 'driver', 'admin')) NOT NULL,
    reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_type TEXT CHECK(item_type IN ('lost', 'found')) NOT NULL,
    item_name TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    bus_number TEXT NOT NULL,
    date TEXT NOT NULL,
    status TEXT CHECK(status IN ('reported', 'claimed')) DEFAULT 'reported',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 18. Emergency Alerts table (SOS signals)
CREATE TABLE IF NOT EXISTS emergency_alerts (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(user_id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status TEXT CHECK(status IN ('active', 'resolved')) DEFAULT 'active',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 19. Maintenance table (vehicle servicing)
CREATE TABLE IF NOT EXISTS maintenance (
    id SERIAL PRIMARY KEY,
    bus_id INTEGER NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
    service_date TEXT NOT NULL,
    description TEXT NOT NULL,
    cost DOUBLE PRECISION NOT NULL,
    status TEXT CHECK(status IN ('pending', 'completed')) DEFAULT 'completed',
    next_service_mileage DOUBLE PRECISION NOT NULL
);

-- 20. Analytics table (aggregate ridership reports)
CREATE TABLE IF NOT EXISTS analytics (
    id SERIAL PRIMARY KEY,
    date TEXT UNIQUE NOT NULL,
    daily_ridership INTEGER DEFAULT 0,
    total_revenue DOUBLE PRECISION DEFAULT 0.0,
    route_id INTEGER REFERENCES routes(id) ON DELETE SET NULL,
    delay_count INTEGER DEFAULT 0
);

-- 21. Settings table (key-value parameters)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
