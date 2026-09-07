import { Router } from 'express';
import bcrypt from 'bcryptjs';
import * as db from '../database.js';
import { signToken } from '../middleware/auth.js';

export function createAuthRouter(authLimiter) {
  const router = Router();

  // Authentication: Login
  router.post('/login', authLimiter, async (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
      const user = await db.get('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Generate JWT token
      const token = signToken({
        userId: user.id,
        role: user.role,
        email: user.email
      });

      let roleData = {};
      if (user.role === 'student') {
        roleData = await db.get(
          `SELECT s.*, r.name as route_name, b.bus_number, st.name as stop_name
           FROM students s
           LEFT JOIN routes r ON s.route_id = r.id
           LEFT JOIN buses b ON s.bus_id = b.id
           LEFT JOIN stops st ON s.pickup_stop_id = st.id
           WHERE s.user_id = $1`,
          [user.id]
        );
      } else if (user.role === 'driver') {
        roleData = await db.get('SELECT * FROM drivers WHERE user_id = $1', [user.id]);
      } else if (user.role === 'admin') {
        roleData = await db.get('SELECT * FROM admins WHERE user_id = $1', [user.id]);
      }

      res.json({
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        },
        token,
        profile: roleData
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
