/**
 * Unit Tests for Metrics Collector
 * Tests traffic metrics collection, statistics calculation, and data management
 */

import { jest } from '@jest/globals';

describe('Metrics Collector', () => {
  let metricsCollector;

  beforeAll(async () => {
    // Set custom log size for testing
    process.env['METRICS_LOG_SIZE'] = '100';

    const module = await import('../../dist/admin/metrics-collector.js');
    metricsCollector = module.default;
  });

  beforeEach(() => {
    // Reset metrics before each test
    metricsCollector.reset();
  });

  describe('recordRequest()', () => {
    test('should record bot request correctly', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const stats = metricsCollector.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.botRequests).toBe(1);
      expect(stats.humanRequests).toBe(0);
      expect(stats.ssrRendered).toBe(1);
      expect(stats.cacheMisses).toBe(1);
    });

    test('should record human request correctly', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
        isBot: false,
        action: 'proxy',
        cacheStatus: null,
      });

      const stats = metricsCollector.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.botRequests).toBe(0);
      expect(stats.humanRequests).toBe(1);
      expect(stats.proxiedDirect).toBe(1);
    });

    test('should record cache HIT correctly', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'HIT',
      });

      const stats = metricsCollector.getStats();
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(0);
    });

    test('should record static asset requests', () => {
      metricsCollector.recordRequest({
        path: '/app.js',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'static',
        cacheStatus: null,
      });

      const stats = metricsCollector.getStats();
      expect(stats.staticAssets).toBe(1);
    });

    test('should record bypassed requests', () => {
      metricsCollector.recordRequest({
        path: '/admin/dashboard',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'bypass',
        cacheStatus: null,
        rule: 'NO_CACHE: /admin/*',
      });

      const stats = metricsCollector.getStats();
      expect(stats.bypassedByRules).toBe(1);
    });

    test('should record errors', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'error',
        cacheStatus: null,
        error: 'Render failed',
      });

      const stats = metricsCollector.getStats();
      expect(stats.errors).toBe(1);
    });

    test('should track multiple requests', () => {
      for (let i = 0; i < 10; i++) {
        metricsCollector.recordRequest({
          path: `/page${i}`,
          userAgent: 'Googlebot',
          isBot: true,
          action: 'ssr',
          cacheStatus: 'MISS',
        });
      }

      const stats = metricsCollector.getStats();
      expect(stats.totalRequests).toBe(10);
      expect(stats.botRequests).toBe(10);
    });
  });

  describe('Bot Detection', () => {
    test('should detect Googlebot', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const botStats = metricsCollector.getBotStats();
      expect(botStats['Googlebot']).toBe(1);
    });

    test('should detect Bingbot', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Mozilla/5.0 (compatible; bingbot/2.0)',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const botStats = metricsCollector.getBotStats();
      expect(botStats['Bingbot']).toBe(1);
    });

    test('should detect Twitterbot', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Twitterbot/1.0',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const botStats = metricsCollector.getBotStats();
      expect(botStats['Twitterbot']).toBe(1);
    });

    test('should detect Facebook bot', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'facebookexternalhit/1.1',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const botStats = metricsCollector.getBotStats();
      expect(botStats['Facebook']).toBe(1);
    });

    test('should detect LinkedIn bot', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'LinkedInBot/1.0',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const botStats = metricsCollector.getBotStats();
      expect(botStats['LinkedIn']).toBe(1);
    });

    test('should detect Slackbot', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Slackbot-LinkExpanding 1.0',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const botStats = metricsCollector.getBotStats();
      expect(botStats['Slack']).toBe(1);
    });

    test('should detect Telegram bot', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'telegrambot (like TwitterBot)',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const botStats = metricsCollector.getBotStats();
      expect(botStats['Telegram']).toBe(1);
    });

    test('should detect WhatsApp', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'WhatsApp/2.0',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const botStats = metricsCollector.getBotStats();
      expect(botStats['WhatsApp']).toBe(1);
    });

    test('should detect Discord bot', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Discordbot/2.0',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const botStats = metricsCollector.getBotStats();
      expect(botStats['Discord']).toBe(1);
    });

    test('should detect Baidu spider', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Mozilla/5.0 (compatible; Baiduspider/2.0)',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const botStats = metricsCollector.getBotStats();
      expect(botStats['Baidu']).toBe(1);
    });

    test('should detect Yandex bot', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Mozilla/5.0 (compatible; YandexBot/3.0)',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const botStats = metricsCollector.getBotStats();
      expect(botStats['Yandex']).toBe(1);
    });

    test('should detect DuckDuckGo bot', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'DuckDuckBot/1.0',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const botStats = metricsCollector.getBotStats();
      expect(botStats['DuckDuckGo']).toBe(1);
    });

    test('should categorize unknown bots as "Other Bots"', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'UnknownBot/1.0',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const botStats = metricsCollector.getBotStats();
      expect(botStats['Other Bots']).toBe(1);
    });

    test('should count same bot multiple times', () => {
      for (let i = 0; i < 5; i++) {
        metricsCollector.recordRequest({
          path: `/page${i}`,
          userAgent: 'Googlebot/2.1',
          isBot: true,
          action: 'ssr',
          cacheStatus: 'MISS',
        });
      }

      const botStats = metricsCollector.getBotStats();
      expect(botStats['Googlebot']).toBe(5);
    });
  });

  describe('getStats()', () => {
    test('should return complete statistics', () => {
      const stats = metricsCollector.getStats();

      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('botRequests');
      expect(stats).toHaveProperty('humanRequests');
      expect(stats).toHaveProperty('cacheHits');
      expect(stats).toHaveProperty('cacheMisses');
      expect(stats).toHaveProperty('ssrRendered');
      expect(stats).toHaveProperty('proxiedDirect');
      expect(stats).toHaveProperty('staticAssets');
      expect(stats).toHaveProperty('bypassedByRules');
      expect(stats).toHaveProperty('errors');
      expect(stats).toHaveProperty('uptime');
      expect(stats).toHaveProperty('cacheHitRate');
      expect(stats).toHaveProperty('requestsPerSecond');
    });

    test('should calculate cache hit rate correctly', () => {
      // 3 hits, 1 miss = 75% hit rate
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'HIT',
      });
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'HIT',
      });
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'HIT',
      });
      metricsCollector.recordRequest({
        path: '/page2',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const stats = metricsCollector.getStats();
      expect(stats.cacheHitRate).toBe('75.00');
    });

    test('should return 0 cache hit rate when no cache operations', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Mozilla',
        isBot: false,
        action: 'proxy',
        cacheStatus: null,
      });

      const stats = metricsCollector.getStats();
      expect(stats.cacheHitRate).toBe('0.00');
    });

    test('should calculate uptime', () => {
      const stats = metricsCollector.getStats();
      expect(typeof stats.uptime).toBe('number');
      expect(stats.uptime).toBeGreaterThanOrEqual(0);
    });

    test('should calculate requests per second', () => {
      const stats = metricsCollector.getStats();
      expect(stats.requestsPerSecond).toBeDefined();
    });
  });

  describe('URL Statistics', () => {
    test('should track URL visit counts', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'HIT',
      });

      const urlStats = metricsCollector.getUrlStats();
      expect(urlStats).toHaveLength(1);
      expect(urlStats[0].path).toBe('/page1');
      expect(urlStats[0].count).toBe(2);
    });

    test('should track cache hits/misses per URL', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'HIT',
      });
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'HIT',
      });

      const urlStats = metricsCollector.getUrlStats();
      expect(urlStats[0].cacheHits).toBe(2);
      expect(urlStats[0].cacheMisses).toBe(1);
    });

    test('should calculate hit rate per URL', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'HIT',
      });
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const urlStats = metricsCollector.getUrlStats();
      expect(urlStats[0].hitRate).toBe('50.00');
    });

    test('should return 0 hit rate when no cache operations for URL', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Mozilla',
        isBot: false,
        action: 'proxy',
        cacheStatus: null,
      });

      const urlStats = metricsCollector.getUrlStats();
      expect(urlStats[0].hitRate).toBe(0);
    });

    test('should sort URLs by count (descending)', () => {
      for (let i = 0; i < 3; i++) {
        metricsCollector.recordRequest({
          path: '/page1',
          userAgent: 'Googlebot',
          isBot: true,
          action: 'ssr',
          cacheStatus: 'MISS',
        });
      }

      for (let i = 0; i < 5; i++) {
        metricsCollector.recordRequest({
          path: '/page2',
          userAgent: 'Googlebot',
          isBot: true,
          action: 'ssr',
          cacheStatus: 'MISS',
        });
      }

      metricsCollector.recordRequest({
        path: '/page3',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const urlStats = metricsCollector.getUrlStats();
      expect(urlStats[0].path).toBe('/page2'); // 5 visits
      expect(urlStats[1].path).toBe('/page1'); // 3 visits
      expect(urlStats[2].path).toBe('/page3'); // 1 visit
    });

    test('should respect limit parameter', () => {
      for (let i = 0; i < 10; i++) {
        metricsCollector.recordRequest({
          path: `/page${i}`,
          userAgent: 'Googlebot',
          isBot: true,
          action: 'ssr',
          cacheStatus: 'MISS',
        });
      }

      const urlStats = metricsCollector.getUrlStats(5);
      expect(urlStats).toHaveLength(5);
    });

    test('should update lastAccess timestamp', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const urlStats = metricsCollector.getUrlStats();
      expect(urlStats[0].lastAccess).toBeDefined();
      expect(typeof urlStats[0].lastAccess).toBe('number');
    });
  });

  describe('Traffic Log', () => {
    test('should maintain rolling window of traffic', () => {
      for (let i = 0; i < 10; i++) {
        metricsCollector.recordRequest({
          path: `/page${i}`,
          userAgent: 'Googlebot',
          isBot: true,
          action: 'ssr',
          cacheStatus: 'MISS',
        });
      }

      const traffic = metricsCollector.getRecentTraffic(10);
      expect(traffic).toHaveLength(10);
    });

    test('should return recent traffic in reverse chronological order', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      metricsCollector.recordRequest({
        path: '/page2',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const traffic = metricsCollector.getRecentTraffic();
      expect(traffic[0].path).toBe('/page2'); // Most recent first
      expect(traffic[1].path).toBe('/page1');
    });

    test('should respect limit parameter in getRecentTraffic', () => {
      for (let i = 0; i < 50; i++) {
        metricsCollector.recordRequest({
          path: `/page${i}`,
          userAgent: 'Googlebot',
          isBot: true,
          action: 'ssr',
          cacheStatus: 'MISS',
        });
      }

      const traffic = metricsCollector.getRecentTraffic(10);
      expect(traffic).toHaveLength(10);
    });

    test('should include timestamps in traffic log', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const traffic = metricsCollector.getRecentTraffic();
      expect(traffic[0].timestamp).toBeDefined();
      expect(typeof traffic[0].timestamp).toBe('number');
    });
  });

  describe('Traffic Timeline', () => {
    test('should generate timeline for specified minutes', () => {
      const timeline = metricsCollector.getTrafficTimeline(60);
      expect(timeline).toHaveLength(60);
    });

    test('should group requests by minute', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const timeline = metricsCollector.getTrafficTimeline(5);
      const lastMinute = timeline[timeline.length - 1];
      expect(lastMinute.total).toBeGreaterThanOrEqual(1);
    });

    test('should separate bot and human traffic', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      metricsCollector.recordRequest({
        path: '/page2',
        userAgent: 'Mozilla',
        isBot: false,
        action: 'proxy',
        cacheStatus: null,
      });

      const timeline = metricsCollector.getTrafficTimeline(5);
      const lastMinute = timeline[timeline.length - 1];
      expect(lastMinute.bots).toBeGreaterThanOrEqual(1);
      expect(lastMinute.humans).toBeGreaterThanOrEqual(1);
    });

    test('should track cache hits/misses in timeline', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'HIT',
      });

      const timeline = metricsCollector.getTrafficTimeline(5);
      const lastMinute = timeline[timeline.length - 1];
      expect(lastMinute.cacheHits).toBeGreaterThanOrEqual(1);
    });

    test('should include timestamp for each timeline entry', () => {
      const timeline = metricsCollector.getTrafficTimeline(5);
      timeline.forEach((entry) => {
        expect(entry.timestamp).toBeDefined();
        expect(typeof entry.timestamp).toBe('number');
      });
    });
  });

  describe('reset()', () => {
    test('should reset all statistics', () => {
      // Add some data
      for (let i = 0; i < 10; i++) {
        metricsCollector.recordRequest({
          path: `/page${i}`,
          userAgent: 'Googlebot',
          isBot: true,
          action: 'ssr',
          cacheStatus: 'MISS',
        });
      }

      metricsCollector.reset();

      const stats = metricsCollector.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.botRequests).toBe(0);
      expect(stats.humanRequests).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
    });

    test('should clear traffic log', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      metricsCollector.reset();

      const traffic = metricsCollector.getRecentTraffic();
      expect(traffic).toHaveLength(0);
    });

    test('should clear bot statistics', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      metricsCollector.reset();

      const botStats = metricsCollector.getBotStats();
      expect(Object.keys(botStats)).toHaveLength(0);
    });

    test('should clear URL statistics', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      metricsCollector.reset();

      const urlStats = metricsCollector.getUrlStats();
      expect(urlStats).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle requests without cache status', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: 'Mozilla',
        isBot: false,
        action: 'proxy',
        cacheStatus: null,
      });

      const stats = metricsCollector.getStats();
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
    });

    test('should handle empty user agent', () => {
      metricsCollector.recordRequest({
        path: '/page1',
        userAgent: '',
        isBot: false,
        action: 'proxy',
        cacheStatus: null,
      });

      const stats = metricsCollector.getStats();
      expect(stats.totalRequests).toBe(1);
    });

    test('should handle very long URLs', () => {
      const longUrl = '/page' + 'x'.repeat(1000);
      metricsCollector.recordRequest({
        path: longUrl,
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const urlStats = metricsCollector.getUrlStats();
      expect(urlStats[0].path).toBe(longUrl);
    });

    test('should handle special characters in URLs', () => {
      metricsCollector.recordRequest({
        path: '/page?query=test&param=value#section',
        userAgent: 'Googlebot',
        isBot: true,
        action: 'ssr',
        cacheStatus: 'MISS',
      });

      const urlStats = metricsCollector.getUrlStats();
      expect(urlStats[0].path).toContain('?');
      expect(urlStats[0].path).toContain('&');
    });
  });
});
