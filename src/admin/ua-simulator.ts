/**
 * User-Agent Simulation Service
 * Simulates different bots and user agents for testing
 */

import browserManager from '../browser';
import cache from '../cache';
import { Logger } from '../utils/logger';

interface UserAgentTemplate {
  id: string;
  name: string;
  category: 'searchbot' | 'socialbot' | 'monitoring' | 'browser' | 'mobile';
  userAgent: string;
  description: string;
  capabilities: {
    javascript: boolean;
    css: boolean;
    images: boolean;
    cookies: boolean;
  };
  popularity: number; // 0-100, how commonly used
}

interface SimulationRequest {
  id: string;
  url: string;
  userAgent: string;
  options: {
    width?: number;
    height?: number;
    deviceScaleFactor?: number;
    waitUntil?: string;
    timeout?: number;
  };
  timestamp: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: SimulationResult;
  error?: string;
}

interface SimulationResult {
  html: string;
  screenshot: string;
  title: string;
  status: number;
  headers: Record<string, string>;
  renderTime: number;
  memoryUsage?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  resources: {
    totalRequests: number;
    blockedRequests: number;
    totalSize: number;
    domains: string[];
  };
  console: Array<{
    level: string;
    message: string;
    timestamp: number;
  }>;
  network: Array<{
    url: string;
    method: string;
    status: number;
    size: number;
    time: number;
  }>;
}

interface ComparisonResult {
  requests: SimulationRequest[];
  comparison: {
    htmlDifferences: {
      additions: string[];
      removals: string[];
      modifications: string[];
    };
    renderTimes: Array<{
      userAgent: string;
      time: number;
      screenshot?: string;
    }>;
    resourceDifferences: {
      uniqueToFirst: string[];
      uniqueToSecond: string[];
      common: string[];
    };
  };
  timestamp: Date;
}

class UASimulator {
  private logger = new Logger('UASimulator');
  private activeSimulations: Map<string, SimulationRequest> = new Map();
  private simulationHistory: SimulationRequest[] = [];

  constructor() {
    this.initializeUserAgents();
  }

  private userAgents: UserAgentTemplate[] = [
    // Search Engines
    {
      id: 'googlebot-desktop',
      name: 'Googlebot Desktop',
      category: 'searchbot',
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      description: "Google's main web crawler",
      capabilities: { javascript: true, css: true, images: true, cookies: false },
      popularity: 95,
    },
    {
      id: 'googlebot-mobile',
      name: 'Googlebot Smartphone',
      category: 'searchbot',
      userAgent:
        'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.96 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      description: "Google's mobile web crawler",
      capabilities: { javascript: true, css: true, images: true, cookies: false },
      popularity: 85,
    },
    {
      id: 'bingbot',
      name: 'Bingbot',
      category: 'searchbot',
      userAgent: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      description: 'Microsoft Bing web crawler',
      capabilities: { javascript: true, css: true, images: true, cookies: false },
      popularity: 75,
    },
    {
      id: 'slurp',
      name: 'Yahoo! Slurp',
      category: 'searchbot',
      userAgent:
        'Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)',
      description: 'Yahoo web crawler',
      capabilities: { javascript: false, css: true, images: true, cookies: false },
      popularity: 60,
    },

    // Social Media Crawlers
    {
      id: 'facebookbot',
      name: 'Facebook External Hit',
      category: 'socialbot',
      userAgent: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      description: 'Facebook link preview crawler',
      capabilities: { javascript: false, css: true, images: true, cookies: false },
      popularity: 90,
    },
    {
      id: 'twitterbot',
      name: 'Twitterbot',
      category: 'socialbot',
      userAgent: 'Mozilla/5.0 (compatible; Twitterbot/1.0)',
      description: 'Twitter link preview crawler',
      capabilities: { javascript: false, css: true, images: true, cookies: false },
      popularity: 85,
    },
    {
      id: 'linkedinbot',
      name: 'LinkedInBot',
      category: 'socialbot',
      userAgent: 'Mozilla/5.0 (compatible; LinkedInBot/1.0)',
      description: 'LinkedIn crawler',
      capabilities: { javascript: false, css: true, images: true, cookies: false },
      popularity: 70,
    },

    // Monitoring & SEO Tools
    {
      id: 'semrushbot',
      name: 'SEMrushBot',
      category: 'monitoring',
      userAgent: 'Mozilla/5.0 (compatible; SEMrushBot/0.98.6; +http://www.semrush.com/bot.html)',
      description: 'SEMrush SEO tool crawler',
      capabilities: { javascript: false, css: true, images: true, cookies: false },
      popularity: 65,
    },
    {
      id: 'ahrefsbot',
      name: 'AhrefsBot',
      category: 'monitoring',
      userAgent: 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://www.ahrefs.com/robot/)',
      description: 'Ahrefs SEO tool crawler',
      capabilities: { javascript: false, css: true, images: true, cookies: false },
      popularity: 60,
    },

    // Modern Browsers
    {
      id: 'chrome-desktop',
      name: 'Chrome Desktop',
      category: 'browser',
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      description: 'Modern Chrome browser',
      capabilities: { javascript: true, css: true, images: true, cookies: true },
      popularity: 70,
    },
    {
      id: 'safari-mobile',
      name: 'Safari Mobile',
      category: 'mobile',
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Mobile/15E148 Safari/604.1',
      description: 'Mobile Safari browser',
      capabilities: { javascript: true, css: true, images: true, cookies: true },
      popularity: 65,
    },
  ];

  /**
   * Initialize user agent templates
   */
  private initializeUserAgents(): void {
    this.logger.info(`Initialized ${this.userAgents.length} user agent templates`);
  }

  /**
   * Get all user agent templates
   */
  getUserAgents(): UserAgentTemplate[] {
    return this.userAgents.sort((a, b) => b.popularity - a.popularity);
  }

  /**
   * Get user agent by ID
   */
  getUserAgent(id: string): UserAgentTemplate | null {
    return this.userAgents.find((ua) => ua.id === id) || null;
  }

  /**
   * Get user agents by category
   */
  getUserAgentsByCategory(category: UserAgentTemplate['category']): UserAgentTemplate[] {
    return this.userAgents.filter((ua) => ua.category === category);
  }

  /**
   * Start a simulation
   */
  async startSimulation(
    url: string,
    userAgentTemplate: UserAgentTemplate,
    options: SimulationRequest['options'] = {}
  ): Promise<SimulationRequest> {
    const simulationId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const request: SimulationRequest = {
      id: simulationId,
      url,
      userAgent: userAgentTemplate.userAgent,
      options: {
        width: options.width || 1200,
        height: options.height || 800,
        deviceScaleFactor: options.deviceScaleFactor || 1,
        waitUntil: options.waitUntil || 'networkidle2',
        timeout: options.timeout || 30000,
      },
      timestamp: new Date(),
      status: 'pending',
    };

    this.activeSimulations.set(simulationId, request);

    // Start simulation in background
    this.runSimulation(request);

    return request;
  }

  /**
   * Run a simulation
   */
  private async runSimulation(request: SimulationRequest): Promise<void> {
    try {
      request.status = 'running';
      this.logger.info(`Starting simulation for ${request.url} with ${request.userAgent}`);

      const browser = await browserManager.getBrowser();
      const page = await browser.newPage();

      try {
        // Set user agent
        await page.setUserAgent(request.userAgent);

        // Set viewport
        await page.setViewport({
          width: request.options.width || 1200,
          height: request.options.height || 800,
          deviceScaleFactor: request.options.deviceScaleFactor || 1,
        });

        // Capture console logs
        const consoleLogs: Array<{ level: string; message: string; timestamp: number }> = [];
        page.on('console', (msg) => {
          consoleLogs.push({
            level: msg.type(),
            message: msg.text(),
            timestamp: Date.now(),
          });
        });

        // Track network requests
        const networkRequests: Array<{
          url: string;
          method: string;
          status: number;
          size: number;
          time: number;
        }> = [];
        const resources = {
          totalRequests: 0,
          blockedRequests: 0,
          totalSize: 0,
          domains: new Set<string>(),
        };

        page.on('request', (req) => {
          resources.totalRequests++;
          const url = new URL(req.url());
          resources.domains.add(url.hostname);
        });

        page.on('response', (res) => {
          const headers = res.headers();
          const size = parseInt(headers['content-length'] || '0');

          networkRequests.push({
            url: res.url(),
            method: res.request().method(),
            status: res.status(),
            size,
            time: 0, // Simplified timing
          });

          if (size > 0) {
            resources.totalSize += size;
          }
        });

        // Load the page
        const startTime = Date.now();
        await page.goto(request.url, {
          waitUntil: request.options.waitUntil as any,
          timeout: request.options.timeout,
        });

        const renderTime = Date.now() - startTime;

        // Get page info
        const title = await page.title();
        const html = await page.content();
        const screenshot = await page.screenshot({
          fullPage: true,
          encoding: 'base64',
        });

        // Get memory usage
        const metrics = await page.metrics();

        // Get response headers
        const response = await page.goto(request.url);
        const responseHeaders: Record<string, string> = {};
        if (response) {
          const headers = response.headers();
          Object.entries(headers).forEach(([key, value]) => {
            responseHeaders[key.toLowerCase()] = String(value);
          });
        }

        const result: SimulationResult = {
          html,
          screenshot: `data:image/png;base64,${screenshot}`,
          title,
          status: response?.status() || 200,
          headers: responseHeaders,
          renderTime,
          memoryUsage: {
            usedJSHeapSize: metrics.JSHeapUsedSize || 0,
            totalJSHeapSize: metrics.JSHeapTotalSize || 0,
            jsHeapSizeLimit: (metrics as Record<string, number>).JSHeapSizeLimit || 0,
          },
          resources: {
            totalRequests: resources.totalRequests,
            blockedRequests: resources.blockedRequests,
            totalSize: resources.totalSize,
            domains: Array.from(resources.domains),
          },
          console: consoleLogs,
          network: networkRequests,
        };

        request.result = result;
        request.status = 'completed';

        // Cache the result
        await this.cacheResult(request);

        this.logger.info(`Completed simulation for ${request.url} in ${renderTime}ms`);
      } finally {
        await page.close();
      }
    } catch (error) {
      request.status = 'failed';
      request.error = (error as Error).message;
      this.logger.error(`Simulation failed for ${request.url}:`, error);
    } finally {
      // Move to history
      this.activeSimulations.delete(request.id);
      this.simulationHistory.unshift(request);
      if (this.simulationHistory.length > 100) {
        this.simulationHistory = this.simulationHistory.slice(0, 100);
      }
    }
  }

  /**
   * Compare two simulations
   */
  async compareSimulations(
    request1: SimulationRequest,
    request2: SimulationRequest
  ): Promise<ComparisonResult> {
    if (!request1.result || !request2.result) {
      throw new Error('Both simulations must be completed to compare');
    }

    // Simple HTML difference detection
    const _html1 = request1.result.html;
    const _html2 = request2.result.html;

    // More sophisticated diff could be implemented here
    const htmlDifferences = {
      additions: [] as string[],
      removals: [] as string[],
      modifications: [] as string[],
    };

    // Resource differences
    const domains1 = new Set(request1.result.resources.domains);
    const domains2 = new Set(request2.result.resources.domains);

    const resourceDifferences = {
      uniqueToFirst: Array.from(domains1).filter((d) => !domains2.has(d)),
      uniqueToSecond: Array.from(domains2).filter((d) => !domains1.has(d)),
      common: Array.from(domains1).filter((d) => domains2.has(d)),
    };

    const comparison: ComparisonResult = {
      requests: [request1, request2],
      comparison: {
        htmlDifferences,
        renderTimes: [
          {
            userAgent: this.getUserAgentForUA(request1.userAgent)?.name || 'Custom',
            time: request1.result.renderTime,
            screenshot: request1.result.screenshot,
          },
          {
            userAgent: this.getUserAgentForUA(request2.userAgent)?.name || 'Custom',
            time: request2.result.renderTime,
            screenshot: request2.result.screenshot,
          },
        ],
        resourceDifferences,
      },
      timestamp: new Date(),
    };

    return comparison;
  }

  /**
   * Find user agent template by user agent string
   */
  private getUserAgentForUA(userAgent: string): UserAgentTemplate | null {
    return this.userAgents.find((ua) => ua.userAgent === userAgent) || null;
  }

  /**
   * Get simulation by ID
   */
  getSimulation(id: string): SimulationRequest | null {
    const active = this.activeSimulations.get(id);
    if (active) return active;

    return this.simulationHistory.find((s) => s.id === id) || null;
  }

  /**
   * Get simulation history
   */
  getSimulationHistory(limit: number = 20): SimulationRequest[] {
    return this.simulationHistory.slice(0, limit);
  }

  /**
   * Get active simulations
   */
  getActiveSimulations(): SimulationRequest[] {
    return Array.from(this.activeSimulations.values());
  }

  /**
   * Cache simulation result
   */
  private async cacheResult(request: SimulationRequest): Promise<void> {
    try {
      cache.set(`simulation:${request.id}`, JSON.stringify(request.result), 86400); // 24 hours
    } catch (error) {
      this.logger.warn('Failed to cache simulation result:', error);
    }
  }

  /**
   * Get simulation statistics
   */
  getStats(): {
    totalSimulations: number;
    successfulSimulations: number;
    failedSimulations: number;
    averageRenderTime: number;
    topUserAgents: Array<{
      userAgent: string;
      count: number;
      name: string;
    }>;
  } {
    const total = this.simulationHistory.length;
    const successful = this.simulationHistory.filter((s) => s.status === 'completed').length;
    const failed = this.simulationHistory.filter((s) => s.status === 'failed').length;

    const completedSimulations = this.simulationHistory.filter(
      (s) => s.status === 'completed' && s.result
    );
    const averageRenderTime =
      completedSimulations.length > 0
        ? completedSimulations.reduce((sum, s) => sum + s.result!.renderTime, 0) /
          completedSimulations.length
        : 0;

    // Count user agents
    const uaCounts: Record<string, { count: number; name: string }> = {};
    for (const simulation of this.simulationHistory) {
      const uaTemplate = this.getUserAgentForUA(simulation.userAgent);
      const key = simulation.userAgent;
      if (!uaCounts[key]) {
        uaCounts[key] = { count: 0, name: uaTemplate?.name || 'Custom' };
      }
      uaCounts[key].count++;
    }

    const topUserAgents = Object.entries(uaCounts)
      .map(([userAgent, data]) => ({ userAgent, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalSimulations: total,
      successfulSimulations: successful,
      failedSimulations: failed,
      averageRenderTime,
      topUserAgents,
    };
  }

  /**
   * Clear simulation history
   */
  clearHistory(): void {
    this.simulationHistory = [];
    this.logger.info('Cleared simulation history');
  }

  /**
   * Cancel an active simulation
   */
  async cancelSimulation(id: string): Promise<boolean> {
    const simulation = this.activeSimulations.get(id);
    if (!simulation) return false;

    simulation.status = 'failed';
    simulation.error = 'Cancelled by user';

    this.activeSimulations.delete(id);
    this.simulationHistory.unshift(simulation);

    this.logger.info(`Cancelled simulation ${id}`);
    return true;
  }
}

export default new UASimulator();
