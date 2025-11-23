import puppeteer, { Browser, Page, PuppeteerLaunchOptions, WaitForOptions } from 'puppeteer';
import config from './config.js';

/**
 * Render result containing HTML and optional HTTP status code
 */
export interface RenderResult {
  html: string;
  statusCode?: number;
}

/**
 * Browser Manager - Singleton Pattern
 */
class BrowserManager {
  private browser: Browser | null = null;
  private isLaunching = false;
  private launchPromise: Promise<Browser> | null = null;

  async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    if (this.isLaunching && this.launchPromise) {
      return this.launchPromise;
    }

    this.isLaunching = true;
    this.launchPromise = this.launchBrowser();

    try {
      this.browser = await this.launchPromise;
      return this.browser;
    } finally {
      this.isLaunching = false;
      this.launchPromise = null;
    }
  }

  private async launchBrowser(): Promise<Browser> {
    console.log('🚀 Launching Puppeteer browser...');

    const launchOptions: PuppeteerLaunchOptions = {
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
      ],
    };

    if (config.NODE_ENV === 'development' || process.env['PUPPETEER_SINGLE_PROCESS'] === 'true') {
      launchOptions.args!.push('--single-process');
      console.log('⚠️  Using single-process mode (not recommended for production)');
    }

    const browser = await puppeteer.launch(launchOptions);
    console.log('✅ Browser launched successfully');

    browser.on('disconnected', () => {
      console.log('⚠️  Browser disconnected');
      this.browser = null;
    });

    return browser;
  }

  async render(url: string): Promise<RenderResult> {
    const browser = await this.getBrowser();
    let page: Page | null = null;

    try {
      page = await browser.newPage();

      await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      });

      await page.setUserAgent(
        'Mozilla/5.0 (compatible; SEOShieldProxy/1.0; +https://github.com/seoshield/seo-shield-proxy)'
      );

      await page.setRequestInterception(true);

      page.on('request', (request) => {
        try {
          const resourceType = request.resourceType();
          if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
            request.abort();
          } else {
            request.continue();
          }
        } catch (error) {
          console.debug('Request interception error (ignoring):', (error as Error).message);
        }
      });

      const navigationOptions: WaitForOptions = {
        waitUntil: 'networkidle0',
        timeout: config.PUPPETEER_TIMEOUT,
      };

      let html: string;

      try {
        await page.goto(url, navigationOptions);
        html = await page.content();
      } catch (navError) {
        console.warn(`⚠️  networkidle0 failed, retrying with networkidle2`);

        try {
          await page.goto(url, {
            ...navigationOptions,
            waitUntil: 'networkidle2',
          });
          html = await page.content();
        } catch (fallback2Error) {
          console.warn(`⚠️  networkidle2 failed, using domcontentloaded`);
          await page.goto(url, {
            ...navigationOptions,
            waitUntil: 'domcontentloaded',
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

      return { html, statusCode };
    } catch (error) {
      console.error(`❌ Rendering failed for ${url}:`, (error as Error).message);
      const renderError = error as Error & { url?: string; renderError?: boolean };
      renderError.url = url;
      renderError.renderError = true;
      throw renderError;
    } finally {
      if (page && !page.isClosed()) {
        try {
          await page.close();
        } catch (closeError) {
          console.error('⚠️  Error closing page:', (closeError as Error).message);
        }
      }
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
        console.log('🔒 Browser closed');
      } catch (error) {
        console.error('⚠️  Error closing browser:', (error as Error).message);
      }
      this.browser = null;
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
