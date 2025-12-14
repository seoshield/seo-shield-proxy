/**
 * IP Reputation Service
 * Provides IP reputation checking with multiple provider support,
 * caching, and fallback mechanisms.
 */

import { Logger } from '../utils/logger';

const logger = new Logger('IPReputation');

/**
 * IP Reputation result from checking an IP address
 */
export interface IPReputationResult {
  ip: string;
  isProxy: boolean;
  isVPN: boolean;
  isDatacenter: boolean;
  isTor: boolean;
  isHosting: boolean;
  cloudProvider?: string;
  abuseScore: number; // 0-100
  country?: string;
  city?: string;
  region?: string;
  asn?: string;
  isp?: string;
  organization?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  cached: boolean;
  checkedAt: Date;
}

/**
 * IP Reputation provider configuration
 */
export interface IPReputationProviderConfig {
  enabled: boolean;
  apiKey?: string;
  rateLimit?: number; // requests per day
  timeout?: number; // milliseconds
}

/**
 * IP Reputation service configuration
 */
export interface IPReputationConfig {
  enabled: boolean;
  providers: {
    ipinfo?: IPReputationProviderConfig;
    abuseipdb?: IPReputationProviderConfig;
    ipapi?: IPReputationProviderConfig;
  };
  cache: {
    enabled: boolean;
    ttl: number; // seconds
    maxSize: number;
  };
  fallbackOnError: boolean;
  defaultRiskLevel: 'low' | 'medium' | 'high';
}

/**
 * Provider interface for IP reputation checks
 */
export interface IPReputationProvider {
  name: string;
  check(ip: string): Promise<Partial<IPReputationResult>>;
  isAvailable(): boolean;
}

/**
 * IP Info provider (ipinfo.io)
 */
export class IPInfoProvider implements IPReputationProvider {
  name = 'ipinfo';
  private apiKey?: string;
  private timeout: number;
  private requestCount = 0;
  private lastReset = Date.now();
  private rateLimit: number;

  constructor(config: IPReputationProviderConfig) {
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 5000;
    this.rateLimit = config.rateLimit || 50000; // 50k/month free tier
  }

  isAvailable(): boolean {
    // Reset daily counter
    const now = Date.now();
    if (now - this.lastReset > 24 * 60 * 60 * 1000) {
      this.requestCount = 0;
      this.lastReset = now;
    }
    return this.requestCount < this.rateLimit / 30; // Daily limit
  }

  async check(ip: string): Promise<Partial<IPReputationResult>> {
    if (!this.isAvailable()) {
      throw new Error('IPInfo rate limit exceeded');
    }

    this.requestCount++;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const url = this.apiKey
        ? `https://ipinfo.io/${ip}?token=${this.apiKey}`
        : `https://ipinfo.io/${ip}/json`;

      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`IPInfo API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        ip,
        country: data.country,
        city: data.city,
        region: data.region,
        asn: data.org?.split(' ')[0],
        isp: data.org?.split(' ').slice(1).join(' '),
        organization: data.org,
        isProxy: data.privacy?.proxy || false,
        isVPN: data.privacy?.vpn || false,
        isDatacenter: data.privacy?.hosting || false,
        isTor: data.privacy?.tor || false,
        isHosting: data.privacy?.hosting || false,
        source: 'ipinfo',
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

/**
 * AbuseIPDB provider
 */
export class AbuseIPDBProvider implements IPReputationProvider {
  name = 'abuseipdb';
  private apiKey: string;
  private timeout: number;
  private requestCount = 0;
  private lastReset = Date.now();
  private rateLimit: number;

  constructor(config: IPReputationProviderConfig) {
    if (!config.apiKey) {
      throw new Error('AbuseIPDB requires an API key');
    }
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 5000;
    this.rateLimit = config.rateLimit || 1000; // 1k/day free tier
  }

  isAvailable(): boolean {
    const now = Date.now();
    if (now - this.lastReset > 24 * 60 * 60 * 1000) {
      this.requestCount = 0;
      this.lastReset = now;
    }
    return this.requestCount < this.rateLimit;
  }

  async check(ip: string): Promise<Partial<IPReputationResult>> {
    if (!this.isAvailable()) {
      throw new Error('AbuseIPDB rate limit exceeded');
    }

    this.requestCount++;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(
        `https://api.abuseipdb.com/api/v2/check?ipAddress=${ip}&maxAgeInDays=90`,
        {
          signal: controller.signal,
          headers: {
            Key: this.apiKey,
            Accept: 'application/json',
          },
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`AbuseIPDB API error: ${response.status}`);
      }

      const data = await response.json();
      const abuseData = data.data;

      return {
        ip,
        abuseScore: abuseData.abuseConfidenceScore || 0,
        isTor: abuseData.isTor || false,
        isHosting: abuseData.usageType === 'Data Center/Web Hosting/Transit',
        country: abuseData.countryCode,
        isp: abuseData.isp,
        source: 'abuseipdb',
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

/**
 * IP-API provider (free, non-commercial)
 */
export class IPAPIProvider implements IPReputationProvider {
  name = 'ipapi';
  private timeout: number;
  private requestCount = 0;
  private lastMinuteReset = Date.now();
  private rateLimit: number;

  constructor(config: IPReputationProviderConfig) {
    this.timeout = config.timeout || 5000;
    this.rateLimit = config.rateLimit || 45; // 45 requests/minute for free tier
  }

  isAvailable(): boolean {
    const now = Date.now();
    if (now - this.lastMinuteReset > 60 * 1000) {
      this.requestCount = 0;
      this.lastMinuteReset = now;
    }
    return this.requestCount < this.rateLimit;
  }

  async check(ip: string): Promise<Partial<IPReputationResult>> {
    if (!this.isAvailable()) {
      throw new Error('IP-API rate limit exceeded');
    }

    this.requestCount++;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(
        `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,region,regionName,city,isp,org,as,hosting,proxy`,
        { signal: controller.signal }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`IP-API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'success') {
        throw new Error(`IP-API error: ${data.message}`);
      }

      return {
        ip,
        country: data.countryCode,
        city: data.city,
        region: data.regionName,
        asn: data.as?.split(' ')[0],
        isp: data.isp,
        organization: data.org,
        isProxy: data.proxy || false,
        isHosting: data.hosting || false,
        isDatacenter: data.hosting || false,
        source: 'ipapi',
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
}

/**
 * Simple in-memory cache for IP reputation results
 */
class IPReputationCache {
  private cache = new Map<string, { result: IPReputationResult; expiresAt: number }>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number, ttlSeconds: number) {
    this.maxSize = maxSize;
    this.ttl = ttlSeconds * 1000;
  }

  get(ip: string): IPReputationResult | null {
    const entry = this.cache.get(ip);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(ip);
      return null;
    }

    return { ...entry.result, cached: true };
  }

  set(ip: string, result: IPReputationResult): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(ip, {
      result: { ...result, cached: false },
      expiresAt: Date.now() + this.ttl,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Main IP Reputation Service
 */
export class IPReputationService {
  private config: IPReputationConfig;
  private providers: IPReputationProvider[] = [];
  private cache: IPReputationCache;

  constructor(config: IPReputationConfig) {
    this.config = config;
    this.cache = new IPReputationCache(
      config.cache.maxSize || 10000,
      config.cache.ttl || 3600
    );
    this.initProviders();
  }

  private initProviders(): void {
    const { providers } = this.config;

    // Initialize IP-API provider (free, no key needed)
    if (providers.ipapi?.enabled) {
      try {
        this.providers.push(new IPAPIProvider(providers.ipapi));
        logger.info('IP-API provider initialized');
      } catch (error) {
        logger.warn('Failed to initialize IP-API provider:', error);
      }
    }

    // Initialize IPInfo provider
    if (providers.ipinfo?.enabled) {
      try {
        this.providers.push(new IPInfoProvider(providers.ipinfo));
        logger.info('IPInfo provider initialized');
      } catch (error) {
        logger.warn('Failed to initialize IPInfo provider:', error);
      }
    }

    // Initialize AbuseIPDB provider
    if (providers.abuseipdb?.enabled && providers.abuseipdb.apiKey) {
      try {
        this.providers.push(new AbuseIPDBProvider(providers.abuseipdb));
        logger.info('AbuseIPDB provider initialized');
      } catch (error) {
        logger.warn('Failed to initialize AbuseIPDB provider:', error);
      }
    }

    logger.info(`IP Reputation service initialized with ${this.providers.length} providers`);
  }

  /**
   * Check IP reputation
   */
  async check(ip: string): Promise<IPReputationResult> {
    // Validate IP format
    if (!this.isValidIP(ip)) {
      return this.createDefaultResult(ip, 'invalid_ip');
    }

    // Check cache first
    if (this.config.cache.enabled) {
      const cached = this.cache.get(ip);
      if (cached) {
        logger.debug(`IP reputation cache hit for ${ip}`);
        return cached;
      }
    }

    // Check if it's a private IP
    if (this.isPrivateIP(ip)) {
      const result = this.createDefaultResult(ip, 'private_ip');
      result.riskLevel = 'low';
      if (this.config.cache.enabled) {
        this.cache.set(ip, result);
      }
      return result;
    }

    // Query providers
    const results = await this.queryProviders(ip);
    const aggregated = this.aggregateResults(ip, results);

    // Cache result
    if (this.config.cache.enabled) {
      this.cache.set(ip, aggregated);
    }

    return aggregated;
  }

  /**
   * Query all available providers
   */
  private async queryProviders(ip: string): Promise<Partial<IPReputationResult>[]> {
    const results: Partial<IPReputationResult>[] = [];

    for (const provider of this.providers) {
      if (!provider.isAvailable()) {
        logger.debug(`Provider ${provider.name} not available, skipping`);
        continue;
      }

      try {
        const result = await provider.check(ip);
        results.push(result);
        logger.debug(`Provider ${provider.name} returned result for ${ip}`);
      } catch (error) {
        logger.warn(`Provider ${provider.name} failed for ${ip}:`, error);
      }
    }

    return results;
  }

  /**
   * Aggregate results from multiple providers
   */
  private aggregateResults(ip: string, results: Partial<IPReputationResult>[]): IPReputationResult {
    if (results.length === 0) {
      return this.createDefaultResult(ip, 'no_providers');
    }

    const aggregated: IPReputationResult = {
      ip,
      isProxy: results.some((r) => r.isProxy),
      isVPN: results.some((r) => r.isVPN),
      isDatacenter: results.some((r) => r.isDatacenter),
      isTor: results.some((r) => r.isTor),
      isHosting: results.some((r) => r.isHosting),
      cloudProvider: results.find((r) => r.cloudProvider)?.cloudProvider,
      abuseScore: Math.max(...results.map((r) => r.abuseScore || 0)),
      country: results.find((r) => r.country)?.country,
      city: results.find((r) => r.city)?.city,
      region: results.find((r) => r.region)?.region,
      asn: results.find((r) => r.asn)?.asn,
      isp: results.find((r) => r.isp)?.isp,
      organization: results.find((r) => r.organization)?.organization,
      riskLevel: 'low',
      source: results.map((r) => r.source).filter(Boolean).join(','),
      cached: false,
      checkedAt: new Date(),
    };

    // Calculate risk level
    aggregated.riskLevel = this.calculateRiskLevel(aggregated);

    return aggregated;
  }

  /**
   * Calculate risk level based on reputation data
   */
  private calculateRiskLevel(result: IPReputationResult): 'low' | 'medium' | 'high' | 'critical' {
    let riskScore = 0;

    // Abuse score contribution (0-50 points)
    riskScore += Math.min(result.abuseScore / 2, 50);

    // Proxy indicators
    if (result.isTor) riskScore += 30;
    if (result.isVPN) riskScore += 15;
    if (result.isProxy) riskScore += 20;

    // Datacenter/Hosting indicators
    if (result.isDatacenter) riskScore += 10;
    if (result.isHosting) riskScore += 10;

    // Determine level
    if (riskScore >= 70) return 'critical';
    if (riskScore >= 50) return 'high';
    if (riskScore >= 25) return 'medium';
    return 'low';
  }

  /**
   * Create default result for edge cases
   */
  private createDefaultResult(ip: string, source: string): IPReputationResult {
    return {
      ip,
      isProxy: false,
      isVPN: false,
      isDatacenter: false,
      isTor: false,
      isHosting: false,
      abuseScore: 0,
      riskLevel: this.config.defaultRiskLevel || 'low',
      source,
      cached: false,
      checkedAt: new Date(),
    };
  }

  /**
   * Validate IP address format
   */
  private isValidIP(ip: string): boolean {
    // IPv4 pattern
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    // IPv6 pattern (simplified)
    const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

    if (ipv4Pattern.test(ip)) {
      const parts = ip.split('.').map(Number);
      return parts.every((part) => part >= 0 && part <= 255);
    }

    return ipv6Pattern.test(ip) || ip === '::1';
  }

  /**
   * Check if IP is private/internal
   */
  private isPrivateIP(ip: string): boolean {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^::1$/,
      /^fe80:/i,
      /^fc00:/i,
      /^fd00:/i,
    ];

    return privateRanges.some((range) => range.test(ip));
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('IP reputation cache cleared');
  }

  /**
   * Get service statistics
   */
  getStats(): {
    providers: number;
    cacheSize: number;
    cacheEnabled: boolean;
  } {
    return {
      providers: this.providers.length,
      cacheSize: this.cache.size(),
      cacheEnabled: this.config.cache.enabled,
    };
  }

  /**
   * Get default configuration
   */
  static getDefaultConfig(): IPReputationConfig {
    return {
      enabled: true,
      providers: {
        ipapi: {
          enabled: true,
          timeout: 5000,
          rateLimit: 45,
        },
        ipinfo: {
          enabled: false,
          apiKey: process.env.IPINFO_API_KEY,
          timeout: 5000,
          rateLimit: 50000,
        },
        abuseipdb: {
          enabled: false,
          apiKey: process.env.ABUSEIPDB_API_KEY,
          timeout: 5000,
          rateLimit: 1000,
        },
      },
      cache: {
        enabled: true,
        ttl: 3600,
        maxSize: 10000,
      },
      fallbackOnError: true,
      defaultRiskLevel: 'low',
    };
  }
}
