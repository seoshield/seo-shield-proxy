/**
 * Unit Tests for src/browser.js
 * Tests Puppeteer browser management, rendering, and resource management
 */

import { jest } from '@jest/globals';
import {
  createMockBrowser,
  createMockPage,
  createMockRequest,
} from '../mocks/puppeteer.mock.js';

// Mock puppeteer before importing browser module
let mockBrowser;
let mockPuppeteer;

describe('Browser Manager', () => {
  let browserManager;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();

    // Reset module cache and import fresh
    jest.resetModules();

    // Setup mock after reset
    mockBrowser = createMockBrowser();
    mockPuppeteer = {
      launch: jest.fn().mockResolvedValue(mockBrowser),
    };

    jest.unstable_mockModule('puppeteer', () => ({
      default: mockPuppeteer,
    }));

    // Reimport with fresh mocks
    const module = await import('../../src/browser.js');
    browserManager = module.default;

    // Reset browser state
    browserManager.browser = null;
    browserManager.isLaunching = false;
  });

  describe('getBrowser() - Singleton Pattern', () => {
    test('should launch browser on first call', async () => {
      const browser = await browserManager.getBrowser();

      expect(mockPuppeteer.launch).toHaveBeenCalledTimes(1);
      expect(browser).toBeDefined();
    });

    test('should reuse existing browser instance', async () => {
      const browser1 = await browserManager.getBrowser();
      const browser2 = await browserManager.getBrowser();

      expect(mockPuppeteer.launch).toHaveBeenCalledTimes(1);
      expect(browser1).toBe(browser2);
    });

    test('should wait if browser is currently launching', async () => {
      const promise1 = browserManager.getBrowser();
      const promise2 = browserManager.getBrowser();

      const [browser1, browser2] = await Promise.all([promise1, promise2]);

      expect(mockPuppeteer.launch).toHaveBeenCalledTimes(1);
      expect(browser1).toBe(browser2);
    });

    test('should relaunch if browser is disconnected', async () => {
      // First launch
      await browserManager.getBrowser();

      // Simulate disconnect
      browserManager.browser = null;
      const disconnectedBrowser = createMockBrowser();
      disconnectedBrowser.isConnected.mockReturnValue(false);
      browserManager.browser = disconnectedBrowser;

      // Should relaunch
      await browserManager.getBrowser();

      expect(mockPuppeteer.launch).toHaveBeenCalledTimes(2);
    });
  });

  describe('launchBrowser()', () => {
    test('should launch with correct options', async () => {
      await browserManager.getBrowser();

      expect(mockPuppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          headless: 'new',
          args: expect.arrayContaining([
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
          ]),
        })
      );
    });

    test('should include required Docker-compatible arguments', async () => {
      await browserManager.getBrowser();

      const launchArgs = mockPuppeteer.launch.mock.calls[0][0];
      expect(launchArgs.args).toContain('--no-sandbox');
      expect(launchArgs.args).toContain('--disable-setuid-sandbox');
      expect(launchArgs.args).toContain('--single-process');
    });

    test('should set up disconnect handler', async () => {
      const browser = await browserManager.getBrowser();

      expect(browser.on).toHaveBeenCalledWith('disconnected', expect.any(Function));
    });

    test('should reset browser reference on disconnect', async () => {
      const browser = await browserManager.getBrowser();
      const disconnectHandler = browser.on.mock.calls.find(
        (call) => call[0] === 'disconnected'
      )[1];

      // Trigger disconnect
      disconnectHandler();

      expect(browserManager.browser).toBeNull();
    });
  });

  describe('render() method', () => {
    beforeEach(() => {
      mockBrowser.newPage.mockResolvedValue(createMockPage());
    });

    test('should render URL and return HTML', async () => {
      const html = await browserManager.render('https://example.com');

      expect(html).toContain('Mock Page');
    });

    test('should create a new page for each render', async () => {
      await browserManager.render('https://example.com/page1');
      await browserManager.render('https://example.com/page2');

      expect(mockBrowser.newPage).toHaveBeenCalledTimes(2);
    });

    test('should set viewport dimensions', async () => {
      const mockPage = createMockPage();
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await browserManager.render('https://example.com');

      expect(mockPage.setViewport).toHaveBeenCalledWith({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      });
    });

    test('should set user agent', async () => {
      const mockPage = createMockPage();
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await browserManager.render('https://example.com');

      expect(mockPage.setUserAgent).toHaveBeenCalledWith(
        expect.stringContaining('Mozilla')
      );
    });

    test('should enable request interception', async () => {
      const mockPage = createMockPage();
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await browserManager.render('https://example.com');

      expect(mockPage.setRequestInterception).toHaveBeenCalledWith(true);
    });

    test('should navigate to URL with networkidle0', async () => {
      const mockPage = createMockPage();
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await browserManager.render('https://example.com/test');

      expect(mockPage.goto).toHaveBeenCalledWith(
        'https://example.com/test',
        expect.objectContaining({
          waitUntil: 'networkidle0',
          timeout: expect.any(Number),
        })
      );
    });

    test('should get page content', async () => {
      const mockHtml = '<html><body>Test Content</body></html>';
      const mockPage = createMockPage({ html: mockHtml });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      const html = await browserManager.render('https://example.com');

      expect(mockPage.content).toHaveBeenCalled();
      expect(html).toBe(mockHtml);
    });

    test('should always close page after rendering', async () => {
      const mockPage = createMockPage();
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await browserManager.render('https://example.com');

      expect(mockPage.close).toHaveBeenCalled();
    });

    test('should close page even if rendering fails', async () => {
      const mockPage = createMockPage({
        goto: jest.fn().mockRejectedValue(new Error('Navigation failed')),
      });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await expect(browserManager.render('https://example.com')).rejects.toThrow();
      expect(mockPage.close).toHaveBeenCalled();
    });

    test('should handle page close errors gracefully', async () => {
      const mockPage = createMockPage({
        close: jest.fn().mockRejectedValue(new Error('Close failed')),
      });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      // Should not throw despite close error
      await expect(browserManager.render('https://example.com')).resolves.toBeDefined();
    });
  });

  describe('Request Interception', () => {
    test('should block image requests', async () => {
      const imageRequest = createMockRequest('image');
      const mockPage = createMockPage({
        mockRequests: [imageRequest],
      });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await browserManager.render('https://example.com');

      expect(imageRequest.abort).toHaveBeenCalled();
    });

    test('should block stylesheet requests', async () => {
      const cssRequest = createMockRequest('stylesheet');
      const mockPage = createMockPage({
        mockRequests: [cssRequest],
      });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await browserManager.render('https://example.com');

      expect(cssRequest.abort).toHaveBeenCalled();
    });

    test('should block font requests', async () => {
      const fontRequest = createMockRequest('font');
      const mockPage = createMockPage({
        mockRequests: [fontRequest],
      });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await browserManager.render('https://example.com');

      expect(fontRequest.abort).toHaveBeenCalled();
    });

    test('should block media requests', async () => {
      const mediaRequest = createMockRequest('media');
      const mockPage = createMockPage({
        mockRequests: [mediaRequest],
      });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await browserManager.render('https://example.com');

      expect(mediaRequest.abort).toHaveBeenCalled();
    });

    test('should allow document requests', async () => {
      const docRequest = createMockRequest('document');
      const mockPage = createMockPage({
        mockRequests: [docRequest],
      });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await browserManager.render('https://example.com');

      expect(docRequest.continue).toHaveBeenCalled();
      expect(docRequest.abort).not.toHaveBeenCalled();
    });

    test('should allow script requests', async () => {
      const scriptRequest = createMockRequest('script');
      const mockPage = createMockPage({
        mockRequests: [scriptRequest],
      });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await browserManager.render('https://example.com');

      expect(scriptRequest.continue).toHaveBeenCalled();
    });

    test('should allow xhr requests', async () => {
      const xhrRequest = createMockRequest('xhr');
      const mockPage = createMockPage({
        mockRequests: [xhrRequest],
      });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await browserManager.render('https://example.com');

      expect(xhrRequest.continue).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('should throw error when navigation fails', async () => {
      const mockPage = createMockPage({
        goto: jest.fn().mockRejectedValue(new Error('Navigation timeout')),
      });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await expect(browserManager.render('https://example.com')).rejects.toThrow(
        'Navigation timeout'
      );
    });

    test('should throw error when page creation fails', async () => {
      mockBrowser.newPage.mockRejectedValue(new Error('Failed to create page'));

      await expect(browserManager.render('https://example.com')).rejects.toThrow(
        'Failed to create page'
      );
    });

    test('should provide meaningful error messages', async () => {
      const mockPage = createMockPage({
        goto: jest.fn().mockRejectedValue(new Error('Timeout')),
      });
      mockBrowser.newPage.mockResolvedValue(mockPage);

      await expect(browserManager.render('https://example.com')).rejects.toThrow();
    });
  });

  describe('close() method', () => {
    test('should close browser if exists', async () => {
      await browserManager.getBrowser();
      await browserManager.close();

      expect(mockBrowser.close).toHaveBeenCalled();
      expect(browserManager.browser).toBeNull();
    });

    test('should handle close when browser is null', async () => {
      browserManager.browser = null;

      await expect(browserManager.close()).resolves.not.toThrow();
    });

    test('should handle browser close errors', async () => {
      await browserManager.getBrowser();
      mockBrowser.close.mockRejectedValue(new Error('Close failed'));

      await expect(browserManager.close()).rejects.toThrow('Close failed');
    });
  });

  describe('Memory Management', () => {
    test('should create new page for each render call', async () => {
      await browserManager.render('https://example.com/1');
      await browserManager.render('https://example.com/2');
      await browserManager.render('https://example.com/3');

      expect(mockBrowser.newPage).toHaveBeenCalledTimes(3);
    });

    test('should close all pages after rendering', async () => {
      const mockPage1 = createMockPage();
      const mockPage2 = createMockPage();
      const mockPage3 = createMockPage();

      mockBrowser.newPage
        .mockResolvedValueOnce(mockPage1)
        .mockResolvedValueOnce(mockPage2)
        .mockResolvedValueOnce(mockPage3);

      await browserManager.render('https://example.com/1');
      await browserManager.render('https://example.com/2');
      await browserManager.render('https://example.com/3');

      expect(mockPage1.close).toHaveBeenCalled();
      expect(mockPage2.close).toHaveBeenCalled();
      expect(mockPage3.close).toHaveBeenCalled();
    });
  });
});
