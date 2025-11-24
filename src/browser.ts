import { Cluster } from 'puppeteer-cluster';
import type { Page } from 'puppeteer';
import config from './config';
import forensicsCollector from './admin/forensics-collector';
import blockingManager from './admin/blocking-manager';
import { ContentHealthCheckManager, CriticalSelector } from './admin/content-health-check';
import { VirtualScrollManager } from './admin/virtual-scroll-manager';

/**
 * Render result containing HTML and optional HTTP status code
 */
export interface RenderResult {
  html: string;
  statusCode?: number;
}

/**
 * Queue metrics for monitoring
 */
export interface QueueMetrics {
  queued: number;
  processing: number;
  completed: number;
  errors: number;
  maxConcurrency: number;
}

/**
 * Browser Manager with Concurrency Control
 * Uses puppeteer-cluster to limit concurrent renders and prevent OOM
 */
class BrowserManager {
  private cluster: Cluster<string, RenderResult> | null = null;
  private isInitializing = false;
  private initPromise: Promise<Cluster<string, RenderResult>> | null = null;
  private metrics: QueueMetrics = {
    queued: 0,
    processing: 0,
    completed: 0,
    errors: 0,
    maxConcurrency: config.MAX_CONCURRENT_RENDERS,
  };
  private contentHealthCheck: ContentHealthCheckManager | null = null;
  private virtualScrollManager: VirtualScrollManager | null = null;

  async getCluster(): Promise<Cluster<string, RenderResult>> {
    if (this.cluster) {
      return this.cluster;
    }

    if (this.isInitializing && this.initPromise) {
      return this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = this.initCluster();

    try {
      this.cluster = await this.initPromise;
      return this.cluster;
    } finally {
      this.isInitializing = false;
      this.initPromise = null;
    }
  }

  private async initCluster(): Promise<Cluster<string, RenderResult>> {
    console.log(`🚀 Initializing Puppeteer cluster with max ${config.MAX_CONCURRENT_RENDERS} concurrent renders...`);

    // Initialize Content Health Check Manager
    this.initializeContentHealthCheck();

    // Initialize Virtual Scroll Manager
    this.initializeVirtualScrollManager();

    const cluster = await Cluster.launch({
      concurrency: Cluster.CONCURRENCY_CONTEXT,
      maxConcurrency: config.MAX_CONCURRENT_RENDERS,
      timeout: config.PUPPETEER_TIMEOUT,
      retryLimit: 1,
      retryDelay: 1000,
      puppeteerOptions: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
          '--disable-extensions',
          '--no-first-run',
          '--disable-background-networking',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-breakpad',
          '--disable-component-extensions-with-background-pages',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--disable-renderer-backgrounding',
          '--enable-features=NetworkService,NetworkServiceInProcess',
          '--force-color-profile=srgb',
          '--hide-scrollbars',
          '--metrics-recording-only',
          '--mute-audio',
          ...(config.NODE_ENV === 'development' || process.env['PUPPETEER_SINGLE_PROCESS'] === 'true'
            ? ['--single-process']
            : []),
        ],
      },
      monitor: false,
    });

    // Set up task handler
    await cluster.task(async ({ page, data: url }) => {
      this.metrics.processing++;
      this.metrics.queued = Math.max(0, this.metrics.queued - 1);

      try {
        const result = await this.renderPage(page, url);
        this.metrics.completed++;
        this.metrics.processing--;
        return result;
      } catch (error) {
        this.metrics.errors++;
        this.metrics.processing--;
        throw error;
      }
    });

    console.log(`✅ Cluster initialized with ${config.MAX_CONCURRENT_RENDERS} max concurrent renders`);

    return cluster;
  }

  /**
   * Comprehensive blacklist of unnecessary domains and resources
   * that slow down rendering without providing SEO value
   */
  private readonly BLACKLISTED_DOMAINS = [
    // Analytics and tracking
    'google-analytics.com',
    'www.google-analytics.com',
    'googletagmanager.com',
    'www.googletagmanager.com',
    'googleadservices.com',
    'www.googleadservices.com',
    'doubleclick.net',
    'www.doubleclick.net',
    'facebook.net',
    'www.facebook.net',
    'connect.facebook.net',
    'pixel.facebook.com',
    'www.facebook.com/tr',
    'hotjar.com',
    'www.hotjar.com',
    'hotjar.io',
    'www.hotjar.io',
    'mixpanel.com',
    'www.mixpanel.com',
    'segment.io',
    'www.segment.io',
    'analytics.segment.io',
    'fullstory.com',
    'www.fullstory.com',
    'clarity.ms',
    'www.clarity.ms',
    'mouseflow.com',
    'www.mouseflow.com',
    'optimizely.com',
    'www.optimizely.com',
    'cdn.optimizely.com',

    // Ad networks
    'googleads.g.doubleclick.net',
    'googlesyndication.com',
    'www.googlesyndication.com',
    'googleads.g.doubleclick.net',
    'adnxs.com',
    'www.adnxs.com',
    'amazon-adsystem.com',
    'www.amazon-adsystem.com',
    'criteo.com',
    'www.criteo.com',
    'taboola.com',
    'www.taboola.com',
    'outbrain.com',
    'www.outbrain.com',

    // Social media widgets and trackers
    'platform.twitter.com',
    'syndication.twitter.com',
    'www.instagram.com/embed',
    'www.linkedin.com/embed',
    'connect.facebook.net',
    'platform.instagram.com',

    // Other performance-impacting services
    'cdn.jsdelivr.net/npm/chart',
    'cdnjs.cloudflare.com/ajax/libs/chart',
    'gravatar.com',
    'www.gravatar.com',
    'disqus.com',
    'www.disqus.com',
  ];

  /**
   * Blacklisted resource patterns
   */
  private readonly BLACKLISTED_PATTERNS = [
    // Common analytics tracking paths
    '/analytics',
    '/gtm',
    '/fbevents',
    '/pixel',
    '/tracking',
    '/collect',
    '/log',
    '/event',
    '/metrics',

    // Ad-related paths
    '/ads/',
    '/advertising/',
    '/doubleclick',
    '/googlead',

    // Social widgets
    '/widgets',
    '/embed',
    '/social',
    '/facebook',
    '/twitter',

    // Resource waste
    '/favicon.ico',
    '/robots.txt',
    '.webp',
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.svg',
    '.css',
    '.woff',
    '.woff2',
    '.ttf',
    '.eot',
  ];

  /**
   * Check if a request should be blocked based on URL and resource type
   */
  private shouldBlockRequest(requestUrl: string, resourceType: string): boolean {
    try {
      const url = new URL(requestUrl);
      const hostname = url.hostname.toLowerCase();

      // Block blacklisted domains
      for (const blacklistedDomain of this.BLACKLISTED_DOMAINS) {
        if (hostname.includes(blacklistedDomain.toLowerCase())) {
          return true;
        }
      }

      // Block by URL patterns
      const lowerUrl = requestUrl.toLowerCase();
      for (const pattern of this.BLACKLISTED_PATTERNS) {
        if (lowerUrl.includes(pattern)) {
          return true;
        }
      }

      // Block resource types that aren't needed for SEO
      if (['image', 'stylesheet', 'font', 'media', 'websocket', 'eventsource'].includes(resourceType)) {
        return true;
      }

      return false;
    } catch (error) {
      // If URL parsing fails, allow the request
      return false;
    }
  }

  /**
   * Initialize Content Health Check Manager
   */
  private initializeContentHealthCheck(): void {
    // Get SEO protocol configuration from runtime config
    // For now, use default configuration - this will be enhanced when we add runtime config support
    const defaultConfig = {
      enabled: true,
      criticalSelectors: [
        { selector: 'title', type: 'title' as const, required: true, description: 'Page title' },
        { selector: 'meta[name="description"]', type: 'meta' as const, required: true, description: 'Meta description' },
        { selector: 'h1', type: 'h1' as const, required: true, description: 'H1 heading' },
        { selector: 'body', type: 'custom' as const, required: true, description: 'Body content' }
      ],
      minBodyLength: 500,
      minTitleLength: 30,
      metaDescriptionRequired: true,
      h1Required: true,
      failOnMissingCritical: true,
    };

    this.contentHealthCheck = new ContentHealthCheckManager(defaultConfig);
    console.log('✅ Content Health Check Manager initialized with default configuration');
  }

  /**
   * Initialize Virtual Scroll Manager
   */
  private initializeVirtualScrollManager(): void {
    const defaultVirtualScrollConfig = VirtualScrollManager.getDefaultConfig();
    this.virtualScrollManager = new VirtualScrollManager(defaultVirtualScrollConfig);
    console.log('✅ Virtual Scroll Manager initialized with default configuration');
  }

  private async renderPage(page: Page, url: string): Promise<RenderResult> {
    try {
      await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      });

      await page.setUserAgent(
        'Mozilla/5.0 (compatible; SEOShieldProxy/1.0; +https://github.com/seoshield/seo-shield-proxy)'
      );

      await page.setRequestInterception(true);

      let blockedCount = 0;
      let allowedCount = 0;

      page.on('request', (request) => {
        try {
          const requestUrl = request.url();
          const resourceType = request.resourceType();

          // Use blocking manager for dynamic rule-based blocking
          const blockingResult = blockingManager.shouldBlockRequest(requestUrl, resourceType);

          if (blockingResult.blocked || this.shouldBlockRequest(requestUrl, resourceType)) {
            blockedCount++;

            // Apply blocking action from blocking manager
            if (blockingResult.action === 'redirect' && blockingResult.options?.redirectUrl) {
              // Note: redirect is not available in all Puppeteer versions, fallback to abort
              try {
                (request as any).redirect?.({
                  url: blockingResult.options.redirectUrl,
                });
              } catch {
                request.abort();
              }
            } else if (blockingResult.action === 'modify' && blockingResult.options?.modifyHeaders) {
              request.continue({
                headers: { ...request.headers(), ...blockingResult.options.modifyHeaders },
              });
            } else {
              request.abort();
            }
          } else {
            allowedCount++;
            request.continue();
          }
        } catch (error) {
          console.debug('Request interception error (ignoring):', (error as Error).message);
          request.continue();
        }
      });

      let html: string;

      try {
        await page.goto(url, {
          waitUntil: 'networkidle0',
          timeout: config.PUPPETEER_TIMEOUT,
        });
        html = await page.content();
      } catch (navError) {
        console.warn(`⚠️  networkidle0 failed, retrying with networkidle2`);

        try {
          await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: config.PUPPETEER_TIMEOUT,
          });
          html = await page.content();
        } catch (fallback2Error) {
          console.warn(`⚠️  networkidle2 failed, using domcontentloaded`);
          await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: config.PUPPETEER_TIMEOUT,
          });
          // Wait 2 seconds for any immediate JS to run
          await new Promise(resolve => setTimeout(resolve, 2000));
          html = await page.content();
        }
      }

      // Enhanced Soft 404 Detection for Enterprise SEO
      const soft404Analysis = await page.evaluate((): { statusCode?: number; isSoft404: boolean; reasons: string[] } => {
        const reasons: string[] = [];
        let statusCode: number | undefined;

        // Check explicit prerender-status-code meta tag
        const metaTag = document.querySelector('meta[name="prerender-status-code"]');
        if (metaTag) {
          const content = metaTag.getAttribute('content');
          if (content) {
            const code = parseInt(content, 10);
            if (!isNaN(code) && code >= 100 && code < 600) {
              statusCode = code;
              reasons.push(`Explicit meta tag: prerender-status-code=${code}`);
            }
          }
        }

        // Intelligent Soft 404 Detection based on content analysis
        const title = document.title?.toLowerCase() || '';
        const bodyText = document.body?.innerText?.toLowerCase() || '';
        const h1Text = document.querySelector('h1')?.innerText?.toLowerCase() || '';
        const h2Texts = Array.from(document.querySelectorAll('h2')).map(h => h.innerText?.toLowerCase() || '');

        // Check for 404 indicators in title
        if (title.includes('404') || title.includes('not found') || title.includes('page not found')) {
          reasons.push(`Title indicates 404: "${title}"`);
        }

        // Check for 404 indicators in main headings
        if (h1Text.includes('404') || h1Text.includes('not found') || h1Text.includes('page not found')) {
          reasons.push(`H1 indicates 404: "${h1Text}"`);
        }

        // Check H2s for 404 indicators
        for (const h2Text of h2Texts) {
          if (h2Text.includes('404') || h2Text.includes('not found') || h2Text.includes('page not found')) {
            reasons.push(`H2 indicates 404: "${h2Text}"`);
            break;
          }
        }

        // Check for common 404 patterns in body text
        const notFoundPatterns = [
          '404 - page not found',
          '404 error',
          'this page cannot be found',
          'the page you are looking for',
          'sorry, the page you',
          'we couldn\'t find the page',
          'no results found',
          'nothing found',
          'url not found',
          'resource not found',
          'content not available'
        ];

        for (const pattern of notFoundPatterns) {
          if (bodyText.includes(pattern)) {
            reasons.push(`Body text pattern: "${pattern}"`);
            break;
          }
        }

        // Check for minimal content (likely 404 pages have very little content)
        const wordCount = bodyText.split(/\s+/).filter(word => word.length > 0).length;
        if (wordCount < 50 && (title.includes('not found') || h1Text.includes('not found'))) {
          reasons.push(`Minimal content (${wordCount} words) with 404 indicators`);
        }

        // Check for 404-specific CSS classes or IDs
        const notFoundSelectors = [
          '.error-404',
          '#error-404',
          '.not-found',
          '#not-found',
          '.page-not-found',
          '#page-not-found',
          '.error-page',
          '#error-page',
          '[class*="404"]',
          '[id*="404"]',
          '[class*="not-found"]',
          '[id*="not-found"]'
        ];

        for (const selector of notFoundSelectors) {
          if (document.querySelector(selector)) {
            reasons.push(`404-specific selector found: ${selector}`);
            break;
          }
        }

        // Determine if this is a soft 404
        const isSoft404 = reasons.length > 0 && !statusCode;

        // If we detected a soft 404 but no explicit status code, set 404
        if (isSoft404 && !statusCode) {
          statusCode = 404;
          reasons.push('Soft 404 detected - setting status code to 404');
        }

        return { statusCode, isSoft404, reasons };
      });

      const { statusCode, isSoft404, reasons } = soft404Analysis;

      if (isSoft404) {
        console.log(`🚨 Soft 404 detected! Reasons: ${reasons.join(', ')}`);
        console.log(`📊 Setting HTTP status code to ${statusCode} for SEO compliance`);
      } else if (statusCode) {
        console.log(`📊 Detected explicit prerender-status-code: ${statusCode}`);
      }

      // Log performance metrics
      const totalRequests = blockedCount + allowedCount;
      const blockRate = totalRequests > 0 ? Math.round((blockedCount / totalRequests) * 100) : 0;

      console.log(`🚀 Network optimization: Blocked ${blockedCount}/${totalRequests} requests (${blockRate}%)`);

      if (blockedCount > 0) {
        console.log(`⚡ Performance boost: ${blockedCount} unnecessary requests blocked to improve render speed`);
      }

      // Apply Virtual Scroll & Lazy Load triggering if enabled
      if (this.virtualScrollManager) {
        try {
          const scrollResult = await this.virtualScrollManager.triggerVirtualScroll(page, url);

          if (scrollResult.success) {
            console.log(`📜 Virtual Scroll completed: ${scrollResult.scrollSteps} steps, ${scrollResult.completionRate}% completion rate`);
            // Update HTML after scrolling to capture new content
            html = await page.content();
          } else {
            console.warn(`⚠️  Virtual Scroll encountered issues for ${url}`);
          }
        } catch (scrollError) {
          console.warn(`⚠️  Virtual Scroll error for ${url}:`, (scrollError as Error).message);
          // Don't fail the entire render if virtual scroll has issues
        }
      }

      // Perform Content Health Check if enabled
      if (this.contentHealthCheck) {
        try {
          const healthResult = await this.contentHealthCheck.checkPageHealth(page, url);

          // If health check fails and configured to fail on missing critical elements
          if (!healthResult.passed && this.contentHealthCheck.config?.failOnMissingCritical) {
            const hasErrors = healthResult.issues.some(issue => issue.type === 'error');
            if (hasErrors) {
              console.warn(`⚠️  Content Health Check failed for ${url} - returning 503 Service Unavailable`);
              return {
                html: '<!DOCTYPE html><html><head><title>Service Unavailable</title></head><body><h1>503 Service Unavailable</h1><p>Content validation failed. Please try again later.</p></body></html>',
                statusCode: 503
              };
            }
          }

          // Log health score for monitoring
          console.log(`🏥 Content Health Score: ${healthResult.score}/100 for ${url}`);

        } catch (healthError) {
          console.warn(`⚠️  Content Health Check error for ${url}:`, (healthError as Error).message);
          // Don't fail the entire render if health check has issues
        }
      }

      return { html, statusCode };
    } catch (error) {
      console.error(`❌ Rendering failed for ${url}:`, (error as Error).message);
      const renderError = error as Error & { url?: string; renderError?: boolean };
      renderError.url = url;
      renderError.renderError = true;

      // Capture forensics data for debugging
      try {
        forensicsCollector.captureForensics(url, error as Error, {
          userAgent: await page.evaluate('navigator.userAgent'),
          viewport: page.viewport(),
          headers: {},
          waitStrategy: 'networkidle0',
          timeout: config.PUPPETEER_TIMEOUT
        }, page).catch((forensicsError: Error) => {
          console.warn('⚠️  Failed to capture forensics data:', forensicsError.message);
        });
      } catch (forensicsError) {
        console.warn('⚠️  Forensics collection error:', (forensicsError as Error).message);
      }

      throw renderError;
    }
  }

  async render(url: string): Promise<RenderResult> {
    const cluster = await this.getCluster();

    this.metrics.queued++;
    console.log(`📋 Queue: ${this.metrics.queued} queued, ${this.metrics.processing}/${this.metrics.maxConcurrency} processing`);

    try {
      const result = await cluster.execute(url);
      return result;
    } catch (error) {
      this.metrics.queued = Math.max(0, this.metrics.queued - 1);
      throw error;
    }
  }

  getMetrics(): QueueMetrics {
    return { ...this.metrics };
  }

  async getBrowser(): Promise<any> {
    const cluster = await this.getCluster();

    // Get a browser instance from the cluster
    // @ts-ignore - Access internal browser instance
    if ((cluster as any).browser) {
      return (cluster as any).browser;
    }

    // Create a temporary browser instance
    const puppeteer = await import('puppeteer');
    return puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
      ],
    });
  }

  async close(): Promise<void> {
    if (this.cluster) {
      try {
        await this.cluster.idle();
        await this.cluster.close();
        console.log('🔒 Cluster closed');
      } catch (error) {
        console.error('⚠️  Error closing cluster:', (error as Error).message);
      }
      this.cluster = null;
    }
  }
}

const browserManager = new BrowserManager();

process.on('SIGINT', async () => {
  console.log('\n⚠️  Received SIGINT, shutting down gracefully...');
  await browserManager.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Received SIGTERM, shutting down gracefully...');
  await browserManager.close();
  process.exit(0);
});

export default browserManager;
