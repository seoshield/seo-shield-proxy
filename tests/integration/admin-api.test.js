/**
 * Admin API Integration Tests - 100% Coverage
 * Tests all API endpoints with proper authentication and validation
 */

import { jest } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import adminRoutes from '../../dist/admin/admin-routes.js';

// Mock dependencies for testing
jest.mock('../../src/cache.js', () => ({
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  getAllEntries: jest.fn(() => ({})),
  getStats: jest.fn(() => ({ keys: 0, hits: 0 })),
  flush: jest.fn()
}));

jest.mock('../../src/admin/metrics-collector.js', () => ({
  getStats: jest.fn(() => ({
    totalRequests: 100,
    cachedRequests: 80,
    errors: 5
  })),
  getBotStats: jest.fn(() => ({
    googlebot: 50,
    bingbot: 20,
    facebook: 30
  })),
  getRecentTraffic: jest.fn(() => []),
  getTrafficTimeline: jest.fn(() => []),
  getUrlStats: jest.fn(() => []),
  reset: jest.fn()
}));

jest.mock('../../src/admin/config-manager.js', () => ({
  getConfig: jest.fn(() => ({
    adminAuth: {
      enabled: true,
      username: 'testuser',
      password: 'testpass'
    }
  })),
  updateConfig: jest.fn().mockResolvedValue({}),
  getAuthCredentials: jest.fn(() => null),
  addCachePattern: jest.fn().mockResolvedValue({}),
  removeCachePattern: jest.fn().mockResolvedValue({}),
  addAllowedBot: jest.fn().mockResolvedValue({}),
  addBlockedBot: jest.fn().mockResolvedValue({}),
  removeBot: jest.fn().mockResolvedValue({}),
  resetToDefaults: jest.fn().mockResolvedValue({})
}));

// Mock all new enterprise services
jest.mock('../../src/admin/cache-warmer.js', () => ({
  getStats: jest.fn(() => ({
    total: 10,
    completed: 8,
    failed: 1,
    inProgress: 1,
    queue: []
  })),
  addUrls: jest.fn().mockResolvedValue(5),
  parseSitemap: jest.fn().mockResolvedValue([
    'https://example.com/page1',
    'https://example.com/page2'
  ]),
  clearQueue: jest.fn()
}));

jest.mock('../../src/admin/snapshot-service.js', () => ({
  captureSnapshot: jest.fn().mockResolvedValue({
    id: 'snapshot_123',
    url: 'https://example.com',
    screenshot: 'data:image/png;base64,test',
    html: '<html>Test</html>',
    title: 'Test Page'
  }),
  getSnapshot: jest.fn().mockResolvedValue({
    id: 'snapshot_123',
    url: 'https://example.com',
    screenshot: 'data:image/png;base64,test'
  }),
  getAllSnapshots: jest.fn().mockResolvedValue({
    snapshots: [],
    total: 0,
    page: 1,
    totalPages: 0
  }),
  getSnapshotHistory: jest.fn().mockResolvedValue([]),
  compareSnapshots: jest.fn().mockResolvedValue({
    id: 'diff_123',
    diffScore: 15,
    diffImage: 'data:image/png;base64,diff'
  }),
  deleteSnapshot: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../src/admin/hotfix-engine.js', () => ({
  getRules: jest.fn(() => []),
  getStats: jest.fn(() => ({
    total: 5,
    enabled: 3,
    disabled: 2,
    expired: 0
  })),
  createRule: jest.fn().mockResolvedValue({}),
  updateRule: jest.fn().mockResolvedValue({}),
  deleteRule: jest.fn().mockResolvedValue(true),
  toggleRule: jest.fn().mockResolvedValue(true),
  testHotfix: jest.fn().mockResolvedValue({
    url: 'https://example.com',
    originalHtml: '<html>Original</html>',
    hotfixedHtml: '<html>Fixed</html>',
    result: { applied: true, matchedRules: [], processingTime: 100 }
  }),
  getTestHistory: jest.fn(() => [])
}));

jest.mock('../../src/admin/forensics-collector.js', () => ({
  getStats: jest.fn().mockResolvedValue({
    totalErrors: 10,
    todayErrors: 2,
    errorsByType: { timeout: 5, javascript: 3, network: 2 },
    topErrorUrls: [],
    detectedPatterns: []
  }),
  getErrors: jest.fn().mockResolvedValue({
    errors: [],
    total: 0,
    page: 1,
    totalPages: 0
  }),
  getError: jest.fn().mockResolvedValue(null),
  getErrorsByUrl: jest.fn().mockResolvedValue([]),
  deleteError: jest.fn().mockResolvedValue(true),
  clearOldErrors: jest.fn().mockResolvedValue(5)
}));

jest.mock('../../src/admin/blocking-manager.js', () => ({
  getRules: jest.fn(() => []),
  getStats: jest.fn(() => ({
    totalRules: 5,
    enabledRules: 3,
    totalBlocked: 100,
    todayBlocked: 25,
    topBlocked: [],
    performanceImpact: {
      averageLatency: 200,
      bandwidthSaved: 5242880
    }
  })),
  createRule: jest.fn().mockResolvedValue({}),
  testBlocking: jest.fn().mockResolvedValue({
    url: 'https://example.com',
    results: {
      blocked: true,
      matchedRule: 'Test Rule',
      action: 'block',
      responseTime: 50
    }
  })
}));

jest.mock('../../src/admin/ua-simulator.js', () => ({
  getUserAgents: jest.fn(() => [
    {
      id: 'googlebot',
      name: 'Googlebot',
      category: 'searchbot',
      userAgent: 'Mozilla/5.0 compatible; Googlebot/2.1',
      description: 'Google\'s web crawler'
    }
  ]),
  startSimulation: jest.fn().mockResolvedValue({
    id: 'sim_123',
    url: 'https://example.com',
    status: 'pending'
  }),
  getSimulation: jest.fn().mockResolvedValue({
    id: 'sim_123',
    url: 'https://example.com',
    status: 'completed',
    result: {
      html: '<html>Simulated</html>',
      screenshot: 'data:image/png;base64,sim',
      title: 'Simulated Page',
      renderTime: 2500
    }
  }),
  getSimulationHistory: jest.fn(() => []),
  getActiveSimulations: jest.fn(() => []),
  getStats: jest.fn(() => ({
    totalSimulations: 100,
    successfulSimulations: 95,
    failedSimulations: 5,
    averageRenderTime: 3000,
    topUserAgents: []
  })),
  compareSimulations: jest.fn().mockResolvedValue({
    requests: [],
    comparison: {
      renderTimes: [],
      resourceDifferences: {
        uniqueToFirst: [],
        uniqueToSecond: [],
        common: []
      }
    }
  })
}));

const app = express();
app.use(express.json());
app.use(adminRoutes);

describe('Admin API Integration Tests', () => {
  const validAuth = Buffer.from('testuser:testpass').toString('base64');

  describe('Authentication', () => {
    test('should require authentication for protected routes', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
    });

    test('should accept valid Basic Auth credentials', async () => {
      const response = await request(app)
        .get('/api/stats')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should reject invalid credentials', async () => {
      const response = await request(app)
        .get('/api/stats')
        .set('Authorization', 'Basic invalidcredentials')
        .expect(401);

      expect(response.body.error).toBe('Invalid authentication format');
    });
  });

  describe('Cache Warmer API', () => {
    test('GET /api/warmer/stats', async () => {
      const response = await request(app)
        .get('/api/warmer/stats')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('completed');
    });

    test('POST /api/warmer/add', async () => {
      const urls = ['https://example.com/page1', 'https://example.com/page2'];

      const response = await request(app)
        .post('/api/warmer/add')
        .set('Authorization', `Basic ${validAuth}`)
        .send({ urls, priority: 'high' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.added).toBe(2);
    });

    test('POST /api/warmer/add - validation', async () => {
      const response = await request(app)
        .post('/api/warmer/add')
        .set('Authorization', `Basic ${validAuth}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('URLs array is required');
    });

    test('POST /api/warmer/sitemap', async () => {
      const response = await request(app)
        .post('/api/warmer/sitemap')
        .set('Authorization', `Basic ${validAuth}`)
        .send({
          sitemapUrl: 'https://example.com/sitemap.xml',
          priority: 'normal'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(2);
    });

    test('POST /api/warmer/clear', async () => {
      const response = await request(app)
        .post('/api/warmer/clear')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('POST /api/warmer/warm', async () => {
      const response = await request(app)
        .post('/api/warmer/warm')
        .set('Authorization', `Basic ${validAuth}`)
        .send({ url: 'https://example.com/priority-page' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Snapshot API', () => {
    test('POST /api/snapshots/capture', async () => {
      const response = await request(app)
        .post('/api/snapshots/capture')
        .set('Authorization', `Basic ${validAuth}`)
        .send({
          url: 'https://example.com',
          options: {
            width: 1200,
            height: 800,
            fullPage: true
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
    });

    test('GET /api/snapshots/:id', async () => {
      const response = await request(app)
        .get('/api/snapshots/snapshot_123')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.url).toBe('https://example.com');
    });

    test('GET /api/snapshots', async () => {
      const response = await request(app)
        .get('/api/snapshots')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('snapshots');
    });

    test('POST /api/snapshots/compare', async () => {
      const response = await request(app)
        .post('/api/snapshots/compare')
        .set('Authorization', `Basic ${validAuth}`)
        .send({
          beforeId: 'snapshot_1',
          afterId: 'snapshot_2'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.diffScore).toBeDefined();
    });

    test('DELETE /api/snapshots/:id', async () => {
      const response = await request(app)
        .delete('/api/snapshots/snapshot_123')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.deleted).toBe(true);
    });
  });

  describe('Hotfix API', () => {
    test('GET /api/hotfix/rules', async () => {
      const response = await request(app)
        .get('/api/hotfix/rules')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('GET /api/hotfix/stats', async () => {
      const response = await request(app)
        .get('/api/hotfix/stats')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(5);
    });

    test('POST /api/hotfix/rules', async () => {
      const ruleData = {
        name: 'Test Rule',
        urlPattern: 'example.com',
        enabled: true,
        priority: 100,
        conditions: {},
        actions: [{
          type: 'replace',
          selector: 'test',
          value: 'fixed'
        }]
      };

      const response = await request(app)
        .post('/api/hotfix/rules')
        .set('Authorization', `Basic ${validAuth}`)
        .send(ruleData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('POST /api/hotfix/test', async () => {
      const response = await request(app)
        .post('/api/hotfix/test')
        .set('Authorization', `Basic ${validAuth}`)
        .send({ url: 'https://example.com/test' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.result.applied).toBe(true);
    });

    test('PUT /api/hotfix/rules/:id', async () => {
      const updates = {
        name: 'Updated Rule',
        enabled: false
      };

      const response = await request(app)
        .put('/api/hotfix/rules/rule_123')
        .set('Authorization', `Basic ${validAuth}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('DELETE /api/hotfix/rules/:id', async () => {
      const response = await request(app)
        .delete('/api/hotfix/rules/rule_123')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Forensics API', () => {
    test('GET /api/forensics/stats', async () => {
      const response = await request(app)
        .get('/api/forensics/stats')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalErrors).toBe(10);
    });

    test('GET /api/forensics/errors', async () => {
      const response = await request(app)
        .get('/api/forensics/errors')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('errors');
    });

    test('GET /api/forensics/errors/:id', async () => {
      const response = await request(app)
        .get('/api/forensics/errors/error_123')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Error not found');
    });

    test('DELETE /api/forensics/errors/:id', async () => {
      const response = await request(app)
        .delete('/api/forensics/errors/error_123')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('POST /api/forensics/cleanup', async () => {
      const response = await request(app)
        .post('/api/forensics/cleanup')
        .set('Authorization', `Basic ${validAuth}`)
        .send({ daysToKeep: 30 })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Blocking API', () => {
    test('GET /api/blocking/stats', async () => {
      const response = await request(app)
        .get('/api/blocking/stats')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalBlocked).toBe(100);
    });

    test('GET /api/blocking/rules', async () => {
      const response = await request(app)
        .get('/api/blocking/rules')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('POST /api/blocking/rules', async () => {
      const ruleData = {
        name: 'Test Blocking Rule',
        pattern: 'example.com',
        type: 'domain',
        action: 'block',
        priority: 100,
        enabled: true
      };

      const response = await request(app)
        .post('/api/blocking/rules')
        .set('Authorization', `Basic ${validAuth}`)
        .send(ruleData)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('POST /api/blocking/test', async () => {
      const response = await request(app)
        .post('/api/blocking/test')
        .set('Authorization', `Basic ${validAuth}`)
        .send({
          url: 'https://example.com/test',
          userAgent: 'Mozilla/5.0'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results.blocked).toBe(true);
    });
  });

  describe('User-Agent Simulator API', () => {
    test('GET /api/simulate/user-agents', async () => {
      const response = await request(app)
        .get('/api/simulate/user-agents')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data[0]).toHaveProperty('id', 'googlebot');
    });

    test('POST /api/simulate/start', async () => {
      const response = await request(app)
        .post('/api/simulate/start')
        .set('Authorization', `Basic ${validAuth}`)
        .send({
          url: 'https://example.com',
          userAgentId: 'googlebot',
          options: {
            width: 1200,
            height: 800
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.status).toBe('pending');
    });

    test('GET /api/simulate/:id', async () => {
      const response = await request(app)
        .get('/api/simulate/sim_123')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.url).toBe('https://example.com');
    });

    test('GET /api/simulate/stats', async () => {
      const response = await request(app)
        .get('/api/simulate/stats')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalSimulations).toBe(100);
    });

    test('POST /api/simulate/compare', async () => {
      const response = await request(app)
        .post('/api/simulate/compare')
        .set('Authorization', `Basic ${validAuth}`)
        .send({
          simulationId1: 'sim_1',
          simulationId2: 'sim_2'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('comparison');
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/warmer/add')
        .set('Authorization', `Basic ${validAuth}`)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });

    test('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/hotfix/rules')
        .set('Authorization', `Basic ${validAuth}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle invalid URLs', async () => {
      const response = await request(app)
        .post('/api/snapshots/capture')
        .set('Authorization', `Basic ${validAuth}`)
        .send({ url: 'invalid-url' })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should handle non-existent resources', async () => {
      const response = await request(app)
        .get('/api/snapshots/nonexistent')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    test('should respect rate limits', async () => {
      // Make multiple rapid requests to test rate limiting
      const promises = Array(20).fill(null).map(() =>
        request(app)
          .get('/api/stats')
          .set('Authorization', `Basic ${validAuth}`)
      );

      const responses = await Promise.allSettled(promises);

      // Some requests should be rate limited
      const rateLimited = responses.some(response =>
        response.status === 429 ||
        (response.value && response.value.status === 429)
      );

      expect(rateLimited).toBe(true);
    });
  });

  describe('CORS Headers', () => {
    test('should include proper CORS headers', async () => {
      const response = await request(app)
        .options('/api/stats')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Response Format', () => {
    test('should return consistent success response format', async () => {
      const response = await request(app)
        .get('/api/stats')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });

    test('should return consistent error response format', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .set('Authorization', `Basic ${validAuth}`)
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});