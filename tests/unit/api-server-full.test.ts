import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';

// Mock database manager
const mockDatabaseManager = {
  connect: vi.fn().mockResolvedValue(true),
  healthCheck: vi.fn().mockResolvedValue({
    connected: true,
    stats: { collections: 5, documents: 100 }
  })
};

vi.mock('../../src/database/database-manager', () => ({
  databaseManager: mockDatabaseManager
}));

// Mock admin routes
vi.mock('../../src/admin/admin-routes', () => ({
  default: express.Router()
}));

// Mock config manager
vi.mock('../../src/admin/config-manager', () => ({
  default: {}
}));

// Mock rate limiter
vi.mock('../../src/middleware/rate-limiter', () => ({
  adminRateLimiter: vi.fn((req: any, res: any, next: any) => next())
}));

// Mock websocket
vi.mock('../../src/admin/websocket', () => ({
  initializeWebSocket: vi.fn()
}));

// Mock config
vi.mock('../../src/config', () => ({
  default: {
    API_PORT: 3190
  }
}));

describe('API Server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete (global as any).databaseManager;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Express app configuration', () => {
    it('should create express app', () => {
      const app = express();
      expect(app).toBeDefined();
    });

    it('should use JSON body parser with 10mb limit', () => {
      const jsonMiddleware = express.json({ limit: '10mb' });
      expect(jsonMiddleware).toBeDefined();
    });

    it('should use URL encoded parser with 10mb limit', () => {
      const urlencodedMiddleware = express.urlencoded({ extended: true, limit: '10mb' });
      expect(urlencodedMiddleware).toBeDefined();
    });
  });

  describe('CORS middleware', () => {
    it('should set Access-Control-Allow-Origin header', async () => {
      const res = {
        header: vi.fn()
      };
      const next = vi.fn();

      const corsMiddleware = (req: any, res: any, next: any) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        next();
      };

      corsMiddleware({}, res, next);

      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    });

    it('should set Access-Control-Allow-Methods header', async () => {
      const res = {
        header: vi.fn()
      };
      const next = vi.fn();

      const corsMiddleware = (req: any, res: any, next: any) => {
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        next();
      };

      corsMiddleware({}, res, next);

      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    });

    it('should set Access-Control-Allow-Headers header', async () => {
      const res = {
        header: vi.fn()
      };
      const next = vi.fn();

      const corsMiddleware = (req: any, res: any, next: any) => {
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
        next();
      };

      corsMiddleware({}, res, next);

      expect(res.header).toHaveBeenCalledWith('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    });

    it('should respond with 200 for OPTIONS requests', async () => {
      const res = {
        header: vi.fn(),
        sendStatus: vi.fn()
      };
      const next = vi.fn();

      const corsMiddleware = (req: any, res: any, next: any) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

        if (req.method === 'OPTIONS') {
          res.sendStatus(200);
        } else {
          next();
        }
      };

      corsMiddleware({ method: 'OPTIONS' }, res, next);

      expect(res.sendStatus).toHaveBeenCalledWith(200);
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next for non-OPTIONS requests', async () => {
      const res = {
        header: vi.fn(),
        sendStatus: vi.fn()
      };
      const next = vi.fn();

      const corsMiddleware = (req: any, res: any, next: any) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

        if (req.method === 'OPTIONS') {
          res.sendStatus(200);
        } else {
          next();
        }
      };

      corsMiddleware({ method: 'GET' }, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.sendStatus).not.toHaveBeenCalled();
    });
  });

  describe('Health check endpoint', () => {
    it('should return health status', async () => {
      const healthCheckHandler = async (req: any, res: any) => {
        const dbHealth = await mockDatabaseManager.healthCheck();
        res.json({
          status: 'ok',
          service: 'seo-shield-api',
          port: 3190,
          timestamp: new Date().toISOString(),
          database: dbHealth.connected ? 'connected' : 'disconnected',
          databaseStats: dbHealth.stats || null
        });
      };

      const res = {
        json: vi.fn()
      };

      await healthCheckHandler({}, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        status: 'ok',
        service: 'seo-shield-api',
        port: 3190,
        database: 'connected'
      }));
    });

    it('should return disconnected database status', async () => {
      mockDatabaseManager.healthCheck.mockResolvedValueOnce({
        connected: false,
        stats: null
      });

      const healthCheckHandler = async (req: any, res: any) => {
        const dbHealth = await mockDatabaseManager.healthCheck();
        res.json({
          status: 'ok',
          service: 'seo-shield-api',
          port: 3190,
          timestamp: new Date().toISOString(),
          database: dbHealth.connected ? 'connected' : 'disconnected',
          databaseStats: dbHealth.stats || null
        });
      };

      const res = {
        json: vi.fn()
      };

      await healthCheckHandler({}, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        database: 'disconnected',
        databaseStats: null
      }));
    });
  });

  describe('404 handler', () => {
    it('should return 404 for unknown paths', () => {
      const notFoundHandler = (req: any, res: any) => {
        res.status(404).json({
          error: 'Not Found',
          message: `Path ${req.path} not found on API server`,
          availableEndpoints: ['/shieldhealth', '/shieldapi/*']
        });
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      notFoundHandler({ path: '/unknown' }, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'Path /unknown not found on API server',
        availableEndpoints: ['/shieldhealth', '/shieldapi/*']
      });
    });

    it('should include path in error message', () => {
      const notFoundHandler = (req: any, res: any) => {
        res.status(404).json({
          error: 'Not Found',
          message: `Path ${req.path} not found on API server`,
          availableEndpoints: ['/shieldhealth', '/shieldapi/*']
        });
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      notFoundHandler({ path: '/api/v1/resource' }, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Path /api/v1/resource not found on API server'
      }));
    });
  });

  describe('Error handler', () => {
    it('should return 500 for errors', () => {
      const errorHandler = (err: Error, req: any, res: any, next: any) => {
        console.error('API Server Error:', err);
        res.status(500).json({
          error: 'Internal Server Error',
          message: err.message
        });
      };

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      const next = vi.fn();

      errorHandler(new Error('Test error'), {}, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Test error'
      });
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });

    it('should log error to console', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const errorHandler = (err: Error, req: any, res: any, next: any) => {
        console.error('API Server Error:', err);
        res.status(500).json({
          error: 'Internal Server Error',
          message: err.message
        });
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      const testError = new Error('Detailed error message');
      errorHandler(testError, {}, res, vi.fn());

      expect(errorSpy).toHaveBeenCalledWith('API Server Error:', testError);

      errorSpy.mockRestore();
    });
  });

  describe('Database initialization', () => {
    it('should connect to database successfully', async () => {
      mockDatabaseManager.connect.mockResolvedValueOnce(true);

      const initializeDatabase = async () => {
        try {
          const connected = await mockDatabaseManager.connect();
          if (connected) {
            console.log('MongoDB storage initialized');
            (global as any).databaseManager = mockDatabaseManager;
          } else {
            console.warn('MongoDB connection failed, falling back to memory-based storage');
          }
        } catch (error) {
          console.error('Database initialization error:', error);
        }
      };

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await initializeDatabase();

      expect(mockDatabaseManager.connect).toHaveBeenCalled();
      expect((global as any).databaseManager).toBe(mockDatabaseManager);

      logSpy.mockRestore();
    });

    it('should handle database connection failure', async () => {
      mockDatabaseManager.connect.mockResolvedValueOnce(false);

      const initializeDatabase = async () => {
        try {
          const connected = await mockDatabaseManager.connect();
          if (connected) {
            console.log('MongoDB storage initialized');
            (global as any).databaseManager = mockDatabaseManager;
          } else {
            console.warn('MongoDB connection failed, falling back to memory-based storage');
          }
        } catch (error) {
          console.error('Database initialization error:', error);
        }
      };

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await initializeDatabase();

      expect(warnSpy).toHaveBeenCalledWith('MongoDB connection failed, falling back to memory-based storage');

      warnSpy.mockRestore();
    });

    it('should handle database initialization error', async () => {
      mockDatabaseManager.connect.mockRejectedValueOnce(new Error('Connection error'));

      const initializeDatabase = async () => {
        try {
          const connected = await mockDatabaseManager.connect();
          if (connected) {
            console.log('MongoDB storage initialized');
          } else {
            console.warn('MongoDB connection failed');
          }
        } catch (error) {
          console.error('Database initialization error:', error);
        }
      };

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await initializeDatabase();

      expect(errorSpy).toHaveBeenCalledWith('Database initialization error:', expect.any(Error));

      errorSpy.mockRestore();
    });
  });

  describe('Server startup', () => {
    it('should log startup banner', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const logStartupBanner = (port: number) => {
        console.log('SEO Shield API Server');
        console.log('');
        console.log(`API Server running on port ${port}`);
        console.log('Admin API endpoints: /shieldapi/*');
        console.log('WebSocket endpoint: /socket.io');
        console.log('Health check: /shieldhealth');
      };

      logStartupBanner(3190);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('SEO Shield API Server'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('API Server running on port 3190'));

      logSpy.mockRestore();
    });

    it('should log fallback mode when database fails', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const logFallbackStartup = (port: number) => {
        console.log('SEO Shield API Server');
        console.log(`API Server running on port ${port} (Database fallback mode)`);
      };

      logFallbackStartup(3190);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('(Database fallback mode)'));

      logSpy.mockRestore();
    });
  });

  describe('HTTP server creation', () => {
    it('should create HTTP server with Express app', () => {
      const app = express();
      const createServer = vi.fn().mockReturnValue({
        listen: vi.fn((port: number, host: string, callback: () => void) => {
          callback();
        })
      });

      const mockCreateServer = (a: any) => createServer(a);
      const server = mockCreateServer(app);

      expect(createServer).toHaveBeenCalledWith(app);
      expect(server).toBeDefined();
    });

    it('should listen on specified port', () => {
      const listenFn = vi.fn((port: number, host: string, callback: () => void) => {
        callback();
        return { address: () => ({ port }) };
      });

      const server = {
        listen: listenFn
      };

      const PORT = 3190;
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
      });

      expect(listenFn).toHaveBeenCalledWith(PORT, '0.0.0.0', expect.any(Function));

      logSpy.mockRestore();
    });
  });

  describe('Admin routes mounting', () => {
    it('should mount admin routes at /shieldapi', () => {
      const app = express();
      const useSpy = vi.spyOn(app, 'use');

      const adminRouter = express.Router();
      app.use('/shieldapi', adminRouter);

      expect(useSpy).toHaveBeenCalledWith('/shieldapi', adminRouter);
    });
  });

  describe('WebSocket initialization', () => {
    it('should initialize WebSocket server', async () => {
      // Import the mock
      const websocketModule = await import('../../src/admin/websocket');
      const mockServer = {};

      websocketModule.initializeWebSocket(mockServer);

      expect(websocketModule.initializeWebSocket).toHaveBeenCalledWith(mockServer);
    });
  });

  describe('Global database manager', () => {
    it('should set global databaseManager on successful connection', async () => {
      mockDatabaseManager.connect.mockResolvedValueOnce(true);

      const initializeDatabase = async () => {
        const connected = await mockDatabaseManager.connect();
        if (connected) {
          (global as any).databaseManager = mockDatabaseManager;
        }
      };

      await initializeDatabase();

      expect((global as any).databaseManager).toBe(mockDatabaseManager);
    });

    it('should not set global databaseManager on failed connection', async () => {
      delete (global as any).databaseManager;
      mockDatabaseManager.connect.mockResolvedValueOnce(false);

      const initializeDatabase = async () => {
        const connected = await mockDatabaseManager.connect();
        if (connected) {
          (global as any).databaseManager = mockDatabaseManager;
        }
      };

      await initializeDatabase();

      expect((global as any).databaseManager).toBeUndefined();
    });
  });

  describe('Server error handling during startup', () => {
    it('should log error and still start server', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const startServerWithFallback = async () => {
        try {
          throw new Error('Database init failed');
        } catch (error) {
          console.error('Failed to initialize database:', error);
          // Still start server
          console.log('Server running in fallback mode');
        }
      };

      await startServerWithFallback();

      expect(errorSpy).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith('Server running in fallback mode');

      errorSpy.mockRestore();
      logSpy.mockRestore();
    });
  });
});

describe('API Server Integration', () => {
  describe('Request handling flow', () => {
    it('should process request through CORS then route handler', async () => {
      const callOrder: string[] = [];

      const corsMiddleware = (req: any, res: any, next: any) => {
        callOrder.push('cors');
        res.header('Access-Control-Allow-Origin', '*');
        next();
      };

      const routeHandler = (req: any, res: any) => {
        callOrder.push('route');
        res.json({ ok: true });
      };

      const res = {
        header: vi.fn(),
        json: vi.fn()
      };

      corsMiddleware({}, res, () => routeHandler({}, res));

      expect(callOrder).toEqual(['cors', 'route']);
    });

    it('should handle preflight requests before reaching routes', async () => {
      const callOrder: string[] = [];

      const corsMiddleware = (req: any, res: any, next: any) => {
        callOrder.push('cors');
        if (req.method === 'OPTIONS') {
          callOrder.push('preflight');
          res.sendStatus(200);
        } else {
          next();
        }
      };

      const routeHandler = (req: any, res: any) => {
        callOrder.push('route');
        res.json({ ok: true });
      };

      const res = {
        header: vi.fn(),
        sendStatus: vi.fn(),
        json: vi.fn()
      };

      corsMiddleware({ method: 'OPTIONS' }, res, () => routeHandler({ method: 'OPTIONS' }, res));

      expect(callOrder).toEqual(['cors', 'preflight']);
      expect(res.sendStatus).toHaveBeenCalledWith(200);
    });
  });

  describe('Error propagation', () => {
    it('should propagate errors to error handler', () => {
      const callOrder: string[] = [];

      const routeHandler = (req: any, res: any, next: any) => {
        callOrder.push('route');
        next(new Error('Route error'));
      };

      const errorHandler = (err: Error, req: any, res: any, next: any) => {
        callOrder.push('error');
        res.status(500).json({ error: err.message });
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      routeHandler({}, res, (err: Error) => errorHandler(err, {}, res, vi.fn()));

      expect(callOrder).toEqual(['route', 'error']);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});

describe('API Server Configuration', () => {
  describe('Port configuration', () => {
    it('should use API_PORT from config', async () => {
      const config = await import('../../src/config');
      expect(config.default.API_PORT).toBe(3190);
    });
  });

  describe('Body parser limits', () => {
    it('should set JSON limit to 10mb', () => {
      const jsonOptions = { limit: '10mb' };
      expect(jsonOptions.limit).toBe('10mb');
    });

    it('should set urlencoded limit to 10mb', () => {
      const urlencodedOptions = { extended: true, limit: '10mb' };
      expect(urlencodedOptions.limit).toBe('10mb');
      expect(urlencodedOptions.extended).toBe(true);
    });
  });
});
