/**
 * Metrics Collector
 * Collects and stores traffic metrics for admin dashboard
 */

export interface RequestData {
  path: string;
  userAgent: string;
  isBot: boolean;
  action: 'ssr' | 'proxy' | 'static' | 'bypass' | 'error';
  cacheStatus: 'HIT' | 'MISS' | null;
  rule?: string;
  cached?: boolean;
  error?: string;
}

interface TrafficLogEntry extends RequestData {
  timestamp: number;
}

interface Stats {
  totalRequests: number;
  botRequests: number;
  humanRequests: number;
  cacheHits: number;
  cacheMisses: number;
  ssrRendered: number;
  proxiedDirect: number;
  staticAssets: number;
  bypassedByRules: number;
  errors: number;
}

interface UrlStat {
  count: number;
  cacheHits: number;
  cacheMisses: number;
  lastAccess: number;
}

interface TimelineEntry {
  timestamp: number;
  total: number;
  bots: number;
  humans: number;
  cacheHits: number;
  cacheMisses: number;
}

/**
 * Metrics Collector
 */
class MetricsCollector {
  private trafficLog: TrafficLogEntry[] = [];
  private maxLogSize: number;
  private stats: Stats;
  private botStats: Record<string, number> = {};
  private maxBotTypes = 100;
  private urlStats: Record<string, UrlStat> = {};
  private maxUrls = 500;
  private startTime: number;

  constructor() {
    this.maxLogSize = parseInt(process.env['METRICS_LOG_SIZE'] || '1000', 10);

    this.stats = {
      totalRequests: 0,
      botRequests: 0,
      humanRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      ssrRendered: 0,
      proxiedDirect: 0,
      staticAssets: 0,
      bypassedByRules: 0,
      errors: 0,
    };

    this.startTime = Date.now();

    console.log(`📊 Metrics collector initialized (max log: ${this.maxLogSize}, max URLs: ${this.maxUrls})`);
  }

  /**
   * Record an incoming request
   */
  recordRequest(data: RequestData): void {
    const timestamp = Date.now();

    const logEntry: TrafficLogEntry = {
      timestamp,
      ...data,
    };

    this.trafficLog.push(logEntry);

    // Maintain rolling window
    if (this.trafficLog.length > this.maxLogSize) {
      this.trafficLog.shift();
    }

    // Update aggregate stats
    this.stats.totalRequests++;

    if (data.isBot) {
      this.stats.botRequests++;

      // Track bot types (with limit)
      const botName = this.extractBotName(data.userAgent);
      if (Object.keys(this.botStats).length < this.maxBotTypes || this.botStats[botName]) {
        this.botStats[botName] = (this.botStats[botName] || 0) + 1;
      } else {
        this.botStats['Other Bots'] = (this.botStats['Other Bots'] || 0) + 1;
      }
    } else {
      this.stats.humanRequests++;
    }

    if (data.cacheStatus === 'HIT') {
      this.stats.cacheHits++;
    } else if (data.cacheStatus === 'MISS') {
      this.stats.cacheMisses++;
    }

    if (data.action === 'ssr') {
      this.stats.ssrRendered++;
    } else if (data.action === 'proxy') {
      this.stats.proxiedDirect++;
    } else if (data.action === 'static') {
      this.stats.staticAssets++;
    } else if (data.action === 'bypass') {
      this.stats.bypassedByRules++;
    }

    if (data.error) {
      this.stats.errors++;
    }

    // URL statistics (with limit)
    if (!this.urlStats[data.path]) {
      const urlCount = Object.keys(this.urlStats).length;
      if (urlCount >= this.maxUrls) {
        // Remove the least recently accessed URL
        const entries = Object.entries(this.urlStats);
        entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
        const oldestUrl = entries[0]?.[0];
        if (oldestUrl) {
          delete this.urlStats[oldestUrl];
          console.log(`📊 URL stats limit reached (${this.maxUrls}), removed oldest: ${oldestUrl}`);
        }
      }

      this.urlStats[data.path] = {
        count: 0,
        cacheHits: 0,
        cacheMisses: 0,
        lastAccess: timestamp,
      };
    }

    this.urlStats[data.path]!.count++;
    this.urlStats[data.path]!.lastAccess = timestamp;

    if (data.cacheStatus === 'HIT') {
      this.urlStats[data.path]!.cacheHits++;
    } else if (data.cacheStatus === 'MISS') {
      this.urlStats[data.path]!.cacheMisses++;
    }
  }

  /**
   * Extract bot name from user agent
   */
  private extractBotName(userAgent: string): string {
    const ua = userAgent.toLowerCase();

    if (ua.includes('googlebot')) return 'Googlebot';
    if (ua.includes('bingbot')) return 'Bingbot';
    if (ua.includes('twitterbot')) return 'Twitterbot';
    if (ua.includes('facebookexternalhit')) return 'Facebook';
    if (ua.includes('linkedinbot')) return 'LinkedIn';
    if (ua.includes('slackbot')) return 'Slack';
    if (ua.includes('telegrambot')) return 'Telegram';
    if (ua.includes('whatsapp')) return 'WhatsApp';
    if (ua.includes('discordbot')) return 'Discord';
    if (ua.includes('baiduspider')) return 'Baidu';
    if (ua.includes('yandexbot')) return 'Yandex';
    if (ua.includes('duckduckbot')) return 'DuckDuckGo';

    return 'Other Bots';
  }

  /**
   * Get current statistics
   */
  getStats(): Stats & { uptime: number; cacheHitRate: string; requestsPerSecond: string } {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    const cacheHitRate =
      this.stats.cacheHits + this.stats.cacheMisses > 0
        ? (this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100
        : 0;

    return {
      uptime,
      ...this.stats,
      cacheHitRate: cacheHitRate.toFixed(2),
      requestsPerSecond: (this.stats.totalRequests / uptime).toFixed(2),
    };
  }

  /**
   * Get bot statistics
   */
  getBotStats(): Record<string, number> {
    return this.botStats;
  }

  /**
   * Get URL statistics
   */
  getUrlStats(limit = 50): Array<UrlStat & { path: string; hitRate: string | number }> {
    return Object.entries(this.urlStats)
      .map(([path, stats]) => ({
        path,
        ...stats,
        hitRate:
          stats.cacheHits + stats.cacheMisses > 0
            ? ((stats.cacheHits / (stats.cacheHits + stats.cacheMisses)) * 100).toFixed(2)
            : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get recent traffic log
   */
  getRecentTraffic(limit = 100): TrafficLogEntry[] {
    return this.trafficLog.slice(-limit).reverse();
  }

  /**
   * Get traffic timeline (grouped by minute)
   */
  getTrafficTimeline(minutes = 60): TimelineEntry[] {
    const now = Date.now();
    const timeline: TimelineEntry[] = [];

    for (let i = minutes - 1; i >= 0; i--) {
      const minuteStart = now - i * 60000;
      const minuteEnd = minuteStart + 60000;

      const requests = this.trafficLog.filter(
        (entry) => entry.timestamp >= minuteStart && entry.timestamp < minuteEnd
      );

      timeline.push({
        timestamp: minuteStart,
        total: requests.length,
        bots: requests.filter((r) => r.isBot).length,
        humans: requests.filter((r) => !r.isBot).length,
        cacheHits: requests.filter((r) => r.cacheStatus === 'HIT').length,
        cacheMisses: requests.filter((r) => r.cacheStatus === 'MISS').length,
      });
    }

    return timeline;
  }

  /**
   * Reset all statistics
   */
  reset(): void {
    this.trafficLog = [];
    this.stats = {
      totalRequests: 0,
      botRequests: 0,
      humanRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      ssrRendered: 0,
      proxiedDirect: 0,
      staticAssets: 0,
      bypassedByRules: 0,
      errors: 0,
    };
    this.botStats = {};
    this.urlStats = {};
    this.startTime = Date.now();
  }
}

// Export singleton instance
const metricsCollector = new MetricsCollector();
export default metricsCollector;
