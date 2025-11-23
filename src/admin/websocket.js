/**
 * WebSocket Handler for Real-time Admin Dashboard
 * Provides live updates for metrics, traffic, and cache statistics
 */

import { Server } from 'socket.io';
import metricsCollector from './metrics-collector.js';
import cache from '../cache.js';

let io = null;

/**
 * Initialize Socket.io server
 * @param {import('http').Server} httpServer - HTTP server instance
 */
export function initializeWebSocket(httpServer) {
  io = new Server(httpServer, {
    path: '/admin/socket.io',
    cors: {
      origin: '*', // Configure based on your needs
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
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
 * @param {Socket} socket - Socket.io socket instance
 */
function sendStats(socket) {
  const stats = {
    metrics: metricsCollector.getStats(),
    bots: metricsCollector.getBotStats(),
    cache: cache.getStats(),
    memory: process.memoryUsage(),
    timestamp: Date.now(),
  };

  // Convert memory values to MB
  stats.memory = {
    heapUsed: Math.floor(stats.memory.heapUsed / 1024 / 1024),
    heapTotal: Math.floor(stats.memory.heapTotal / 1024 / 1024),
    rss: Math.floor(stats.memory.rss / 1024 / 1024),
    external: Math.floor(stats.memory.external / 1024 / 1024),
  };

  socket.emit('stats', stats);
}

/**
 * Broadcast stats to all connected clients
 */
function broadcastStats() {
  if (!io) return;

  const stats = {
    metrics: metricsCollector.getStats(),
    bots: metricsCollector.getBotStats(),
    cache: cache.getStats(),
    memory: process.memoryUsage(),
    timestamp: Date.now(),
  };

  // Convert memory values to MB
  stats.memory = {
    heapUsed: Math.floor(stats.memory.heapUsed / 1024 / 1024),
    heapTotal: Math.floor(stats.memory.heapTotal / 1024 / 1024),
    rss: Math.floor(stats.memory.rss / 1024 / 1024),
    external: Math.floor(stats.memory.external / 1024 / 1024),
  };

  io.emit('stats', stats);
}

/**
 * Broadcast a traffic event to all connected clients
 * @param {Object} trafficData - Traffic event data
 */
export function broadcastTrafficEvent(trafficData) {
  if (!io) return;
  io.emit('traffic', {
    ...trafficData,
    timestamp: Date.now(),
  });
}

export default { initializeWebSocket, broadcastTrafficEvent };
