import { SeoProtocolConfig } from '../config';
import { ContentHealthCheckManager } from './content-health-check';
import { VirtualScrollManager, VirtualScrollResult } from './virtual-scroll-manager';
import { ETagManager } from './etag-manager';
import { ETagService } from './etag-service';
import { ClusterManager, ClusterStats } from './cluster-manager';
import { ShadowDOMExtractor } from './shadow-dom-extractor';
import { CircuitBreakerManager, CircuitState } from './circuit-breaker';
import { Logger } from '../utils/logger';
import type { Page } from 'puppeteer';

const logger = new Logger('SEOProtocolsService');

// Type for ETag cache stats
interface ETagCacheStats {
  totalEntries: number;
  cacheHitRate?: number;
  memoryUsage?: number;
}

// Type for protocol metrics
interface ProtocolMetrics {
  contentHealthCheck?: unknown;
  virtualScroll?: VirtualScrollResult;
  etagStrategy?: ETagCacheStats;
  clusterMode?: ClusterStats;
  shadowDom?: unknown;
  circuitBreaker?: Record<string, { state: CircuitState; failures: number; successes: number }>;
}

// Type for optimization metrics
interface OptimizationMetrics {
  virtualScroll?: VirtualScrollResult;
  shadowDom?: { extractedCount: number };
  [key: string]: unknown;
}

/**
 * SEO Protocols Service
 *
 * Central service that manages and coordinates all advanced SEO optimization
 * protocols for the SEO Shield proxy system.
 */
export class SEOProtocolsService {
  private config: SeoProtocolConfig;
  private contentHealthCheck: ContentHealthCheckManager | null = null;
  private virtualScrollManager: VirtualScrollManager | null = null;
  private etagService: ETagService | null = null;
  private clusterManager: ClusterManager | null = null;
  private shadowDOMExtractor: ShadowDOMExtractor | null = null;
  private circuitBreakerManager: CircuitBreakerManager | null = null;

  constructor(config: SeoProtocolConfig) {
    this.config = config;
  }

  /**
   * Initialize all SEO protocol services
   */
  async initialize(): Promise<void> {
    logger.info('Initializing SEO Protocols Service...');

    try {
      // Initialize Content Health Check
      if (this.config.contentHealthCheck.enabled) {
        this.contentHealthCheck = new ContentHealthCheckManager(this.config.contentHealthCheck);
        logger.info('Content Health Check Manager initialized');
      }

      // Initialize Virtual Scroll Manager
      if (this.config.virtualScroll.enabled) {
        this.virtualScrollManager = new VirtualScrollManager(this.config.virtualScroll);
        logger.info('Virtual Scroll Manager initialized');
      }

      // Initialize ETag Service
      if (this.config.etagStrategy.enabled) {
        this.etagService = ETagService.create(this.config.etagStrategy);
        logger.info('ETag Service initialized');
      }

      // Initialize Cluster Manager
      if (this.config.clusterMode.enabled) {
        this.clusterManager = new ClusterManager(this.config.clusterMode);
        await this.clusterManager.initialize();
        logger.info('Cluster Manager initialized');
      }

      // Initialize Shadow DOM Extractor
      if (this.config.shadowDom.enabled) {
        this.shadowDOMExtractor = new ShadowDOMExtractor(this.config.shadowDom);
        logger.info('Shadow DOM Extractor initialized');
      }

      // Initialize Circuit Breaker Manager
      if (this.config.circuitBreaker.enabled) {
        this.circuitBreakerManager = new CircuitBreakerManager(this.config.circuitBreaker);
        logger.info('Circuit Breaker Manager initialized');
      }

      logger.info('SEO Protocols Service initialization complete');
    } catch (error) {
      logger.error('Failed to initialize SEO Protocols Service:', error);
      throw error;
    }
  }

  /**
   * Get Content Health Check Manager
   */
  getContentHealthCheck(): ContentHealthCheckManager | null {
    return this.contentHealthCheck;
  }

  /**
   * Get Virtual Scroll Manager
   */
  getVirtualScrollManager(): VirtualScrollManager | null {
    return this.virtualScrollManager;
  }

  /**
   * Get ETag Service
   */
  getETagService(): ETagService | null {
    return this.etagService;
  }

  /**
   * Get Cluster Manager
   */
  getClusterManager(): ClusterManager | null {
    return this.clusterManager;
  }

  /**
   * Get Shadow DOM Extractor
   */
  getShadowDOMExtractor(): ShadowDOMExtractor | null {
    return this.shadowDOMExtractor;
  }

  /**
   * Get Circuit Breaker Manager
   */
  getCircuitBreakerManager(): CircuitBreakerManager | null {
    return this.circuitBreakerManager;
  }

  /**
   * Get current configuration
   */
  getConfig(): SeoProtocolConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SeoProtocolConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('SEO Protocols configuration updated');
  }

  /**
   * Get comprehensive status of all protocols
   */
  async getStatus(): Promise<{
    enabled: boolean;
    protocols: {
      contentHealthCheck: { enabled: boolean; status: string };
      virtualScroll: { enabled: boolean; status: string };
      etagStrategy: { enabled: boolean; status: string };
      clusterMode: { enabled: boolean; status: string };
      shadowDom: { enabled: boolean; status: string };
      circuitBreaker: { enabled: boolean; status: string };
    };
    overall: 'healthy' | 'degraded' | 'unhealthy';
  }> {
    const status = {
      enabled: true,
      protocols: {
        contentHealthCheck: {
          enabled: this.config.contentHealthCheck.enabled,
          status: this.contentHealthCheck ? 'active' : 'disabled',
        },
        virtualScroll: {
          enabled: this.config.virtualScroll.enabled,
          status: this.virtualScrollManager ? 'active' : 'disabled',
        },
        etagStrategy: {
          enabled: this.config.etagStrategy.enabled,
          status: this.etagService ? 'active' : 'disabled',
        },
        clusterMode: {
          enabled: this.config.clusterMode.enabled,
          status: this.clusterManager ? 'active' : 'disabled',
        },
        shadowDom: {
          enabled: this.config.shadowDom.enabled,
          status: this.shadowDOMExtractor ? 'active' : 'disabled',
        },
        circuitBreaker: {
          enabled: this.config.circuitBreaker.enabled,
          status: this.circuitBreakerManager ? 'active' : 'disabled',
        },
      },
      overall: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
    };

    // Check circuit breaker health if enabled
    if (this.circuitBreakerManager) {
      const circuitHealth = this.circuitBreakerManager.getOverallHealth();
      if (circuitHealth.status === 'unhealthy') {
        status.overall = 'unhealthy';
      } else if (circuitHealth.status === 'degraded' && status.overall === 'healthy') {
        status.overall = 'degraded';
      }
    }

    return status;
  }

  /**
   * Get performance metrics from all protocols
   */
  async getMetrics(): Promise<ProtocolMetrics> {
    const metrics: ProtocolMetrics = {};

    // Get ETag metrics
    if (this.etagService) {
      metrics.etagStrategy = this.etagService.getCacheStats();
    }

    // Get Cluster metrics
    if (this.clusterManager) {
      metrics.clusterMode = await this.clusterManager.getStats();
    }

    // Get Circuit Breaker metrics
    if (this.circuitBreakerManager) {
      metrics.circuitBreaker = this.circuitBreakerManager.getAllStates();
    }

    return metrics;
  }

  /**
   * Graceful shutdown of all protocols
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down SEO Protocols Service...');

    try {
      // Shutdown Cluster Manager
      if (this.clusterManager) {
        await this.clusterManager.shutdown();
        logger.info('Cluster Manager shutdown');
      }

      // Cleanup ETag cache
      if (this.etagService) {
        this.etagService.cleanupCache();
        logger.info('ETag Service cache cleaned');
      }

      logger.info('SEO Protocols Service shutdown complete');
    } catch (error) {
      logger.error('Error during SEO Protocols Service shutdown:', error);
      throw error;
    }
  }

  /**
   * Apply SEO optimizations to rendered content
   */
  async applyOptimizations(params: {
    url: string;
    html: string;
    page: Page;
  }): Promise<{
    html: string;
    optimizations: string[];
    metrics: OptimizationMetrics;
    warnings: string[];
  }> {
    const optimizations: string[] = [];
    const warnings: string[] = [];
    let finalHtml = params.html;
    const metrics: OptimizationMetrics = {};

    try {
      // Apply Virtual Scroll if enabled
      if (this.virtualScrollManager && params.page) {
        try {
          const scrollResult = await this.virtualScrollManager.triggerVirtualScroll(
            params.page,
            params.url
          );
          if (scrollResult.success) {
            finalHtml = await params.page.content();
            optimizations.push(`Virtual scroll: ${scrollResult.completionRate}% completion`);
            metrics.virtualScroll = scrollResult;
          } else {
            warnings.push('Virtual scroll failed');
          }
        } catch (error) {
          warnings.push(
            `Virtual scroll error: ${error instanceof Error ? error.message : 'Unknown'}`
          );
        }
      }

      // Apply Shadow DOM extraction if enabled
      if (this.shadowDOMExtractor && params.page) {
        try {
          const shadowResult = await this.shadowDOMExtractor.extractCompleteContent(params.page);
          if (shadowResult.stats.totalShadowRoots > 0) {
            finalHtml = shadowResult.flattened;
            optimizations.push(
              `Shadow DOM: ${shadowResult.stats.totalShadowRoots} roots processed`
            );
            metrics.shadowDOM = shadowResult;
          }
        } catch (error) {
          warnings.push(
            `Shadow DOM extraction error: ${error instanceof Error ? error.message : 'Unknown'}`
          );
        }
      }

      // Apply Content Health Check if enabled
      if (this.contentHealthCheck && params.page) {
        try {
          const healthResult = await this.contentHealthCheck.checkPageHealth(
            params.page,
            params.url
          );
          if (healthResult.passed) {
            optimizations.push(`Health check: ${healthResult.score}/100 score`);
          } else {
            warnings.push(`Health check failed: ${healthResult.issues.length} issues`);
          }
          metrics.contentHealthCheck = healthResult;
        } catch (error) {
          warnings.push(
            `Health check error: ${error instanceof Error ? error.message : 'Unknown'}`
          );
        }
      }

      return {
        html: finalHtml,
        optimizations,
        metrics,
        warnings,
      };
    } catch (error) {
      throw new Error(
        `SEO optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get default configuration
   */
  static getDefaultConfig(): SeoProtocolConfig {
    return {
      contentHealthCheck: {
        enabled: true,
        criticalSelectors: [
          { selector: 'title', type: 'title', required: true, description: 'Page title' },
          {
            selector: 'meta[name="description"]',
            type: 'meta',
            required: true,
            description: 'Meta description',
          },
          { selector: 'h1', type: 'h1', required: true, description: 'H1 heading' },
          { selector: 'body', type: 'custom', required: true, description: 'Body content' },
        ],
        minBodyLength: 500,
        minTitleLength: 30,
        metaDescriptionRequired: true,
        h1Required: true,
        failOnMissingCritical: true,
      },
      virtualScroll: VirtualScrollManager.getDefaultConfig(),
      etagStrategy: ETagManager.getDefaultConfig(),
      clusterMode: ClusterManager.getDefaultConfig(),
      shadowDom: ShadowDOMExtractor.getDefaultConfig(),
      circuitBreaker: CircuitBreakerManager.getDefaultConfig(),
    };
  }
}

// Singleton instance for easy access
let seoProtocolsService: SEOProtocolsService | null = null;

/**
 * Get or create SEO Protocols Service singleton
 */
export function getSEOProtocolsService(config?: Partial<SeoProtocolConfig>): SEOProtocolsService {
  if (!seoProtocolsService) {
    const defaultConfig = SEOProtocolsService.getDefaultConfig();
    const mergedConfig: SeoProtocolConfig = config
      ? { ...defaultConfig, ...config } as SeoProtocolConfig
      : defaultConfig;
    seoProtocolsService = new SEOProtocolsService(mergedConfig);
  }
  return seoProtocolsService;
}
