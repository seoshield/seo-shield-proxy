import puppeteer from 'puppeteer';
import config from './config.js';

/**
 * Browser Manager - Singleton Pattern
 * Manages a single Puppeteer browser instance and creates pages on demand
 */
class BrowserManager {
  constructor() {
    this.browser = null;
    this.isLaunching = false;
    this.launchPromise = null;
  }

  /**
   * Get or create the browser instance (singleton)
   * @returns {Promise<Browser>} - Puppeteer browser instance
   */
  async getBrowser() {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    // If browser is currently launching, wait for it
    if (this.isLaunching && this.launchPromise) {
      return this.launchPromise;
    }

    // Launch new browser
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

  /**
   * Launch a new browser instance
   * @returns {Promise<Browser>} - Puppeteer browser instance
   */
  async launchBrowser() {
    console.log('🚀 Launching Puppeteer browser...');

    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // Required for some Docker environments
      ],
    };

    // In development, use different args
    if (config.NODE_ENV === 'development') {
      launchOptions.headless = 'new';
    }

    const browser = await puppeteer.launch(launchOptions);
    console.log('✅ Browser launched successfully');

    // Handle browser disconnect
    browser.on('disconnected', () => {
      console.log('⚠️  Browser disconnected');
      this.browser = null;
    });

    return browser;
  }

  /**
   * Render a URL and return the HTML
   * @param {string} url - Full URL to render
   * @returns {Promise<string>} - Rendered HTML
   */
  async render(url) {
    const browser = await this.getBrowser();
    let page = null;

    try {
      // Create new page
      page = await browser.newPage();

      // Set viewport for consistent rendering
      await page.setViewport({
        width: 1920,
        height: 1080,
        deviceScaleFactor: 1,
      });

      // Set user agent to avoid bot detection
      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Enable request interception for performance
      await page.setRequestInterception(true);

      // Block unnecessary resources
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        const blockedTypes = ['image', 'stylesheet', 'font', 'media'];

        if (blockedTypes.includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });

      console.log(`🌐 Rendering: ${url}`);

      // Navigate to the URL and wait for network idle
      await page.goto(url, {
        waitUntil: 'networkidle0', // Wait until network is idle (no requests for 500ms)
        timeout: config.PUPPETEER_TIMEOUT,
      });

      // Get the rendered HTML
      const html = await page.content();

      console.log(`✅ Rendered successfully: ${url} (${(html.length / 1024).toFixed(2)} KB)`);

      return html;
    } catch (error) {
      console.error(`❌ Rendering failed for ${url}:`, error.message);
      throw error;
    } finally {
      // CRITICAL: Always close the page to prevent memory leaks
      if (page) {
        try {
          await page.close();
        } catch (closeError) {
          console.error('⚠️  Error closing page:', closeError.message);
        }
      }
    }
  }

  /**
   * Close the browser instance
   */
  async close() {
    if (this.browser) {
      console.log('🔒 Closing browser...');
      await this.browser.close();
      this.browser = null;
      console.log('✅ Browser closed');
    }
  }
}

// Export singleton instance
const browserManager = new BrowserManager();

// Graceful shutdown
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
