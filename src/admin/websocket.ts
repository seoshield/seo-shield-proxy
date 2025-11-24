/**
 * WebSocket Handler for Real-time Admin Dashboard
 * Provides live updates for metrics, traffic, and cache statistics
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import metricsCollector from './metrics-collector';
import cache from '../cache';

let io: Server | null = null;

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
      origin: ['http://localhost:3001', 'http://127.0.0.1:3001', 'http://localhost:3002', 'http://127.0.0.1:3002', 'http://localhost:8080'],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    allowEIO3: true,
  });

  // Store io instance globally for BrowserManager to access
  (global as any).io = io;

  io.on('connection', (socket: Socket) => {
    console.log('📡 Admin client connected:', socket.id);

    // Send initial stats on connection
    sendStats(socket);

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('📡 Admin client disconnected:', socket.id);
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
  setInterval(() => {
    broadcastStats();
  }, 2000);

  console.log('✅ WebSocket server initialized');
  return io;
}

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

export default { initializeWebSocket, broadcastTrafficEvent };
