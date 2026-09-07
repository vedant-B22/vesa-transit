import * as db from '../database.js';

// Check attendance scanning window (combines admin manual override and default scheduled transit window)
export async function isAttendanceScanningAllowed() {
  try {
    const setting = await db.get("SELECT value FROM settings WHERE key = 'attendance_scanning_mode'");
    const mode = setting?.value || 'auto';
    if (mode === 'active') {
      return { allowed: true, mode: 'active', message: 'Attendance scanning is manually enabled by campus administration.' };
    }
    if (mode === 'inactive') {
      return { allowed: false, mode: 'inactive', message: 'Attendance scanning is currently disabled by campus administration.' };
    }

    // Default 'auto' time window check: 07:00-09:30 AM and 04:30-07:00 PM
    const now = new Date();
    const curMins = now.getHours() * 60 + now.getMinutes();
    const morningStart = 7 * 60; // 07:00
    const morningEnd = 9 * 60 + 30; // 09:30
    const eveningStart = 16 * 60 + 30; // 16:30
    const eveningEnd = 19 * 60; // 19:00
    const isAutoWindow = (curMins >= morningStart && curMins <= morningEnd) || (curMins >= eveningStart && curMins <= eveningEnd);
    return {
      allowed: isAutoWindow,
      mode: 'auto',
      message: isAutoWindow 
        ? 'Attendance scanning is active during scheduled transit window.' 
        : 'Bus attendance scanning is outside scheduled morning (07:00–09:30 AM) and evening (04:30–07:00 PM) hours.'
    };
  } catch (e) {
    console.error('Error checking attendance scanning window:', e);
    return { allowed: true, mode: 'auto', message: 'Attendance scanning is active.' };
  }
}
