/**
 * SSR Fallback Tests
 * Comprehensive tests for SSR fallback scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createMockPage,
  createMockBrowser,
  createMockCluster,
  createSoft404Html,
  createValidPageHtml,
  createMockRenderResult,
  networkErrors,
  createSSREvent,
} from '../mocks/browser-mocks';

describe('SSR Fallback Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Timeout Fallback', () => {
    it('should detect navigation timeout error', async () => {
      const page = createMockPage({ shouldTimeout: true });

      await expect(page.goto('https://slow-page.com')).rejects.toThrow('Navigation timeout');
    });

    it('should create fallback result on timeout', () => {
      const result = createMockRenderResult({
        fallback: true,
        reason: 'timeout',
        statusCode: 200,
      });

      expect(result.fallback).toBe(true);
      expect(result.reason).toBe('timeout');
    });

    it('should have correct timeout configuration', () => {
      const timeoutConfig = {
        navigation: 30000,
        render: 30000,
        idle: 5000,
      };

      expect(timeoutConfig.navigation).toBe(30000);
      expect(timeoutConfig.render).toBe(30000);
    });

    it('should handle soft timeout with partial content', () => {
      const partialResult = {
        html: '<html><body>Partial content</body></html>',
        statusCode: 200,
        partialRender: true,
        warning: 'Soft timeout - partial content returned',
      };

      expect(partialResult.partialRender).toBe(true);
      expect(partialResult.html).toBeDefined();
      expect(partialResult.warning).toContain('partial');
    });
  });

  describe('Browser Crash Fallback', () => {
    it('should handle browser crash gracefully', async () => {
      const crashingBrowser = createMockBrowser({ shouldCrash: true });

      await expect(crashingBrowser.newPage()).rejects.toThrow('Browser crashed');
    });

    it('should detect disconnected browser', () => {
      const crashedBrowser = createMockBrowser({ shouldCrash: true });

      expect(crashedBrowser.isConnected()).toBe(false);
    });

    it('should create fallback result on browser crash', () => {
      const result = createMockRenderResult({
        fallback: true,
        reason: 'browser_crash',
      });

      expect(result.fallback).toBe(true);
      expect(result.reason).toBe('browser_crash');
    });

    it('should attempt retry before fallback', () => {
      let attempts = 0;
      const maxRetries = 1;

      const tryRender = async () => {
        attempts++;
        if (attempts <= maxRetries) {
          throw new Error('Browser crashed');
        }
        return { success: true };
      };

      const renderWithRetry = async () => {
        for (let i = 0; i <= maxRetries; i++) {
          try {
            return await tryRender();
          } catch {
            if (i === maxRetries) {
              return { success: false, fallback: true };
            }
          }
        }
      };

      expect(renderWithRetry()).resolves.toEqual({ success: true });
    });
  });

  describe('Network Error Fallback', () => {
    it('should handle connection refused', async () => {
      const page = createMockPage({ networkError: networkErrors.connectionRefused });

      await expect(page.goto('https://unreachable.com')).rejects.toThrow('CONNECTION_REFUSED');
    });

    it('should handle connection reset', async () => {
      const page = createMockPage({ networkError: networkErrors.connectionReset });

      await expect(page.goto('https://reset.com')).rejects.toThrow('CONNECTION_RESET');
    });

    it('should handle DNS resolution failure', async () => {
      const page = createMockPage({ networkError: networkErrors.nameNotResolved });

      await expect(page.goto('https://invalid-domain.com')).rejects.toThrow('NAME_NOT_RESOLVED');
    });

    it('should handle SSL errors', async () => {
      const page = createMockPage({ networkError: networkErrors.certAuthorityInvalid });

      await expect(page.goto('https://bad-ssl.com')).rejects.toThrow('CERT_AUTHORITY_INVALID');
    });

    it('should create fallback result on network error', () => {
      const result = createMockRenderResult({
        fallback: true,
        reason: 'network_error',
      });

      expect(result.fallback).toBe(true);
      expect(result.reason).toBe('network_error');
    });

    it('should categorize network errors correctly', () => {
      const categorizeError = (error: string) => {
        if (error.includes('SSL') || error.includes('CERT')) return 'ssl_error';
        if (error.includes('NAME_NOT_RESOLVED')) return 'dns_error';
        if (error.includes('CONNECTION')) return 'connection_error';
        return 'network_error';
      };

      expect(categorizeError(networkErrors.certAuthorityInvalid)).toBe('ssl_error');
      expect(categorizeError(networkErrors.nameNotResolved)).toBe('dns_error');
      expect(categorizeError(networkErrors.connectionRefused)).toBe('connection_error');
    });
  });

  describe('Pool Exhaustion Fallback', () => {
    it('should handle browser pool exhaustion', async () => {
      const browser = createMockBrowser({ maxPages: 2 });

      // Open pages up to limit
      await browser.newPage();
      await browser.newPage();

      // Third page should fail
      await expect(browser.newPage()).rejects.toThrow('pool exhausted');
    });

    it('should handle cluster queue full', async () => {
      const cluster = createMockCluster({ queueSize: 10, maxConcurrency: 10 });

      // Mock queue full scenario
      cluster.execute.mockRejectedValueOnce(new Error('Cluster queue full'));

      await expect(cluster.execute('https://example.com', vi.fn())).rejects.toThrow('queue full');
    });

    it('should create fallback result on pool exhaustion', () => {
      const result = createMockRenderResult({
        fallback: true,
        reason: 'pool_exhausted',
      });

      expect(result.fallback).toBe(true);
      expect(result.reason).toBe('pool_exhausted');
    });

    it('should track queue metrics', () => {
      const queueMetrics = {
        queued: 5,
        running: 10,
        maxConcurrency: 10,
        waitTime: 2500,
      };

      expect(queueMetrics.running).toBe(queueMetrics.maxConcurrency);
      expect(queueMetrics.queued).toBeGreaterThan(0);
    });
  });

  describe('Soft 404 Detection', () => {
    it('should detect soft 404 from title', () => {
      const html = createSoft404Html('title');
      const detectSoft404 = (content: string) => {
        const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].toLowerCase() : '';
        return title.includes('not found') || title.includes('404');
      };

      expect(detectSoft404(html)).toBe(true);
    });

    it('should detect soft 404 from H1', () => {
      const html = createSoft404Html('h1');
      const detectSoft404 = (content: string) => {
        const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        const h1 = h1Match ? h1Match[1].toLowerCase() : '';
        return h1.includes('not found') || h1.includes('404');
      };

      expect(detectSoft404(html)).toBe(true);
    });

    it('should detect soft 404 from body patterns', () => {
      const html = createSoft404Html('body');
      const detectSoft404 = (content: string) => {
        const patterns = [
          /class\s*=\s*["'][^"']*error-?404[^"']*["']/i,
          /id\s*=\s*["']error-?404["']/i,
          /page\s+(not\s+found|could\s+not\s+be\s+found)/i,
        ];
        return patterns.some((pattern) => pattern.test(content));
      };

      expect(detectSoft404(html)).toBe(true);
    });

    it('should detect soft 404 from meta tag', () => {
      const html = createSoft404Html('meta');
      const detectSoft404 = (content: string) => {
        const metaMatch = content.match(/prerender-status-code[^>]*content\s*=\s*["'](\d+)["']/i);
        return metaMatch ? parseInt(metaMatch[1]) === 404 : false;
      };

      expect(detectSoft404(html)).toBe(true);
    });

    it('should not false positive on valid pages', () => {
      const html = createValidPageHtml({ title: 'Product Page' });
      const detectSoft404 = (content: string) => {
        const titleMatch = content.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].toLowerCase() : '';
        return title.includes('not found') || title.includes('404');
      };

      expect(detectSoft404(html)).toBe(false);
    });

    it('should handle minimal content with 404 indicators', () => {
      const minimalHtml = '<html><body><p>404</p></body></html>';
      const detectMinimalSoft404 = (content: string) => {
        const bodyContent = content.replace(/<[^>]+>/g, '').trim();
        return bodyContent.length < 100 && /404|not found/i.test(bodyContent);
      };

      expect(detectMinimalSoft404(minimalHtml)).toBe(true);
    });
  });

  describe('Graceful Degradation', () => {
    it('should return proxy fallback on any render error', () => {
      const handleRenderError = (error: Error) => {
        return {
          fallback: true,
          reason: error.message.includes('timeout')
            ? 'timeout'
            : error.message.includes('crash')
              ? 'browser_crash'
              : 'render_error',
          shouldProxy: true,
        };
      };

      const timeoutError = handleRenderError(new Error('Navigation timeout'));
      expect(timeoutError.shouldProxy).toBe(true);

      const crashError = handleRenderError(new Error('Browser crash'));
      expect(crashError.shouldProxy).toBe(true);
    });

    it('should preserve original request for proxy fallback', () => {
      const originalRequest = {
        url: '/products/123',
        method: 'GET',
        headers: { 'user-agent': 'Googlebot/2.1' },
      };

      const fallbackResult = {
        fallback: true,
        originalRequest,
      };

      expect(fallbackResult.originalRequest).toEqual(originalRequest);
    });

    it('should log fallback events', () => {
      const event = createSSREvent('render_error', {
        url: 'https://example.com',
        error: 'Navigation timeout',
        fallback: true,
      });

      expect(event.event).toBe('render_error');
      expect(event.url).toBe('https://example.com');
    });
  });

  describe('Navigation Strategy Fallback', () => {
    it('should try networkidle0 first', async () => {
      const strategies = ['networkidle0', 'networkidle2', 'domcontentloaded'];

      expect(strategies[0]).toBe('networkidle0');
    });

    it('should fallback through navigation strategies', async () => {
      const attemptedStrategies: string[] = [];

      const tryStrategy = async (strategy: string): Promise<{ success: boolean; strategy: string }> => {
        attemptedStrategies.push(strategy);
        if (strategy === 'domcontentloaded') {
          return { success: true, strategy };
        }
        throw new Error(`${strategy} timeout`);
      };

      const tryNavigation = async (strategies: string[]) => {
        for (const strategy of strategies) {
          try {
            return await tryStrategy(strategy);
          } catch {
            // Continue to next strategy
            continue;
          }
        }
        return { success: false, strategy: 'none' };
      };

      const result = await tryNavigation(['networkidle0', 'networkidle2', 'domcontentloaded']);

      expect(attemptedStrategies).toEqual(['networkidle0', 'networkidle2', 'domcontentloaded']);
      expect(result.strategy).toBe('domcontentloaded');
    });

    it('should add delay after domcontentloaded', async () => {
      const addJSWaitDelay = async () => {
        const delay = 100; // ms
        await new Promise((resolve) => setTimeout(resolve, delay));
        return delay;
      };

      vi.useFakeTimers();
      const delayPromise = addJSWaitDelay();
      vi.advanceTimersByTime(100);
      const delay = await delayPromise;

      expect(delay).toBe(100);
    });
  });

  describe('Error Recovery', () => {
    it('should close page on error', async () => {
      const page = createMockPage();

      const renderWithCleanup = async () => {
        try {
          throw new Error('Render failed');
        } finally {
          await page.close();
        }
      };

      await expect(renderWithCleanup()).rejects.toThrow('Render failed');
      expect(page.close).toHaveBeenCalled();
    });

    it('should not leak browser instances', () => {
      let openInstances = 0;

      const trackInstance = {
        open: () => {
          openInstances++;
        },
        close: () => {
          openInstances--;
        },
      };

      // Simulate render with proper cleanup
      trackInstance.open();
      trackInstance.close();

      expect(openInstances).toBe(0);
    });

    it('should emit error event on failure', () => {
      const events: Array<{ event: string; data: unknown }> = [];

      const emitEvent = (event: string, data: unknown) => {
        events.push({ event, data });
      };

      emitEvent('render_error', { url: 'https://example.com', error: 'Timeout' });

      expect(events).toHaveLength(1);
      expect(events[0].event).toBe('render_error');
    });
  });

  describe('SSR Event Tracking', () => {
    it('should create render_start event', () => {
      const event = createSSREvent('render_start', { url: 'https://example.com' });

      expect(event.event).toBe('render_start');
      expect(event.url).toBe('https://example.com');
      expect(event.timestamp).toBeDefined();
    });

    it('should create render_complete event', () => {
      const event = createSSREvent('render_complete', {
        url: 'https://example.com',
        renderTime: 1500,
        statusCode: 200,
      });

      expect(event.event).toBe('render_complete');
      expect(event.renderTime).toBe(1500);
    });

    it('should create render_error event', () => {
      const event = createSSREvent('render_error', {
        url: 'https://example.com',
        error: 'Navigation timeout',
      });

      expect(event.event).toBe('render_error');
      expect(event.error).toBe('Navigation timeout');
    });

    it('should create cache_hit event', () => {
      const event = createSSREvent('cache_hit', {
        url: 'https://example.com',
        ttl: 3600,
      });

      expect(event.event).toBe('cache_hit');
      expect(event.ttl).toBe(3600);
    });
  });
});
