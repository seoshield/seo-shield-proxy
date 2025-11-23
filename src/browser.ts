import { Cluster } from 'puppeteer-cluster';
import type { Page } from 'puppeteer';
import config from './config.js';

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
    'cdn.jsdelivr.net/npm/chart.js',
    'cdnjs.cloudflare.com/ajax/libs/chart.js',
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
    '/analytics.js',
    '/gtm.js',
    '/fbevents.js',
    '/pixel.js',
    '/tracking.js',
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
    '/widgets.js',
    '/embed.js',
    '/social.js',
    '/facebook.js',
    '/twitter.js',

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

          if (this.shouldBlockRequest(requestUrl, resourceType)) {
            blockedCount++;
            request.abort();
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

      // Check for prerender-status-code meta tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const statusCode = await page.evaluate((): any => {
        // @ts-ignore - Running in browser context
        const metaTag = document.querySelector('meta[name="prerender-status-code"]');
        if (metaTag) {
          const content = metaTag.getAttribute('content');
          if (content) {
            const code = parseInt(content, 10);
            if (!isNaN(code) && code >= 100 && code < 600) {
              return code;
            }
          }
        }
        return undefined;
      }) as number | undefined;

      if (statusCode) {
        console.log(`📊 Detected prerender-status-code: ${statusCode}`);
      }

      // Log performance metrics
      const totalRequests = blockedCount + allowedCount;
      const blockRate = totalRequests > 0 ? Math.round((blockedCount / totalRequests) * 100) : 0;

      console.log(`🚀 Network optimization: Blocked ${blockedCount}/${totalRequests} requests (${blockRate}%)`);

      if (blockedCount > 0) {
        console.log(`⚡ Performance boost: ${blockedCount} unnecessary requests blocked to improve render speed`);
      }

      return { html, statusCode };
    } catch (error) {
      console.error(`❌ Rendering failed for ${url}:`, (error as Error).message);
      const renderError = error as Error & { url?: string; renderError?: boolean };
      renderError.url = url;
      renderError.renderError = true;
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
