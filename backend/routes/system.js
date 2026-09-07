import { Router } from 'express';
import { isAttendanceScanningAllowed } from '../services/attendanceWindow.js';

export function createSystemRouter() {
  const router = Router();

  // System Attendance Window Status (Public / for all roles)
  router.get('/attendance-window', async (req, res) => {
    const status = await isAttendanceScanningAllowed();
    res.json(status);
  });

  return router;
}
