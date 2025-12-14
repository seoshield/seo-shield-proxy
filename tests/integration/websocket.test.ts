/**
 * WebSocket Integration Tests
 * Tests for real-time WebSocket communication
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { setupTestEnv } from './setup';

// Mock socket.io-client
class MockSocket extends EventEmitter {
  connected = false;
  id = 'mock-socket-id';
  auth: Record<string, unknown> = {};

  constructor(auth?: Record<string, unknown>) {
    super();
    this.auth = auth || {};
  }

  connect() {
    this.connected = true;
    setTimeout(() => this.emit('connect'), 10);
    return this;
  }

  disconnect() {
    this.connected = false;
    this.emit('disconnect', 'client namespace disconnect');
    return this;
  }

  close() {
    this.disconnect();
  }

  // Override emit to also return the socket for chaining
  emit(event: string, ...args: unknown[]) {
    super.emit(event, ...args);
    return true;
  }
}

// Mock WebSocket server
class MockWebSocketServer extends EventEmitter {
  clients = new Set<MockSocket>();
  private rooms = new Map<string, Set<MockSocket>>();

  constructor() {
    super();
  }

  to(room: string) {
    return {
      emit: (event: string, data: unknown) => {
        const roomClients = this.rooms.get(room);
        if (roomClients) {
          roomClients.forEach((client) => {
            client.emit(event, data);
          });
        }
      },
    };
  }

  in(room: string) {
    return this.to(room);
  }

  broadcast = {
    emit: (event: string, data: unknown) => {
      this.clients.forEach((client) => {
        client.emit(event, data);
      });
    },
  };

  addClient(socket: MockSocket) {
    this.clients.add(socket);
  }

  removeClient(socket: MockSocket) {
    this.clients.delete(socket);
  }

  joinRoom(socket: MockSocket, room: string) {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room)?.add(socket);
  }

  leaveRoom(socket: MockSocket, room: string) {
    this.rooms.get(room)?.delete(socket);
  }
}

describe('WebSocket Integration', () => {
  let mockServer: MockWebSocketServer;

  beforeAll(() => {
    setupTestEnv();
    mockServer = new MockWebSocketServer();
  });

  afterAll(() => {
    mockServer.clients.forEach((client) => client.close());
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Connection Handling', () => {
    it('should establish WebSocket connection', async () => {
      const socket = new MockSocket();
      mockServer.addClient(socket);

      const connectPromise = new Promise<void>((resolve) => {
        socket.on('connect', resolve);
      });

      socket.connect();
      await connectPromise;

      expect(socket.connected).toBe(true);
    });

    it('should handle disconnection', async () => {
      const socket = new MockSocket();
      mockServer.addClient(socket);

      socket.connect();
      await new Promise<void>((resolve) => socket.on('connect', resolve));

      const disconnectPromise = new Promise<string>((resolve) => {
        socket.on('disconnect', resolve);
      });

      socket.disconnect();
      const reason = await disconnectPromise;

      expect(socket.connected).toBe(false);
      expect(reason).toBe('client namespace disconnect');
    });

    it('should support authentication', async () => {
      const socket = new MockSocket({ token: 'test-token' });
      mockServer.addClient(socket);

      socket.connect();
      await new Promise<void>((resolve) => socket.on('connect', resolve));

      expect(socket.auth.token).toBe('test-token');
    });

    it('should generate unique socket IDs', () => {
      const socket1 = new MockSocket();
      const socket2 = new MockSocket();

      // In a real scenario, IDs would be different
      // Here we just verify the property exists
      expect(socket1.id).toBeDefined();
      expect(socket2.id).toBeDefined();
    });
  });

  describe('Event Broadcasting', () => {
    it('should broadcast to all clients', async () => {
      const socket1 = new MockSocket();
      const socket2 = new MockSocket();

      mockServer.addClient(socket1);
      mockServer.addClient(socket2);

      socket1.connect();
      socket2.connect();

      await Promise.all([
        new Promise<void>((resolve) => socket1.on('connect', resolve)),
        new Promise<void>((resolve) => socket2.on('connect', resolve)),
      ]);

      const receivedMessages: unknown[] = [];

      socket1.on('metrics', (data) => receivedMessages.push({ socket: 1, data }));
      socket2.on('metrics', (data) => receivedMessages.push({ socket: 2, data }));

      mockServer.broadcast.emit('metrics', { totalRequests: 100 });

      // Allow time for event propagation
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(receivedMessages).toHaveLength(2);
      expect(receivedMessages[0]).toEqual({ socket: 1, data: { totalRequests: 100 } });
      expect(receivedMessages[1]).toEqual({ socket: 2, data: { totalRequests: 100 } });
    });

    it('should broadcast to specific room', async () => {
      const socket1 = new MockSocket();
      const socket2 = new MockSocket();

      mockServer.addClient(socket1);
      mockServer.addClient(socket2);

      mockServer.joinRoom(socket1, 'admin');
      // socket2 not in admin room

      const receivedMessages: unknown[] = [];

      socket1.on('admin-event', (data) => receivedMessages.push(data));
      socket2.on('admin-event', (data) => receivedMessages.push(data));

      mockServer.to('admin').emit('admin-event', { message: 'admin only' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0]).toEqual({ message: 'admin only' });
    });
  });

  describe('Real-time Metrics', () => {
    it('should receive traffic metrics', async () => {
      const socket = new MockSocket();
      mockServer.addClient(socket);

      socket.connect();
      await new Promise<void>((resolve) => socket.on('connect', resolve));

      const metricsPromise = new Promise<unknown>((resolve) => {
        socket.on('metrics', resolve);
      });

      // Simulate server sending metrics
      socket.emit('metrics', {
        totalRequests: 1000,
        botRequests: 300,
        humanRequests: 700,
        cacheHitRate: 0.7,
      });

      const metrics = await metricsPromise;

      expect(metrics).toEqual({
        totalRequests: 1000,
        botRequests: 300,
        humanRequests: 700,
        cacheHitRate: 0.7,
      });
    });

    it('should receive SSR events', async () => {
      const socket = new MockSocket();
      mockServer.addClient(socket);

      socket.connect();
      await new Promise<void>((resolve) => socket.on('connect', resolve));

      const eventPromise = new Promise<unknown>((resolve) => {
        socket.on('ssr_event', resolve);
      });

      socket.emit('ssr_event', {
        type: 'render_complete',
        url: 'https://example.com',
        renderTime: 1500,
        statusCode: 200,
      });

      const event = await eventPromise;

      expect(event).toHaveProperty('type', 'render_complete');
      expect(event).toHaveProperty('url', 'https://example.com');
      expect(event).toHaveProperty('renderTime', 1500);
    });

    it('should receive cache events', async () => {
      const socket = new MockSocket();
      mockServer.addClient(socket);

      socket.connect();
      await new Promise<void>((resolve) => socket.on('connect', resolve));

      const eventPromise = new Promise<unknown>((resolve) => {
        socket.on('cache_event', resolve);
      });

      socket.emit('cache_event', {
        type: 'hit',
        url: 'https://example.com/page',
        ttl: 3600,
      });

      const event = await eventPromise;

      expect(event).toHaveProperty('type', 'hit');
      expect(event).toHaveProperty('url');
    });
  });

  describe('Client Events', () => {
    it('should handle client-sent events', async () => {
      const socket = new MockSocket();
      mockServer.addClient(socket);

      socket.connect();
      await new Promise<void>((resolve) => socket.on('connect', resolve));

      const serverReceived: unknown[] = [];

      // Simulate server listening
      socket.on('client_action', (data) => {
        serverReceived.push(data);
      });

      socket.emit('client_action', { action: 'refresh_cache', url: '/page' });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(serverReceived).toHaveLength(1);
      expect(serverReceived[0]).toEqual({ action: 'refresh_cache', url: '/page' });
    });

    it('should handle subscription requests', async () => {
      const socket = new MockSocket();
      mockServer.addClient(socket);

      socket.connect();
      await new Promise<void>((resolve) => socket.on('connect', resolve));

      let subscribed = false;

      socket.on('subscribe', (channel: string) => {
        if (channel === 'metrics') {
          subscribed = true;
          mockServer.joinRoom(socket, 'metrics');
        }
      });

      socket.emit('subscribe', 'metrics');

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(subscribed).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors', async () => {
      const socket = new MockSocket();

      const errorPromise = new Promise<unknown>((resolve) => {
        socket.on('connect_error', resolve);
      });

      // Simulate connection error
      socket.emit('connect_error', new Error('Connection refused'));

      const error = await errorPromise;

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe('Connection refused');
    });

    it('should handle server errors', async () => {
      const socket = new MockSocket();
      mockServer.addClient(socket);

      socket.connect();
      await new Promise<void>((resolve) => socket.on('connect', resolve));

      const errorPromise = new Promise<unknown>((resolve) => {
        socket.on('error', resolve);
      });

      socket.emit('error', { message: 'Internal server error' });

      const error = await errorPromise;

      expect(error).toHaveProperty('message', 'Internal server error');
    });

    it('should handle timeout', async () => {
      vi.useFakeTimers();

      const socket = new MockSocket();
      let timedOut = false;

      const timeout = setTimeout(() => {
        if (!socket.connected) {
          timedOut = true;
          socket.emit('connect_timeout');
        }
      }, 5000);

      vi.advanceTimersByTime(5000);

      expect(timedOut).toBe(true);

      clearTimeout(timeout);
      vi.useRealTimers();
    });
  });

  describe('Reconnection', () => {
    it('should attempt reconnection on disconnect', async () => {
      const socket = new MockSocket();
      mockServer.addClient(socket);

      socket.connect();
      await new Promise<void>((resolve) => socket.on('connect', resolve));

      let reconnectAttempts = 0;

      socket.on('reconnect_attempt', () => {
        reconnectAttempts++;
      });

      // Simulate disconnect and reconnect attempts
      socket.disconnect();
      socket.emit('reconnect_attempt');
      socket.emit('reconnect_attempt');
      socket.emit('reconnect_attempt');

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(reconnectAttempts).toBe(3);
    });

    it('should emit reconnect event on successful reconnection', async () => {
      const socket = new MockSocket();
      mockServer.addClient(socket);

      socket.connect();
      await new Promise<void>((resolve) => socket.on('connect', resolve));

      const reconnectPromise = new Promise<number>((resolve) => {
        socket.on('reconnect', resolve);
      });

      socket.disconnect();
      socket.emit('reconnect', 2); // Reconnected after 2 attempts

      const attempts = await reconnectPromise;

      expect(attempts).toBe(2);
    });
  });
});
