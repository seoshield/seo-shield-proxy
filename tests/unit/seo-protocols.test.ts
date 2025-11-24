import { ContentHealthCheckManager, CriticalSelector } from '../../src/admin/content-health-check';
import { VirtualScrollManager } from '../../src/admin/virtual-scroll-manager';
import { ETagManager } from '../../src/admin/etag-manager';
import { ETagService } from '../../src/admin/etag-service';
import { ClusterManager } from '../../src/admin/cluster-manager';
import { ShadowDOMExtractor } from '../../src/admin/shadow-dom-extractor';
import { CircuitBreaker, CircuitBreakerManager } from '../../src/admin/circuit-breaker';
import { SEOProtocolsService } from '../../src/admin/seo-protocols-service';

// Mock console methods to avoid test output pollution
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
  console.log = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

describe('SEO Protocols Unit Tests', () => {
  describe('ContentHealthCheckManager', () => {
    let manager: ContentHealthCheckManager;

    beforeEach(() => {
      const config = {
        enabled: true,
        criticalSelectors: [
          { selector: 'title', type: 'title', required: true, description: 'Page title' },
          { selector: 'meta[name="description"]', type: 'meta', required: true, description: 'Meta description' },
          { selector: 'h1', type: 'h1', required: true, description: 'H1 heading' },
          { selector: 'body', type: 'custom', required: true, description: 'Body content' }
        ],
        minBodyLength: 500,
        minTitleLength: 30,
        metaDescriptionRequired: true,
        h1Required: true,
        failOnMissingCritical: true,
      };
      manager = new ContentHealthCheckManager(config);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should be initialized with default configuration', () => {
      expect(manager).toBeDefined();
      expect(manager.config.enabled).toBe(true);
      expect(manager.config.criticalSelectors).toContain('title');
      expect(manager.config.criticalSelectors).toContain('meta[name="description"]');
      expect(manager.config.criticalSelectors).toContain('h1');
      expect(manager.config.criticalSelectors).toContain('body');
      expect(manager.config.minBodyLength).toBe(500);
      expect(manager.config.minTitleLength).toBe(30);
      expect(manager.config.metaDescriptionRequired).toBe(true);
      expect(manager.config.h1Required).toBe(true);
      expect(manager.config.failOnMissingCritical).toBe(true);
    });

    it('should validate page title length - too short', async () => {
      const mockPage = {
        evaluate: jest.fn()
          .mockResolvedValueOnce({ titleLength: 25, descriptionLength: 150, h1Count: 1, wordCount: 500, bodyLength: 1000 })
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce([])
      } as any;

      const result = await manager.checkPageHealth(mockPage, 'http://example.com');

      expect(result.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'warning',
          selector: 'title',
          message: expect.stringContaining('too short')
        })
      ]));
      expect(result.metrics.titleLength).toBe(25);
    });

    it('should validate page title length - perfect', async () => {
      const mockPage = {
        evaluate: jest.fn()
          .mockResolvedValueOnce({ titleLength: 50, descriptionLength: 150, h1Count: 1, wordCount: 500, bodyLength: 1000 })
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce([])
      } as any;

      const result = await manager.checkPageHealth(mockPage, 'http://example.com');

      expect(result.issues).not.toEqual(expect.arrayContaining([
        expect.objectContaining({
          selector: 'title',
          type: 'warning'
        })
      ]));
      expect(result.metrics.titleLength).toBe(50);
    });

    it('should validate page title length - too long', async () => {
      const mockPage = {
        evaluate: jest.fn()
          .mockResolvedValueOnce({ titleLength: 80, descriptionLength: 150, h1Count: 1, wordCount: 500, bodyLength: 1000 })
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce([])
      } as any;

      const result = await manager.checkPageHealth(mockPage, 'http://example.com');

      expect(result.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'warning',
          selector: 'title',
          message: expect.stringContaining('too long')
        })
      ]));
    });

    it('should detect missing meta description', async () => {
      const mockPage = {
        evaluate: jest.fn()
          .mockResolvedValueOnce({ titleLength: 50, descriptionLength: 0, h1Count: 1, wordCount: 500, bodyLength: 1000 })
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce([])
      } as any;

      const result = await manager.checkPageHealth(mockPage, 'http://example.com');

      expect(result.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'error',
          selector: 'meta[name="description"]',
          message: expect.stringContaining('missing')
        })
      ]));
      expect(result.metrics.descriptionLength).toBe(0);
    });

    it('should detect missing H1 tag', async () => {
      const mockPage = {
        evaluate: jest.fn()
          .mockResolvedValueOnce({ titleLength: 50, descriptionLength: 150, h1Count: 0, wordCount: 500, bodyLength: 1000 })
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce([])
      } as any;

      const result = await manager.checkPageHealth(mockPage, 'http://example.com');

      expect(result.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'error',
          selector: 'h1',
          message: expect.stringContaining('missing')
        })
      ]));
      expect(result.metrics.h1Count).toBe(0);
    });

    it('should detect multiple H1 tags', async () => {
      const mockPage = {
        evaluate: jest.fn()
          .mockResolvedValueOnce({ titleLength: 50, descriptionLength: 150, h1Count: 3, wordCount: 500, bodyLength: 1000 })
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce([])
      } as any;

      const result = await manager.checkPageHealth(mockPage, 'http://example.com');

      expect(result.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'warning',
          selector: 'h1',
          message: expect.stringContaining('Multiple')
        })
      ]));
    });

    it('should detect insufficient body content', async () => {
      const mockPage = {
        evaluate: jest.fn()
          .mockResolvedValueOnce({ titleLength: 50, descriptionLength: 150, h1Count: 1, wordCount: 100, bodyLength: 300 })
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce([])
      } as any;

      const result = await manager.checkPageHealth(mockPage, 'http://example.com');

      expect(result.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'error',
          selector: 'body',
          message: expect.stringContaining('too short')
        })
      ]));
      expect(result.metrics.bodyLength).toBe(300);
    });

    it('should calculate high health score for perfect page', async () => {
      const mockPage = {
        evaluate: jest.fn()
          .mockResolvedValueOnce({ titleLength: 45, descriptionLength: 155, h1Count: 1, wordCount: 800, bodyLength: 2000 })
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ selector: 'title', type: 'title' }])
          .mockResolvedValueOnce([{ selector: 'meta[name="description"]', type: 'meta' }])
          .mockResolvedValueOnce([{ selector: 'h1', type: 'h1' }])
          .mockResolvedValueOnce([{ selector: 'body', type: 'custom' }])
      } as any;

      const result = await manager.checkPageHealth(mockPage, 'http://example.com');

      expect(result.score).toBeGreaterThan(90);
      expect(result.passed).toBe(true);
      expect(result.issues.filter(issue => issue.type === 'error')).toHaveLength(0);
    });

    it('should generate recommendations for page issues', async () => {
      const mockPage = {
        evaluate: jest.fn()
          .mockResolvedValueOnce({ titleLength: 20, descriptionLength: 0, h1Count: 0, wordCount: 100, bodyLength: 200 })
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce([])
      } as any;

      const result = await manager.checkPageHealth(mockPage, 'http://example.com');

      expect(result.recommendations).toEqual(expect.arrayContaining([
        expect.stringContaining('Add a descriptive page title'),
        expect.stringContaining('Add a meta description'),
        expect.stringContaining('Add a single H1 tag'),
        expect.stringContaining('Add more substantive content')
      ]));
    });

    it('should handle page evaluation errors gracefully', async () => {
      const mockPage = {
        evaluate: jest.fn().mockRejectedValue(new Error('Evaluation failed'))
      } as any;

      const result = await manager.checkPageHealth(mockPage, 'http://example.com');

      expect(result.success).toBe(false);
      expect(result.score).toBe(0);
      expect(result.issues).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('Failed to analyze page')
        })
      ]));
    });

    it('should validate critical selectors presence', async () => {
      const mockPage = {
        evaluate: jest.fn()
          .mockResolvedValueOnce({ titleLength: 50, descriptionLength: 150, h1Count: 1, wordCount: 500, bodyLength: 1000 })
          .mockResolvedValueOnce(true) // title found
          .mockResolvedValueOnce(true) // meta description found
          .mockResolvedValueOnce(true) // h1 found
          .mockResolvedValueOnce(true) // body found
          .mockResolvedValueOnce(false)
      } as any;

      const result = await manager.checkPageHealth(mockPage, 'http://example.com');

      expect(result.metrics.criticalSelectorsFound).toBe(4);
      expect(result.metrics.totalCriticalSelectors).toBe(4);
    });

    it('should get default selectors for different page types', () => {
      const ecommerceSelectors = ContentHealthCheckManager.getDefaultCriticalSelectors('ecommerce');
      expect(ecommerceSelectors).toEqual(expect.arrayContaining([
        expect.objectContaining({ selector: 'title', type: 'title' }),
        expect.objectContaining({ selector: '.product-title', type: 'h1' }),
        expect.objectContaining({ selector: '.price', type: 'custom' })
      ]));

      const blogSelectors = ContentHealthCheckManager.getDefaultCriticalSelectors('blog');
      expect(blogSelectors).toEqual(expect.arrayContaining([
        expect.objectContaining({ selector: '.blog-title', type: 'h1' }),
        expect.objectContaining({ selector: '.blog-content', type: 'custom' })
      ]));

      const generalSelectors = ContentHealthCheckManager.getDefaultCriticalSelectors('general');
      expect(generalSelectors).toEqual(expect.arrayContaining([
        expect.objectContaining({ selector: 'title', type: 'title' }),
        expect.objectContaining({ selector: 'h1', type: 'h1' })
      ]));
    });
  });

  describe('VirtualScrollManager', () => {
    let manager: VirtualScrollManager;

    beforeEach(() => {
      const config = {
        enabled: true,
        scrollSteps: 10,
        scrollInterval: 300,
        maxScrollHeight: 10000,
        waitAfterScroll: 1000,
        scrollSelectors: ['.infinite-scroll'],
        infiniteScrollSelectors: ['.load-more'],
        lazyImageSelectors: ['img[data-src]'],
        triggerIntersectionObserver: true,
        waitForNetworkIdle: true,
        networkIdleTimeout: 5000
      };
      manager = new VirtualScrollManager(config);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should be initialized with default configuration', () => {
      expect(manager).toBeDefined();
      expect(manager.config.enabled).toBe(true);
      expect(manager.config.scrollSteps).toBe(10);
      expect(manager.config.scrollInterval).toBe(300);
      expect(manager.config.maxScrollHeight).toBe(10000);
      expect(manager.config.waitAfterScroll).toBe(1000);
    });

    it('should handle disabled virtual scrolling', async () => {
      const config = VirtualScrollManager.getDefaultConfig();
      config.enabled = false;
      const disabledManager = new VirtualScrollManager(config);

      const mockPage = {} as any;
      const result = await disabledManager.triggerVirtualScroll(mockPage, 'http://example.com');

      expect(result.success).toBe(true);
      expect(result.recommendations).toContain('Virtual scroll is disabled in configuration');
      expect(result.scrollSteps).toBe(0);
    });

    it('should execute virtual scrolling successfully', async () => {
      const mockPage = {
        evaluate: jest.fn()
          .mockResolvedValueOnce({
            finalHeight: 2000,
            scrollSteps: 5,
            totalDistance: 1000
          })
          .mockResolvedValueOnce(3) // infinite scroll triggered
          .mockResolvedValueOnce(5) // lazy images triggered
          .mockResolvedValueOnce(true) // intersection observer success
          .mockResolvedValueOnce({
            pageHeight: 2000,
            imageCount: 10,
            wordCount: 1000,
            elementCount: 100
          })
          .mockResolvedValueOnce({
            pageHeight: 2000,
            imageCount: 15,
            wordCount: 1200,
            elementCount: 120
          })
      } as any;

      (mockPage.waitForTimeout as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      const result = await manager.triggerVirtualScroll(mockPage, 'http://example.com');

      expect(result.success).toBe(true);
      expect(result.scrollSteps).toBeGreaterThan(0);
      expect(result.finalHeight).toBe(2000);
      expect(result.initialHeight).toBe(2000);
      expect(result.newImages).toBe(5);
      expect(result.newContent).toBe(200);
      expect(result.triggerMethods).toEqual(expect.arrayContaining([
        'Basic Scrolling',
        'Infinite Scroll Trigger',
        'Lazy Image Trigger',
        'Intersection Observer Trigger',
        'Custom Scroll Events'
      ]));
    });

    it('should handle scroll execution errors', async () => {
      const mockPage = {
        evaluate: jest.fn().mockRejectedValue(new Error('Scroll failed'))
      } as any;

      const result = await manager.triggerVirtualScroll(mockPage, 'http://example.com');

      expect(result.success).toBe(false);
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringContaining('Scroll execution failed')
      ]));
    });

    it('should calculate completion rate correctly', async () => {
      const mockPage = {
        evaluate: jest.fn()
          .mockResolvedValueOnce({
            finalHeight: 5000,
            scrollSteps: 8,
            totalDistance: 4000
          })
          .mockResolvedValueOnce({
            pageHeight: 1000,
            imageCount: 5,
            wordCount: 500,
            elementCount: 50
          })
          .mockResolvedValueOnce({
            pageHeight: 5000,
            imageCount: 15,
            wordCount: 1500,
            elementCount: 150
          })
      } as any;

      (mockPage.waitForTimeout as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      const result = await manager.triggerVirtualScroll(mockPage, 'http://example.com');

      expect(result.completionRate).toBeGreaterThan(0);
      expect(result.completionRate).toBeLessThanOrEqual(100);
    });

    it('should generate recommendations for optimization', async () => {
      const config = VirtualScrollManager.getDefaultConfig();
      config.scrollSteps = 2;
      const lowPerformManager = new VirtualScrollManager(config);

      const mockPage = {
        evaluate: jest.fn()
          .mockResolvedValueOnce({
            finalHeight: 1000,
            scrollSteps: 2,
            totalDistance: 500
          })
          .mockResolvedValueOnce({
            pageHeight: 1000,
            imageCount: 5,
            wordCount: 500,
            elementCount: 50
          })
          .mockResolvedValueOnce({
            pageHeight: 1000,
            imageCount: 5,
            wordCount: 500,
            elementCount: 50
          })
      } as any;

      (mockPage.waitForTimeout as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      const result = await lowPerformManager.triggerVirtualScroll(mockPage, 'http://example.com');

      expect(result.recommendations).toEqual(expect.arrayContaining([
        expect.stringContaining('increasing scroll steps')
      ]));
    });

    it('should get default configuration', () => {
      const defaultConfig = VirtualScrollManager.getDefaultConfig();
      expect(defaultConfig.enabled).toBe(true);
      expect(defaultConfig.scrollSteps).toBe(10);
      expect(defaultConfig.scrollInterval).toBe(300);
      expect(defaultConfig.maxScrollHeight).toBe(10000);
      expect(defaultConfig.lazyImageSelectors).toContain('img[data-src]');
      expect(defaultConfig.lazyImageSelectors).toContain('img[loading="lazy"]');
    });
  });

  describe('ETagManager', () => {
    let manager: ETagManager;

    beforeEach(() => {
      const config = {
        enabled: true,
        hashAlgorithm: 'sha256' as const,
        enable304Responses: true,
        checkContentChanges: true,
        ignoredElements: ['script', 'style'],
        significantChanges: {
          minWordChange: 50,
          minStructureChange: 10,
          contentWeightThreshold: 25
        }
      };
      manager = new ETagManager(config);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should be initialized with default configuration', () => {
      expect(manager).toBeDefined();
      expect(manager.config.enabled).toBe(true);
      expect(manager.config.hashAlgorithm).toBe('sha256');
      expect(manager.config.enable304Responses).toBe(true);
    });

    it('should generate ETag for HTML content', async () => {
      const html = '<html><head><title>Test</title></head><body><h1>Content</h1></body></html>';
      const url = 'http://example.com';

      const result = await manager.generateETag(html, url);

      expect(result.etag).toBeTruthy();
      expect(result.etag).toMatch(/^".*"$/);
      expect(result.contentLength).toBe(html.length);
      expect(result.significantHash).toBeTruthy();
      expect(result.structureHash).toBeTruthy();
      expect(result.fullHash).toBeTruthy();
      expect(result.changeType).toBe('none');
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('should handle disabled ETag generation', async () => {
      const config = ETagManager.getDefaultConfig();
      config.enabled = false;
      const disabledManager = new ETagManager(config);

      const html = '<html></html>';
      const result = await disabledManager.generateETag(html, 'http://example.com');

      expect(result.etag).toBe('');
      expect(result.lastModified).toBeTruthy();
      expect(result.contentLength).toBe(html.length);
    });

    it('should detect content changes', async () => {
      const html1 = '<html><body>Content 1</body></html>';
      const html2 = '<html><body>Content 2</body></html>';
      const url = 'http://example.com';

      const result1 = await manager.compareETag(url, html1);
      const result2 = await manager.compareETag(url, html2);

      expect(result1.notModified).toBe(false);
      expect(result2.notModified).toBe(false);
      expect(result1.etag).not.toBe(result2.etag);
      expect(result1.cacheable).toBe(true);
      expect(result2.cacheable).toBe(true);
    });

    it('should handle If-None-Match header', async () => {
      const html = '<html><body>Content</body></html>';
      const url = 'http://example.com';

      // Generate initial ETag
      const initialResult = await manager.generateETag(html, url);

      // Compare with same content and If-None-Match header
      const comparisonResult = await manager.compareETag(
        url,
        html,
        initialResult.etag
      );

      expect(comparisonResult.notModified).toBe(true);
      expect(comparisonResult.etag).toBe(initialResult.etag);
    });

    it('should handle If-Modified-Since header', async () => {
      const html = '<html><body>Content</body></html>';
      const url = 'http://example.com';

      // Generate initial result
      const initialResult = await manager.generateETag(html, url);

      // Compare with same content and If-Modified-Since header
      const comparisonResult = await manager.compareETag(
        url,
        html,
        undefined,
        initialResult.lastModified
      );

      expect(comparisonResult.notModified).toBe(true);
      expect(comparisonResult.lastModified).toBe(initialResult.lastModified);
    });

    it('should analyze content changes', async () => {
      const html1 = '<html><body>Short content</body></html>';
      const html2 = '<html><body>Very long content with many words and new elements and images</body></html>';
      const url = 'http://example.com';

      // First, generate ETag for first content
      await manager.generateETag(html1, url);

      // Then compare with significantly different content
      const result = await manager.compareETag(url, html2);

      expect(result.changeType).toMatch(/^(minor|significant|major)$/);
      expect(result.changeDetails).toBeDefined();
    });

    it('should return cache control headers', () => {
      const headers = manager.getCacheControlHeaders('minor');
      expect(headers['Cache-Control']).toBeTruthy();
      expect(headers['ETag']).toBeTruthy();
      expect(headers['Last-Modified']).toBeTruthy();
      expect(headers['Cache-Control']).toContain('max-age=7200');
    });

    it('should cache URLs appropriately', () => {
      expect(manager.shouldCacheUrl('https://example.com/page')).toBe(true);
      expect(manager.shouldCacheUrl('https://example.com/api/data')).toBe(false);
      expect(manager.shouldCacheUrl('https://example.com/page.css')).toBe(false);
      expect(manager.shouldCacheUrl('https://example.com/page?timestamp=123')).toBe(false);
    });

    it('should cleanup old cache entries', () => {
      // Add some entries to cache
      manager.generateETag('<html></html>', 'https://example.com/test1');
      manager.generateETag('<html></html>', 'https://example.com/test2');

      // Cleanup should not throw errors
      expect(() => manager.cleanupCache()).not.toThrow();
    });

    it('should get cache statistics', () => {
      const stats = manager.getCacheStats();
      expect(stats).toHaveProperty('totalEntries');
      expect(typeof stats.totalEntries).toBe('number');
    });

    it('should get default configuration', () => {
      const defaultConfig = ETagManager.getDefaultConfig();
      expect(defaultConfig.enabled).toBe(true);
      expect(defaultConfig.hashAlgorithm).toBe('sha256');
      expect(defaultConfig.enable304Responses).toBe(true);
      expect(defaultConfig.ignoredElements).toContain('script');
      expect(defaultConfig.ignoredElements).toContain('style');
    });
  });

  describe('ETagService', () => {
    let etagService: ETagService;

    beforeEach(() => {
      const config = ETagManager.getDefaultConfig();
      etagService = ETagService.create(config);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should create ETag service with configuration', () => {
      expect(etagService).toBeDefined();
    });

    it('should generate ETag for SSR content', async () => {
      const url = 'https://example.com';
      const html = '<html><body>Test content</body></html>';

      const result = await etagService.generateETagForSSR(url, html);

      expect(result.etag).toBeTruthy();
      expect(result.lastModified).toBeTruthy();
      expect(result.cacheControl).toBeTruthy();
    });

    it('should check if content should be served from cache', async () => {
      const url = 'https://example.com';
      const html = '<html><body>Test content</body></html>';
      const ifNoneMatch = '"some-etag"';

      const result = await etagService.shouldServeFromCache({ url, headers: { 'if-none-match': ifNoneMatch } } as any, html);

      expect(typeof result).toBe('boolean');
    });

    it('should get cache statistics', () => {
      const stats = etagService.getCacheStats();
      expect(stats).toBeDefined();
      expect(typeof stats.totalEntries).toBe('number');
    });

    it('should cleanup cache entries', () => {
      expect(() => etagService.cleanupCache()).not.toThrow();
    });

    it('should provide middleware function', () => {
      const middleware = etagService.middleware();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('ShadowDOMExtractor', () => {
    let extractor: ShadowDOMExtractor;

    beforeEach(() => {
      const config = {
        enabled: true,
        deepSerialization: true,
        includeShadowContent: true,
        flattenShadowTrees: true,
        customElements: {
          'lit-element': { extractMethod: 'slot' as const },
          'custom-component': { extractMethod: 'custom' as const, selector: '.content' }
        },
        preserveShadowBoundaries: false,
        extractCSSVariables: true,
        extractComputedStyles: false
      };
      extractor = new ShadowDOMExtractor(config);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should be initialized with default configuration', () => {
      expect(extractor).toBeDefined();
      expect(extractor.config.enabled).toBe(true);
      expect(extractor.config.deepSerialization).toBe(true);
      expect(extractor.config.flattenShadowTrees).toBe(true);
    });

    it('should handle disabled shadow DOM extraction', async () => {
      const config = ShadowDOMExtractor.getDefaultConfig();
      config.enabled = false;
      const disabledExtractor = new ShadowDOMExtractor(config);

      const mockPage = {
        content: jest.fn().mockResolvedValue('<html><body>No shadow DOM</body></html>')
      } as any;

      const result = await disabledExtractor.extractCompleteContent(mockPage);

      expect(result.shadowDOMs).toHaveLength(0);
      expect(result.stats.totalShadowRoots).toBe(0);
      expect(result.warnings).toContain('Shadow DOM extraction is disabled');
    });

    it('should extract content from page with evaluation script', async () => {
      const mockPage = {
        content: jest.fn().mockResolvedValue('<html><body>Content</body></html>'),
        evaluate: jest.fn().mockImplementation(async () => {
          // Add small delay to ensure extraction time > 0
          await new Promise(resolve => setTimeout(resolve, 5));
          return {
            lightDOM: '<html><body>Content</body></html>',
            shadowDOMs: [],
            flattened: '<html><body>Content</body></html>',
            extractedElements: 5,
            cssVariables: ['--primary-color', '--font-size'],
            maxDepth: 2,
            warnings: []
          };
        })
      } as any;

      const result = await extractor.extractCompleteContent(mockPage);

      expect(result.lightDOM).toBeTruthy();
      expect(result.flattened).toBeTruthy();
      expect(result.stats.extractionTime).toBeGreaterThan(0);
      expect(result.stats.extractedElements).toBe(5);
      expect(result.stats.cssVariables).toBe(2);
      expect(result.stats.nestedDepth).toBe(2);
    });

    it('should handle extraction errors gracefully', async () => {
      const mockPage = {
        content: jest.fn().mockResolvedValue('<html></html>'),
        evaluate: jest.fn().mockRejectedValue(new Error('Extraction failed'))
      } as any;

      const result = await extractor.extractCompleteContent(mockPage);

      expect(result.warnings).toEqual(expect.arrayContaining([
        expect.stringContaining('Extraction failed')
      ]));
      expect(result.shadowDOMs).toHaveLength(0);
    });

    it('should check for shadow DOM usage', async () => {
      const mockPage = {
        evaluate: jest.fn().mockResolvedValue(false)
      } as any;

      const hasShadow = await extractor.hasShadowDOM(mockPage);
      expect(hasShadow).toBe(false);

      // Test with shadow DOM present
      mockPage.evaluate = jest.fn().mockResolvedValue(true);
      const hasShadowTrue = await extractor.hasShadowDOM(mockPage);
      expect(hasShadowTrue).toBe(true);
    });

    it('should get shadow DOM statistics', async () => {
      const mockPage = {
        evaluate: jest.fn().mockResolvedValue({
          totalElements: 50,
          shadowHosts: 3,
          openShadowRoots: 2,
          closedShadowRoots: 1,
          customElements: ['lit-element', 'custom-component']
        })
      } as any;

      const stats = await extractor.getShadowDOMStats(mockPage);

      expect(stats.totalElements).toBe(50);
      expect(stats.shadowHosts).toBe(3);
      expect(stats.openShadowRoots).toBe(2);
      expect(stats.closedShadowRoots).toBe(1);
      expect(stats.customElements).toContain('lit-element');
    });

    it('should extract content from custom elements', async () => {
      const mockPage = {
        evaluate: jest.fn().mockResolvedValue(['Slot content 1', 'Slot content 2'])
      } as any;

      const results = await extractor.extractCustomElementContent(mockPage, 'lit-element');

      expect(results).toEqual(['Slot content 1', 'Slot content 2']);
    });

    it('should get CSS variables from shadow DOM', async () => {
      const mockPage = {
        evaluate: jest.fn().mockResolvedValue({
          '--primary-color': '#007bff',
          '--font-size': '16px',
          '--padding': '10px'
        })
      } as any;

      const variables = await extractor.getShadowCSSVariables(mockPage);

      expect(variables['--primary-color']).toBe('#007bff');
      expect(variables['--font-size']).toBe('16px');
    });

    it('should get default configuration', () => {
      const defaultConfig = ShadowDOMExtractor.getDefaultConfig();
      expect(defaultConfig.enabled).toBe(true);
      expect(defaultConfig.deepSerialization).toBe(true);
      expect(defaultConfig.flattenShadowTrees).toBe(true);
      expect(defaultConfig.customElements).toHaveProperty('lit-element');
    });
  });

  describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker<string>;

    beforeEach(() => {
      const config = {
        enabled: true,
        errorThreshold: 50,
        resetTimeout: 1000,
        monitoringPeriod: 300000,
        fallbackToStale: true,
        halfOpenMaxCalls: 3,
        failureThreshold: 3,
        successThreshold: 2,
        timeoutThreshold: 5000
      };
      circuitBreaker = new CircuitBreaker(config);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should be initialized with default configuration', () => {
      expect(circuitBreaker).toBeDefined();
      const state = circuitBreaker.getState();
      expect(state.state).toBe('CLOSED');
      expect(state.failures).toBe(0);
      expect(state.successes).toBe(0);
    });

    it('should execute successful operations', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(operation);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.circuitState).toBe('CLOSED');
      expect(result.fallbackUsed).toBe(false);
      expect(result.metrics.totalSuccesses).toBe(1);
    });

    it('should handle operation failures', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));
      const result = await circuitBreaker.execute(operation);

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.circuitState).toBe('CLOSED');
      expect(result.metrics.totalFailures).toBe(1);
    });

    it('should use fallback when provided', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));
      const fallback = jest.fn().mockResolvedValue('fallback result');

      const result = await circuitBreaker.execute(operation, fallback);

      expect(result.success).toBe(true);
      expect(result.result).toBe('fallback result');
      expect(result.fallbackUsed).toBe(true);
    });

    it('should transition to open state after threshold failures', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));

      // First failure
      await circuitBreaker.execute(operation);
      expect(circuitBreaker.getState().state).toBe('CLOSED');

      // Second failure
      await circuitBreaker.execute(operation);
      expect(circuitBreaker.getState().state).toBe('CLOSED');

      // Third failure - should open circuit
      await circuitBreaker.execute(operation);
      expect(circuitBreaker.getState().state).toBe('OPEN');
    });

    it('should handle operation timeout', async () => {
      const operation = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 10000)); // 10 second delay
      });

      const result = await circuitBreaker.execute(operation);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timed out');
    });

    it('should reset circuit to initial state', () => {
      circuitBreaker.forceState('OPEN');
      expect(circuitBreaker.getState().state).toBe('OPEN');

      circuitBreaker.reset();
      expect(circuitBreaker.getState().state).toBe('CLOSED');
      expect(circuitBreaker.getState().failures).toBe(0);
    });

    it('should provide health status', () => {
      const health = circuitBreaker.getHealthStatus();
      expect(health.healthy).toBe(true);
      expect(health.status).toBe('healthy');
      expect(health.message).toContain('closed');
    });

    it('should handle circuit breaker during open state', async () => {
      // Force circuit open
      circuitBreaker.forceState('OPEN');

      const operation = jest.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(operation);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Circuit breaker is OPEN');
    });

    it('should check if requests are allowed', () => {
      expect(circuitBreaker.isRequestAllowed()).toBe(true);

      circuitBreaker.forceState('OPEN');
      expect(circuitBreaker.isRequestAllowed()).toBe(false);

      circuitBreaker.forceState('HALF_OPEN');
      expect(circuitBreaker.isRequestAllowed()).toBe(true);
    });

    it('should get time until next retry', () => {
      circuitBreaker.forceState('OPEN');
      const timeUntilRetry = circuitBreaker.getTimeUntilNextRetry();
      expect(typeof timeUntilRetry).toBe('number');
      expect(timeUntilRetry).toBeGreaterThanOrEqual(0);
    });

    it('should get default configuration', () => {
      const defaultConfig = CircuitBreaker.getDefaultConfig();
      expect(defaultConfig.enabled).toBe(true);
      expect(defaultConfig.errorThreshold).toBe(50);
      expect(defaultConfig.failureThreshold).toBe(5);
      expect(defaultConfig.timeoutThreshold).toBe(30000);
    });
  });

  describe('CircuitBreakerManager', () => {
    let manager: CircuitBreakerManager;

    beforeEach(() => {
      const config = CircuitBreaker.getDefaultConfig();
      manager = new CircuitBreakerManager(config);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should create and manage multiple circuits', () => {
      const circuit1 = manager.getCircuit('service1');
      const circuit2 = manager.getCircuit('service2');
      const circuit1Again = manager.getCircuit('service1');

      expect(circuit1).toBeDefined();
      expect(circuit2).toBeDefined();
      expect(circuit1Again).toBe(circuit1);
      expect(circuit1).not.toBe(circuit2);
    });

    it('should get all circuit states', () => {
      manager.getCircuit('service1');
      manager.getCircuit('service2');

      const states = manager.getAllStates();
      expect(states).toHaveProperty('service1');
      expect(states).toHaveProperty('service2');
    });

    it('should get overall health status', () => {
      const health = manager.getOverallHealth();
      expect(health.healthy).toBe(true);
      expect(health.status).toBe('healthy');
      expect(health.circuits).toBeDefined();
    });

    it('should reset all circuits', () => {
      const circuit1 = manager.getCircuit('service1');
      circuit1.forceState('OPEN');

      expect(circuit1.getState().state).toBe('OPEN');

      manager.resetAll();

      expect(circuit1.getState().state).toBe('CLOSED');
    });

    it('should close all circuits', () => {
      const circuit1 = manager.getCircuit('service1');
      const circuit2 = manager.getCircuit('service2');

      circuit1.forceState('OPEN');
      circuit2.forceState('OPEN');

      manager.closeAll();

      expect(circuit1.getState().state).toBe('CLOSED');
      expect(circuit2.getState().state).toBe('CLOSED');
    });

    it('should handle degraded health status', async () => {
      const circuit1 = manager.getCircuit('service1');
      const circuit2 = manager.getCircuit('service2');

      // Simulate some failures
      for (let i = 0; i < 2; i++) {
        try {
          await circuit1.execute(() => Promise.reject(new Error('Test error')));
        } catch (e) {
          // Ignore
        }
      }

      const health = manager.getOverallHealth();
      expect(health.status).toMatch(/^(healthy|degraded)$/);
    });
  });

  describe('ClusterManager', () => {
    let manager: ClusterManager;

    beforeEach(() => {
      const config = {
        enabled: false, // Disabled for unit tests to avoid Redis dependency
        useRedisQueue: false,
        maxWorkers: 3,
        jobTimeout: 30000,
        retryAttempts: 3,
        retryDelay: 5000,
        redis: {
          host: 'localhost',
          port: 6379,
          db: 0
        },
        browser: {
          headless: true,
          args: ['--no-sandbox'],
          defaultViewport: { width: 1920, height: 1080 }
        }
      };
      manager = new ClusterManager(config);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should be initialized with configuration', () => {
      expect(manager).toBeDefined();
    });

    it('should initialize without errors when disabled', async () => {
      await expect(manager.initialize()).resolves.not.toThrow();
    });

    it('should add render job to queue', async () => {
      // This will return null when queue is not available
      const result = await manager.addRenderJob('https://example.com');
      expect(result).toBeNull();
    });

    it('should get cluster statistics', async () => {
      const stats = await manager.getStats();
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('workers');
      expect(stats).toHaveProperty('jobs');
      expect(stats).toHaveProperty('performance');
    });

    it('should handle pause and resume operations', async () => {
      await expect(manager.pause()).resolves.not.toThrow();
      await expect(manager.resume()).resolves.not.toThrow();
    });

    it('should handle shutdown gracefully', async () => {
      await expect(manager.shutdown()).resolves.not.toThrow();
    });

    it('should get default configuration', () => {
      const defaultConfig = ClusterManager.getDefaultConfig();
      expect(defaultConfig.enabled).toBe(false);
      expect(defaultConfig.maxWorkers).toBe(3);
      expect(defaultConfig.jobTimeout).toBe(30000);
      expect(defaultConfig.browser.headless).toBe(true);
    });
  });

  describe('SEOProtocolsService', () => {
    let service: SEOProtocolsService;

    beforeEach(async () => {
      const config = SEOProtocolsService.getDefaultConfig();
      service = new SEOProtocolsService(config);
      await service.initialize();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should be initialized with default configuration', () => {
      expect(service).toBeDefined();
      const config = service.getConfig();
      expect(config.contentHealthCheck.enabled).toBe(true);
      expect(config.virtualScroll.enabled).toBe(true);
      expect(config.etagStrategy.enabled).toBe(true);
      expect(config.clusterMode.enabled).toBe(false); // Default disabled
      expect(config.shadowDom.enabled).toBe(true);
      expect(config.circuitBreaker.enabled).toBe(true);
    });

    it('should initialize all services', async () => {
      await expect(service.initialize()).resolves.not.toThrow();
    });

    it('should provide access to individual managers', () => {
      expect(service.getContentHealthCheck()).toBeDefined();
      expect(service.getVirtualScrollManager()).toBeDefined();
      expect(service.getETagService()).toBeDefined();
      expect(service.getClusterManager()).toBeDefined();
      expect(service.getShadowDOMExtractor()).toBeDefined();
      expect(service.getCircuitBreakerManager()).toBeDefined();
    });

    it('should get service status', async () => {
      const status = await service.getStatus();
      expect(status.enabled).toBe(true);
      expect(status.protocols.contentHealthCheck.enabled).toBe(true);
      expect(status.protocols.virtualScroll.enabled).toBe(true);
      expect(status.protocols.etagStrategy.enabled).toBe(true);
      expect(status.protocols.shadowDom.enabled).toBe(true);
      expect(status.protocols.circuitBreaker.enabled).toBe(true);
      expect(status.overall).toMatch(/^(healthy|degraded|unhealthy)$/);
    });

    it('should update configuration', () => {
      const newConfig = {
        contentHealthCheck: { enabled: false }
      };

      service.updateConfig(newConfig);
      const config = service.getConfig();
      expect(config.contentHealthCheck.enabled).toBe(false);
    });

    it('should apply optimizations', async () => {
      const mockPage = {
        content: jest.fn().mockResolvedValue('<html><body>Optimized content</body></html>'),
        evaluate: jest.fn().mockResolvedValue({})
      } as any;

      const result = await service.applyOptimizations({
        url: 'http://example.com',
        html: '<html><body>Original content</body></html>',
        page: mockPage
      });

      expect(result.html).toBeTruthy();
      expect(Array.isArray(result.optimizations)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(result.metrics).toBeDefined();
    });

    it('should handle optimization errors gracefully', async () => {
      const mockPage = {
        content: jest.fn().mockRejectedValue(new Error('Page error')),
        evaluate: jest.fn().mockRejectedValue(new Error('Eval error'))
      } as any;

      const result = await service.applyOptimizations({
        url: 'http://example.com',
        html: '<html><body>Content</body></html>',
        page: mockPage
      });

      expect(result.html).toBe('<html><body>Content</body></html>');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should get metrics', async () => {
      const metrics = await service.getMetrics();
      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('object');
    });

    it('should shutdown gracefully', async () => {
      await service.initialize();
      await expect(service.shutdown()).resolves.not.toThrow();
    });

    it('should get default configuration', () => {
      const defaultConfig = SEOProtocolsService.getDefaultConfig();
      expect(defaultConfig.contentHealthCheck.enabled).toBe(true);
      expect(defaultConfig.virtualScroll.enabled).toBe(true);
      expect(defaultConfig.etagStrategy.enabled).toBe(true);
      expect(defaultConfig.clusterMode.enabled).toBe(false);
      expect(defaultConfig.shadowDom.enabled).toBe(true);
      expect(defaultConfig.circuitBreaker.enabled).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should create default configuration for all protocols', () => {
      const defaultConfig = SEOProtocolsService.getDefaultConfig();

      // Content Health Check
      expect(defaultConfig.contentHealthCheck).toHaveProperty('enabled');
      expect(defaultConfig.contentHealthCheck).toHaveProperty('criticalSelectors');
      expect(defaultConfig.contentHealthCheck).toHaveProperty('minBodyLength');
      expect(defaultConfig.contentHealthCheck.enabled).toBe(true);

      // Virtual Scroll
      expect(defaultConfig.virtualScroll).toHaveProperty('enabled');
      expect(defaultConfig.virtualScroll).toHaveProperty('scrollSteps');
      expect(defaultConfig.virtualScroll).toHaveProperty('scrollInterval');
      expect(defaultConfig.virtualScroll.enabled).toBe(true);

      // ETag Strategy
      expect(defaultConfig.etagStrategy).toHaveProperty('enabled');
      expect(defaultConfig.etagStrategy).toHaveProperty('hashAlgorithm');
      expect(defaultConfig.etagStrategy).toHaveProperty('enable304Responses');
      expect(defaultConfig.etagStrategy.enabled).toBe(true);

      // Cluster Mode
      expect(defaultConfig.clusterMode).toHaveProperty('enabled');
      expect(defaultConfig.clusterMode).toHaveProperty('maxWorkers');
      expect(defaultConfig.clusterMode).toHaveProperty('useRedisQueue');
      expect(defaultConfig.clusterMode.enabled).toBe(false);

      // Shadow DOM
      expect(defaultConfig.shadowDom).toHaveProperty('enabled');
      expect(defaultConfig.shadowDom).toHaveProperty('deepSerialization');
      expect(defaultConfig.shadowDom).toHaveProperty('flattenShadowTrees');
      expect(defaultConfig.shadowDom.enabled).toBe(true);

      // Circuit Breaker
      expect(defaultConfig.circuitBreaker).toHaveProperty('enabled');
      expect(defaultConfig.circuitBreaker).toHaveProperty('errorThreshold');
      expect(defaultConfig.circuitBreaker).toHaveProperty('resetTimeout');
      expect(defaultConfig.circuitBreaker.enabled).toBe(true);
    });

    it('should validate configuration structure', () => {
      const config = SEOProtocolsService.getDefaultConfig();

      // Validate nested objects exist
      expect(typeof config.contentHealthCheck).toBe('object');
      expect(typeof config.virtualScroll).toBe('object');
      expect(typeof config.etagStrategy).toBe('object');
      expect(typeof config.clusterMode).toBe('object');
      expect(typeof config.shadowDom).toBe('object');
      expect(typeof config.circuitBreaker).toBe('object');

      // Validate required properties exist
      expect(config.contentHealthCheck).toHaveProperty('criticalSelectors');
      expect(config.virtualScroll).toHaveProperty('scrollSteps');
      expect(config.etagStrategy).toHaveProperty('hashAlgorithm');
      expect(config.clusterMode).toHaveProperty('maxWorkers');
      expect(config.shadowDom).toHaveProperty('deepSerialization');
      expect(config.circuitBreaker).toHaveProperty('errorThreshold');
    });

    it('should handle complete workflow end-to-end', async () => {
      const service = new SEOProtocolsService(SEOProtocolsService.getDefaultConfig());
      await service.initialize();

      const mockPage = {
        content: jest.fn().mockResolvedValue('<html><head><title>Test Page</title><meta name="description" content="Test description"></head><body><h1>Main Heading</h1><p>Test content with sufficient length to meet minimum requirements and ensure good health score</p></body></html>'),
        evaluate: jest.fn()
          .mockResolvedValueOnce({ titleLength: 10, descriptionLength: 19, h1Count: 1, wordCount: 20, bodyLength: 150 })
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce({
            finalHeight: 1000,
            scrollSteps: 5,
            totalDistance: 500
          })
          .mockResolvedValueOnce({
            pageHeight: 1000,
            imageCount: 5,
            wordCount: 20,
            elementCount: 25
          })
          .mockResolvedValueOnce({
            pageHeight: 1000,
            imageCount: 5,
            wordCount: 20,
            elementCount: 25
          })
          .mockResolvedValueOnce({
            lightDOM: '<html></html>',
            shadowDOMs: [],
            flattened: '<html></html>',
            extractedElements: 0,
            cssVariables: [],
            maxDepth: 0,
            warnings: []
          })
      } as any;

      (mockPage.waitForTimeout as jest.Mock) = jest.fn().mockResolvedValue(undefined);

      const result = await service.applyOptimizations({
        url: 'https://example.com/test',
        html: '<html><body>Original</body></html>',
        page: mockPage
      });

      expect(result).toBeDefined();
      expect(result.html).toBeTruthy();
      expect(Array.isArray(result.optimizations)).toBe(true);
      expect(result.metrics).toBeDefined();

      const status = await service.getStatus();
      expect(status.overall).toMatch(/^(healthy|degraded|unhealthy)$/);

      await service.shutdown();
    });
  });
});

// Global test configuration
describe('Global SEO Protocols Configuration', () => {
  it('should validate all default configurations are properly formed', () => {
    // ContentHealthCheckManager
    const contentHealthConfig = ContentHealthCheckManager.getDefaultConfig();
    expect(Array.isArray(contentHealthConfig.criticalSelectors)).toBe(true);
    expect(typeof contentHealthConfig.minBodyLength).toBe('number');
    expect(typeof contentHealthConfig.enabled).toBe('boolean');

    // VirtualScrollManager
    const virtualScrollConfig = VirtualScrollManager.getDefaultConfig();
    expect(typeof virtualScrollConfig.scrollSteps).toBe('number');
    expect(typeof virtualScrollConfig.scrollInterval).toBe('number');
    expect(Array.isArray(virtualScrollConfig.lazyImageSelectors)).toBe(true);

    // ETagManager
    const etagConfig = ETagManager.getDefaultConfig();
    expect(['md5', 'sha256']).toContain(etagConfig.hashAlgorithm);
    expect(typeof etagConfig.enable304Responses).toBe('boolean');

    // ClusterManager
    const clusterConfig = ClusterManager.getDefaultConfig();
    expect(typeof clusterConfig.maxWorkers).toBe('number');
    expect(typeof clusterConfig.jobTimeout).toBe('number');

    // ShadowDOMExtractor
    const shadowConfig = ShadowDOMExtractor.getDefaultConfig();
    expect(typeof shadowConfig.deepSerialization).toBe('boolean');
    expect(typeof shadowConfig.flattenShadowTrees).toBe('boolean');

    // CircuitBreaker
    const circuitConfig = CircuitBreaker.getDefaultConfig();
    expect(typeof circuitConfig.errorThreshold).toBe('number');
    expect(typeof circuitConfig.resetTimeout).toBe('number');
  });

  it('should validate all singleton services can be created', () => {
    // These should not throw when created with default configs
    expect(() => new ContentHealthCheckManager(ContentHealthCheckManager.getDefaultConfig())).not.toThrow();
    expect(() => new VirtualScrollManager(VirtualScrollManager.getDefaultConfig())).not.toThrow();
    expect(() => new ETagManager(ETagManager.getDefaultConfig())).not.toThrow();
    expect(() => new ShadowDOMExtractor(ShadowDOMExtractor.getDefaultConfig())).not.toThrow();
    expect(() => new CircuitBreaker(CircuitBreaker.getDefaultConfig())).not.toThrow();
    expect(() => new ClusterManager(ClusterManager.getDefaultConfig())).not.toThrow();
    expect(() => new SEOProtocolsService(SEOProtocolsService.getDefaultConfig())).not.toThrow();
  });
});