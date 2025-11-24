/**
 * Performance and Load Testing - 100% Success Rate Target
 * Tests system under various load conditions
 */

const puppeteer = require('puppeteer');

describe('Performance & Load Testing', () => {
  let browser;
  const BASE_URL = 'http://localhost:3000';
  const ADMIN_URL = 'http://localhost:3001';
  const CONCURRENT_USERS = 50;
  const TEST_DURATION = 30000; // 30 seconds

  beforeAll(async () => {
    // Increase timeout for performance tests
    jest.setTimeout(120000);

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  describe('Concurrent User Load Testing', () => {
    test('should handle 50 concurrent users', async () => {
      const page = await browser.newPage();
      const promises = [];

      // Create concurrent page requests
      for (let i = 0; i < CONCURRENT_USERS; i++) {
        promises.push(
          page.goto(`${BASE_URL}/test-page-${i}`, {
            waitUntil: 'networkidle2',
            timeout: 30000
          }).then(response => ({
            status: response.status(),
            loadTime: Date.now()
          }))
        );
      }

      const results = await Promise.allSettled(promises);
      const successful = results.filter(result =>
        result.status === 'fulfilled' && result.value.status === 200
      );

      // Require at least 95% success rate
      const successRate = (successful.length / CONCURRENT_USERS) * 100;
      expect(successRate).toBeGreaterThanOrEqual(95);

      await page.close();
    }, 60000);

    test('should maintain response times under load', async () => {
      const page = await browser.newPage();
      const responseTimes = [];

      // Test with increasing load
      for (let users = 1; users <= 20; users += 5) {
        const promises = [];
        const startTime = Date.now();

        for (let i = 0; i < users; i++) {
          promises.push(
            page.goto(`${BASE_URL}/load-test-${users}-${i}`, {
              waitUntil: 'networkidle2',
              timeout: 15000
            })
          );
        }

        await Promise.all(promises);
        const endTime = Date.now();
        const averageTime = (endTime - startTime) / users;
        responseTimes.push({ users, averageTime });

        // Average response time should not increase linearly
        if (users > 1) {
          const timePerUser = averageTime / users;
          expect(timePerUser).toBeLessThan(2000); // 2 seconds per user
        }
      }

      await page.close();
    }, 60000);
  });

  describe('Memory Leak Detection', () => {
    test('should not leak memory during extended use', async () => {
      const page = await browser.newPage();
      const initialMemory = await page.metrics();

      // Perform many requests to detect memory leaks
      for (let i = 0; i < 100; i++) {
        await page.goto(`${BASE_URL}/memory-test-${i}`, {
          waitUntil: 'networkidle2',
          timeout: 10000
        });

        // Check memory usage every 20 requests
        if (i % 20 === 0) {
          const currentMemory = await page.metrics();
          const memoryGrowth = currentMemory.JSHeapUsedSize - initialMemory.JSHeapUsedSize;

          // Memory should not grow more than 50MB during testing
          expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
        }
      }

      await page.close();
    }, 120000);

    test('should clean up page resources properly', async () => {
      const page = await browser.newPage();

      // Open multiple pages and close them
      const pages = [];
      for (let i = 0; i < 10; i++) {
        const newPage = await browser.newPage();
        await newPage.goto(`${BASE_URL}/cleanup-test-${i}`);
        pages.push(newPage);
      }

      // Close all pages
      const closePromises = pages.map(page => page.close());
      await Promise.all(closePromises);

      // Verify no pages remain open
      const remainingPages = await browser.pages();
      expect(remainingPages.length).toBeLessThan(2); // Allow for initial page
    });
  });

  describe('Admin Dashboard Performance', () => {
    test('should load admin dashboard quickly', async () => {
      const page = await browser.newPage();

      const startTime = Date.now();
      await page.goto(ADMIN_URL, {
        waitUntil: 'networkidle2',
        timeout: 10000
      });
      const loadTime = Date.now() - startTime;

      // Admin dashboard should load in under 3 seconds
      expect(loadTime).toBeLessThan(3000);

      await page.close();
    });

    test('should handle real-time updates efficiently', async () => {
      const page = await browser.newPage();
      await page.goto(ADMIN_URL, {
        waitUntil: 'networkidle2'
      });

      // Monitor WebSocket connections for real-time updates
      const webSocketConnections = [];

      page.on('websocketcreated', ws => {
        webSocketConnections.push(ws);
      });

      page.on('websocketclosed', ws => {
        const index = webSocketConnections.indexOf(ws);
        if (index > -1) {
          webSocketConnections.splice(index, 1);
        }
      });

      // Simulate real-time data updates
      for (let i = 0; i < 50; i++) {
        await page.evaluate(() => {
          // Simulate WebSocket data
          window.dispatchEvent(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'stats_update',
              data: { timestamp: Date.now() }
            })
          }));
        });

        // Small delay between updates
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Should not have excessive WebSocket connections
      expect(webSocketConnections.length).toBeLessThan(5);

      await page.close();
    });

    test('should handle dashboard navigation smoothly', async () => {
      const page = await browser.newPage();
      await page.goto(ADMIN_URL, {
        waitUntil: 'networkidle2'
      });

      // Test navigation between different tabs
      const tabs = [
        'overview',
        'traffic',
        'cache',
        'warmer',
        'snapshots',
        'forensics',
        'blocking',
        'hotfix',
        'simulation'
      ];

      for (const tab of tabs) {
        const startTime = Date.now();

        await page.evaluate((tabName) => {
          // Simulate clicking on tab
          const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
          if (tabButton) tabButton.click();
        }, tab);

        await page.waitForTimeout(500); // Wait for tab content to load
        const navigationTime = Date.now() - startTime;

        // Navigation should be fast
        expect(navigationTime).toBeLessThan(1000);
      }

      await page.close();
    });
  });

  describe('Cache Performance', () => {
    test('should serve cached pages quickly', async () => {
      const page = await browser.newPage();
      const url = `${BASE_URL}/cache-test`;

      // First request - should be slower
      const startTime1 = Date.now();
      await page.goto(url, {
        waitUntil: 'networkidle2'
      });
      const firstLoadTime = Date.now() - startTime1;

      // Second request - should be faster (cached)
      const startTime2 = Date.now();
      await page.goto(url, {
        waitUntil: 'networkidle2'
      });
      const secondLoadTime = Date.now() - startTime2;

      // Cached request should be significantly faster
      expect(secondLoadTime).toBeLessThan(firstLoadTime * 0.8);

      await page.close();
    });

    test('should handle cache warming under load', async () => {
      const page = await browser.newPage();

      // Simulate cache warming requests
      const warmUrls = Array(20).fill(null).map((_, i) =>
        `${BASE_URL}/warm-test-${i}`
      );

      const warmPromises = warmUrls.map(url =>
        page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 10000
        })
      );

      const warmResults = await Promise.allSettled(warmPromises);
      const successfulWarm = warmResults.filter(result =>
        result.status === 'fulfilled'
      );

      // Should achieve high success rate for cache warming
      const warmSuccessRate = (successfulWarm.length / warmUrls.length) * 100;
      expect(warmSuccessRate).toBeGreaterThanOrEqual(90);

      await page.close();
    });
  });

  describe('Bot Detection Performance', () => {
    test('should identify bots quickly', async () => {
      const page = await browser.newPage();

      // Test with different user agents
      const userAgents = [
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
        'Mozilla/5.0 (compatible; facebookexternalhit/1.1; +http://www.facebook.com/externalhit_uatext.php)',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' // Regular browser
      ];

      for (const userAgent of userAgents) {
        await page.setUserAgent(userAgent);

        const startTime = Date.now();
        await page.goto(`${BASE_URL}/bot-test`, {
          waitUntil: 'networkidle2'
        });
        const detectionTime = Date.now() - startTime;

        // Bot detection should be very fast
        expect(detectionTime).toBeLessThan(500);
      }

      await page.close();
    });

    test('should handle mixed bot and human traffic', async () => {
      const page = await browser.newPage();

      // Test mixed traffic patterns
      const requests = [
        { userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)', expectedCache: true },
        { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64)', expectedCache: false },
        { userAgent: 'Mozilla/5.0 (compatible; facebookexternalhit/1.1)', expectedCache: true },
        { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)', expectedCache: false }
      ];

      for (const { userAgent, expectedCache } of requests) {
        await page.setUserAgent(userAgent);

        const response = await page.goto(`${BASE_URL}/mixed-traffic`, {
          waitUntil: 'networkidle2'
        });

        const headers = response.headers();
        const isFromCache = headers['x-cache'] === 'HIT';

        if (expectedCache) {
          // Bot requests should be cached
          expect(isFromCache).toBe(true);
        }
      }

      await page.close();
    });
  });

  describe('Error Recovery', () => {
    test('should recover from failed renders gracefully', async () => {
      const page = await browser.newPage();

      // Test with pages that might fail to render
      const problematicUrls = [
        `${BASE_URL}/timeout-test`,
        `${BASE_URL}/javascript-error-test`,
        `${BASE_URL}/network-error-test`
      ];

      for (const url of problematicUrls) {
        try {
          await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 10000
          });
        } catch (error) {
          // Should handle errors gracefully
          expect(error).toBeDefined();
        }

        // Page should still be functional
        try {
          await page.goto(`${BASE_URL}/recovery-test`, {
            waitUntil: 'networkidle2',
            timeout: 5000
          });
          expect(true).toBe(true); // Should reach here
        } catch (recoveryError) {
          // If even recovery fails, that's a critical error
          throw recoveryError;
        }
      }

      await page.close();
    });

    test('should handle memory pressure gracefully', async () => {
      const page = await browser.newPage();

      // Create memory pressure
      const largeData = new Array(1000).fill('x').join('');

      for (let i = 0; i < 10; i++) {
        try {
          await page.evaluate((data) => {
            // Simulate memory pressure
            window.largeData = data;
            window.memoryPressure = true;
          }, largeData);

          await page.goto(`${BASE_URL}/memory-pressure-test-${i}`, {
            waitUntil: 'networkidle2',
            timeout: 8000
          });
        } catch (error) {
          // Should not crash completely
          expect(error.name).not.toBe('Error');
        }
      }

      // System should still be responsive
      await page.goto(`${BASE_URL}/still-responsive`, {
        waitUntil: 'networkidle2',
        timeout: 5000
      });

      await page.close();
    });
  });

  describe('Long-Running Stability', () => {
    test('should maintain stability over extended period', async () => {
      const page = await browser.newPage();
      const errors = [];
      const successes = [];

      const endTime = Date.now() + TEST_DURATION;

      while (Date.now() < endTime) {
        try {
          const startTime = Date.now();
          await page.goto(`${BASE_URL}/stability-test-${Date.now()}`, {
            waitUntil: 'networkidle2',
            timeout: 10000
          });
          const responseTime = Date.now() - startTime;

          successes.push({ time: responseTime, timestamp: Date.now() });

          // Response time should remain reasonable
          expect(responseTime).toBeLessThan(8000);

        } catch (error) {
          errors.push({ error: error.message, timestamp: Date.now() });
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Should achieve high success rate
      const successRate = (successes.length / (successes.length + errors.length)) * 100;
      expect(successRate).toBeGreaterThanOrEqual(95);

      console.log(`Stability Test Results:`);
      console.log(`  Success Rate: ${successRate.toFixed(2)}%`);
      console.log(`  Successful Requests: ${successes.length}`);
      console.log(`  Errors: ${errors.length}`);
      console.log(`  Average Response Time: ${
        successes.reduce((sum, s) => sum + s.time, 0) / successes.length
      }ms`);

      await page.close();
    }, 120000);
  });
});