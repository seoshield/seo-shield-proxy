import { MongoDBStorage, MongoStorage } from '../storage/mongodb-storage';

// Type alias for either storage implementation
type StorageAdapter = MongoDBStorage | MongoStorage;

export interface BotRule {
  id: string;
  name: string;
  enabled: boolean;
  pattern: string | RegExp;
  type: 'userAgent' | 'ip' | 'domain' | 'path' | 'header';
  action: 'allow' | 'block' | 'render' | 'priority';
  priority: number;
  botType?: string;
  description?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
  createdUser?: string;
}

export interface BotDetectionResult {
  isBot: boolean;
  confidence: number;
  botType: string;
  rulesMatched: string[];
  action: 'allow' | 'block' | 'render' | 'priority';
  metadata?: any;
}

export interface IPReputation {
  ip: string;
  reputation: 'clean' | 'suspicious' | 'malicious' | 'unknown';
  category: 'search_engine' | 'social' | 'monitoring' | 'malicious' | 'cloud' | 'private' | 'hosting' | 'unknown';
  lastSeen: Date;
  requestCount: number;
  blockedCount: number;
  source?: string;
}

export class AdvancedBotDetector {
  private mongoStorage: StorageAdapter;
  private botRules: BotRule[] = [];
  private ipReputationCache: Map<string, IPReputation> = new Map();
  private lastRulesUpdate: Date = new Date(0);
  private ipReputationTTL: number = 3600000; // 1 hour

  constructor(mongoStorage: StorageAdapter) {
    this.mongoStorage = mongoStorage;
    this.loadBotRules();
  }

  private async loadBotRules(): Promise<void> {
    try {
      // Load from MongoDB or use default rules
      this.botRules = await this.getBotRulesFromDatabase();
      this.lastRulesUpdate = new Date();
      console.log(`🤖️ Loaded ${this.botRules.length} bot detection rules`);
    } catch (error) {
      console.error('❌ Failed to load bot rules, using defaults:', error);
      this.botRules = this.getDefaultBotRules();
    }
  }

  private getDefaultBotRules(): BotRule[] {
    const now = new Date();
    return [
      // Search Engine Bots
      {
        id: 'googlebot',
        name: 'Googlebot',
        enabled: true,
        pattern: /googlebot/i,
        type: 'userAgent',
        action: 'render',
        priority: 100,
        botType: 'googlebot',
        description: 'Google search crawler',
        tags: ['search', 'crawler'],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'bingbot',
        name: 'Bingbot',
        enabled: true,
        pattern: /bingbot/i,
        type: 'userAgent',
        action: 'render',
        priority: 100,
        botType: 'bingbot',
        description: 'Microsoft Bing search crawler',
        tags: ['search', 'crawler'],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'yandexbot',
        name: 'YandexBot',
        enabled: true,
        pattern: /yandexbot/i,
        type: 'userAgent',
        action: 'render',
        priority: 100,
        botType: 'yandexbot',
        description: 'Yandex search crawler',
        tags: ['search', 'crawler'],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'duckduckbot',
        name: 'DuckDuckBot',
        enabled: true,
        pattern: /duckduckbot/i,
        type: 'userAgent',
        action: 'render',
        priority: 100,
        botType: 'duckduckbot',
        description: 'DuckDuckGo search crawler',
        tags: ['search', 'crawler', 'privacy'],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'baidu',
        name: 'Baidu Spider',
        enabled: true,
        pattern: /baiduspider/i,
        type: 'userAgent',
        action: 'render',
        priority: 90,
        botType: 'baidu',
        description: 'Baidu search crawler',
        tags: ['search', 'crawler'],
        createdAt: now,
        updatedAt: now
      },

      // Social Media Bots
      {
        id: 'facebookexternalhit',
        name: 'Facebook External Hit',
        enabled: true,
        pattern: /facebookexternalhit/i,
        type: 'userAgent',
        action: 'render',
        priority: 80,
        botType: 'facebook',
        description: 'Facebook link preview crawler',
        tags: ['social', 'crawler'],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'twitterbot',
        name: 'Twitterbot',
        enabled: true,
        pattern: /twitterbot/i,
        type: 'userAgent',
        action: 'render',
        priority: 80,
        botType: 'twitter',
        description: 'Twitter link preview crawler',
        tags: ['social', 'crawler'],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'linkedinbot',
        name: 'LinkedInBot',
        enabled: true,
        pattern: /linkedinbot/i,
        type: 'userAgent',
        action: 'render',
        priority: 80,
        botType: 'linkedin',
        description: 'LinkedIn link preview crawler',
        tags: ['social', 'crawler', 'professional'],
        createdAt: now,
        updatedAt: now
      },

      // Monitoring Tools
      {
        id: 'uptimerobot',
        name: 'UptimeRobot',
        enabled: true,
        pattern: /uptimerobot/i,
        type: 'userAgent',
        action: 'block',
        priority: 50,
        botType: 'monitoring',
        description: 'Website monitoring service',
        tags: ['monitoring', 'tools'],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'pingdom',
        name: 'Pingdom',
        enabled: true,
        pattern: /pingdom/i,
        type: 'userAgent',
        action: 'block',
        priority: 50,
        botType: 'monitoring',
        description: 'Performance monitoring service',
        tags: ['monitoring', 'tools'],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'screamingfrog',
        name: 'Screaming Frog',
        enabled: true,
        pattern: /screaming frog/i,
        type: 'userAgent',
        action: 'block',
        priority: 50,
        botType: 'security',
        description: 'Security vulnerability scanner',
        tags: ['security', 'tools'],
        createdAt: now,
        updatedAt: now
      },

      // Suspicious Patterns
      {
        id: 'headless',
        name: 'Headless Browser',
        enabled: true,
        pattern: /headlesschrome/i,
        type: 'userAgent',
        action: 'priority',
        priority: 30,
        botType: 'suspicious',
        description: 'Headless browser detection',
        tags: ['suspicious', 'automation'],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'puppeteer',
        name: 'Puppeteer',
        enabled: true,
        pattern: /puppeteer/i,
        type: 'userAgent',
        action: 'priority',
        priority: 30,
        botType: 'automation',
        description: 'Puppeteer automation framework',
        tags: ['automation', 'tools'],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'selenium',
        name: 'Selenium',
        enabled: true,
        pattern: /selenium/i,
        type: 'userAgent',
        action: 'priority',
        priority: 30,
        botType: 'automation',
        description: 'Selenium automation framework',
        tags: ['automation', 'tools'],
        createdAt: now,
        updatedAt: now
      },

      // API Clients
      {
        id: 'curl',
        name: 'cURL',
        enabled: true,
        pattern: /^curl\//,
        type: 'userAgent',
        action: 'priority',
        priority: 20,
        botType: 'api',
        description: 'cURL command line tool',
        tags: ['api', 'tools'],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'wget',
        name: 'Wget',
        enabled: true,
        pattern: /wget/i,
        type: 'userAgent',
        action: 'priority',
        priority: 20,
        botType: 'tools',
        description: 'Wget download tool',
        tags: ['api', 'tools'],
        createdAt: now,
        updatedAt: now
      },

      // WordPress
      {
        id: 'wordpress',
        name: 'WordPress',
        enabled: true,
        pattern: /wordpress/i,
        type: 'userAgent',
        action: 'render',
        priority: 60,
        botType: 'cms',
        description: 'WordPress crawler',
        tags: ['cms', 'content'],
        createdAt: now,
        updatedAt: now
      },

      // Default Block Rules
      {
        id: 'no-user-agent',
        name: 'No User-Agent',
        enabled: true,
        pattern: /^$/,
        type: 'userAgent',
        action: 'block',
        priority: 90,
        botType: 'suspicious',
        description: 'Requests without User-Agent header',
        tags: ['suspicious'],
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'bot-like-requests',
        name: 'Bot-like Patterns',
        enabled: true,
        pattern: /(bot|crawl|spider|scrape|harvest)/i,
        type: 'userAgent',
        action: 'priority',
        priority: 40,
        botType: 'unknown',
        description: 'Generic bot-like patterns',
        tags: ['suspicious'],
        createdAt: now,
        updatedAt: now
      }
    ];
  }

  private async getBotRulesFromDatabase(): Promise<BotRule[]> {
    // In a real implementation, this would load from MongoDB
    // For now, return default rules
    return this.getDefaultBotRules();
  }

  async detectBot(request: {
    userAgent?: string;
    ip?: string;
    headers?: Record<string, string>;
    referer?: string;
    path?: string;
    method?: string;
  }): Promise<BotDetectionResult> {
    const result: BotDetectionResult = {
      isBot: false,
      confidence: 0,
      botType: 'human',
      rulesMatched: [],
      action: 'allow'
    };

    const userAgent = request.userAgent || '';
    const ip = request.ip || '';

    // Check User-Agent patterns
    for (const rule of this.botRules) {
      if (!rule.enabled) continue;

      if (rule.type === 'userAgent' && userAgent) {
        if (rule.pattern instanceof RegExp && rule.pattern.test(userAgent)) {
          result.rulesMatched.push(rule.id);
          result.isBot = true;
          result.botType = rule.botType || 'unknown';
          result.confidence = Math.max(result.confidence, this.getRuleConfidence(rule));

          // Update action based on priority
          if (this.shouldUpdateAction(result.action, rule.action, rule.priority)) {
            result.action = rule.action;
          }
        }
      }
    }

    // Check IP reputation
    if (ip) {
      const ipRep = await this.getIPReputation(ip);
      if (ipRep.reputation === 'malicious') {
        result.isBot = true;
        result.confidence = Math.max(result.confidence, 90);
        result.botType = 'malicious';
        result.rulesMatched.push('ip-reputation');
        result.action = 'block';
      } else if (ipRep.reputation === 'suspicious') {
        result.isBot = true;
        result.confidence = Math.max(result.confidence, 70);
        result.botType = 'suspicious';
        result.rulesMatched.push('ip-reputation');
        result.action = result.action === 'allow' ? 'priority' : result.action;
      } else if (ipRep.category === 'search_engine') {
        result.isBot = true;
        result.confidence = Math.max(result.confidence, 80);
        result.botType = ipRep.category;
        result.rulesMatched.push('ip-reputation');
        result.action = result.action === 'allow' ? 'render' : result.action;
      }
    }

    // Additional heuristics
    const heuristics = this.analyzeHeuristics(request);
    result.confidence = Math.max(result.confidence, heuristics.confidence);
    if (heuristics.isBot) {
      result.isBot = true;
      result.botType = result.botType === 'human' ? 'heuristics.type' : result.botType;
      result.rulesMatched.push('heuristics');
    }

    // Add metadata
    result.metadata = {
      userAgent,
      ip,
      ipReputation: ip ? this.getIPReputation(ip) : undefined,
      heuristics
    };

    // Log the detection
    await this.logBotDetection(result, request);

    return result;
  }

  private getRuleConfidence(rule: BotRule): number {
    const baseConfidence = {
      priority: rule.priority,
      botType: rule.botType || 'unknown'
    };

    // Search engines get high confidence
    if (['googlebot', 'bingbot', 'yandexbot', 'duckduckbot'].includes(rule.botType || '')) {
      return 95;
    }

    // Social media gets medium-high confidence
    if (['facebook', 'twitter', 'linkedin', 'instagram'].includes(rule.botType || '')) {
      return 85;
    }

    // Security tools get medium confidence
    if (rule.botType === 'security' || rule.botType === 'malicious') {
      return 75;
    }

    return baseConfidence.priority;
  }

  private shouldUpdateAction(currentAction: string, newAction: string, priority: number): boolean {
    const actionPriority: Record<string, number> = {
      'block': 100,
      'render': 90,
      'priority': 50,
      'allow': 10
    };

    const currentPriority = actionPriority[currentAction] ?? 0;
    const newPriority = actionPriority[newAction] ?? 0;

    return newPriority > currentPriority;
  }

  private async getIPReputation(ip: string): Promise<IPReputation> {
    // Check cache first
    if (this.ipReputationCache.has(ip)) {
      const cached = this.ipReputationCache.get(ip)!;
      if (Date.now() - cached.lastSeen.getTime() < this.ipReputationTTL) {
        return cached;
      }
    }

    // In a real implementation, this would check against IP reputation services
    // For now, simulate IP reputation
    const reputation: IPReputation = {
      ip,
      reputation: 'unknown',
      category: 'unknown',
      lastSeen: new Date(),
      requestCount: 1,
      blockedCount: 0,
      source: 'local'
    };

    // Classify some known ranges
    if (this.isPrivateIP(ip)) {
      reputation.reputation = 'clean';
      reputation.category = 'private';
    } else if (this.isCloudProviderIP(ip)) {
      reputation.reputation = 'clean';
      reputation.category = 'cloud';
    } else if (this.isHostingProviderIP(ip)) {
      reputation.reputation = 'clean';
      reputation.category = 'hosting';
    }

    this.ipReputationCache.set(ip, reputation);
    return reputation;
  }

  private isPrivateIP(ip: string): boolean {
    // Private IP ranges
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^::1$/,
      /^fe80:/,
      /^fc00:/,
      /^::/
    ];

    return privateRanges.some(range => range.test(ip));
  }

  private isCloudProviderIP(ip: string): boolean {
    // Known cloud provider IP ranges would be checked here
    // For now, return false
    return false;
  }

  private isHostingProviderIP(ip: string): boolean {
    // Known hosting provider IP ranges would be checked here
    // For now, return false
    return false;
  }

  private analyzeHeuristics(request: {
    userAgent?: string;
    ip?: string;
    headers?: Record<string, string>;
    referer?: string;
    path?: string;
    method?: string;
  }): { isBot: boolean; confidence: number; type: string; } {
    const userAgent = request.userAgent || '';
    const headers = request.headers || {};

    let botScore = 0;
    let botType = 'unknown';

    // Check for bot indicators in User-Agent
    if (userAgent) {
      // Too short User-Agent
      if (userAgent.length < 20) {
        botScore += 20;
      }

      // Missing common browser identifiers
      if (!userAgent.includes('Mozilla/') && !userAgent.includes('Chrome') &&
          !userAgent.includes('Safari') && !userAgent.includes('Edge')) {
        botScore += 30;
      }

      // Suspicious patterns
      const suspiciousPatterns = [
        /bot/i, /crawler/i, /spider/i, /scrape/i, /harvest/i,
        /headless/i, /phantom/i, /selenium/i, /puppeteer/i,
        /automated/i, /script/i, /crawl/i
      ];

      suspiciousPatterns.forEach(pattern => {
        if (pattern.test(userAgent)) {
          botScore += 25;
        }
      });

      // HTTP library patterns
      if (userAgent.includes('curl/') || userAgent.includes('wget/') ||
          userAgent.includes('python-requests') || userAgent.includes('java/')) {
        botScore += 40;
      }
    }

    // Check headers
    if (headers['x-forwarded-for']) {
      botScore += 15;
    }

    if (headers['via']) {
      botScore += 10;
    }

    // Check referer
    if (request.referer) {
      const referer = request.referer.toLowerCase();
      if (referer.includes('bot') || referer.includes('crawler') ||
          referer.includes('spider') || referer.includes('scrape')) {
        botScore += 20;
      }
    }

    // Determine bot type based on score
    if (botScore >= 80) {
      botType = 'confirmed_bot';
    } else if (botScore >= 50) {
      botType = 'likely_bot';
    } else if (botScore >= 30) {
      botType = 'possible_bot';
    }

    return {
      isBot: botScore >= 30,
      confidence: Math.min(botScore, 100),
      type: botType
    };
  }

  private async logBotDetection(result: BotDetectionResult, request: any): Promise<void> {
    try {
      await this.mongoStorage.logAudit({
        action: 'bot_detection',
        category: 'security',
        level: 'info',
        message: `Bot detection: ${result.isBot ? 'Bot' : 'Human'} (${result.botType}, ${result.confidence}% confidence)`,
        data: {
          detectionResult: result,
          request: {
            userAgent: request.userAgent,
            ip: request.ip,
            method: request.method,
            path: request.path,
            referer: request.referer
          }
        },
        ip: request.ip
      });
    } catch (error) {
      console.error('❌ Failed to log bot detection:', error);
    }
  }

  // Rule Management Methods
  async addBotRule(rule: Omit<BotRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<BotRule> {
    const newRule: BotRule = {
      ...rule,
      id: new Date().toISOString(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.botRules.push(newRule);
    this.lastRulesUpdate = new Date();

    // In a real implementation, save to MongoDB
    await this.mongoStorage.logAudit({
      action: 'bot_rule_created',
      category: 'system',
      level: 'info',
      message: `Bot rule created: ${newRule.name}`,
      data: { rule: newRule }
    });

    return newRule;
  }

  async updateBotRule(id: string, updates: Partial<BotRule>): Promise<boolean> {
    const ruleIndex = this.botRules.findIndex(rule => rule.id === id);
    if (ruleIndex === -1) {
      return false;
    }

    this.botRules[ruleIndex] = {
      ...this.botRules[ruleIndex],
      ...updates,
      updatedAt: new Date()
    };

    this.lastRulesUpdate = new Date();

    await this.mongoStorage.logAudit({
      action: 'bot_rule_updated',
      category: 'system',
      level: 'info',
      message: `Bot rule updated: ${this.botRules[ruleIndex].name}`,
      data: { id, updates }
    });

    return true;
  }

  async deleteBotRule(id: string): Promise<boolean> {
    const ruleIndex = this.botRules.findIndex(rule => rule.id === id);
    if (ruleIndex === -1) {
      return false;
    }

    const deletedRule = this.botRules[ruleIndex];
    this.botRules.splice(ruleIndex, 1);

    await this.mongoStorage.logAudit({
      action: 'bot_rule_deleted',
      category: 'system',
      level: 'warning',
      message: `Bot rule deleted: ${deletedRule.name}`,
      data: { deletedRule }
    });

    return true;
  }

  async getBotRules(): Promise<BotRule[]> {
    return [...this.botRules];
  }

  async getBotRule(id: string): Promise<BotRule | undefined> {
    return this.botRules.find(rule => rule.id === id);
  }

  async toggleBotRule(id: string): Promise<boolean> {
    const rule = await this.getBotRule(id);
    if (!rule) {
      return false;
    }

    return await this.updateBotRule(id, { enabled: !rule.enabled });
  }

  async clearIPReputationCache(): Promise<void> {
    this.ipReputationCache.clear();
  }

  async getStatistics(): Promise<any> {
    return {
      totalRules: this.botRules.length,
      enabledRules: this.botRules.filter(rule => rule.enabled).length,
      rulesByType: this.botRules.reduce((acc, rule) => {
        acc[rule.type] = (acc[rule.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      rulesByAction: this.botRules.reduce((acc, rule) => {
        acc[rule.action] = (acc[rule.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      rulesByBotType: this.botRules.reduce((acc, rule) => {
        const type = rule.botType || 'unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      ipReputationCacheSize: this.ipReputationCache.size,
      lastRulesUpdate: this.lastRulesUpdate
    };
  }
}