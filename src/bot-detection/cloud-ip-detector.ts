/**
 * Cloud IP Detector
 * Detects if an IP belongs to a cloud provider (AWS, GCP, Azure, etc.)
 */

import { Logger } from '../utils/logger';

const logger = new Logger('CloudIPDetector');

/**
 * IP range entry
 */
export interface IPRange {
  cidr: string;
  region?: string;
  service?: string;
}

/**
 * Cloud IP detection result
 */
export interface CloudIPResult {
  isCloud: boolean;
  provider?: 'AWS' | 'GCP' | 'Azure' | 'DigitalOcean' | 'Oracle' | 'Cloudflare' | 'Other';
  region?: string;
  service?: string;
}

/**
 * Cloud provider configuration
 */
export interface CloudProviderConfig {
  detectAWS: boolean;
  detectGCP: boolean;
  detectAzure: boolean;
  detectDigitalOcean: boolean;
  detectCloudflare: boolean;
  refreshInterval: number; // hours
}

/**
 * Cloud IP Detector
 * Downloads and maintains cloud provider IP ranges for detection
 */
export class CloudIPDetector {
  private awsRanges: IPRange[] = [];
  private gcpRanges: IPRange[] = [];
  private azureRanges: IPRange[] = [];
  private digitalOceanRanges: IPRange[] = [];
  private cloudflareRanges: IPRange[] = [];
  private lastRefresh: Date | null = null;
  private config: CloudProviderConfig;
  private initialized = false;
  private initializing = false;

  constructor(config: Partial<CloudProviderConfig> = {}) {
    this.config = {
      detectAWS: config.detectAWS ?? true,
      detectGCP: config.detectGCP ?? true,
      detectAzure: config.detectAzure ?? true,
      detectDigitalOcean: config.detectDigitalOcean ?? true,
      detectCloudflare: config.detectCloudflare ?? true,
      refreshInterval: config.refreshInterval ?? 24,
    };
  }

  /**
   * Initialize by loading IP ranges
   */
  async initialize(): Promise<void> {
    if (this.initializing) return;
    this.initializing = true;

    try {
      const promises: Promise<void>[] = [];

      if (this.config.detectAWS) {
        promises.push(this.fetchAWSRanges());
      }
      if (this.config.detectGCP) {
        promises.push(this.fetchGCPRanges());
      }
      if (this.config.detectCloudflare) {
        promises.push(this.fetchCloudflareRanges());
      }

      // Azure and DigitalOcean use static ranges for now
      if (this.config.detectAzure) {
        this.loadAzureStaticRanges();
      }
      if (this.config.detectDigitalOcean) {
        this.loadDigitalOceanStaticRanges();
      }

      await Promise.allSettled(promises);

      this.lastRefresh = new Date();
      this.initialized = true;

      const totalRanges =
        this.awsRanges.length +
        this.gcpRanges.length +
        this.azureRanges.length +
        this.digitalOceanRanges.length +
        this.cloudflareRanges.length;

      logger.info(`Cloud IP detector initialized with ${totalRanges} ranges`);
    } catch (error) {
      logger.error('Failed to initialize cloud IP detector:', error);
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Check if refresh is needed
   */
  private needsRefresh(): boolean {
    if (!this.lastRefresh) return true;

    const hoursSinceRefresh = (Date.now() - this.lastRefresh.getTime()) / (1000 * 60 * 60);
    return hoursSinceRefresh >= this.config.refreshInterval;
  }

  /**
   * Fetch AWS IP ranges
   */
  private async fetchAWSRanges(): Promise<void> {
    try {
      const response = await fetch('https://ip-ranges.amazonaws.com/ip-ranges.json', {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`AWS API error: ${response.status}`);
      }

      const data = await response.json();

      this.awsRanges = data.prefixes.map((p: { ip_prefix: string; region: string; service: string }) => ({
        cidr: p.ip_prefix,
        region: p.region,
        service: p.service,
      }));

      logger.debug(`Loaded ${this.awsRanges.length} AWS IP ranges`);
    } catch (error) {
      logger.warn('Failed to fetch AWS IP ranges:', error);
      // Load static fallback
      this.loadAWSStaticRanges();
    }
  }

  /**
   * Fetch GCP IP ranges
   */
  private async fetchGCPRanges(): Promise<void> {
    try {
      // GCP publishes ranges via DNS TXT records, but we'll use their JSON endpoint
      const response = await fetch('https://www.gstatic.com/ipranges/cloud.json', {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`GCP API error: ${response.status}`);
      }

      const data = await response.json();

      this.gcpRanges = data.prefixes
        .filter((p: { ipv4Prefix?: string }) => p.ipv4Prefix)
        .map((p: { ipv4Prefix: string; scope?: string; service?: string }) => ({
          cidr: p.ipv4Prefix,
          region: p.scope,
          service: p.service,
        }));

      logger.debug(`Loaded ${this.gcpRanges.length} GCP IP ranges`);
    } catch (error) {
      logger.warn('Failed to fetch GCP IP ranges:', error);
      this.loadGCPStaticRanges();
    }
  }

  /**
   * Fetch Cloudflare IP ranges
   */
  private async fetchCloudflareRanges(): Promise<void> {
    try {
      const response = await fetch('https://www.cloudflare.com/ips-v4', {
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Cloudflare API error: ${response.status}`);
      }

      const text = await response.text();
      const ranges = text.split('\n').filter((line) => line.trim());

      this.cloudflareRanges = ranges.map((cidr) => ({
        cidr: cidr.trim(),
        service: 'CDN',
      }));

      logger.debug(`Loaded ${this.cloudflareRanges.length} Cloudflare IP ranges`);
    } catch (error) {
      logger.warn('Failed to fetch Cloudflare IP ranges:', error);
      this.loadCloudflareStaticRanges();
    }
  }

  /**
   * Load static AWS ranges as fallback
   */
  private loadAWSStaticRanges(): void {
    // Common AWS IP ranges (subset)
    this.awsRanges = [
      { cidr: '3.0.0.0/8', region: 'global', service: 'EC2' },
      { cidr: '13.0.0.0/8', region: 'global', service: 'EC2' },
      { cidr: '18.0.0.0/8', region: 'global', service: 'EC2' },
      { cidr: '34.192.0.0/10', region: 'us-east-1', service: 'EC2' },
      { cidr: '35.80.0.0/12', region: 'us-west-2', service: 'EC2' },
      { cidr: '52.0.0.0/8', region: 'global', service: 'EC2' },
      { cidr: '54.0.0.0/8', region: 'global', service: 'EC2' },
      { cidr: '99.77.0.0/16', region: 'global', service: 'EC2' },
    ];
  }

  /**
   * Load static GCP ranges
   */
  private loadGCPStaticRanges(): void {
    this.gcpRanges = [
      { cidr: '34.64.0.0/10', region: 'global' },
      { cidr: '34.128.0.0/10', region: 'global' },
      { cidr: '35.184.0.0/13', region: 'global' },
      { cidr: '35.192.0.0/11', region: 'global' },
      { cidr: '104.196.0.0/14', region: 'global' },
      { cidr: '107.167.160.0/19', region: 'global' },
      { cidr: '107.178.192.0/18', region: 'global' },
      { cidr: '130.211.0.0/16', region: 'global' },
      { cidr: '146.148.0.0/17', region: 'global' },
    ];
  }

  /**
   * Load static Azure ranges
   */
  private loadAzureStaticRanges(): void {
    // Azure has many ranges - these are some common ones
    this.azureRanges = [
      { cidr: '13.64.0.0/11', region: 'global' },
      { cidr: '13.96.0.0/13', region: 'global' },
      { cidr: '13.104.0.0/14', region: 'global' },
      { cidr: '20.0.0.0/8', region: 'global' },
      { cidr: '23.96.0.0/13', region: 'global' },
      { cidr: '40.64.0.0/10', region: 'global' },
      { cidr: '51.104.0.0/14', region: 'global' },
      { cidr: '52.96.0.0/12', region: 'global' },
      { cidr: '104.40.0.0/13', region: 'global' },
      { cidr: '137.116.0.0/14', region: 'global' },
      { cidr: '168.61.0.0/16', region: 'global' },
    ];
  }

  /**
   * Load static DigitalOcean ranges
   */
  private loadDigitalOceanStaticRanges(): void {
    this.digitalOceanRanges = [
      { cidr: '45.55.0.0/16', region: 'global' },
      { cidr: '64.225.0.0/16', region: 'global' },
      { cidr: '104.131.0.0/16', region: 'global' },
      { cidr: '104.236.0.0/16', region: 'global' },
      { cidr: '138.68.0.0/16', region: 'global' },
      { cidr: '138.197.0.0/16', region: 'global' },
      { cidr: '142.93.0.0/16', region: 'global' },
      { cidr: '157.230.0.0/16', region: 'global' },
      { cidr: '159.65.0.0/16', region: 'global' },
      { cidr: '159.89.0.0/16', region: 'global' },
      { cidr: '161.35.0.0/16', region: 'global' },
      { cidr: '162.243.0.0/16', region: 'global' },
      { cidr: '165.22.0.0/16', region: 'global' },
      { cidr: '167.99.0.0/16', region: 'global' },
      { cidr: '167.172.0.0/16', region: 'global' },
      { cidr: '178.62.0.0/16', region: 'global' },
      { cidr: '178.128.0.0/16', region: 'global' },
      { cidr: '188.166.0.0/16', region: 'global' },
      { cidr: '206.189.0.0/16', region: 'global' },
      { cidr: '209.97.0.0/16', region: 'global' },
    ];
  }

  /**
   * Load static Cloudflare ranges
   */
  private loadCloudflareStaticRanges(): void {
    this.cloudflareRanges = [
      { cidr: '103.21.244.0/22', service: 'CDN' },
      { cidr: '103.22.200.0/22', service: 'CDN' },
      { cidr: '103.31.4.0/22', service: 'CDN' },
      { cidr: '104.16.0.0/13', service: 'CDN' },
      { cidr: '104.24.0.0/14', service: 'CDN' },
      { cidr: '108.162.192.0/18', service: 'CDN' },
      { cidr: '131.0.72.0/22', service: 'CDN' },
      { cidr: '141.101.64.0/18', service: 'CDN' },
      { cidr: '162.158.0.0/15', service: 'CDN' },
      { cidr: '172.64.0.0/13', service: 'CDN' },
      { cidr: '173.245.48.0/20', service: 'CDN' },
      { cidr: '188.114.96.0/20', service: 'CDN' },
      { cidr: '190.93.240.0/20', service: 'CDN' },
      { cidr: '197.234.240.0/22', service: 'CDN' },
      { cidr: '198.41.128.0/17', service: 'CDN' },
    ];
  }

  /**
   * Check if an IP belongs to a cloud provider
   */
  isCloudIP(ip: string): CloudIPResult {
    // Ensure initialized
    if (!this.initialized && !this.initializing) {
      this.initialize();
    }

    // Check AWS
    for (const range of this.awsRanges) {
      if (this.ipInCIDR(ip, range.cidr)) {
        return {
          isCloud: true,
          provider: 'AWS',
          region: range.region,
          service: range.service,
        };
      }
    }

    // Check GCP
    for (const range of this.gcpRanges) {
      if (this.ipInCIDR(ip, range.cidr)) {
        return {
          isCloud: true,
          provider: 'GCP',
          region: range.region,
          service: range.service,
        };
      }
    }

    // Check Azure
    for (const range of this.azureRanges) {
      if (this.ipInCIDR(ip, range.cidr)) {
        return {
          isCloud: true,
          provider: 'Azure',
          region: range.region,
          service: range.service,
        };
      }
    }

    // Check DigitalOcean
    for (const range of this.digitalOceanRanges) {
      if (this.ipInCIDR(ip, range.cidr)) {
        return {
          isCloud: true,
          provider: 'DigitalOcean',
          region: range.region,
        };
      }
    }

    // Check Cloudflare
    for (const range of this.cloudflareRanges) {
      if (this.ipInCIDR(ip, range.cidr)) {
        return {
          isCloud: true,
          provider: 'Cloudflare',
          service: range.service,
        };
      }
    }

    return { isCloud: false };
  }

  /**
   * Check if IP is in CIDR range
   */
  private ipInCIDR(ip: string, cidr: string): boolean {
    try {
      const [range, bits] = cidr.split('/');
      const mask = parseInt(bits, 10);

      const ipLong = this.ipToLong(ip);
      const rangeLong = this.ipToLong(range);

      if (ipLong === null || rangeLong === null) return false;

      const maskLong = -1 << (32 - mask);

      return (ipLong & maskLong) === (rangeLong & maskLong);
    } catch {
      return false;
    }
  }

  /**
   * Convert IP to 32-bit integer
   */
  private ipToLong(ip: string): number | null {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return null;
    }

    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  }

  /**
   * Refresh IP ranges
   */
  async refresh(): Promise<void> {
    if (this.needsRefresh()) {
      await this.initialize();
    }
  }

  /**
   * Get statistics
   */
  getStats(): {
    initialized: boolean;
    lastRefresh: Date | null;
    ranges: {
      aws: number;
      gcp: number;
      azure: number;
      digitalocean: number;
      cloudflare: number;
    };
  } {
    return {
      initialized: this.initialized,
      lastRefresh: this.lastRefresh,
      ranges: {
        aws: this.awsRanges.length,
        gcp: this.gcpRanges.length,
        azure: this.azureRanges.length,
        digitalocean: this.digitalOceanRanges.length,
        cloudflare: this.cloudflareRanges.length,
      },
    };
  }
}

// Export singleton instance
let cloudIPDetectorInstance: CloudIPDetector | null = null;

export function getCloudIPDetector(config?: Partial<CloudProviderConfig>): CloudIPDetector {
  if (!cloudIPDetectorInstance) {
    cloudIPDetectorInstance = new CloudIPDetector(config);
  }
  return cloudIPDetectorInstance;
}
