/**
 * Unit Tests for Status Code Detection in browser.js
 * Tests prerender-status-code meta tag detection
 */

import { jest } from '@jest/globals';
import {
  createMockBrowser,
  createMockPage,
} from '../mocks/puppeteer.mock.js';

describe('Browser Manager - Status Code Detection', () => {
  let browserManager;
  let mockBrowser;
  let mockPuppeteer;

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.resetModules();

    mockBrowser = createMockBrowser();
    mockPuppeteer = {
      launch: jest.fn().mockResolvedValue(mockBrowser),
    };

    jest.unstable_mockModule('puppeteer', () => ({
      default: mockPuppeteer,
    }));

    const module = await import('../../dist/browser.js');
    browserManager = module.default;
    browserManager.browser = null;
    browserManager.isLaunching = false;
  });

  describe('prerender-status-code meta tag detection', () => {
    test('should detect 404 status code from meta tag', async () => {
      const mockPage = createMockPage({
        evaluateResult: 404,
      });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      const result = await browserManager.render('https://example.com/not-found');

      expect(result).toHaveProperty('html');
      expect(result).toHaveProperty('statusCode', 404);
      expect(mockPage.evaluate).toHaveBeenCalled();
    });

    test('should detect 410 status code from meta tag', async () => {
      const mockPage = createMockPage({
        evaluateResult: 410,
      });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      const result = await browserManager.render('https://example.com/gone');

      expect(result.statusCode).toBe(410);
    });

    test('should detect 403 status code from meta tag', async () => {
      const mockPage = createMockPage({
        evaluateResult: 403,
      });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      const result = await browserManager.render('https://example.com/forbidden');

      expect(result.statusCode).toBe(403);
    });

    test('should return undefined statusCode when no meta tag present', async () => {
      const mockPage = createMockPage({
        evaluateResult: undefined,
      });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      const result = await browserManager.render('https://example.com');

      expect(result.statusCode).toBeUndefined();
    });

    test('should always return html property', async () => {
      const mockPage = createMockPage({
        html: '<html><body>Test Content</body></html>',
        evaluateResult: 404,
      });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      const result = await browserManager.render('https://example.com');

      expect(result.html).toBe('<html><body>Test Content</body></html>');
      expect(result.statusCode).toBe(404);
    });

    test('should work with various HTTP status codes', async () => {
      const testCases = [200, 301, 302, 401, 404, 410, 500, 503];

      for (const statusCode of testCases) {
        const mockPage = createMockPage({
          evaluateResult: statusCode,
        });
        mockBrowser.newPage.mockResolvedValue(mockPage);

        const result = await browserManager.render('https://example.com');
        expect(result.statusCode).toBe(statusCode);
      }
    });
  });
});
