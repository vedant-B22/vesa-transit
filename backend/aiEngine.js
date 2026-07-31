import * as db from './database.js';

/**
 * AI Delay Prediction Engine
 * Calculates travel times based on distance, live speed, simulated traffic density, and weather conditions.
 */
export const predictDelay = (distanceKm, baseDurationMins, trafficFactor = 1.0, weather = 'clear') => {
  let weatherMultiplier = 1.0;
  if (weather === 'rainy') weatherMultiplier = 1.25;
  if (weather === 'heavy_rain') weatherMultiplier = 1.5;
  if (weather === 'foggy') weatherMultiplier = 1.35;

  const predictedMins = Math.round(baseDurationMins * trafficFactor * weatherMultiplier);
  const delayMins = Math.max(0, predictedMins - baseDurationMins);

  return {
    predictedDurationMins: predictedMins,
    delayMins,
    trafficLevel: trafficFactor > 1.4 ? 'Heavy' : trafficFactor > 1.15 ? 'Moderate' : 'Light',
    weatherEffect: weatherMultiplier > 1.0 ? 'Delayed due to weather conditions' : 'Normal weather'
  };
};

/**
 * Smart Route Optimization
 * If multiple students mark "Not Coming Today", optimization skips unnecessary pickup stops.
 */
export const optimizeRoute = async (tripId) => {
  // Get route and stops
  const trip = await db.get('SELECT * FROM trips WHERE id = ?', [tripId]);
  if (!trip) return null;

  const stops = await db.query(
    'SELECT * FROM stops WHERE route_id = ? ORDER BY sequence_order ASC',
    [trip.route_id]
  );

  // Get active students for this route who are NOT marked "Not Coming Today" for the current date
  const todayStr = new Date().toISOString().split('T')[0];
  const activeStudents = await db.query(
    `SELECT s.user_id, s.pickup_stop_id 
     FROM students s
     WHERE s.route_id = ? 
       AND s.user_id NOT IN (
         SELECT student_id FROM not_coming WHERE date = ?
       )`,
    [trip.route_id, todayStr]
  );

  const activeStopIds = new Set(activeStudents.map(s => s.pickup_stop_id));
  
  // VESA Gate (destination) is always active, as is the first stop (for starting reference) or active stops
  const optimizedStops = stops.map(stop => {
    // Keep first stop and last stop active
    const isTerminus = stop.sequence_order === 1 || stop.sequence_order === stops.length;
    const hasStudents = activeStopIds.has(stop.id);
    const shouldSkip = !isTerminus && !hasStudents;

    return {
      ...stop,
      skipped: shouldSkip,
      reason: shouldSkip ? 'No students boarding today' : 'Active stop'
    };
  });

  // Calculate distance savings
  let originalDistance = 0;
  let optimizedDistance = 0;
  for (let i = 0; i < stops.length; i++) {
    originalDistance += 3.0; // Simulated 3km between stops
    if (!optimizedStops[i].skipped) {
      optimizedDistance += 2.5; // Optimized path skips detours, simulating shorter trip
    }
  }

  const timeSavingsMins = Math.max(0, Math.round((stops.length - optimizedStops.filter(s => !s.skipped).length) * 5)); // 5 mins saved per skipped stop

  return {
    tripId,
    stops: optimizedStops,
    skippedStopsCount: stops.length - optimizedStops.filter(s => !s.skipped).length,
    timeSavingsMins,
    optimizedDistanceKm: Math.round(optimizedDistance * 10) / 10
  };
};

/**
 * Predictive Maintenance Engine
 * Flags vehicles needing service based on mileage thresholds and maintenance history.
 */
export const getPredictiveMaintenanceList = async () => {
  const buses = await db.query('SELECT * FROM buses');
  const recommendations = [];

  const SERVICE_INTERVAL = 10000; // Recommend service every 10k kilometers

  for (const bus of buses) {
    // Get last completed service details
    const lastService = await db.get(
      'SELECT * FROM maintenance WHERE bus_id = ? AND status = "completed" ORDER BY service_date DESC LIMIT 1',
      [bus.id]
    );

    let mileageSinceService = bus.total_mileage;
    if (lastService) {
      mileageSinceService = bus.total_mileage - (lastService.next_service_mileage - SERVICE_INTERVAL);
    }

    const currentIntervalLimit = Math.ceil(bus.total_mileage / SERVICE_INTERVAL) * SERVICE_INTERVAL;
    const remainingKm = currentIntervalLimit - bus.total_mileage;

    // Trigger warning if less than 500km remaining or if status is not 'active'
    let serviceRecommended = false;
    let priority = 'Low';
    let message = 'Vehicle operating within normal parameters.';

    if (remainingKm <= 500) {
      serviceRecommended = true;
      priority = 'High';
      message = `Vehicle is within ${Math.round(remainingKm)} km of its recommended ${currentIntervalLimit} km service interval.`;
    } else if (remainingKm <= 1500) {
      serviceRecommended = true;
      priority = 'Medium';
      message = `Service check-in recommended within ${Math.round(remainingKm)} km.`;
    }

    if (bus.status === 'maintenance') {
      serviceRecommended = true;
      priority = 'Critical';
      message = 'Bus is currently in maintenance depot.';
    }

    recommendations.push({
      busId: bus.id,
      busNumber: bus.bus_number,
      totalMileage: bus.total_mileage,
      lastServiceDate: lastService ? lastService.service_date : 'No service record',
      remainingKm: Math.max(0, Math.round(remainingKm)),
      serviceRecommended,
      priority,
      message
    });
  }

  return recommendations;
};

/**
 * AI Student Chat Assistant
 * Processes user queries using DB context and outputs personalized human-like transit responses.
 */
export const answerStudentQuery = async (studentUserId, questionText) => {
  const q = questionText.toLowerCase();
  
  // Fetch student and their assigned bus/route details
  const student = await db.get(
    `SELECT s.*, u.email, r.name as route_name, b.bus_number, b.status as bus_status, st.name as stop_name
     FROM students s
     JOIN users u ON s.user_id = u.id
     LEFT JOIN routes r ON s.route_id = r.id
     LEFT JOIN buses b ON s.bus_id = b.id
     LEFT JOIN stops st ON s.pickup_stop_id = st.id
     WHERE s.user_id = ?`,
    [studentUserId]
  );

  if (!student) {
    return "I couldn't locate your student profile. Please contact VESA Admin.";
  }

  // 1. Where is my bus / When will it arrive / Tracking queries
  if (q.includes('where') || q.includes('location') || q.includes('track') || q.includes('when') || q.includes('arrive') || q.includes('eta') || q.includes('time')) {
    // Check if there is an active trip for this bus
    const activeTrip = await db.get(
      `SELECT t.*, d.name as driver_name, d.phone as driver_phone,
              s_curr.name as current_stop_name, s_next.name as next_stop_name
       FROM trips t
       JOIN drivers d ON t.driver_id = d.user_id
       LEFT JOIN stops s_curr ON t.current_stop_id = s_curr.id
       LEFT JOIN stops s_next ON t.next_stop_id = s_next.id
       WHERE t.bus_id = ? AND t.status = "active"`,
      [student.bus_id]
    );

    if (!activeTrip) {
      return `Hi ${student.name.split(' ')[0]}! Your assigned bus **${student.bus_number}** (Route: ${student.route_name}) is currently **not on a trip**. Trips usually start at 7:30 AM for the morning route.`;
    }

    const etaText = activeTrip.eta_mins 
      ? `approx. **${activeTrip.eta_mins} minutes**` 
      : 'calculating...';
      
    const currentStopText = activeTrip.current_stop_name 
      ? `just passed **${activeTrip.current_stop_name}**`
      : 'just left the hub';

    const nextStopText = activeTrip.next_stop_name 
      ? `heading towards **${activeTrip.next_stop_name}**` 
      : 'en route to the college';

    const speedText = activeTrip.speed 
      ? `travelling at **${Math.round(activeTrip.speed)} km/h**` 
      : 'currently halted';

    return `Hi ${student.name.split(' ')[0]}! Bus **${student.bus_number}** is currently active on **${student.route_name}**. It is ${currentStopText}, ${nextStopText}, and ${speedText}. The current ETA to your pickup stop (**${student.stop_name}**) is ${etaText}. Driver **${activeTrip.driver_name}** (${activeTrip.driver_phone}) is on duty.`;
  }

  // 2. Delay query
  if (q.includes('delay') || q.includes('late') || q.includes('behind')) {
    const activeTrip = await db.get(
      `SELECT t.*, r.estimated_duration_mins
       FROM trips t
       JOIN routes r ON t.route_id = r.id
       WHERE t.bus_id = ? AND t.status = "active"`,
      [student.bus_id]
    );

    if (!activeTrip) {
      return `Your bus **${student.bus_number}** is not running right now. No delays are reported.`;
    }

    // Check if there's any active wait requests accepted which might add delay
    const acceptedDelays = await db.get(
      'SELECT COUNT(*) as count FROM wait_requests WHERE trip_id = ? AND status = "accepted"',
      [activeTrip.id]
    );

    let delayReason = "minor morning traffic";
    if (acceptedDelays.count > 0) {
      delayReason = `traffic and ${acceptedDelays.count} student delay request(s)`;
    }

    const delayMins = activeTrip.eta_mins ? Math.max(0, activeTrip.eta_mins - 10) : 0; // Simulated calculation
    if (delayMins > 0) {
      return `Yes ${student.name.split(' ')[0]}, the bus is experiencing a delay of about **${delayMins} minutes** due to ${delayReason}. We apologize for the inconvenience!`;
    } else {
      return `Good news ${student.name.split(' ')[0]}! Bus **${student.bus_number}** is running right on schedule. No delays reported!`;
    }
  }

  // 3. Fee Query
  if (q.includes('fee') || q.includes('pay') || q.includes('due') || q.includes('money') || q.includes('cost')) {
    const feeInfo = await db.get(
      'SELECT * FROM fees WHERE student_id = ?',
      [student.user_id]
    );

    if (!feeInfo) {
      return `Hi ${student.name.split(' ')[0]}, I couldn't find a fee record for your account. Please check with the finance office.`;
    }

    if (feeInfo.pending_amount === 0) {
      return `Hi ${student.name.split(' ')[0]}! Your bus fee of **$${feeInfo.total_amount}** is **Fully Paid**. You have no outstanding dues. Thank you!`;
    } else {
      return `Hi ${student.name.split(' ')[0]}. You have a pending bus fee balance of **$${feeInfo.pending_amount}** (Total fee: $${feeInfo.total_amount}, Paid: $${feeInfo.paid_amount}). The due date is **${feeInfo.due_date}**. You can make payments via the Bus Fees tab in the app.`;
    }
  }

  // 4. Route / Stop queries
  if (q.includes('route') || q.includes('stop') || q.includes('pickup') || q.includes('where do i board')) {
    const stopsList = await db.query(
      'SELECT name, scheduled_time, sequence_order FROM stops WHERE route_id = ? ORDER BY sequence_order ASC',
      [student.route_id]
    );

    const stopsString = stopsList
      .map(s => `${s.sequence_order}. ${s.name} (${s.scheduled_time})`)
      .join('\n');

    return `Hi ${student.name.split(' ')[0]}. You are assigned to **${student.route_name}** on **${student.bus_number}**.\n\nYour pickup stop is **${student.stop_name}**.\n\nHere is the full route schedule:\n${stopsString}`;
  }

  // 5. Default conversational greeting / help
  return `Hi ${student.name.split(' ')[0]}, I am the VESA Transit AI Assistant. You can ask me questions like:\n• *Where is my bus?*\n• *When will the bus arrive at my stop?*\n• *Why is the bus delayed?*\n• *What is my fee status?*\n• *Show my route timings.*`;
};
