import './config/env.js';
import express from 'express';
import cors from 'cors';
import { rateLimit, aiRateLimit, securityHeaders, bodySizeGuard, sanitizeBody } from './middleware/security.js';
import aiRoutes from './routes/ai.js';
import autopilotRoutes from './routes/autopilot.js';
import invoiceRoutes from './routes/invoices.js';
import exportRoutes from './routes/export.js';
import contactRoutes from './routes/contacts.js';
import notificationRoutes from './routes/notifications.js';
import profileRoutes from './routes/profiles.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Global Middleware ──
app.use(securityHeaders);
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(bodySizeGuard);
app.use(express.json({ limit: '1mb' }));
app.use(sanitizeBody);

// JSON parse error handler
app.use((err, _req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }
  next(err);
});

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── Routes ──

// AI routes have stricter rate limits
app.use('/api/ai', aiRateLimit, aiRoutes);
app.use('/api/autopilot', rateLimit(40), autopilotRoutes);

// Standard rate limits for CRUD routes
app.use('/api/invoices', rateLimit(), invoiceRoutes);
app.use('/api/export', rateLimit(30), exportRoutes);
app.use('/api/contacts', rateLimit(), contactRoutes);
app.use('/api/notifications', rateLimit(), notificationRoutes);
app.use('/api/profiles', rateLimit(), profileRoutes);

// Health check (no rate limit)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[Error]', err.message || err);

  // Detect Supabase / network connectivity issues
  const isNetworkError = err.message?.includes('fetch failed') || err.message?.includes('ENOTFOUND') || err.cause?.code === 'ENOTFOUND';

  if (isNetworkError) {
    return res.status(503).json({
      error: 'Database temporarily unavailable',
      details: 'Could not connect to Supabase. The project may be paused or there is a network issue.',
      code: 'DB_UNAVAILABLE',
    });
  }

  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// ── Start Server ──
const server = app.listen(PORT, () => {
  console.log(`🚀 Obscural server running on http://localhost:${PORT}`);
});

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
  // Force exit after 10s
  setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
