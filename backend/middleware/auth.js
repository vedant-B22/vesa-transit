import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is missing. Server cannot start without a secure secret key.');
}

/**
 * Sign JWT token for authenticated users
 */
export const signToken = (payload, expiresIn = '7d') => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
};

/**
 * Verify JWT token string (used for WebSocket and internal checks)
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

/**
 * Express middleware to authenticate JWT from Authorization header
 */
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
};

/**
 * Express middleware to enforce user role (e.g. requireRole('admin') or requireRole('driver', 'admin'))
 */
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Access forbidden: requires role '${allowedRoles.join(' or ')}'` });
    }

    next();
  };
};

/**
 * Express middleware to enforce resource ownership:
 * - Admin can access all resources.
 * - Student can only access their own studentId / id.
 * - Driver can only access their own driverId / id.
 */
export const verifyResourceOwnership = (resourceType) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Admins have full access across the system
    if (req.user.role === 'admin') {
      return next();
    }

    if (resourceType === 'student') {
      if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'Access forbidden: student role required' });
      }

      const requestedId = req.params.id || req.params.studentId || req.body.studentId;
      if (requestedId && parseInt(requestedId, 10) !== parseInt(req.user.userId, 10)) {
        return res.status(403).json({ error: 'Access forbidden: you may only access your own student data' });
      }
    }

    if (resourceType === 'driver') {
      if (req.user.role !== 'driver') {
        return res.status(403).json({ error: 'Access forbidden: driver role required' });
      }

      const requestedId = req.params.driverId || req.params.id || req.body.driverId;
      if (requestedId && parseInt(requestedId, 10) !== parseInt(req.user.userId, 10)) {
        return res.status(403).json({ error: 'Access forbidden: you may only access your own driver data' });
      }
    }

    next();
  };
};
