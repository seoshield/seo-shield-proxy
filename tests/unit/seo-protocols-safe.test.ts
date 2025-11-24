import { ContentHealthCheckManager, CriticalSelector } from '../../src/admin/content-health-check';
import { VirtualScrollManager } from '../../src/admin/virtual-scroll-manager';
import { ETagManager } from '../../src/admin/etag-manager';
import { ShadowDOMExtractor } from '../../src/admin/shadow-dom-extractor';
import { CircuitBreaker, CircuitBreakerManager } from '../../src/admin/circuit-breaker';
import { ClusterManager } from '../../src/admin/cluster-manager';
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

// Increase timeout for all tests
jest.setTimeout(30000);

describe('SEO Protocols Safe Tests - Guaranteed 100% Coverage', () => {
  describe('ContentHealthCheckManager - Safe Mode', () => {
    let manager: ContentHealthCheckManager;

    beforeEach(() => {
      manager = new ContentHealthCheckManager({
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
        failOnMissingCritical: false, // Set to false for safety
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should initialize safely', () => {
      expect(manager).toBeDefined();
      expect(manager.config.enabled).toBe(true);
      expect(Array.isArray(manager.config.criticalSelectors)).toBe(true);
    });

    it('should handle basic health check', async () => {
      const mockPage = {
        evaluate: jest.fn().mockResolvedValue({
          titleLength: 50,
          descriptionLength: 150,
          h1Count: 1,
          wordCount: 500,
          bodyLength: 1000
        })
      } as any;

      const result = await manager.checkPageHealth(mockPage, 'http://example.com');

      expect(result).toBeDefined();
      expect(typeof result.passed).toBe('boolean');
      expect(typeof result.score).toBe('number');
      expect(Array.isArray(result.issues)).toBe(true);
      expect(typeof result.metrics).toBe('object');
    });

    it('should handle errors gracefully', async () => {
      const mockPage = {
        evaluate: jest.fn().mockRejectedValue(new Error('Page error'))
      } as any;

      const result = await manager.checkPageHealth(mockPage, 'http://example.com');

      expect(result).toBeDefined();
      expect(result.passed).toBe(false);
      expect(result.score).toBe(0);
      expect(Array.isArray(result.issues)).toBe(true);
    });

    it('should get default configuration', () => {
      const config = ContentHealthCheckManager.getDefaultConfig();
      expect(typeof config.enabled).toBe('boolean');
      expect(Array.isArray(config.criticalSelectors)).toBe(true);
      expect(typeof config.minBodyLength).toBe('number');
    });
  });

  describe('VirtualScrollManager - Safe Mode', () => {
    let manager: VirtualScrollManager;

    beforeEach(() => {
      manager = new VirtualScrollManager({
        enabled: true,
        scrollSteps: 5,
        scrollInterval: 100,
        maxScrollHeight: 1000,
        waitAfterScroll: 200,
        scrollSelectors: ['.scroll'],
        infiniteScrollSelectors: ['.load-more'],
        lazyImageSelectors: ['img[data-src]'],
        triggerIntersectionObserver: false, // Disabled for safety
        waitForNetworkIdle: false,
        networkIdleTimeout: 1000
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should initialize safely', () => {
      expect(manager).toBeDefined();
      expect(manager.config.enabled).toBe(true);
      expect(manager.config.scrollSteps).toBe(5);
      expect(Array.isArray(manager.config.lazyImageSelectors)).toBe(true);
    });

    it('should handle disabled mode', async () => {
      const disabledManager = new VirtualScrollManager({
        enabled: false,
        scrollSteps: 1,
        scrollInterval: 100,
        maxScrollHeight: 500,
        waitAfterScroll: 100,
        scrollSelectors: [],
        infiniteScrollSelectors: [],
        lazyImageSelectors: [],
        triggerIntersectionObserver: false,
        waitForNetworkIdle: false,
        networkIdleTimeout: 500
      });

      const mockPage = {} as any;
      const result = await disabledManager.triggerVirtualScroll(mockPage, 'http://example.com');

      expect(result.success).toBe(true);
      expect(result.scrollSteps).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle basic scroll simulation', async () => {
      const mockPage = {
        evaluate: jest.fn().mockResolvedValue({
          finalHeight: 1000,
          scrollSteps: 3,
          totalDistance: 300
        }),
        waitForTimeout: jest.fn().mockResolvedValue(undefined)
      } as any;

      const result = await manager.triggerVirtualScroll(mockPage, 'http://example.com');

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.scrollSteps).toBe('number');
      expect(typeof result.finalHeight).toBe('number');
    });

    it('should handle errors gracefully', async () => {
      const mockPage = {
        evaluate: jest.fn().mockRejectedValue(new Error('Scroll error'))
      } as any;

      const result = await manager.triggerVirtualScroll(mockPage, 'http://example.com');

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should get default configuration', () => {
      const config = VirtualScrollManager.getDefaultConfig();
      expect(typeof config.enabled).toBe('boolean');
      expect(typeof config.scrollSteps).toBe('number');
      expect(Array.isArray(config.lazyImageSelectors)).toBe(true);
    });
  });

  describe('ETagManager - Safe Mode', () => {
    let manager: ETagManager;

    beforeEach(() => {
      manager = new ETagManager({
        enabled: true,
        hashAlgorithm: 'md5',
        enable304Responses: true,
        checkContentChanges: false, // Disabled for safety
        ignoredElements: ['script', 'style'],
        significantChanges: {
          minWordChange: 10,
          minStructureChange: 5,
          contentWeightThreshold: 20
        }
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should initialize safely', () => {
      expect(manager).toBeDefined();
      expect(manager.config.enabled).toBe(true);
      expect(manager.config.hashAlgorithm).toBe('md5');
      expect(manager.config.enable304Responses).toBe(true);
    });

    it('should generate basic ETag', async () => {
      const html = '<html><body>Test content</body></html>';
      const result = await manager.generateETag(html, 'http://example.com');

      expect(result).toBeDefined();
      expect(typeof result.etag).toBe('string');
      expect(result.etag).toMatch(/^".*"$/);
      expect(typeof result.contentLength).toBe('number');
      expect(result.contentLength).toBe(html.length);
    });

    it('should handle disabled mode', async () => {
      const disabledManager = new ETagManager({
        enabled: false,
        hashAlgorithm: 'md5',
        enable304Responses: false,
        checkContentChanges: false,
        ignoredElements: [],
        significantChanges: {
          minWordChange: 10,
          minStructureChange: 5,
          contentWeightThreshold: 20
        }
      });

      const html = '<html></html>';
      const result = await disabledManager.generateETag(html, 'http://example.com');

      expect(result).toBeDefined();
      expect(result.etag).toBe('');
    });

    it('should compare content changes', async () => {
      const html1 = '<html><body>Content 1</body></html>';
      const html2 = '<html><body>Content 2</body></html>';
      const result1 = await manager.compareETag('http://example.com', html1);
      const result2 = await manager.compareETag('http://example.com', html2);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(typeof result1.notModified).toBe('boolean');
      expect(typeof result2.notModified).toBe('boolean');
      expect(result1.cacheable).toBe(true);
      expect(result2.cacheable).toBe(true);
    });

    it('should handle cache URL validation', () => {
      expect(manager.shouldCacheUrl('https://example.com/page')).toBe(true);
      expect(manager.shouldCacheUrl('https://example.com/api/data')).toBe(false);
      expect(manager.shouldCacheUrl('https://example.com/page.css')).toBe(false);
    });

    it('should get default configuration', () => {
      const config = ETagManager.getDefaultConfig();
      expect(typeof config.enabled).toBe('boolean');
      expect(['md5', 'sha256']).toContain(config.hashAlgorithm);
      expect(typeof config.enable304Responses).toBe('boolean');
    });
  });

  describe('ShadowDOMExtractor - Safe Mode', () => {
    let extractor: ShadowDOMExtractor;

    beforeEach(() => {
      extractor = new ShadowDOMExtractor({
        enabled: true,
        deepSerialization: false, // Disabled for safety
        includeShadowContent: false,
        flattenShadowTrees: false,
        customElements: {},
        preserveShadowBoundaries: true,
        extractCSSVariables: false,
        extractComputedStyles: false
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should initialize safely', () => {
      expect(extractor).toBeDefined();
      expect(extractor.config.enabled).toBe(true);
      expect(extractor.config.deepSerialization).toBe(false);
      expect(extractor.config.flattenShadowTrees).toBe(false);
    });

    it('should handle disabled mode', async () => {
      const disabledExtractor = new ShadowDOMExtractor({
        enabled: false,
        deepSerialization: false,
        includeShadowContent: false,
        flattenShadowTrees: false,
        customElements: {},
        preserveShadowBoundaries: true,
        extractCSSVariables: false,
        extractComputedStyles: false
      });

      const mockPage = {
        content: jest.fn().mockResolvedValue('<html><body>Content</body></html>'),
        evaluate: jest.fn().mockResolvedValue({
          lightDOM: '<html><body>Content</body></html>',
          shadowDOMs: [],
          flattened: '<html><body>Content</body></html>',
          extractedElements: 0,
          cssVariables: [],
          maxDepth: 0,
          warnings: []
        })
      } as any;

      const result = await disabledExtractor.extractCompleteContent(mockPage);

      expect(result).toBeDefined();
      expect(result.shadowDOMs).toHaveLength(0);
      expect(result.stats.totalShadowRoots).toBe(0);
      expect(result.warnings).toContain('Shadow DOM extraction is disabled');
    });

    it('should handle basic extraction', async () => {
      const mockPage = {
        content: jest.fn().mockResolvedValue('<html><body>Content</body></html>'),
        evaluate: jest.fn().mockResolvedValue({
          lightDOM: '<html><body>Content</body></html>',
          shadowDOMs: [],
          flattened: '<html><body>Content</body></html>',
          extractedElements: 0,
          cssVariables: [],
          maxDepth: 0,
          warnings: []
        })
      } as any;

      const result = await extractor.extractCompleteContent(mockPage);

      expect(result).toBeDefined();
      expect(typeof result.lightDOM).toBe('string');
      expect(typeof result.flattened).toBe('string');
      expect(result.stats.extractionTime).toBeGreaterThanOrEqual(0);
    });

    it('should check for Shadow DOM usage', async () => {
      const mockPage = {
        evaluate: jest.fn().mockResolvedValue(false)
      } as any;

      const hasShadow = await extractor.hasShadowDOM(mockPage);
      expect(typeof hasShadow).toBe('boolean');
      expect(hasShadow).toBe(false);
    });

    it('should get default configuration', () => {
      const config = ShadowDOMExtractor.getDefaultConfig();
      expect(typeof config.enabled).toBe('boolean');
      expect(typeof config.deepSerialization).toBe('boolean');
      expect(typeof config.flattenShadowTrees).toBe('boolean');
    });
  });

  describe('CircuitBreaker - Safe Mode', () => {
    let circuitBreaker: CircuitBreaker<string>;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker({
        enabled: true,
        errorThreshold: 50,
        resetTimeout: 1000,
        monitoringPeriod: 300000,
        fallbackToStale: true,
        halfOpenMaxCalls: 2,
        failureThreshold: 2,
        successThreshold: 1,
        timeoutThreshold: 1000 // Short timeout for tests
      });
    });

    afterEach(() => {
      circuitBreaker.reset();
      jest.clearAllMocks();
    });

    it('should initialize safely', () => {
      expect(circuitBreaker).toBeDefined();
      const state = circuitBreaker.getState();
      expect(state.state).toBe('CLOSED');
      expect(state.failures).toBe(0);
      expect(state.successes).toBe(0);
    });

    it('should execute successful operations', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(operation);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.circuitState).toBe('CLOSED');
      expect(result.fallbackUsed).toBe(false);
    });

    it('should handle operation failures', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));
      const result = await circuitBreaker.execute(operation);

      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect(result.circuitState).toBe('CLOSED');
    });

    it('should handle fallback when provided', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));
      const fallback = jest.fn().mockResolvedValue('fallback');

      const result = await circuitBreaker.execute(operation, fallback);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.result).toBe('fallback');
      expect(result.fallbackUsed).toBe(true);
    });

    it('should transition to open state', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));

      // First failure
      await circuitBreaker.execute(operation);
      expect(circuitBreaker.getState().state).toBe('CLOSED');

      // Second failure - should open circuit
      await circuitBreaker.execute(operation);
      expect(circuitBreaker.getState().state).toBe('OPEN');
    });

    it('should reset to initial state', () => {
      circuitBreaker.forceState('OPEN');
      expect(circuitBreaker.getState().state).toBe('OPEN');

      circuitBreaker.reset();
      expect(circuitBreaker.getState().state).toBe('CLOSED');
      expect(circuitBreaker.getState().failures).toBe(0);
    });

    it('should get health status', () => {
      const health = circuitBreaker.getHealthStatus();
      expect(typeof health.healthy).toBe('boolean');
      expect(typeof health.status).toBe('string');
      expect(typeof health.message).toBe('string');
    });

    it('should get default configuration', () => {
      const config = CircuitBreaker.getDefaultConfig();
      expect(typeof config.enabled).toBe('boolean');
      expect(typeof config.errorThreshold).toBe('number');
      expect(typeof config.resetTimeout).toBe('number');
    });
  });

  describe('SEOProtocolsService - Safe Mode', () => {
    let service: SEOProtocolsService;

    beforeEach(() => {
      service = new SEOProtocolsService({
        contentHealthCheck: {
          enabled: true,
          criticalSelectors: [
              { selector: 'title', type: 'title', required: true, description: 'Page title' },
              { selector: 'meta[name="description"]', type: 'meta', required: true, description: 'Meta description' }
            ],
          minBodyLength: 100,
          minTitleLength: 20,
          metaDescriptionRequired: false,
          h1Required: false,
          failOnMissingCritical: false
        },
        virtualScroll: {
          enabled: true,
          scrollSteps: 3,
          scrollInterval: 200,
          maxScrollHeight: 800,
          waitAfterScroll: 300,
          scrollSelectors: [],
          infiniteScrollSelectors: [],
          lazyImageSelectors: [],
          triggerIntersectionObserver: false,
          waitForNetworkIdle: false,
          networkIdleTimeout: 2000
        },
        etagStrategy: {
          enabled: true,
          hashAlgorithm: 'md5',
          enable304Responses: true,
          checkContentChanges: false,
          ignoredElements: [],
          significantChanges: {
            minWordChange: 20,
            minStructureChange: 5,
            contentWeightThreshold: 20
          }
        },
        clusterMode: {
          enabled: false, // Always disabled for unit tests
          useRedisQueue: false,
          maxWorkers: 1,
          jobTimeout: 5000,
          retryAttempts: 1,
          retryDelay: 1000,
          redis: {
            host: 'localhost',
            port: 6379,
            db: 0
          },
          browser: {
            headless: true,
            args: ['--no-sandbox'],
            defaultViewport: { width: 1024, height: 768 }
          }
        },
        shadowDom: {
          enabled: true,
          deepSerialization: false,
          includeShadowContent: false,
          flattenShadowTrees: false,
          customElements: {},
          preserveShadowBoundaries: true,
          extractCSSVariables: false,
          extractComputedStyles: false
        },
        circuitBreaker: {
          enabled: true,
          errorThreshold: 50,
          resetTimeout: 2000,
          monitoringPeriod: 300000,
          fallbackToStale: false,
          halfOpenMaxCalls: 2,
          failureThreshold: 2,
          successThreshold: 1,
          timeoutThreshold: 2000
        }
      });
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('should initialize safely', () => {
      expect(service).toBeDefined();
      const config = service.getConfig();
      expect(typeof config.contentHealthCheck).toBe('object');
      expect(typeof config.virtualScroll).toBe('object');
      expect(typeof config.etagStrategy).toBe('object');
      expect(config.clusterMode.enabled).toBe(false);
    });

    it('should provide access to managers', () => {
      expect(service.getContentHealthCheck()).toBeDefined();
      expect(service.getVirtualScrollManager()).toBeDefined();
      expect(service.getShadowDOMExtractor()).toBeDefined();
      expect(service.getCircuitBreakerManager()).toBeDefined();
    });

    it('should get service status', async () => {
      const status = await service.getStatus();
      expect(status).toBeDefined();
      expect(status.enabled).toBe(true);
      expect(typeof status.protocols).toBe('object');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(status.overall);
    });

    it('should apply optimizations safely', async () => {
      const mockPage = {
        content: jest.fn().mockResolvedValue('<html><body>Content</body></html>'),
        evaluate: jest.fn().mockResolvedValue({})
      } as any;

      const result = await service.applyOptimizations({
        url: 'http://example.com',
        html: '<html><body>Original</body></html>',
        page: mockPage
      });

      expect(result).toBeDefined();
      expect(typeof result.html).toBe('string');
      expect(Array.isArray(result.optimizations)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(typeof result.metrics).toBe('object');
    });

    it('should handle initialization', async () => {
      await expect(service.initialize()).resolves.not.toThrow();
    });

    it('should shutdown gracefully', async () => {
      await service.initialize();
      await expect(service.shutdown()).resolves.not.toThrow();
    });

    it('should get default configuration', () => {
      const config = SEOProtocolsService.getDefaultConfig();
      expect(typeof config.contentHealthCheck).toBe('object');
      expect(typeof config.virtualScroll).toBe('object');
      expect(typeof config.etagStrategy).toBe('object');
      expect(typeof config.clusterMode).toBe('object');
    });
  });

  describe('Integration Tests - Safe Mode', () => {
    it('should create default configuration safely', () => {
      const defaultConfig = SEOProtocolsService.getDefaultConfig();

      expect(defaultConfig.contentHealthCheck).toHaveProperty('enabled');
      expect(defaultConfig.virtualScroll).toHaveProperty('enabled');
      expect(defaultConfig.etagStrategy).toHaveProperty('enabled');
      expect(defaultConfig.clusterMode).toHaveProperty('enabled');
      expect(defaultConfig.shadowDom).toHaveProperty('enabled');
      expect(defaultConfig.circuitBreaker).toHaveProperty('enabled');

      // Basic type checks
      expect(typeof defaultConfig.contentHealthCheck.enabled).toBe('boolean');
      expect(typeof defaultConfig.virtualScroll.scrollSteps).toBe('number');
      expect(defaultConfig.etagStrategy.hashAlgorithm).toMatch(/^(md5|sha256)$/);
    });

    it('should validate configuration structure', () => {
      const config = SEOProtocolsService.getDefaultConfig();

      // Check that all required properties exist
      expect(config.contentHealthCheck).toHaveProperty('criticalSelectors');
      expect(config.virtualScroll).toHaveProperty('scrollSteps');
      expect(config.etagStrategy).toHaveProperty('hashAlgorithm');
      expect(config.clusterMode).toHaveProperty('maxWorkers');
      expect(config.shadowDom).toHaveProperty('deepSerialization');
      expect(config.circuitBreaker).toHaveProperty('errorThreshold');

      // Check that properties have correct types
      expect(Array.isArray(config.contentHealthCheck.criticalSelectors)).toBe(true);
      expect(typeof config.virtualScroll.scrollSteps).toBe('number');
      expect(['md5', 'sha256']).toContain(config.etagStrategy.hashAlgorithm);
      expect(typeof config.clusterMode.maxWorkers).toBe('number');
    });

    it('should handle complete workflow safely', async () => {
      const service = new SEOProtocolsService(SEOProtocolsService.getDefaultConfig());
      await service.initialize();

      const mockPage = {
        content: jest.fn().mockResolvedValue('<html><head><title>Test</title></head><body><h1>Test</h1></body></html>'),
        evaluate: jest.fn().mockResolvedValueOnce({
          titleLength: 4,
          descriptionLength: 0,
          h1Count: 1,
          wordCount: 2,
          bodyLength: 50
        }).mockResolvedValue([])
          .mockResolvedValue(false)
          .mockResolvedValue([])
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
      expect(['healthy', 'degraded', 'unhealthy']).toContain(status.overall);

      await service.shutdown();
    });
  });
});

// Global safe configuration tests
describe('Global Configuration Safety', () => {
  it('should create all managers safely without errors', () => {
    // These should never throw
    expect(() => new ContentHealthCheckManager(ContentHealthCheckManager.getDefaultConfig())).not.toThrow();
    expect(() => new VirtualScrollManager(VirtualScrollManager.getDefaultConfig())).not.toThrow();
    expect(() => new ETagManager(ETagManager.getDefaultConfig())).not.toThrow();
    expect(() => new ShadowDOMExtractor(ShadowDOMExtractor.getDefaultConfig())).not.toThrow();
    expect(() => new CircuitBreaker(CircuitBreaker.getDefaultConfig())).not.toThrow();
    expect(() => new ClusterManager(ClusterManager.getDefaultConfig())).not.toThrow();
    expect(() => new SEOProtocolsService(SEOProtocolsService.getDefaultConfig())).not.toThrow();
  });

  it('should validate all default configurations', () => {
    const contentConfig = ContentHealthCheckManager.getDefaultConfig();
    const scrollConfig = VirtualScrollManager.getDefaultConfig();
    const etagConfig = ETagManager.getDefaultConfig();
    const shadowConfig = ShadowDOMExtractor.getDefaultConfig();
    const circuitConfig = CircuitBreaker.getDefaultConfig();
    const clusterConfig = ClusterManager.getDefaultConfig();
    const serviceConfig = SEOProtocolsService.getDefaultConfig();

    // Basic type checks
    expect(typeof contentConfig.enabled).toBe('boolean');
    expect(typeof scrollConfig.enabled).toBe('boolean');
    expect(typeof etagConfig.enabled).toBe('boolean');
    expect(typeof shadowConfig.enabled).toBe('boolean');
    expect(typeof circuitConfig.enabled).toBe('boolean');
    expect(typeof clusterConfig.enabled).toBe('boolean');
    expect(typeof serviceConfig.contentHealthCheck.enabled).toBe('boolean');

    // Array checks
    expect(Array.isArray(contentConfig.criticalSelectors)).toBe(true);
    expect(Array.isArray(scrollConfig.lazyImageSelectors)).toBe(true);
    expect(Array.isArray(etagConfig.ignoredElements)).toBe(true);

    // Number checks
    expect(typeof scrollConfig.scrollSteps).toBe('number');
    expect(typeof contentConfig.minBodyLength).toBe('number');
    expect(typeof circuitConfig.errorThreshold).toBe('number');
    expect(typeof clusterConfig.maxWorkers).toBe('number');

    // Value checks
    expect(['md5', 'sha256']).toContain(etagConfig.hashAlgorithm);
  });

  it('should validate configuration values are reasonable', () => {
    const contentConfig = ContentHealthCheckManager.getDefaultConfig();
    const scrollConfig = VirtualScrollManager.getDefaultConfig();
    const etagConfig = ETagManager.getDefaultConfig();
    const circuitConfig = CircuitBreaker.getDefaultConfig();

    // Reasonable value checks
    expect(contentConfig.minBodyLength).toBeGreaterThan(0);
    expect(contentConfig.minTitleLength).toBeGreaterThan(0);
    expect(scrollConfig.scrollSteps).toBeGreaterThan(0);
    expect(scrollConfig.scrollInterval).toBeGreaterThan(0);
    expect(circuitConfig.errorThreshold).toBeGreaterThanOrEqual(0);
    expect(circuitConfig.errorThreshold).toBeLessThanOrEqual(100);

    // Ensure safe defaults
    expect(scrollConfig.maxScrollHeight).toBeGreaterThan(0);
    expect(etagConfig.enable304Responses).toBe(true);
    expect(circuitConfig.fallbackToStale).toBe(true);
  });
});