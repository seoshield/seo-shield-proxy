import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMockCursor = () => ({
  sort: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  toArray: vi.fn().mockResolvedValue([])
});

const createMockCollection = () => ({
  insertOne: vi.fn().mockResolvedValue({ insertedId: 'test' }),
  find: vi.fn().mockReturnValue(createMockCursor()),
  findOne: vi.fn().mockResolvedValue(null),
  updateOne: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
  deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
  countDocuments: vi.fn().mockResolvedValue(5)
});

const mockDb = {
  collection: vi.fn().mockReturnValue(createMockCollection()),
  listCollections: vi.fn().mockReturnValue({
    toArray: vi.fn().mockResolvedValue([
      { name: 'traffic' },
      { name: 'audit_logs' },
      { name: 'error_logs' }
    ])
  }),
  stats: vi.fn().mockResolvedValue({
    db: 'test_db',
    storageSize: 1024000,
    dataSize: 512000,
    collections: 3
  })
};

describe('MongoStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should import MongoStorage', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    expect(module.MongoStorage).toBeDefined();
  });

  it('should create instance with Db object', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);
    expect(storage).toBeDefined();
  });

  it('should have isReady method', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);
    expect(typeof storage.isReady).toBe('function');
  });

  it('should return ready status', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);
    expect(storage.isReady()).toBe(true);
  });

  it('should have storeTrafficMetric method', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);
    expect(typeof storage.storeTrafficMetric).toBe('function');
  });

  it('should have getTrafficMetrics method', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);
    expect(typeof storage.getTrafficMetrics).toBe('function');
  });
});

describe('MongoStorage Traffic Methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should store traffic metric', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const metric = {
      timestamp: new Date(),
      path: '/test',
      userAgent: 'Test UA',
      isBot: false,
      action: 'proxy' as const
    };

    await storage.storeTrafficMetric(metric);
    expect(mockDb.collection).toHaveBeenCalledWith('traffic_metrics');
  });

  it('should get traffic metrics with default limit', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const metrics = await storage.getTrafficMetrics();
    expect(Array.isArray(metrics)).toBe(true);
  });

  it('should get traffic metrics with custom limit', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const metrics = await storage.getTrafficMetrics(50);
    expect(Array.isArray(metrics)).toBe(true);
  });

  it('should get traffic metrics with time filter', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const metrics = await storage.getTrafficMetrics(100, {
      startTime: new Date('2024-01-01'),
      endTime: new Date('2024-12-31')
    });
    expect(Array.isArray(metrics)).toBe(true);
  });

  it('should get traffic metrics with bot filter', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const metrics = await storage.getTrafficMetrics(100, {
      filters: { isBot: true }
    });
    expect(Array.isArray(metrics)).toBe(true);
  });

  it('should get traffic metrics with botType filter', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const metrics = await storage.getTrafficMetrics(100, {
      filters: { botType: 'googlebot' }
    });
    expect(Array.isArray(metrics)).toBe(true);
  });

  it('should get traffic metrics with action filter', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const metrics = await storage.getTrafficMetrics(100, {
      filters: { action: 'ssr' }
    });
    expect(Array.isArray(metrics)).toBe(true);
  });

  it('should get traffic metrics with path filter', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const metrics = await storage.getTrafficMetrics(100, {
      filters: { path: '/api' }
    });
    expect(Array.isArray(metrics)).toBe(true);
  });

  it('should get traffic metrics with sort options', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const metrics = await storage.getTrafficMetrics(100, {
      sortBy: 'responseTime',
      sortOrder: 1
    });
    expect(Array.isArray(metrics)).toBe(true);
  });

  it('should get traffic metrics with offset', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const metrics = await storage.getTrafficMetrics(100, {
      offset: 10
    });
    expect(Array.isArray(metrics)).toBe(true);
  });
});

describe('MongoStorage Audit Methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have logAudit method', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);
    expect(typeof storage.logAudit).toBe('function');
  });

  it('should log audit event', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    await storage.logAudit({
      action: 'login',
      category: 'security',
      level: 'info',
      message: 'User logged in'
    });

    expect(mockDb.collection).toHaveBeenCalledWith('audit_logs');
  });

  it('should have getAuditLogs method', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);
    expect(typeof storage.getAuditLogs).toBe('function');
  });

  it('should get audit logs with default options', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const logs = await storage.getAuditLogs();
    expect(Array.isArray(logs)).toBe(true);
  });

  it('should get audit logs with category filter', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const logs = await storage.getAuditLogs(100, { category: 'security' });
    expect(Array.isArray(logs)).toBe(true);
  });

  it('should get audit logs with level filter', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const logs = await storage.getAuditLogs(100, { level: 'error' });
    expect(Array.isArray(logs)).toBe(true);
  });

  it('should get audit logs with action filter', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const logs = await storage.getAuditLogs(100, { action: 'login' });
    expect(Array.isArray(logs)).toBe(true);
  });

  it('should get audit logs with userId filter', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const logs = await storage.getAuditLogs(100, { userId: 'user123' });
    expect(Array.isArray(logs)).toBe(true);
  });

  it('should get audit logs with time range', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const logs = await storage.getAuditLogs(100, {
      startTime: new Date('2024-01-01'),
      endTime: new Date('2024-12-31')
    });
    expect(Array.isArray(logs)).toBe(true);
  });

  it('should get audit logs with offset', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const logs = await storage.getAuditLogs(100, { offset: 20 });
    expect(Array.isArray(logs)).toBe(true);
  });
});

describe('MongoStorage Error Methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have logError method', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);
    expect(typeof storage.logError).toBe('function');
  });

  it('should log error and return id', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const errorId = await storage.logError({
      error: 'Test error',
      stack: 'Error stack trace',
      resolved: false
    });

    expect(mockDb.collection).toHaveBeenCalledWith('error_logs');
    expect(typeof errorId).toBe('string');
  });

  it('should have getErrorLogs method', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);
    expect(typeof storage.getErrorLogs).toBe('function');
  });

  it('should get error logs with default options', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const logs = await storage.getErrorLogs();
    expect(Array.isArray(logs)).toBe(true);
  });

  it('should get error logs with resolved filter', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const logs = await storage.getErrorLogs(100, { resolved: false });
    expect(Array.isArray(logs)).toBe(true);
  });

  it('should get error logs with severity filter', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const logs = await storage.getErrorLogs(100, { severity: 'critical' });
    expect(Array.isArray(logs)).toBe(true);
  });

  it('should get error logs with category filter', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const logs = await storage.getErrorLogs(100, { category: 'rendering' });
    expect(Array.isArray(logs)).toBe(true);
  });

  it('should get error logs with url filter', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const logs = await storage.getErrorLogs(100, { url: '/api/test' });
    expect(Array.isArray(logs)).toBe(true);
  });

  it('should get error logs with time range', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const logs = await storage.getErrorLogs(100, {
      startTime: new Date('2024-01-01'),
      endTime: new Date('2024-12-31')
    });
    expect(Array.isArray(logs)).toBe(true);
  });

  it('should get error logs with offset', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const logs = await storage.getErrorLogs(100, { offset: 10 });
    expect(Array.isArray(logs)).toBe(true);
  });
});

describe('MongoStorage Config Methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have getConfig method', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);
    expect(typeof storage.getConfig).toBe('function');
  });

  it('should get config by key', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    await storage.getConfig('test_key');
    expect(mockDb.collection).toHaveBeenCalledWith('configurations');
  });

  it('should return null for non-existent config', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const config = await storage.getConfig('non_existent');
    expect(config).toBeNull();
  });

  it('should have saveConfig method', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);
    expect(typeof storage.saveConfig).toBe('function');
  });

  it('should save config with description', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const version = await storage.saveConfig(
      { setting: 'value' },
      'Test configuration',
      'admin'
    );

    expect(typeof version).toBe('string');
    expect(version).toContain('v');
  });

  it('should save config without description', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const version = await storage.saveConfig({ setting: 'value' });
    expect(typeof version).toBe('string');
  });
});

describe('MongoStorage Stats Methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have getStats method', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);
    expect(typeof storage.getStats).toBe('function');
  });

  it('should return database stats', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const stats = await storage.getStats();
    expect(stats).toBeDefined();
  });

  it('should include collection stats', async () => {
    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(mockDb as any);

    const stats = await storage.getStats();
    expect(stats.collections).toBeDefined();
    expect(Array.isArray(stats.collections)).toBe(true);
  });
});

describe('MongoStorage Error Handling', () => {
  it('should handle error in storeTrafficMetric', async () => {
    const errorDb = {
      collection: vi.fn().mockReturnValue({
        insertOne: vi.fn().mockRejectedValue(new Error('DB error'))
      })
    };

    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(errorDb as any);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await storage.storeTrafficMetric({
      timestamp: new Date(),
      path: '/test',
      userAgent: 'Test',
      isBot: false,
      action: 'proxy'
    });

    consoleSpy.mockRestore();
  });

  it('should handle error in getTrafficMetrics', async () => {
    const errorDb = {
      collection: vi.fn().mockReturnValue({
        find: vi.fn().mockImplementation(() => {
          throw new Error('DB error');
        })
      })
    };

    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(errorDb as any);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const metrics = await storage.getTrafficMetrics();
    expect(metrics).toEqual([]);

    consoleSpy.mockRestore();
  });

  it('should handle error in logAudit', async () => {
    const errorDb = {
      collection: vi.fn().mockReturnValue({
        insertOne: vi.fn().mockRejectedValue(new Error('DB error'))
      })
    };

    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(errorDb as any);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await storage.logAudit({
      action: 'test',
      category: 'system',
      level: 'info',
      message: 'Test'
    });

    consoleSpy.mockRestore();
  });

  it('should handle error in getAuditLogs', async () => {
    const errorDb = {
      collection: vi.fn().mockReturnValue({
        find: vi.fn().mockImplementation(() => {
          throw new Error('DB error');
        })
      })
    };

    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(errorDb as any);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const logs = await storage.getAuditLogs();
    expect(logs).toEqual([]);

    consoleSpy.mockRestore();
  });

  it('should handle error in logError', async () => {
    const errorDb = {
      collection: vi.fn().mockReturnValue({
        insertOne: vi.fn().mockRejectedValue(new Error('DB error'))
      })
    };

    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(errorDb as any);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const errorId = await storage.logError({
      error: 'Test error',
      resolved: false
    });
    expect(errorId).toBe('');

    consoleSpy.mockRestore();
  });

  it('should handle error in getErrorLogs', async () => {
    const errorDb = {
      collection: vi.fn().mockReturnValue({
        find: vi.fn().mockImplementation(() => {
          throw new Error('DB error');
        })
      })
    };

    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(errorDb as any);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const logs = await storage.getErrorLogs();
    expect(logs).toEqual([]);

    consoleSpy.mockRestore();
  });

  it('should handle error in getConfig', async () => {
    const errorDb = {
      collection: vi.fn().mockReturnValue({
        findOne: vi.fn().mockRejectedValue(new Error('DB error'))
      })
    };

    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(errorDb as any);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const config = await storage.getConfig('test');
    expect(config).toBeNull();

    consoleSpy.mockRestore();
  });

  it('should handle error in saveConfig', async () => {
    const errorDb = {
      collection: vi.fn().mockReturnValue({
        updateOne: vi.fn().mockRejectedValue(new Error('DB error'))
      })
    };

    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(errorDb as any);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(storage.saveConfig({ test: 'value' })).rejects.toThrow('DB error');

    consoleSpy.mockRestore();
  });

  it('should handle error in getStats', async () => {
    const errorDb = {
      stats: vi.fn().mockRejectedValue(new Error('DB error'))
    };

    const module = await import('../../src/storage/mongodb-storage');
    const storage = new module.MongoStorage(errorDb as any);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const stats = await storage.getStats();
    expect(stats).toEqual({});

    consoleSpy.mockRestore();
  });
});
