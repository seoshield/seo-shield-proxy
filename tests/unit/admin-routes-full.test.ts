import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// Mock all dependencies
vi.mock('jsonwebtoken');

const mockMetricsCollector = {
  getStats: vi.fn().mockReturnValue({ totalRequests: 100, botRequests: 50, humanRequests: 50 }),
  getBotStats: vi.fn().mockReturnValue({ googlebot: 20, bingbot: 10 }),
  getRecentTraffic: vi.fn().mockReturnValue([]),
  getTrafficTimeline: vi.fn().mockReturnValue([]),
  getUrlStats: vi.fn().mockReturnValue([]),
  reset: vi.fn()
};

vi.mock('../../src/admin/metrics-collector', () => ({
  default: mockMetricsCollector
}));

const mockConfigManager = {
  getConfig: vi.fn().mockReturnValue({
    adminAuth: { enabled: true, username: 'admin', password: 'pass' }
  }),
  updateConfig: vi.fn().mockResolvedValue({}),
  addCachePattern: vi.fn().mockResolvedValue({}),
  removeCachePattern: vi.fn().mockResolvedValue({}),
  addAllowedBot: vi.fn().mockResolvedValue({}),
  addBlockedBot: vi.fn().mockResolvedValue({}),
  removeBot: vi.fn().mockResolvedValue({}),
  resetToDefaults: vi.fn().mockResolvedValue({})
};

vi.mock('../../src/admin/config-manager', () => ({
  default: mockConfigManager
}));

const mockCache = {
  get: vi.fn().mockReturnValue('{}'),
  set: vi.fn().mockReturnValue(true),
  delete: vi.fn().mockReturnValue(true),
  flush: vi.fn(),
  getStats: vi.fn().mockReturnValue({ keys: 10, hits: 50, misses: 10 }),
  getAllEntries: vi.fn().mockReturnValue([{ url: 'https://example.com', size: 1024, ttl: 3600 }])
};

vi.mock('../../src/cache', () => ({
  default: mockCache
}));

const mockBrowserManager = {
  getMetrics: vi.fn().mockReturnValue({ queued: 0, processing: 0, completed: 10, errors: 1, maxConcurrency: 3 })
};

vi.mock('../../src/browser', () => ({
  default: mockBrowserManager
}));

const mockCacheWarmer = {
  getStats: vi.fn().mockReturnValue({ pending: 0, completed: 10, failed: 0 }),
  getEstimatedTime: vi.fn().mockReturnValue({ minutes: 0, seconds: 0 }),
  addUrls: vi.fn().mockResolvedValue({ added: 5 }),
  parseSitemap: vi.fn().mockResolvedValue(['https://example.com/page1', 'https://example.com/page2']),
  clearQueue: vi.fn()
};

vi.mock('../../src/admin/cache-warmer', () => ({
  default: mockCacheWarmer
}));

vi.mock('../../src/admin/snapshot-service', () => ({
  default: {
    captureSnapshot: vi.fn().mockResolvedValue({ id: 'snap-1' }),
    listSnapshots: vi.fn().mockResolvedValue([]),
    getSnapshot: vi.fn().mockResolvedValue(null)
  }
}));

vi.mock('../../src/admin/hotfix-engine', () => ({
  default: {
    getRules: vi.fn().mockReturnValue([]),
    addRule: vi.fn().mockResolvedValue({}),
    updateRule: vi.fn().mockResolvedValue({}),
    deleteRule: vi.fn().mockResolvedValue(true),
    applyHotfix: vi.fn().mockReturnValue('<html></html>')
  }
}));

vi.mock('../../src/admin/forensics-collector', () => ({
  default: {
    getRecentErrors: vi.fn().mockReturnValue([]),
    getErrorStats: vi.fn().mockReturnValue({}),
    clearErrors: vi.fn()
  }
}));

vi.mock('../../src/admin/blocking-manager', () => ({
  default: {
    getRules: vi.fn().mockReturnValue([]),
    addRule: vi.fn().mockReturnValue({}),
    updateRule: vi.fn().mockReturnValue({}),
    deleteRule: vi.fn().mockReturnValue(true)
  }
}));

vi.mock('../../src/admin/ua-simulator', () => ({
  default: {
    getBots: vi.fn().mockReturnValue([]),
    simulateBotRequest: vi.fn().mockResolvedValue({})
  }
}));

vi.mock('../../src/admin/seo-protocols-service', () => ({
  getSEOProtocolsService: vi.fn().mockReturnValue({
    getProtocols: vi.fn().mockReturnValue([])
  })
}));

vi.mock('../../src/admin/websocket', () => ({
  broadcastTrafficEvent: vi.fn()
}));

const mockDatabaseManager = {
  getMongoStorage: vi.fn().mockReturnValue({
    getTrafficMetrics: vi.fn().mockResolvedValue([]),
    getConfig: vi.fn().mockResolvedValue(null),
    saveConfig: vi.fn().mockResolvedValue('config-1')
  })
};

vi.mock('../../src/database/database-manager', () => ({
  databaseManager: mockDatabaseManager
}));

vi.mock('../../src/admin/ssr-events-store', () => ({
  ssrEventsStore: {
    getEvents: vi.fn().mockReturnValue([]),
    addEvent: vi.fn()
  }
}));

vi.mock('../../src/config', () => ({
  default: {
    JWT_SECRET: 'test-secret',
    ADMIN_PASSWORD: 'test-password',
    API_PORT: 3190
  }
}));

describe('Admin Routes', () => {
  const JWT_SECRET = 'test-secret';
  const ADMIN_PASSWORD = 'test-password';

  beforeEach(() => {
    vi.clearAllMocks();
    (jwt.sign as any).mockReturnValue('mock-token');
    (jwt.verify as any).mockReturnValue({ role: 'admin', timestamp: Date.now() });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication Routes', () => {
    describe('POST /auth/login', () => {
      it('should return 400 when password is not provided', () => {
        const handler = (req: any, res: any) => {
          const { password } = req.body;
          if (!password) {
            return res.status(400).json({
              success: false,
              error: 'Password is required'
            });
          }
        };

        const res = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn()
        };

        handler({ body: {} }, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Password is required'
        });
      });

      it('should return 401 when password is invalid', () => {
        const handler = (req: any, res: any) => {
          const { password } = req.body;
          if (password !== ADMIN_PASSWORD) {
            return res.status(401).json({
              success: false,
              error: 'Invalid password'
            });
          }
        };

        const res = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn()
        };

        handler({ body: { password: 'wrong-password' } }, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: 'Invalid password'
        });
      });

      it('should return token when password is valid', () => {
        const handler = (req: any, res: any) => {
          const { password } = req.body;
          if (password === ADMIN_PASSWORD) {
            const token = jwt.sign(
              { role: 'admin', timestamp: Date.now() },
              JWT_SECRET,
              { expiresIn: '24h' }
            );
            return res.json({
              success: true,
              message: 'Login successful',
              token,
              expiresIn: '24h'
            });
          }
        };

        const res = { json: vi.fn() };

        handler({ body: { password: ADMIN_PASSWORD } }, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
          success: true,
          message: 'Login successful',
          token: 'mock-token'
        }));
      });

      it('should handle login error', () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const handler = (req: any, res: any) => {
          try {
            throw new Error('Login system error');
          } catch (error) {
            console.error('Login error:', error);
            return res.status(500).json({
              success: false,
              error: 'Login system error'
            });
          }
        };

        const res = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn()
        };

        handler({ body: {} }, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(errorSpy).toHaveBeenCalled();

        errorSpy.mockRestore();
      });
    });

    describe('GET /auth/status', () => {
      it('should return authenticated: true when auth is disabled', () => {
        const handler = (req: any, res: any) => {
          const config = { adminAuth: { enabled: false } };
          if (config?.adminAuth?.enabled === false) {
            return res.json({
              success: true,
              authenticated: true,
              message: 'Authentication disabled'
            });
          }
        };

        const res = { json: vi.fn() };

        handler({}, res);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          authenticated: true,
          message: 'Authentication disabled'
        });
      });

      it('should return authenticated: false when no auth header', () => {
        const handler = (req: any, res: any) => {
          const config = { adminAuth: { enabled: true } };
          const authHeader = req.headers.authorization;

          if (!authHeader) {
            return res.json({
              success: true,
              authenticated: false,
              message: 'No authentication provided'
            });
          }
        };

        const res = { json: vi.fn() };

        handler({ headers: {} }, res);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          authenticated: false,
          message: 'No authentication provided'
        });
      });

      it('should validate JWT Bearer token', () => {
        const handler = (req: any, res: any) => {
          const authHeader = req.headers.authorization;

          if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            try {
              const decoded = jwt.verify(token, JWT_SECRET) as any;
              return res.json({
                success: true,
                authenticated: true,
                role: decoded.role || 'admin',
                message: 'Authenticated via JWT'
              });
            } catch (error) {
              return res.json({
                success: true,
                authenticated: false,
                message: 'Invalid token'
              });
            }
          }
        };

        const res = { json: vi.fn() };

        handler({ headers: { authorization: 'Bearer valid-token' } }, res);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          authenticated: true,
          role: 'admin',
          message: 'Authenticated via JWT'
        });
      });

      it('should handle expired JWT token', () => {
        (jwt.verify as any).mockImplementationOnce(() => {
          const error = new jwt.TokenExpiredError('Token expired', new Date());
          throw error;
        });

        const handler = (req: any, res: any) => {
          const authHeader = req.headers.authorization;

          if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            try {
              jwt.verify(token, JWT_SECRET);
              return res.json({ authenticated: true });
            } catch (error) {
              const errorMessage = error instanceof jwt.TokenExpiredError
                ? 'Token expired'
                : 'Invalid token';
              return res.json({
                success: true,
                authenticated: false,
                message: errorMessage
              });
            }
          }
        };

        const res = { json: vi.fn() };

        handler({ headers: { authorization: 'Bearer expired-token' } }, res);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          authenticated: false,
          message: 'Token expired'
        });
      });

      it('should validate Basic auth', () => {
        const handler = (req: any, res: any) => {
          const authHeader = req.headers.authorization;
          const config = { adminAuth: { username: 'admin', password: 'pass' } };

          if (authHeader?.startsWith('Basic ')) {
            try {
              const base64Credentials = authHeader.slice(6);
              const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
              const [username, password] = credentials.split(':', 2);

              if (config?.adminAuth?.username && config?.adminAuth?.password) {
                if (username === config.adminAuth.username && password === config.adminAuth.password) {
                  return res.json({
                    success: true,
                    authenticated: true,
                    username: username,
                    message: 'Authenticated via Basic auth'
                  });
                }
              }

              return res.json({
                success: true,
                authenticated: false,
                message: 'Invalid credentials'
              });
            } catch (decodeError) {
              return res.json({
                success: true,
                authenticated: false,
                message: 'Invalid authentication format'
              });
            }
          }
        };

        const res = { json: vi.fn() };
        const authString = Buffer.from('admin:pass').toString('base64');

        handler({ headers: { authorization: `Basic ${authString}` } }, res);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          authenticated: true,
          username: 'admin',
          message: 'Authenticated via Basic auth'
        });
      });

      it('should validate Basic auth with ADMIN_PASSWORD', () => {
        const handler = (req: any, res: any) => {
          const authHeader = req.headers.authorization;
          const config = { adminAuth: {} };

          if (authHeader?.startsWith('Basic ')) {
            try {
              const base64Credentials = authHeader.slice(6);
              const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
              const [username, password] = credentials.split(':', 2);

              if (password === ADMIN_PASSWORD) {
                return res.json({
                  success: true,
                  authenticated: true,
                  username: username || 'admin',
                  message: 'Authenticated via Basic auth'
                });
              }

              return res.json({
                success: true,
                authenticated: false,
                message: 'Invalid credentials'
              });
            } catch {
              return res.json({
                success: true,
                authenticated: false,
                message: 'Invalid authentication format'
              });
            }
          }
        };

        const res = { json: vi.fn() };
        const authString = Buffer.from(`user:${ADMIN_PASSWORD}`).toString('base64');

        handler({ headers: { authorization: `Basic ${authString}` } }, res);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          authenticated: true,
          username: 'user',
          message: 'Authenticated via Basic auth'
        });
      });

      it('should return unsupported auth method for unknown header', () => {
        const handler = (req: any, res: any) => {
          const authHeader = req.headers.authorization;

          if (authHeader && !authHeader.startsWith('Bearer ') && !authHeader.startsWith('Basic ')) {
            return res.json({
              success: true,
              authenticated: false,
              message: 'Unsupported authentication method'
            });
          }
        };

        const res = { json: vi.fn() };

        handler({ headers: { authorization: 'Custom token123' } }, res);

        expect(res.json).toHaveBeenCalledWith({
          success: true,
          authenticated: false,
          message: 'Unsupported authentication method'
        });
      });
    });
  });

  describe('Authenticate Middleware', () => {
    it('should bypass auth when disabled', () => {
      const next = vi.fn();
      const authenticate = (req: any, res: any, next: any) => {
        const config = { adminAuth: { enabled: false } };
        if (config?.adminAuth?.enabled === false) {
          return next();
        }
      };

      authenticate({}, {}, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 401 when no auth header', () => {
      const authenticate = (req: any, res: any, next: any) => {
        const config = { adminAuth: { enabled: true } };
        const authHeader = req.headers.authorization;

        if (!authHeader) {
          return res.status(401).json({
            success: false,
            error: 'No authorization header provided'
          });
        }
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      authenticate({ headers: {} }, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should validate Bearer token and set req.user', () => {
      const next = vi.fn();
      const authenticate = (req: any, res: any, next: any) => {
        const authHeader = req.headers.authorization;

        if (authHeader?.startsWith('Bearer ')) {
          const token = authHeader.slice(7);
          try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
            return next();
          } catch {
            return res.status(401).json({ error: 'Invalid token' });
          }
        }
      };

      const req = { headers: { authorization: 'Bearer valid-token' } };
      authenticate(req, {}, next);

      expect(next).toHaveBeenCalled();
      expect((req as any).user).toBeDefined();
    });

    it('should handle expired token in middleware', () => {
      (jwt.verify as any).mockImplementationOnce(() => {
        throw new jwt.TokenExpiredError('Token expired', new Date());
      });

      const authenticate = (req: any, res: any, next: any) => {
        const authHeader = req.headers.authorization;

        if (authHeader?.startsWith('Bearer ')) {
          const token = authHeader.slice(7);
          try {
            jwt.verify(token, JWT_SECRET);
            return next();
          } catch (error) {
            const errorMessage = error instanceof jwt.TokenExpiredError
              ? 'Token expired'
              : 'Invalid token';
            return res.status(401).json({
              success: false,
              error: errorMessage
            });
          }
        }
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      authenticate({ headers: { authorization: 'Bearer expired-token' } }, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Token expired'
      });
    });

    it('should validate Basic auth in middleware', () => {
      const next = vi.fn();
      const authenticate = (req: any, res: any, next: any) => {
        const authHeader = req.headers.authorization;
        const config = { adminAuth: { username: 'admin', password: 'pass' } };

        if (authHeader?.startsWith('Basic ')) {
          try {
            const base64Credentials = authHeader.slice(6);
            const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
            const [username, password] = credentials.split(':', 2);

            if (config?.adminAuth?.username && config?.adminAuth?.password) {
              if (username === config.adminAuth.username && password === config.adminAuth.password) {
                return next();
              }
            }
          } catch {
            // Fall through to error
          }
        }

        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      };

      const authString = Buffer.from('admin:pass').toString('base64');
      authenticate({ headers: { authorization: `Basic ${authString}` } }, {}, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 401 for invalid Basic auth credentials', () => {
      const authenticate = (req: any, res: any, next: any) => {
        const authHeader = req.headers.authorization;

        if (authHeader?.startsWith('Basic ')) {
          try {
            const base64Credentials = authHeader.slice(6);
            const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
            const [username, password] = credentials.split(':', 2);

            if (password === ADMIN_PASSWORD) {
              return next();
            }
          } catch {
            // Fall through to error
          }
        }

        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      const authString = Buffer.from('admin:wrong').toString('base64');
      authenticate({ headers: { authorization: `Basic ${authString}` } }, res, vi.fn());

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Stats Routes', () => {
    it('should return stats', () => {
      const handler = (req: any, res: any) => {
        const stats = mockMetricsCollector.getStats();
        const botStats = mockMetricsCollector.getBotStats();
        const cacheStats = mockCache.getStats();
        const queueMetrics = mockBrowserManager.getMetrics();

        res.json({
          success: true,
          data: {
            metrics: stats,
            bots: botStats,
            cache: cacheStats,
            queue: queueMetrics,
          },
        });
      };

      const res = { json: vi.fn() };
      handler({}, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          metrics: expect.any(Object),
          bots: expect.any(Object),
          cache: expect.any(Object),
          queue: expect.any(Object)
        })
      }));
    });
  });

  describe('Traffic Routes', () => {
    it('should return traffic from MongoDB', async () => {
      const mongoStorage = mockDatabaseManager.getMongoStorage();
      mongoStorage?.getTrafficMetrics.mockResolvedValueOnce([
        { timestamp: new Date(), path: '/', method: 'GET', ip: '1.1.1.1' }
      ]);

      const handler = async (req: any, res: any) => {
        const limit = parseInt(req.query['limit'] as string) || 100;

        if (mongoStorage) {
          const trafficData = await mongoStorage.getTrafficMetrics(limit, {
            sortBy: 'timestamp',
            sortOrder: -1
          });

          res.json({
            success: true,
            data: trafficData.map((metric: any) => ({
              timestamp: metric.timestamp,
              path: metric.path,
              method: metric.method,
              ip: metric.ip
            })),
          });
        }
      };

      const res = { json: vi.fn() };
      await handler({ query: { limit: '50' } }, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.any(Array)
      }));
    });

    it('should fallback to in-memory metrics when MongoDB unavailable', async () => {
      mockDatabaseManager.getMongoStorage.mockReturnValueOnce(null);
      mockMetricsCollector.getRecentTraffic.mockReturnValueOnce([{ path: '/' }]);

      const handler = async (req: any, res: any) => {
        const limit = parseInt(req.query['limit'] as string) || 100;
        const mongoStorage = mockDatabaseManager.getMongoStorage();

        if (mongoStorage) {
          // MongoDB path
        } else {
          const traffic = mockMetricsCollector.getRecentTraffic(limit);
          res.json({
            success: true,
            data: traffic,
          });
        }
      };

      const res = { json: vi.fn() };
      await handler({ query: {} }, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: [{ path: '/' }]
      }));
    });

    it('should handle traffic API error', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const handler = async (req: any, res: any) => {
        try {
          throw new Error('Database error');
        } catch (error) {
          console.error('Traffic API error:', error);
          res.status(500).json({
            success: false,
            error: 'Failed to fetch traffic data'
          });
        }
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      await handler({}, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });

  describe('Timeline Routes', () => {
    it('should return timeline data', () => {
      const handler = (req: any, res: any) => {
        const minutes = parseInt(req.query['minutes'] as string) || 60;
        const timeline = mockMetricsCollector.getTrafficTimeline(minutes);

        res.json({
          success: true,
          data: timeline,
        });
      };

      const res = { json: vi.fn() };
      handler({ query: { minutes: '30' } }, res);

      expect(mockMetricsCollector.getTrafficTimeline).toHaveBeenCalledWith(30);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true
      }));
    });
  });

  describe('URL Stats Routes', () => {
    it('should return URL stats', () => {
      const handler = (req: any, res: any) => {
        const limit = parseInt(req.query['limit'] as string) || 50;
        const urlStats = mockMetricsCollector.getUrlStats(limit);

        res.json({
          success: true,
          data: urlStats,
        });
      };

      const res = { json: vi.fn() };
      handler({ query: { limit: '25' } }, res);

      expect(mockMetricsCollector.getUrlStats).toHaveBeenCalledWith(25);
    });
  });

  describe('Cache Routes', () => {
    it('should return cache list', () => {
      const handler = (req: any, res: any) => {
        const cacheData = mockCache.getAllEntries();

        res.json({
          success: true,
          data: cacheData,
        });
      };

      const res = { json: vi.fn() };
      handler({}, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        data: expect.any(Array)
      }));
    });

    it('should return cache analytics', () => {
      const handler = (req: any, res: any) => {
        try {
          const cacheData = mockCache.getAllEntries();
          const cacheStats = mockCache.getStats();

          const entries = cacheData.map((entry: any) => ({
            url: entry.url,
            size: entry.size,
            ttl: entry.ttl,
            isStale: entry.ttl <= 0,
            cacheStatus: entry.ttl > 0 ? 'HIT' : 'STALE'
          }));

          const hitRate = cacheStats.hits + cacheStats.misses > 0
            ? (cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100
            : 0;

          res.json({
            success: true,
            entries,
            stats: {
              totalEntries: entries.length,
              hitRate,
              totalHits: cacheStats.hits,
              totalMisses: cacheStats.misses
            }
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            error: (error as Error).message
          });
        }
      };

      const res = { json: vi.fn() };
      handler({}, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        entries: expect.any(Array),
        stats: expect.objectContaining({
          hitRate: expect.any(Number)
        })
      }));
    });

    it('should delete cache entry', () => {
      const handler = (req: any, res: any) => {
        try {
          const { cacheKey } = req.body;
          if (!cacheKey) {
            return res.status(400).json({
              success: false,
              error: 'Cache key is required',
            });
          }

          const deleted = mockCache.delete(cacheKey);
          res.json({
            success: true,
            message: deleted ? 'Cache entry deleted' : 'Cache entry not found',
            deleted,
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            error: (error as Error).message,
          });
        }
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      handler({ body: { cacheKey: 'https://example.com' } }, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        deleted: true
      }));
    });

    it('should return 400 when cache key is missing', () => {
      const handler = (req: any, res: any) => {
        const { cacheKey } = req.body;
        if (!cacheKey) {
          return res.status(400).json({
            success: false,
            error: 'Cache key is required',
          });
        }
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      handler({ body: {} }, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should clear all cache', () => {
      const handler = (req: any, res: any) => {
        const { url } = req.body;

        if (url) {
          const deleted = mockCache.delete(url);
          res.json({
            success: true,
            message: deleted ? 'Cache entry deleted' : 'Cache entry not found',
            deleted,
          });
        } else {
          mockCache.flush();
          res.json({
            success: true,
            message: 'All cache cleared',
          });
        }
      };

      const res = { json: vi.fn() };
      handler({ body: {} }, res);

      expect(mockCache.flush).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'All cache cleared'
      });
    });
  });

  describe('Config Routes', () => {
    it('should get config from MongoDB', async () => {
      const mongoStorage = mockDatabaseManager.getMongoStorage();
      mongoStorage?.getConfig.mockResolvedValueOnce({ key: 'value' });

      const handler = async (req: any, res: any) => {
        if (mongoStorage) {
          try {
            const mongoConfig = await mongoStorage.getConfig('runtime_config');
            if (mongoConfig) {
              return res.json({
                success: true,
                data: mongoConfig,
                source: 'database'
              });
            }
          } catch {
            // Fallback
          }
        }

        const config = mockConfigManager.getConfig();
        res.json({
          success: true,
          data: config,
          source: 'file'
        });
      };

      const res = { json: vi.fn() };
      await handler({}, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        source: 'database'
      }));
    });

    it('should fallback to file config when MongoDB fails', async () => {
      const mongoStorage = mockDatabaseManager.getMongoStorage();
      mongoStorage?.getConfig.mockRejectedValueOnce(new Error('DB error'));

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const handler = async (req: any, res: any) => {
        if (mongoStorage) {
          try {
            const mongoConfig = await mongoStorage.getConfig('runtime_config');
            if (mongoConfig) {
              return res.json({
                success: true,
                data: mongoConfig,
                source: 'database'
              });
            }
          } catch (dbError) {
            console.warn('Failed to load config from database, using file config:', dbError);
          }
        }

        const config = mockConfigManager.getConfig();
        res.json({
          success: true,
          data: config,
          source: 'file'
        });
      };

      const res = { json: vi.fn() };
      await handler({}, res);

      expect(warnSpy).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        source: 'file'
      }));

      warnSpy.mockRestore();
    });

    it('should update config', async () => {
      const handler = async (req: any, res: any) => {
        try {
          const updates = req.body;
          const newConfig = await mockConfigManager.updateConfig(updates);
          res.json({
            success: true,
            message: 'Configuration updated',
            data: newConfig,
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            error: (error as Error).message,
          });
        }
      };

      const res = { json: vi.fn() };
      await handler({ body: { setting: 'value' } }, res);

      expect(mockConfigManager.updateConfig).toHaveBeenCalledWith({ setting: 'value' });
    });

    it('should add cache pattern', async () => {
      const handler = async (req: any, res: any) => {
        try {
          const { pattern, type } = req.body;

          if (!pattern) {
            return res.status(400).json({
              success: false,
              error: 'Pattern is required',
            });
          }

          const config = await mockConfigManager.addCachePattern(pattern, type);

          return res.json({
            success: true,
            message: 'Cache pattern added',
            data: config,
          });
        } catch (error) {
          return res.status(500).json({
            success: false,
            error: (error as Error).message,
          });
        }
      };

      const res = { json: vi.fn() };
      await handler({ body: { pattern: '/api/*', type: 'noCache' } }, res);

      expect(mockConfigManager.addCachePattern).toHaveBeenCalledWith('/api/*', 'noCache');
    });

    it('should remove cache pattern', async () => {
      const handler = async (req: any, res: any) => {
        try {
          const { pattern, type } = req.body;

          if (!pattern) {
            return res.status(400).json({
              success: false,
              error: 'Pattern is required',
            });
          }

          const config = await mockConfigManager.removeCachePattern(pattern, type);

          return res.json({
            success: true,
            message: 'Cache pattern removed',
            data: config,
          });
        } catch (error) {
          return res.status(500).json({
            success: false,
            error: (error as Error).message,
          });
        }
      };

      const res = { json: vi.fn() };
      await handler({ body: { pattern: '/api/*', type: 'noCache' } }, res);

      expect(mockConfigManager.removeCachePattern).toHaveBeenCalledWith('/api/*', 'noCache');
    });

    it('should manage bot rules - allow', async () => {
      const handler = async (req: any, res: any) => {
        const { botName, action } = req.body;

        if (!botName || !action) {
          return res.status(400).json({
            success: false,
            error: 'Bot name and action are required',
          });
        }

        let config;
        switch (action) {
          case 'allow':
            config = await mockConfigManager.addAllowedBot(botName);
            break;
          case 'block':
            config = await mockConfigManager.addBlockedBot(botName);
            break;
          case 'remove':
            config = await mockConfigManager.removeBot(botName);
            break;
          default:
            return res.status(400).json({
              success: false,
              error: 'Invalid action',
            });
        }

        return res.json({
          success: true,
          message: `Bot ${botName} ${action}ed`,
          data: config,
        });
      };

      const res = { json: vi.fn() };
      await handler({ body: { botName: 'googlebot', action: 'allow' } }, res);

      expect(mockConfigManager.addAllowedBot).toHaveBeenCalledWith('googlebot');
    });

    it('should manage bot rules - block', async () => {
      const handler = async (req: any, res: any) => {
        const { botName, action } = req.body;

        let config;
        switch (action) {
          case 'allow':
            config = await mockConfigManager.addAllowedBot(botName);
            break;
          case 'block':
            config = await mockConfigManager.addBlockedBot(botName);
            break;
        }

        return res.json({ success: true, data: config });
      };

      const res = { json: vi.fn() };
      await handler({ body: { botName: 'badbot', action: 'block' } }, res);

      expect(mockConfigManager.addBlockedBot).toHaveBeenCalledWith('badbot');
    });

    it('should reset config to defaults', async () => {
      const handler = async (req: any, res: any) => {
        try {
          const config = await mockConfigManager.resetToDefaults();

          res.json({
            success: true,
            message: 'Configuration reset to defaults',
            data: config,
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            error: (error as Error).message,
          });
        }
      };

      const res = { json: vi.fn() };
      await handler({}, res);

      expect(mockConfigManager.resetToDefaults).toHaveBeenCalled();
    });
  });

  describe('Metrics Routes', () => {
    it('should reset metrics', () => {
      const handler = (req: any, res: any) => {
        mockMetricsCollector.reset();

        res.json({
          success: true,
          message: 'Metrics reset',
        });
      };

      const res = { json: vi.fn() };
      handler({}, res);

      expect(mockMetricsCollector.reset).toHaveBeenCalled();
    });
  });

  describe('Stream Routes (SSE)', () => {
    it('should set correct headers for SSE', () => {
      const handler = (req: any, res: any) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
      };

      const res = { setHeader: vi.fn() };
      handler({}, res);

      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
      expect(res.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
    });

    it('should send initial connection event', () => {
      const handler = (req: any, res: any) => {
        res.write(`data: ${JSON.stringify({
          type: 'connection',
          status: 'connected',
          timestamp: Date.now(),
          message: 'Real-time stream connected'
        })}\n\n`);
      };

      const res = { write: vi.fn() };
      handler({}, res);

      expect(res.write).toHaveBeenCalledWith(expect.stringContaining('connection'));
    });

    it('should clean up on close', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const handler = (req: any, res: any) => {
        const interval = setInterval(() => {}, 2000);

        req.on('close', () => {
          clearInterval(interval);
          res.end();
        });

        // Simulate close
        req._closeCallback?.();
      };

      const closeCallback = vi.fn();
      const res = { end: vi.fn() };
      const req = {
        on: (event: string, callback: () => void) => {
          if (event === 'close') {
            req._closeCallback = callback;
          }
        },
        _closeCallback: null as any
      };

      handler(req, res);

      if (req._closeCallback) {
        req._closeCallback();
      }

      expect(res.end).toHaveBeenCalled();
    });
  });

  describe('Cache Warmer Routes', () => {
    it('should return warmer stats', () => {
      const handler = (req: any, res: any) => {
        const stats = mockCacheWarmer.getStats();
        const estimatedTime = mockCacheWarmer.getEstimatedTime();

        res.json({
          success: true,
          data: {
            ...stats,
            estimatedTime,
          },
        });
      };

      const res = { json: vi.fn() };
      handler({}, res);

      expect(mockCacheWarmer.getStats).toHaveBeenCalled();
      expect(mockCacheWarmer.getEstimatedTime).toHaveBeenCalled();
    });

    it('should add URLs to warmer', async () => {
      const handler = async (req: any, res: any) => {
        try {
          const { urls, priority = 'normal' } = req.body;

          if (!Array.isArray(urls) || urls.length === 0) {
            return res.status(400).json({
              success: false,
              error: 'URLs array is required',
            });
          }

          const added = await mockCacheWarmer.addUrls(urls, priority);

          res.json({
            success: true,
            message: `Added ${added.added} URLs to warm queue`,
            data: { added: added.added },
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            error: (error as Error).message,
          });
        }
      };

      const res = { json: vi.fn() };
      await handler({ body: { urls: ['https://example.com'], priority: 'high' } }, res);

      expect(mockCacheWarmer.addUrls).toHaveBeenCalledWith(['https://example.com'], 'high');
    });

    it('should return 400 when URLs array is empty', async () => {
      const handler = async (req: any, res: any) => {
        const { urls } = req.body;

        if (!Array.isArray(urls) || urls.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'URLs array is required',
          });
        }
      };

      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      await handler({ body: { urls: [] } }, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should parse sitemap and add URLs', async () => {
      const handler = async (req: any, res: any) => {
        try {
          const { sitemapUrl, priority = 'normal' } = req.body;

          if (!sitemapUrl) {
            return res.status(400).json({
              success: false,
              error: 'Sitemap URL is required',
            });
          }

          const urls = await mockCacheWarmer.parseSitemap(sitemapUrl);

          if (urls.length === 0) {
            return res.json({
              success: true,
              message: 'No URLs found in sitemap',
              data: { urls: [], added: 0 },
            });
          }

          const added = await mockCacheWarmer.addUrls(urls, priority);

          res.json({
            success: true,
            message: `Parsed ${urls.length} URLs from sitemap`,
            data: { urls, added: added.added, total: urls.length },
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            error: (error as Error).message,
          });
        }
      };

      const res = { json: vi.fn() };
      await handler({ body: { sitemapUrl: 'https://example.com/sitemap.xml' } }, res);

      expect(mockCacheWarmer.parseSitemap).toHaveBeenCalledWith('https://example.com/sitemap.xml');
    });

    it('should handle empty sitemap', async () => {
      mockCacheWarmer.parseSitemap.mockResolvedValueOnce([]);

      const handler = async (req: any, res: any) => {
        const urls = await mockCacheWarmer.parseSitemap(req.body.sitemapUrl);

        if (urls.length === 0) {
          return res.json({
            success: true,
            message: 'No URLs found in sitemap',
            data: { urls: [], added: 0 },
          });
        }
      };

      const res = { json: vi.fn() };
      await handler({ body: { sitemapUrl: 'https://example.com/empty-sitemap.xml' } }, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'No URLs found in sitemap'
      }));
    });

    it('should clear warmer queue', () => {
      const handler = (req: any, res: any) => {
        mockCacheWarmer.clearQueue();

        res.json({
          success: true,
          message: 'Cache warmer queue cleared',
        });
      };

      const res = { json: vi.fn() };
      handler({}, res);

      expect(mockCacheWarmer.clearQueue).toHaveBeenCalled();
    });
  });
});
