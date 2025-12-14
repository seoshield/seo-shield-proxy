/**
 * WebSocket Handler for Real-time Admin Dashboard
 * Provides live updates for metrics, traffic, and cache statistics
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import metricsCollector from './metrics-collector';
import cache from '../cache';
import { Logger } from '../utils/logger';

const logger = new Logger('WebSocket');
let io: Server | null = null;
let statsInterval: NodeJS.Timeout | null = null;

// CORS origins from environment or defaults
const CORS_ORIGINS = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:3001', 'http://127.0.0.1:3001', 'http://localhost:3002'];

interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
}

interface StatsPayload {
  metrics: ReturnType<typeof metricsCollector.getStats>;
  bots: ReturnType<typeof metricsCollector.getBotStats>;
  cache: ReturnType<typeof cache.getStats>;
  memory: MemoryStats;
  timestamp: number;
}

/**
 * Initialize Socket.io server
 */
export function initializeWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    path: '/socket.io',
    cors: {
      origin: CORS_ORIGINS,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    allowEIO3: true,
  });

  // Store io instance globally for BrowserManager to access
  // Type declaration in src/types/browser-globals.d.ts
  globalThis.io = io;

  io.on('connection', (socket: Socket) => {
    logger.info(`Admin client connected: ${socket.id}`);

    // Send initial stats on connection
    sendStats(socket);

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`Admin client disconnected: ${socket.id}`);
    });

    // Handle manual stats request
    socket.on('request-stats', () => {
      sendStats(socket);
    });

    // Handle cache clear request
    socket.on('clear-cache', () => {
      cache.flush();
      sendStats(socket);
      socket.emit('message', { type: 'success', text: 'Cache cleared successfully' });
    });
  });

  // Broadcast stats to all connected clients every 2 seconds
  // Store interval reference for cleanup
  statsInterval = setInterval(() => {
    broadcastStats();
  }, 2000);

  logger.info('WebSocket server initialized');
  return io;
}

/**
 * Cleanup WebSocket resources
 */
export function shutdownWebSocket(): void {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
    logger.info('WebSocket stats interval cleared');
  }
  if (io) {
    io.close();
    io = null;
    logger.info('WebSocket server closed');
  }
}

// Graceful shutdown handlers
process.on('SIGINT', shutdownWebSocket);
process.on('SIGTERM', shutdownWebSocket);

/**
 * Send stats to a specific socket
 */
function sendStats(socket: Socket): void {
  const memoryUsage = process.memoryUsage();

  const stats: StatsPayload = {
    metrics: metricsCollector.getStats(),
    bots: metricsCollector.getBotStats(),
    cache: cache.getStats(),
    memory: {
      heapUsed: Math.floor(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.floor(memoryUsage.heapTotal / 1024 / 1024),
      rss: Math.floor(memoryUsage.rss / 1024 / 1024),
      external: Math.floor(memoryUsage.external / 1024 / 1024),
    },
    timestamp: Date.now(),
  };

  socket.emit('stats', stats);
}

/**
 * Broadcast stats to all connected clients
 */
function broadcastStats(): void {
  if (!io) return;

  const memoryUsage = process.memoryUsage();

  const stats: StatsPayload = {
    metrics: metricsCollector.getStats(),
    bots: metricsCollector.getBotStats(),
    cache: cache.getStats(),
    memory: {
      heapUsed: Math.floor(memoryUsage.heapUsed / 1024 / 1024),
      heapTotal: Math.floor(memoryUsage.heapTotal / 1024 / 1024),
      rss: Math.floor(memoryUsage.rss / 1024 / 1024),
      external: Math.floor(memoryUsage.external / 1024 / 1024),
    },
    timestamp: Date.now(),
  };

  io.emit('stats', stats);
}

/**
 * Broadcast a traffic event to all connected clients
 */
export function broadcastTrafficEvent(trafficData: Record<string, unknown>): void {
  if (!io) return;
  io.emit('traffic', {
    ...trafficData,
    timestamp: Date.now(),
  });
}

export default { initializeWebSocket, broadcastTrafficEvent, shutdownWebSocket };
