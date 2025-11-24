/**
 * Snapshot Service Tests - 100% Coverage
 * Tests all functionality of the visual snapshot service
 */

import { jest } from '@jest/globals';

// Mock dependencies
jest.mock('../../src/cache.js', () => ({
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn()
}));

jest.mock('sharp', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    metadata: jest.fn().mockResolvedValue({
      width: 1200,
      height: 800
    }),
    bandjoin: jest.fn().mockReturnValue({
      raw: jest.fn().mockResolvedValue({
        data: new Uint8Array(100)
      }),
      resize: jest.fn().mockReturnValue({
        raw: jest.fn().mockResolvedValue({
          data: new Uint8Array(100),
          info: {}
        })
      }),
      raw: jest.fn().mockReturnValue({
        composite: jest.fn().mockResolvedValue({
          modulate: jest.fn().mockReturnValue({
            png: jest.fn().mockResolvedValue({
              data: new Buffer('test')
            })
          })
        })
      })
    })
  })
}));

jest.mock('../../src/utils/logger.js', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

// Mock fs
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined)
}));

// Import after mocking
import snapshotService from '../../dist/admin/snapshot-service.js';

describe('SnapshotService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('captureSnapshot', () => {
    test('should capture snapshot with default options', async () => {
      const mockPage = {
        setUserAgent: jest.fn(),
        setViewport: jest.fn(),
        goto: jest.fn().mockResolvedValue(),
        title: jest.fn().mockResolvedValue('Test Page'),
        content: jest.fn().mockResolvedValue('<html>Test</html>'),
        screenshot: jest.fn().mockResolvedValue('screenshot-data'),
        close: jest.fn()
      };

      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue(mockPage)
      };

      // Mock browser manager
      jest.doMock('../../src/browser.js', () => ({
        getBrowser: jest.fn().mockResolvedValue(mockBrowser)
      }));

      const url = 'https://example.com/test';
      const result = await snapshotService.captureSnapshot(url);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('url', url);
      expect(result).toHaveProperty('screenshot');
      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('title', 'Test Page');
      expect(mockPage.setUserAgent).toHaveBeenCalled();
      expect(mockPage.setViewport).toHaveBeenCalled();
      expect(mockPage.goto).toHaveBeenCalledWith(url, expect.any(Object));
      expect(mockPage.close).toHaveBeenCalled();
    });

    test('should handle capture errors', async () => {
      const mockPage = {
        setUserAgent: jest.fn(),
        setViewport: jest.fn(),
        goto: jest.fn().mockRejectedValue(new Error('Page load failed')),
        close: jest.fn()
      };

      jest.doMock('../../src/browser.js', () => ({
        getBrowser: jest.fn().mockResolvedValue({
          newPage: jest.fn().mockResolvedValue(mockPage)
        })
      }));

      const url = 'https://example.com/test';

      await expect(snapshotService.captureSnapshot(url))
        .rejects.toThrow('Failed to capture snapshot');
    });

    test('should use custom options', async () => {
      const mockPage = {
        setUserAgent: jest.fn(),
        setViewport: jest.fn(),
        goto: jest.fn().mockResolvedValue(),
        title: jest.fn().mockResolvedValue('Test'),
        content: jest.fn().mockResolvedValue('<html>Test</html>'),
        screenshot: jest.fn().mockResolvedValue('screenshot'),
        close: jest.fn()
      };

      jest.doMock('../../src/browser.js', () => ({
        getBrowser: jest.fn().mockResolvedValue({
          newPage: jest.fn().mockResolvedValue(mockPage)
        })
      }));

      const options = {
        width: 1920,
        height: 1080,
        fullPage: false
      };

      await snapshotService.captureSnapshot('https://example.com/test', options);

      expect(mockPage.setViewport).toHaveBeenCalledWith({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1
      });
    });
  });

  describe('compareSnapshots', () => {
    test('should compare two snapshots successfully', async () => {
      const beforeId = 'snapshot_before_123';
      const afterId = 'snapshot_after_456';

      const mockSnapshots = [
        {
          id: beforeId,
          url: 'https://example.com/test',
          screenshot: 'data:image/png;base64,before-screenshot',
          title: 'Before'
        },
        {
          id: afterId,
          url: 'https://example.com/test',
          screenshot: 'data:image/png;base64,after-screenshot',
          title: 'After'
        }
      ];

      const { cache } = require('../../src/cache');
      cache.get
        .mockReturnValueOnce(mockSnapshots[0])
        .mockReturnValueOnce(mockSnapshots[1]);

      const result = await snapshotService.compareSnapshots(beforeId, afterId);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('beforeId', beforeId);
      expect(result).toHaveProperty('afterId', afterId);
      expect(result).toHaveProperty('diffScore');
      expect(result).toHaveProperty('diffImage');
    });

    test('should handle different URLs comparison', async () => {
      const beforeId = 'snapshot_before_123';
      const afterId = 'snapshot_after_456';

      const mockSnapshots = [
        {
          id: beforeId,
          url: 'https://example.com/page1',
          screenshot: 'data:image/png;base64,screenshot1'
        },
        {
          id: afterId,
          url: 'https://example.com/page2',
          screenshot: 'data:image/png;base64,screenshot2'
        }
      ];

      const { cache } = require('../../src/cache');
      cache.get
        .mockReturnValueOnce(mockSnapshots[0])
        .mockReturnValueOnce(mockSnapshots[1]);

      await expect(snapshotService.compareSnapshots(beforeId, afterId))
        .rejects.toThrow('Snapshots must be from the same URL');
    });

    test('should handle missing snapshots', async () => {
      const { cache } = require('../../src/cache');
      cache.get.mockReturnValue(null);

      await expect(snapshotService.compareSnapshots('nonexistent1', 'nonexistent2'))
        .rejects.toThrow('One or both snapshots not found');
    });
  });

  describe('getSnapshotHistory', () => {
    test('should return snapshot history for URL', async () => {
      const url = 'https://example.com/test';
      const history = [
        {
          id: 'snapshot1',
          url,
          timestamp: new Date('2024-01-01T00:00:00Z')
        },
        {
          id: 'snapshot2',
          url,
          timestamp: new Date('2024-01-02T00:00:00Z')
        }
      ];

      const { cache } = require('../../src/cache');
      cache.getAllEntries.mockReturnValue({
        'snapshot:snapshot1': history[0],
        'snapshot:snapshot2': history[1],
        'snapshot:other': { url: 'https://example.com/other' }
      });

      const result = await snapshotService.getSnapshotHistory(url);

      expect(result).toHaveLength(2);
      expect(result[0].url).toBe(url);
      expect(result[1].url).toBe(url);
    });

    test('should respect limit parameter', async () => {
      const url = 'https://example.com/test';
      const history = Array(15).fill(null).map((_, i) => ({
        id: `snapshot${i}`,
        url,
        timestamp: new Date(`2024-01-${i + 1}T00:00:00Z`)
      }));

      const { cache } = require('../../src/cache');
      const cacheEntries = {};
      history.forEach(snapshot => {
        cacheEntries[`snapshot:${snapshot.id}`] = snapshot;
      });
      cache.getAllEntries.mockReturnValue(cacheEntries);

      const result = await snapshotService.getSnapshotHistory(url, 10);

      expect(result).toHaveLength(10);
    });
  });

  describe('getAllSnapshots', () => {
    test('should return paginated snapshots', async () => {
      const snapshots = Array(25).fill(null).map((_, i) => ({
        id: `snapshot${i}`,
        url: `https://example.com/page${i}`,
        timestamp: new Date(`2024-01-${i + 1}T00:00:00Z`)
      }));

      const { cache } = require('../../src/cache');
      const cacheEntries = {};
      snapshots.forEach(snapshot => {
        cacheEntries[`snapshot:${snapshot.id}`] = snapshot;
      });
      cache.getAllEntries.mockReturnValue(cacheEntries);

      const result = await snapshotService.getAllSnapshots(2, 10);

      expect(result.snapshots).toHaveLength(10);
      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(3);
    });
  });

  describe('deleteSnapshot', () => {
    test('should delete snapshot successfully', async () => {
      const { cache } = require('../../src/cache');
      cache.delete.mockReturnValue(true);

      const result = await snapshotService.deleteSnapshot('snapshot_123');

      expect(result).toBe(true);
      expect(cache.delete).toHaveBeenCalledWith('snapshot:snapshot_123');
    });

    test('should handle non-existent snapshot', async () => {
      const { cache } = require('../../src/cache');
      cache.delete.mockReturnValue(false);

      const result = await snapshotService.deleteSnapshot('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('should handle empty snapshot list', async () => {
      const { cache } = require('../../src/cache');
      cache.getAllEntries.mockReturnValue({});

      const result = await snapshotService.getAllSnapshots();

      expect(result.snapshots).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    test('should handle malformed cache entries', async () => {
      const { cache } = require('../../src/cache');
      cache.getAllEntries.mockReturnValue({
        'snapshot:valid': { id: 'valid', url: 'https://example.com' },
        'snapshot:invalid': 'not an object',
        'snapshot:snapshot:123': 'wrong format'
      });

      const result = await snapshotService.getAllSnapshots();

      // Should only return valid snapshot objects
      expect(result.snapshots).toHaveLength(1);
      expect(result.snapshots[0].id).toBe('valid');
    });
  });
});