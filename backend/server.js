import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import * as db from './database.js';
import { createAuthRouter } from './routes/auth.js';
import { createStudentRouter } from './routes/student.js';
import { createDriverRouter } from './routes/driver.js';
import { createAdminRouter } from './routes/admin.js';
import { createSystemRouter } from './routes/system.js';
import { setupWebSocket } from './services/websocket.js';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const port = process.env.PORT || 5001;

// 1. Helmet Security Headers (allow Leaflet map tiles and inline SVGs)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

// 2. CORS allowlist configuration
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:5001',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5001'
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);

app.use(express.json({ limit: '5mb' }));

// 3. Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts from this IP, please try again after 15 minutes.' }
});

const alertLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests submitted. Please try again later.' }
});

// Initialize Database on server start
db.initDatabase();

// -------------------------------------------------------------
// HEALTH CHECK
// -------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({ status: 'OK', time: new Date() });
});

// -------------------------------------------------------------
// MODULAR API ROUTES
// -------------------------------------------------------------
app.use('/api/auth', createAuthRouter(authLimiter));
app.use('/api/student', createStudentRouter(alertLimiter));
app.use('/api/driver', createDriverRouter());
app.use('/api/admin', createAdminRouter());
app.use('/api/system', createSystemRouter());

// -------------------------------------------------------------
// STATIC FRONTEND ASSETS IN PRODUCTION
// -------------------------------------------------------------
const frontendDistPath = join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

app.get('*', (req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  res.sendFile(join(frontendDistPath, 'index.html'));
});

// -------------------------------------------------------------
// CENTRALIZED ERROR HANDLING MIDDLEWARE
// -------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('API Error:', {
    message: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    url: req.originalUrl,
    method: req.method
  });

  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || 500;
  const userMessage = status === 500 
    ? 'An unexpected error occurred. Please contact system support.' 
    : (err.message || 'Operation failed');

  res.status(status).json({ error: userMessage });
});

// -------------------------------------------------------------
// SERVER & WEBSOCKET SETUP
// -------------------------------------------------------------
const server = createServer(app);
setupWebSocket(server);

server.listen(port, () => {
  console.log(`VESA Transit Production API Server running on port ${port}`);
});

export default app;
