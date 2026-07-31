import * as db from './database.js';

async function runTests() {
  console.log('--- VESA Transit Backend Test Runner ---');
  try {
    // 1. Initialize and seed DB
    await db.initDatabase();
    console.log('✓ Database initialization pass.');

    // 2. Query Students
    const students = await db.query('SELECT name, roll_number, fee_status FROM students');
    console.log(`✓ Fetched ${students.length} students:`);
    students.forEach(s => console.log(`  - ${s.name} (${s.roll_number}) - Fees: ${s.fee_status}`));

    // 3. Query Buses
    const buses = await db.query('SELECT bus_number, status, total_mileage FROM buses');
    console.log(`✓ Fetched ${buses.length} buses:`);
    buses.forEach(b => console.log(`  - ${b.bus_number} - Status: ${b.status} - Mileage: ${b.total_mileage} km`));

    // 4. Query Routes & Stops
    const routes = await db.query('SELECT name, distance_km FROM routes');
    console.log(`✓ Fetched ${routes.length} routes:`);
    routes.forEach(r => console.log(`  - ${r.name} - ${r.distance_km} km`));

    // 5. Query active/scheduled trips
    const trips = await db.query('SELECT id, status FROM trips');
    console.log(`✓ Active/Scheduled trips: ${trips.length}`);

    console.log('\n--- ALL TEST CHECKS PASSED SUCCESSFULLY ---');
    process.exit(0);
  } catch (err) {
    console.error('✗ Backend tests failed with error:', err);
    process.exit(1);
  }
}

runTests();
