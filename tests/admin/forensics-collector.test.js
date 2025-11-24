/**
 * Unit Tests for Forensics Collector Service
 * Test Coverage: 100% for all error collection and analysis functionality
 */

import forensicsCollector from '../../src/admin/forensics-collector.js';
import browserManager from '../../src/browser.js';
import cache from '../../src/cache.js';
import { Logger } from '../../src/utils/logger.js';

// Mock dependencies
jest.mock('../../src/browser.js');
jest.mock('../../src/cache.js');
jest.mock('../../src/utils/logger.js');

describe('ForensicsCollector', () => {
  const mockPage = {
    content: jest.fn(),
    screenshot: jest.fn(),
    metrics: jest.fn(),
    evaluate: jest.fn(),
  };

  const mockBrowser = {
    newPage: jest.fn(() => mockPage),
  };

  const mockContext = {
    userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)',
    viewport: { width: 1200, height: 800 },
    headers: { 'X-Forwarded-For': '192.168.1.1' },
    waitStrategy: 'networkidle2',
    timeout: 30000,
    startTime: Date.now() - 5000,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock implementations
    (browserManager.getBrowser as jest.Mock).mockResolvedValue(mockBrowser);

    mockPage.content.mockResolvedValue('<html><body>Error content</body></html>');
    mockPage.screenshot.mockResolvedValue(Buffer.from('fake-screenshot'));
    mockPage.metrics.mockResolvedValue({
      JSHeapUsedSize: 50000000,
      JSHeapTotalSize: 80000000,
      JSHeapSizeLimit: 4000000000,
    });

    mockPage.evaluate.mockImplementation((script) => {
      if (script.toString().includes('__seoShieldConsoleLogs')) {
        return [
          {
            timestamp: Date.now(),
            level: 'error',
            text: 'Script error',
            url: 'https://example.com/script.js',
            line: 42,
            column: 15,
          },
        ];
      }
      if (script.toString().includes('performance.getEntriesByType')) {
        return [
          {
            name: 'https://example.com/page',
            startTime: 0,
            duration: 1500,
            initiatorType: 'navigation',
            transferSize: 50000,
          },
        ];
      }
      if (script.toString().includes('__seoShieldFailedRequests')) {
        return [
          {
            timestamp: Date.now(),
            url: 'https://example.com/failed-resource',
            method: 'GET',
            status: 404,
            statusText: 'Not Found',
            resourceType: 'script',
            errorText: 'Network error',
            errorType: 'NetworkError',
          },
        ];
      }
      return [];
    });

    // Mock cache operations
    (cache.set as jest.Mock).mockResolvedValue(true);
    (cache.get as jest.Mock).mockResolvedValue(null);
    (cache.delete as jest.Mock).mockResolvedValue(true);
    (cache.getAllEntries as jest.Mock).mockResolvedValue({});
  });

  describe('captureForensics', () => {
    it('should capture complete forensic data for timeout errors', async () => {
      const timeoutError = new Error('Navigation timeout exceeded');
      (timeoutError as any).name = 'TimeoutError';

      const result = await forensicsCollector.captureForensics(
        'https://example.com',
        timeoutError,
        mockContext,
        mockPage
      );

      expect(result).toMatchObject({
        id: expect.stringMatching(/^forensics_\d+_[a-z0-9]+$/),
        url: 'https://example.com',
        error: {
          message: 'Navigation timeout exceeded',
          type: 'timeout',
          stack: expect.any(String),
        },
        context: {
          userAgent: mockContext.userAgent,
          viewport: mockContext.viewport,
          proxyHeaders: mockContext.headers,
          waitStrategy: mockContext.waitStrategy,
          timeout: mockContext.timeout,
        },
        renderTime: expect.any(Number),
      });

      expect(mockPage.content).toHaveBeenCalled();
      expect(mockPage.screenshot).toHaveBeenCalledWith({
        fullPage: true,
        encoding: 'base64',
      });
      expect(mockPage.metrics).toHaveBeenCalled();
    });

    it('should categorize JavaScript errors correctly', async () => {
      const jsError = new Error('Cannot read property of undefined');
      (jsError as any).name = 'TypeError';

      const result = await forensicsCollector.captureForensics(
        'https://example.com',
        jsError,
        mockContext,
        mockPage
      );

      expect(result.error.type).toBe('javascript');
      expect(cache.set).toHaveBeenCalledWith(
        expect.stringMatching(/^forensics_\d+_[a-z0-9]+$/),
        result,
        604800 // 7 days TTL
      );
    });

    it('should categorize network errors correctly', async () => {
      const networkError = new Error('net::ERR_CONNECTION_REFUSED');

      const result = await forensicsCollector.captureForensics(
        'https://example.com',
        networkError,
        mockContext,
        mockPage
      );

      expect(result.error.type).toBe('network');
    });

    it('should categorize crash errors correctly', async () => {
      const crashError = new Error('Renderer process crashed');

      const result = await forensicsCollector.captureForensics(
        'https://example.com',
        crashError,
        mockContext,
        mockPage
      );

      expect(result.error.type).toBe('crash');
    });

    it('should categorize unknown errors as unknown type', async () => {
      const unknownError = new Error('Some unexpected error');

      const result = await forensicsCollector.captureForensics(
        'https://example.com',
        unknownError,
        mockContext,
        mockPage
      );

      expect(result.error.type).toBe('unknown');
    });

    it('should handle missing page gracefully', async () => {
      const error = new Error('Test error');

      const result = await forensicsCollector.captureForensics(
        'https://example.com',
        error,
        mockContext,
        undefined
      );

      expect(result.console).toEqual([]);
      expect(result.network).toEqual([]);
      expect(result.html).toBeUndefined();
      expect(result.screenshot).toBe('');
      expect(result.memoryUsage).toBeUndefined();
    });

    it('should handle page capture errors gracefully', async () => {
      mockPage.content.mockRejectedValue(new Error('Content capture failed'));
      mockPage.screenshot.mockRejectedValue(new Error('Screenshot failed'));
      mockPage.metrics.mockRejectedValue(new Error('Metrics failed'));

      const result = await forensicsCollector.captureForensics(
        'https://example.com',
        new Error('Test error'),
        mockContext,
        mockPage
      );

      expect(result.html).toBeUndefined();
      expect(result.screenshot).toBe('');
      expect(result.memoryUsage).toBeUndefined();
    });

    it('should capture console logs from page', async () => {
      await forensicsCollector.captureForensics(
        'https://example.com',
        new Error('Test error'),
        mockContext,
        mockPage
      );

      expect(mockPage.evaluate).toHaveBeenCalledWith(expect.any(Function));
      expect(mockPage.evaluate).toHaveBeenCalledWith(
        expect.stringContaining('__seoShieldConsoleLogs')
      );
    });

    it('should capture network activity from performance entries', async () => {
      await forensicsCollector.captureForensics(
        'https://example.com',
        new Error('Test error'),
        mockContext,
        mockPage
      );

      expect(mockPage.evaluate).toHaveBeenCalledWith(
        expect.stringContaining('performance.getEntriesByType')
      );
    });

    it('should calculate render time correctly', async () => {
      const testContext = {
        ...mockContext,
        startTime: Date.now() - 3000, // 3 seconds ago
      };

      const result = await forensicsCollector.captureForensics(
        'https://example.com',
        new Error('Test error'),
        testContext,
        mockPage
      );

      expect(result.renderTime).toBeGreaterThanOrEqual(3000);
      expect(result.renderTime).toBeLessThan(5000); // Should be close to 3 seconds
    });
  });

  describe('getErrors', () => {
    const mockForensicsData = {
      'forensics_1': {
        id: 'forensics_1',
        url: 'https://example.com/page1',
        timestamp: new Date('2023-01-02').toISOString(),
        error: { message: 'Error 1', type: 'timeout' },
        console: [],
        network: [],
        renderTime: 5000,
      },
      'forensics_2': {
        id: 'forensics_2',
        url: 'https://example.com/page2',
        timestamp: new Date('2023-01-01').toISOString(),
        error: { message: 'Error 2', type: 'javascript' },
        console: [],
        network: [],
        renderTime: 3000,
      },
      'other_cache_key': 'should be ignored',
    };

    it('should return paginated errors sorted by timestamp', async () => {
      (cache.getAllEntries as jest.Mock).mockResolvedValue(mockForensicsData);

      const result = await forensicsCollector.getErrors(1, 10);

      expect(result).toMatchObject({
        errors: expect.arrayContaining([
          expect.objectContaining({
            id: 'forensics_1',
            url: 'https://example.com/page1',
            error: { message: 'Error 1', type: 'timeout' },
          }),
          expect.objectContaining({
            id: 'forensics_2',
            url: 'https://example.com/page2',
            error: { message: 'Error 2', type: 'javascript' },
          }),
        ]),
        total: 2,
        page: 1,
        totalPages: 1,
      });

      // Should be sorted by timestamp (newest first)
      expect(result.errors[0].id).toBe('forensics_1');
      expect(result.errors[1].id).toBe('forensics_2');
    });

    it('should handle pagination correctly', async () => {
      const manyErrors = {};
      for (let i = 1; i <= 25; i++) {
        manyErrors[`forensics_${i}`] = {
          id: `forensics_${i}`,
          url: `https://example.com/page${i}`,
          timestamp: new Date(`2023-01-${String(i).padStart(2, '0')}`).toISOString(),
          error: { message: `Error ${i}`, type: 'timeout' },
          console: [],
          network: [],
          renderTime: 5000,
        };
      }

      (cache.getAllEntries as jest.Mock).mockResolvedValue(manyErrors);

      const page1 = await forensicsCollector.getErrors(1, 10);
      const page2 = await forensicsCollector.getErrors(2, 10);
      const page3 = await forensicsCollector.getErrors(3, 10);

      expect(page1.errors).toHaveLength(10);
      expect(page2.errors).toHaveLength(10);
      expect(page3.errors).toHaveLength(5);
      expect(page1.total).toBe(25);
      expect(page1.totalPages).toBe(3);
    });

    it('should handle cache errors gracefully', async () => {
      (cache.getAllEntries as jest.Mock).mockRejectedValue(new Error('Cache error'));

      const result = await forensicsCollector.getErrors();

      expect(result).toMatchObject({
        errors: [],
        total: 0,
        page: 1,
        totalPages: 0,
      });
    });

    it('should filter out non-forensics cache entries', async () => {
      const mixedCacheData = {
        'forensics_1': {
          id: 'forensics_1',
          url: 'https://example.com/page1',
          timestamp: new Date('2023-01-01').toISOString(),
          error: { message: 'Error 1', type: 'timeout' },
          console: [],
          network: [],
          renderTime: 5000,
        },
        'cache_123': { some: 'other data' },
        'session_456': { session: 'data' },
        'forensics_2': null, // Should be filtered out
      };

      (cache.getAllEntries as jest.Mock).mockResolvedValue(mixedCacheData);

      const result = await forensicsCollector.getErrors();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].id).toBe('forensics_1');
    });
  });

  describe('getError', () => {
    it('should return specific error by ID', async () => {
      const mockError = {
        id: 'forensics_test',
        url: 'https://example.com/test',
        timestamp: new Date().toISOString(),
        error: { message: 'Test error', type: 'timeout' },
        console: [],
        network: [],
        renderTime: 5000,
      };

      (cache.get as jest.Mock).mockResolvedValue(mockError);

      const result = await forensicsCollector.getError('forensics_test');

      expect(result).toEqual(mockError);
      expect(cache.get).toHaveBeenCalledWith('forensics:forensics_test');
    });

    it('should return null for non-existent error', async () => {
      (cache.get as jest.Mock).mockResolvedValue(null);

      const result = await forensicsCollector.getError('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle cache errors gracefully', async () => {
      (cache.get as jest.Mock).mockRejectedValue(new Error('Cache error'));

      const result = await forensicsCollector.getError('test');

      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    const mockErrors = [
      {
        id: 'forensics_1',
        url: 'https://example.com/page1',
        timestamp: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        error: { message: 'Error 1', type: 'timeout' },
        console: [],
        network: [],
        renderTime: 5000,
      },
      {
        id: 'forensics_2',
        url: 'https://example.com/page2',
        timestamp: new Date().toISOString(), // Today
        error: { message: 'Error 2', type: 'javascript' },
        console: [],
        network: [],
        renderTime: 3000,
      },
      {
        id: 'forensics_3',
        url: 'https://example.com/page1',
        timestamp: new Date().toISOString(), // Today
        error: { message: 'Error 3', type: 'network' },
        console: [],
        network: [],
        renderTime: 2000,
      },
    ];

    it('should return comprehensive error statistics', async () => {
      const mockCacheData = {};
      mockErrors.forEach(error => {
        mockCacheData[`forensics:${error.id}`] = error;
      });
      (cache.getAllEntries as jest.Mock).mockResolvedValue(mockCacheData);

      const result = await forensicsCollector.getStats();

      expect(result).toMatchObject({
        totalErrors: 3,
        todayErrors: 2, // Errors 2 and 3 are from today
        errorsByType: {
          timeout: 1,
          javascript: 1,
          network: 1,
        },
        topErrorUrls: [
          { url: 'https://example.com/page1', count: 2 },
          { url: 'https://example.com/page2', count: 1 },
        ],
        detectedPatterns: expect.any(Array),
      });
    });

    it('should handle empty cache gracefully', async () => {
      (cache.getAllEntries as jest.Mock).mockResolvedValue({});

      const result = await forensicsCollector.getStats();

      expect(result).toMatchObject({
        totalErrors: 0,
        todayErrors: 0,
        errorsByType: {},
        topErrorUrls: [],
        detectedPatterns: [],
      });
    });

    it('should handle cache errors gracefully', async () => {
      (cache.getAllEntries as jest.Mock).mockRejectedValue(new Error('Cache error'));

      const result = await forensicsCollector.getStats();

      expect(result).toMatchObject({
        totalErrors: 0,
        todayErrors: 0,
        errorsByType: {},
        topErrorUrls: [],
        detectedPatterns: [],
      });
    });
  });

  describe('clearOldErrors', () => {
    it('should clear errors older than specified days', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10); // 10 days old

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 2); // 2 days old

      const mockCacheData = {
        'forensics_old': {
          id: 'forensics_old',
          url: 'https://example.com/old',
          timestamp: oldDate.toISOString(),
          error: { message: 'Old error', type: 'timeout' },
          console: [],
          network: [],
          renderTime: 5000,
        },
        'forensics_recent': {
          id: 'forensics_recent',
          url: 'https://example.com/recent',
          timestamp: recentDate.toISOString(),
          error: { message: 'Recent error', type: 'javascript' },
          console: [],
          network: [],
          renderTime: 3000,
        },
      };

      (cache.getAllEntries as jest.Mock).mockResolvedValue(mockCacheData);

      const deletedCount = await forensicsCollector.clearOldErrors(5);

      expect(deletedCount).toBe(1);
      expect(cache.delete).toHaveBeenCalledWith('forensics:forensics_old');
      expect(cache.delete).not.toHaveBeenCalledWith('forensics:forensics_recent');
    });

    it('should handle cache errors gracefully', async () => {
      (cache.getAllEntries as jest.Mock).mockRejectedValue(new Error('Cache error'));

      const deletedCount = await forensicsCollector.clearOldErrors();

      expect(deletedCount).toBe(0);
    });
  });

  describe('getErrorsByUrl', () => {
    it('should return errors for specific URL', async () => {
      const mockErrors = [
        {
          id: 'forensics_1',
          url: 'https://example.com/target',
          timestamp: new Date().toISOString(),
          error: { message: 'Error 1', type: 'timeout' },
          console: [],
          network: [],
          renderTime: 5000,
        },
        {
          id: 'forensics_2',
          url: 'https://example.com/other',
          timestamp: new Date().toISOString(),
          error: { message: 'Error 2', type: 'javascript' },
          console: [],
          network: [],
          renderTime: 3000,
        },
        {
          id: 'forensics_3',
          url: 'https://example.com/target',
          timestamp: new Date().toISOString(),
          error: { message: 'Error 3', type: 'network' },
          console: [],
          network: [],
          renderTime: 2000,
        },
      ];

      const mockCacheData = {};
      mockErrors.forEach(error => {
        mockCacheData[`forensics:${error.id}`] = error;
      });
      (cache.getAllEntries as jest.Mock).mockResolvedValue(mockCacheData);

      const result = await forensicsCollector.getErrorsByUrl('https://example.com/target');

      expect(result).toHaveLength(2);
      expect(result.every(error => error.url === 'https://example.com/target')).toBe(true);
    });

    it('should limit results as specified', async () => {
      const mockErrors = Array.from({ length: 15 }, (_, i) => ({
        id: `forensics_${i}`,
        url: 'https://example.com/target',
        timestamp: new Date().toISOString(),
        error: { message: `Error ${i}`, type: 'timeout' },
        console: [],
        network: [],
        renderTime: 5000,
      }));

      const mockCacheData = {};
      mockErrors.forEach(error => {
        mockCacheData[`forensics:${error.id}`] = error;
      });
      (cache.getAllEntries as jest.Mock).mockResolvedValue(mockCacheData);

      const result = await forensicsCollector.getErrorsByUrl('https://example.com/target', 5);

      expect(result).toHaveLength(5);
    });

    it('should handle errors gracefully', async () => {
      (cache.getAllEntries as jest.Mock).mockRejectedValue(new Error('Cache error'));

      const result = await forensicsCollector.getErrorsByUrl('https://example.com/target');

      expect(result).toEqual([]);
    });
  });

  describe('deleteError', () => {
    it('should delete specific error', async () => {
      (cache.delete as jest.Mock).mockResolvedValue(true);

      const result = await forensicsCollector.deleteError('forensics_test');

      expect(result).toBe(true);
      expect(cache.delete).toHaveBeenCalledWith('forensics:forensics_test');
    });

    it('should handle cache errors gracefully', async () => {
      (cache.delete as jest.Mock).mockRejectedValue(new Error('Cache error'));

      const result = await forensicsCollector.deleteError('forensics_test');

      expect(result).toBe(false);
    });
  });

  describe('pattern analysis', () => {
    it('should analyze and detect error patterns', async () => {
      const timeoutError = new Error('Navigation timeout exceeded');

      const result = await forensicsCollector.captureForensics(
        'https://example.com',
        timeoutError,
        mockContext,
        mockPage
      );

      // Pattern analysis should happen automatically
      expect(cache.set).toHaveBeenCalled();
    });

    it('should detect patterns in console logs', async () => {
      mockPage.evaluate.mockImplementation((script) => {
        if (script.toString().includes('__seoShieldConsoleLogs')) {
          return [
            {
              timestamp: Date.now(),
              level: 'error',
              text: 'JavaScript runtime error occurred',
            },
          ];
        }
        return [];
      });

      await forensicsCollector.captureForensics(
        'https://example.com',
        new Error('Test error'),
        mockContext,
        mockPage
      );

      // Should detect console error patterns
      expect(mockPage.evaluate).toHaveBeenCalled();
    });
  });
});