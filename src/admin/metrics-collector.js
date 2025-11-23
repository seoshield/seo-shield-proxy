/**
 * Metrics Collector
 * Collects and stores traffic metrics for admin dashboard
 */

class MetricsCollector {
  constructor() {
    // Traffic log (rolling window - configurable max size)
    this.trafficLog = [];
    this.maxLogSize = parseInt(process.env.METRICS_LOG_SIZE, 10) || 1000;

    // Aggregate statistics
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

    // Bot breakdown (limit to prevent unbounded growth)
    this.botStats = {};
    this.maxBotTypes = 100;

    // URL statistics (limit to prevent unbounded growth)
    this.urlStats = {};
    this.maxUrls = 500;

    // Start time
    this.startTime = Date.now();

    console.log(`📊 Metrics collector initialized (max log: ${this.maxLogSize}, max URLs: ${this.maxUrls})`);
  }

  /**
   * Record an incoming request
   * @param {object} data - Request data
   */
  recordRequest(data) {
    const timestamp = Date.now();

    // Add to traffic log
    const logEntry = {
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
        // Consolidate into "Other Bots" when limit reached
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
      // Check if we've reached the limit
      const urlCount = Object.keys(this.urlStats).length;
      if (urlCount >= this.maxUrls) {
        // Remove the least recently accessed URL
        const entries = Object.entries(this.urlStats);
        entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
        const oldestUrl = entries[0][0];
        delete this.urlStats[oldestUrl];
        console.log(`📊 URL stats limit reached (${this.maxUrls}), removed oldest: ${oldestUrl}`);
      }

      this.urlStats[data.path] = {
        count: 0,
        cacheHits: 0,
        cacheMisses: 0,
        lastAccess: timestamp,
      };
    }

    this.urlStats[data.path].count++;
    this.urlStats[data.path].lastAccess = timestamp;

    if (data.cacheStatus === 'HIT') {
      this.urlStats[data.path].cacheHits++;
    } else if (data.cacheStatus === 'MISS') {
      this.urlStats[data.path].cacheMisses++;
    }
  }

  /**
   * Extract bot name from user agent
   * @param {string} userAgent
   * @returns {string}
   */
  extractBotName(userAgent) {
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
   * @returns {object}
   */
  getStats() {
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
   * @returns {object}
   */
  getBotStats() {
    return this.botStats;
  }

  /**
   * Get URL statistics
   * @param {number} limit - Number of top URLs to return
   * @returns {array}
   */
  getUrlStats(limit = 50) {
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
   * @param {number} limit - Number of recent entries to return
   * @returns {array}
   */
  getRecentTraffic(limit = 100) {
    return this.trafficLog.slice(-limit).reverse();
  }

  /**
   * Get traffic timeline (grouped by minute)
   * @param {number} minutes - Number of minutes to return
   * @returns {array}
   */
  getTrafficTimeline(minutes = 60) {
    const now = Date.now();
    const timeline = [];

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
  reset() {
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
