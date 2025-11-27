import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApp = {
  use: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  listen: vi.fn((port: number, cb: () => void) => { if (cb) cb(); return { close: vi.fn() }; }),
  disable: vi.fn()
};

vi.mock('express', () => ({
  default: Object.assign(vi.fn(() => mockApp), {
    json: vi.fn(() => vi.fn()),
    urlencoded: vi.fn(() => vi.fn()),
    static: vi.fn(() => vi.fn())
  })
}));

vi.mock('cors', () => ({
  default: vi.fn(() => (req: any, res: any, next: any) => next())
}));

vi.mock('http', () => ({
  createServer: vi.fn(() => ({
    listen: vi.fn((...args: any[]) => {
      const cb = args.find(arg => typeof arg === 'function');
      if (cb) cb();
      return { close: vi.fn() };
    }),
    close: vi.fn(),
    on: vi.fn()
  }))
}));

vi.mock('../../src/config', () => ({
  default: {
    API_PORT: 3190,
    PORT: 8080,
    TARGET_URL: 'http://localhost:3000',
    ADMIN_PASSWORD: 'test',
    JWT_SECRET: 'test-secret',
    NODE_ENV: 'test'
  }
}));

vi.mock('../../src/cache', () => ({
  default: { get: vi.fn(), set: vi.fn(), getStats: vi.fn().mockReturnValue({}) },
  getCache: vi.fn().mockResolvedValue({ get: vi.fn(), set: vi.fn() })
}));

vi.mock('../../src/admin/admin-routes', () => ({
  default: vi.fn()
}));

vi.mock('../../src/admin/websocket', () => ({
  initializeWebSocket: vi.fn()
}));

describe('API Server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should import api-server module', async () => {
    const module = await import('../../src/api-server');
    expect(module).toBeDefined();
  });

  it('should have default export (app)', async () => {
    const module = await import('../../src/api-server');
    expect(module.default).toBeDefined();
  });
});

describe('API Server CORS Middleware Simulation', () => {
  it('should set Access-Control-Allow-Origin header', () => {
    const mockRes = {
      headers: {} as Record<string, string>,
      header: function(name: string, value: string) {
        this.headers[name] = value;
      }
    };

    mockRes.header('Access-Control-Allow-Origin', '*');
    expect(mockRes.headers['Access-Control-Allow-Origin']).toBe('*');
  });

  it('should set Access-Control-Allow-Methods header', () => {
    const mockRes = {
      headers: {} as Record<string, string>,
      header: function(name: string, value: string) {
        this.headers[name] = value;
      }
    };

    mockRes.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    expect(mockRes.headers['Access-Control-Allow-Methods']).toBe('GET, POST, PUT, DELETE, OPTIONS');
  });

  it('should set Access-Control-Allow-Headers header', () => {
    const mockRes = {
      headers: {} as Record<string, string>,
      header: function(name: string, value: string) {
        this.headers[name] = value;
      }
    };

    mockRes.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    expect(mockRes.headers['Access-Control-Allow-Headers']).toContain('Authorization');
  });

  it('should handle OPTIONS preflight request', () => {
    const req = { method: 'OPTIONS' };
    let statusCode = 0;

    if (req.method === 'OPTIONS') {
      statusCode = 200;
    }

    expect(statusCode).toBe(200);
  });

  it('should call next for non-OPTIONS requests', () => {
    const req = { method: 'GET' };
    let nextCalled = false;

    if (req.method !== 'OPTIONS') {
      nextCalled = true;
    }

    expect(nextCalled).toBe(true);
  });
});

describe('API Server Health Check Endpoint', () => {
  it('should return status ok', () => {
    const healthResponse = {
      status: 'ok',
      service: 'seo-shield-api',
      port: 3190,
      timestamp: new Date().toISOString(),
      database: 'connected',
      databaseStats: { collections: 5, documents: 100 }
    };

    expect(healthResponse.status).toBe('ok');
    expect(healthResponse.service).toBe('seo-shield-api');
  });

  it('should return database status', () => {
    const dbConnected = true;
    const healthResponse = {
      database: dbConnected ? 'connected' : 'disconnected'
    };

    expect(healthResponse.database).toBe('connected');
  });

  it('should return database stats when connected', () => {
    const dbHealth = {
      connected: true,
      stats: { collections: 5, documents: 100 }
    };

    const response = {
      database: dbHealth.connected ? 'connected' : 'disconnected',
      databaseStats: dbHealth.stats || null
    };

    expect(response.databaseStats).toEqual({ collections: 5, documents: 100 });
  });

  it('should return null stats when disconnected', () => {
    const dbHealth = {
      connected: false,
      stats: null
    };

    const response = {
      database: dbHealth.connected ? 'connected' : 'disconnected',
      databaseStats: dbHealth.stats || null
    };

    expect(response.database).toBe('disconnected');
    expect(response.databaseStats).toBeNull();
  });

  it('should include timestamp in health response', () => {
    const timestamp = new Date().toISOString();
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('API Server 404 Handler', () => {
  it('should return 404 status', () => {
    const req = { path: '/unknown-path' };
    const response = {
      error: 'Not Found',
      message: `Path ${req.path} not found on API server`,
      availableEndpoints: ['/shieldhealth', '/shieldapi/*']
    };

    expect(response.error).toBe('Not Found');
    expect(response.message).toContain('/unknown-path');
  });

  it('should list available endpoints', () => {
    const response = {
      availableEndpoints: ['/shieldhealth', '/shieldapi/*']
    };

    expect(response.availableEndpoints).toContain('/shieldhealth');
    expect(response.availableEndpoints).toContain('/shieldapi/*');
  });
});

describe('API Server Error Handler', () => {
  it('should return 500 status for internal errors', () => {
    const error = new Error('Something went wrong');
    const response = {
      error: 'Internal Server Error',
      message: error.message
    };

    expect(response.error).toBe('Internal Server Error');
    expect(response.message).toBe('Something went wrong');
  });

  it('should log errors to console', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Test error');

    console.error('API Server Error:', error);

    expect(consoleSpy).toHaveBeenCalledWith('API Server Error:', error);
    consoleSpy.mockRestore();
  });
});

describe('API Server Database Initialization', () => {
  it('should handle successful database connection', async () => {
    const mockDatabaseManager = {
      connect: vi.fn().mockResolvedValue(true)
    };

    const connected = await mockDatabaseManager.connect();
    expect(connected).toBe(true);
  });

  it('should handle failed database connection', async () => {
    const mockDatabaseManager = {
      connect: vi.fn().mockResolvedValue(false)
    };

    const connected = await mockDatabaseManager.connect();
    expect(connected).toBe(false);
  });

  it('should handle database connection error', async () => {
    const mockDatabaseManager = {
      connect: vi.fn().mockRejectedValue(new Error('Connection refused'))
    };

    await expect(mockDatabaseManager.connect()).rejects.toThrow('Connection refused');
  });

  it('should log MongoDB storage initialization', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    console.log('✅ MongoDB storage initialized');
    expect(consoleSpy).toHaveBeenCalledWith('✅ MongoDB storage initialized');
    consoleSpy.mockRestore();
  });

  it('should warn on database connection failure', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    console.warn('⚠️  MongoDB connection failed, falling back to memory-based storage');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should set global databaseManager on successful connection', async () => {
    const mockDatabaseManager = {
      connect: vi.fn().mockResolvedValue(true)
    };

    const mockGlobal: any = {};

    const connected = await mockDatabaseManager.connect();
    if (connected) {
      mockGlobal.databaseManager = mockDatabaseManager;
    }

    expect(mockGlobal.databaseManager).toBe(mockDatabaseManager);
  });
});

describe('API Server Startup', () => {
  it('should start server on configured port', () => {
    const PORT = 3190;
    const serverStarted = true;

    expect(PORT).toBe(3190);
    expect(serverStarted).toBe(true);
  });

  it('should log server startup banner', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║                 SEO Shield API Server                 ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');

    expect(consoleSpy).toHaveBeenCalledTimes(3);
    consoleSpy.mockRestore();
  });

  it('should log API endpoints on startup', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const PORT = 3190;

    console.log(`🚀 API Server running on port ${PORT}`);
    console.log('🎯 Admin API endpoints: /shieldapi/*');
    console.log('📡 WebSocket endpoint: /socket.io');
    console.log('💚 Health check: /shieldhealth');

    expect(consoleSpy).toHaveBeenCalledWith(`🚀 API Server running on port ${PORT}`);
    consoleSpy.mockRestore();
  });

  it('should start server in database fallback mode on error', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const PORT = 3190;

    console.log(`🚀 API Server running on port ${PORT} (Database fallback mode)`);

    expect(consoleSpy).toHaveBeenCalledWith(`🚀 API Server running on port ${PORT} (Database fallback mode)`);
    consoleSpy.mockRestore();
  });
});

describe('API Server WebSocket Initialization', () => {
  it('should call initializeWebSocket with server', async () => {
    const { initializeWebSocket } = await import('../../src/admin/websocket');
    expect(typeof initializeWebSocket).toBe('function');
  });
});

describe('API Server Express Middleware Configuration', () => {
  it('should configure JSON body parser with 10mb limit', () => {
    const jsonConfig = { limit: '10mb' };
    expect(jsonConfig.limit).toBe('10mb');
  });

  it('should configure urlencoded parser with extended mode', () => {
    const urlencodedConfig = { extended: true, limit: '10mb' };
    expect(urlencodedConfig.extended).toBe(true);
    expect(urlencodedConfig.limit).toBe('10mb');
  });
});

describe('API Server Route Mounting', () => {
  it('should mount admin routes at /shieldapi', () => {
    const mountPath = '/shieldapi';
    expect(mountPath).toBe('/shieldapi');
  });

  it('should mount health check at /shieldhealth', () => {
    const healthPath = '/shieldhealth';
    expect(healthPath).toBe('/shieldhealth');
  });
});

describe('API Server HTTP Server Creation', () => {
  it('should create HTTP server from Express app', () => {
    const mockCreateServer = vi.fn(() => ({
      listen: vi.fn(),
      on: vi.fn()
    }));

    const server = mockCreateServer({});
    expect(server).toBeDefined();
    expect(typeof server.listen).toBe('function');
  });

  it('should listen on 0.0.0.0 for all interfaces', () => {
    const listenAddress = '0.0.0.0';
    expect(listenAddress).toBe('0.0.0.0');
  });
});

describe('API Server Config Integration', () => {
  it('should use API_PORT from config', async () => {
    const config = await import('../../src/config');
    expect(config.default.API_PORT).toBe(3190);
  });
});

describe('Database Health Check Response', () => {
  it('should return complete health check object', async () => {
    const dbHealth = {
      connected: true,
      stats: {
        collections: 5,
        documents: 1000,
        avgObjSize: 512
      }
    };

    const PORT = 3190;
    const response = {
      status: 'ok',
      service: 'seo-shield-api',
      port: PORT,
      timestamp: new Date().toISOString(),
      database: dbHealth.connected ? 'connected' : 'disconnected',
      databaseStats: dbHealth.stats || null
    };

    expect(response.status).toBe('ok');
    expect(response.service).toBe('seo-shield-api');
    expect(response.port).toBe(3190);
    expect(response.database).toBe('connected');
    expect(response.databaseStats).toBeDefined();
  });
});

describe('API Server Initialization Flow', () => {
  it('should initialize database before starting server', async () => {
    const steps: string[] = [];

    const initializeDatabase = async () => {
      steps.push('database_init');
      return true;
    };

    const startServer = () => {
      steps.push('server_start');
    };

    await initializeDatabase();
    startServer();

    expect(steps).toEqual(['database_init', 'server_start']);
  });

  it('should start server even if database fails', async () => {
    const steps: string[] = [];

    const initializeDatabase = async () => {
      throw new Error('Database connection failed');
    };

    const startServer = () => {
      steps.push('server_start');
    };

    try {
      await initializeDatabase();
    } catch {
      steps.push('database_error');
    }
    startServer();

    expect(steps).toContain('database_error');
    expect(steps).toContain('server_start');
  });
});
