/**
 * API-Only Server - Runs on port 3190 (configurable via API_PORT env)
 * Only handles /shieldapi/* endpoints for admin dashboard
 */

import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import adminRoutes from './admin/admin-routes';
import { adminRateLimiter } from './middleware/rate-limiter';
import { initializeWebSocket } from './admin/websocket';
import { databaseManager } from './database/database-manager';
import config from './config';
import { Logger } from './utils/logger';

const logger = new Logger('APIServer');
const app = express();
const PORT = config.API_PORT;

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS for admin dashboard - dynamic origin support for SSE/EventSource
app.use((req: Request, res: Response, next: NextFunction) => {
  // Use specific origin if provided (required for credentials), fallback to *
  const origin = req.headers.origin || '*';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Last-Event-ID');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours

  if (req.method === 'OPTIONS') {
    res.sendStatus(204); // No Content for preflight
  } else {
    next();
  }
});

// Mount admin API routes with rate limiting
app.use('/shieldapi', adminRateLimiter, adminRoutes);

// Health check endpoint
app.get('/shieldhealth', async (req: Request, res: Response) => {
  const dbHealth = await databaseManager.healthCheck();
  res.json({
    status: 'ok',
    service: 'seo-shield-api',
    port: PORT,
    timestamp: new Date().toISOString(),
    database: dbHealth.connected ? 'connected' : 'disconnected',
    databaseStats: dbHealth.stats || null
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Path ${req.path} not found on API server`,
    availableEndpoints: ['/shieldhealth', '/shieldapi/*']
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('API Server Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: config.NODE_ENV === 'production' ? 'An error occurred' : err.message
  });
});

// Initialize database connection
async function initializeDatabase(): Promise<boolean> {
  try {
    const connected = await databaseManager.connect();
    if (connected) {
      logger.info('MongoDB storage initialized');
      return true;
    } else {
      logger.warn('MongoDB connection failed, falling back to memory-based storage');
      return false;
    }
  } catch (error) {
    logger.error('Database initialization error:', error);
    return false;
  }
}

// Start server
const server = createServer(app);

// Initialize WebSocket server
initializeWebSocket(server);

// Server startup logging
function logServerStart(dbConnected: boolean): void {
  const mode = dbConnected ? '' : ' (Database fallback mode)';
  logger.info('═══════════════════════════════════════════════════════════');
  logger.info('                 SEO Shield API Server                     ');
  logger.info('═══════════════════════════════════════════════════════════');
  logger.info(`API Server running on port ${PORT}${mode}`);
  logger.info('Admin API endpoints: /shieldapi/*');
  logger.info('WebSocket endpoint: /socket.io');
  logger.info('Health check: /shieldhealth');
  logger.info('Rate limiting: enabled');
}

// Initialize database before starting server
initializeDatabase().then((dbConnected) => {
  server.listen(PORT, '0.0.0.0', () => {
    logServerStart(dbConnected);
  });
}).catch((error) => {
  logger.error('Failed to initialize database:', error);
  // Still start server even if database fails
  server.listen(PORT, '0.0.0.0', () => {
    logServerStart(false);
  });
});

export default app;