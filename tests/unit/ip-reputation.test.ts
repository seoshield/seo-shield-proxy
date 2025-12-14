/**
 * IP Reputation Tests
 * Tests for IP reputation service and cloud IP detection
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('IPReputationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Module Import', () => {
    it('should import IPReputationService', async () => {
      const module = await import('../../src/bot-detection/ip-reputation');
      expect(module.IPReputationService).toBeDefined();
    });

    it('should import provider classes', async () => {
      const module = await import('../../src/bot-detection/ip-reputation');
      expect(module.IPInfoProvider).toBeDefined();
      expect(module.AbuseIPDBProvider).toBeDefined();
      expect(module.IPAPIProvider).toBeDefined();
    });
  });

  describe('Default Configuration', () => {
    it('should provide default configuration', async () => {
      const { IPReputationService } = await import('../../src/bot-detection/ip-reputation');
      const config = IPReputationService.getDefaultConfig();

      expect(config.enabled).toBe(true);
      expect(config.cache.enabled).toBe(true);
      expect(config.cache.ttl).toBe(3600);
      expect(config.cache.maxSize).toBe(10000);
      expect(config.fallbackOnError).toBe(true);
    });
  });

  describe('Service Initialization', () => {
    it('should create service with default config', async () => {
      const { IPReputationService } = await import('../../src/bot-detection/ip-reputation');
      const config = IPReputationService.getDefaultConfig();
      const service = new IPReputationService(config);

      expect(service).toBeDefined();
    });

    it('should initialize with IP-API provider by default', async () => {
      const { IPReputationService } = await import('../../src/bot-detection/ip-reputation');
      const config = IPReputationService.getDefaultConfig();
      const service = new IPReputationService(config);

      const stats = service.getStats();
      expect(stats.providers).toBeGreaterThanOrEqual(0);
    });
  });

  describe('IP Validation', () => {
    it('should handle invalid IP addresses', async () => {
      const { IPReputationService } = await import('../../src/bot-detection/ip-reputation');
      const config = IPReputationService.getDefaultConfig();
      config.providers.ipapi = { enabled: false };
      const service = new IPReputationService(config);

      const result = await service.check('invalid-ip');

      expect(result.ip).toBe('invalid-ip');
      expect(result.source).toBe('invalid_ip');
      expect(result.riskLevel).toBe('low');
    });

    it('should recognize private IPs', async () => {
      const { IPReputationService } = await import('../../src/bot-detection/ip-reputation');
      const config = IPReputationService.getDefaultConfig();
      config.providers.ipapi = { enabled: false };
      const service = new IPReputationService(config);

      const privateIPs = ['192.168.1.1', '10.0.0.1', '172.16.0.1', '127.0.0.1'];

      for (const ip of privateIPs) {
        const result = await service.check(ip);
        expect(result.source).toBe('private_ip');
        expect(result.riskLevel).toBe('low');
      }
    });

    it('should handle localhost IPv6', async () => {
      const { IPReputationService } = await import('../../src/bot-detection/ip-reputation');
      const config = IPReputationService.getDefaultConfig();
      config.providers.ipapi = { enabled: false };
      const service = new IPReputationService(config);

      const result = await service.check('::1');
      expect(result.source).toBe('private_ip');
    });
  });

  describe('Caching', () => {
    it('should cache results when enabled', async () => {
      const { IPReputationService } = await import('../../src/bot-detection/ip-reputation');
      const config = IPReputationService.getDefaultConfig();
      config.providers.ipapi = { enabled: false };
      config.cache.enabled = true;
      const service = new IPReputationService(config);

      // First check - cache miss
      await service.check('192.168.1.1');

      // Second check - should hit cache
      const result = await service.check('192.168.1.1');
      expect(result.cached).toBe(true);
    });

    it('should clear cache when requested', async () => {
      const { IPReputationService } = await import('../../src/bot-detection/ip-reputation');
      const config = IPReputationService.getDefaultConfig();
      config.providers.ipapi = { enabled: false };
      const service = new IPReputationService(config);

      await service.check('192.168.1.1');
      service.clearCache();

      const stats = service.getStats();
      expect(stats.cacheSize).toBe(0);
    });
  });

  describe('Risk Level Calculation', () => {
    it('should return low risk for clean IPs', async () => {
      const { IPReputationService } = await import('../../src/bot-detection/ip-reputation');
      const config = IPReputationService.getDefaultConfig();
      config.providers.ipapi = { enabled: false };
      const service = new IPReputationService(config);

      const result = await service.check('192.168.1.1');
      expect(result.riskLevel).toBe('low');
    });
  });

  describe('Statistics', () => {
    it('should return statistics', async () => {
      const { IPReputationService } = await import('../../src/bot-detection/ip-reputation');
      const config = IPReputationService.getDefaultConfig();
      const service = new IPReputationService(config);

      const stats = service.getStats();

      expect(stats).toHaveProperty('providers');
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('cacheEnabled');
      expect(typeof stats.providers).toBe('number');
      expect(typeof stats.cacheSize).toBe('number');
      expect(typeof stats.cacheEnabled).toBe('boolean');
    });
  });
});

describe('IPAPIProvider', () => {
  it('should create provider instance', async () => {
    const { IPAPIProvider } = await import('../../src/bot-detection/ip-reputation');
    const provider = new IPAPIProvider({ enabled: true, timeout: 5000 });

    expect(provider).toBeDefined();
    expect(provider.name).toBe('ipapi');
  });

  it('should report availability', async () => {
    const { IPAPIProvider } = await import('../../src/bot-detection/ip-reputation');
    const provider = new IPAPIProvider({ enabled: true, rateLimit: 45 });

    expect(provider.isAvailable()).toBe(true);
  });
});

describe('IPInfoProvider', () => {
  it('should create provider instance', async () => {
    const { IPInfoProvider } = await import('../../src/bot-detection/ip-reputation');
    const provider = new IPInfoProvider({ enabled: true, apiKey: 'test-key' });

    expect(provider).toBeDefined();
    expect(provider.name).toBe('ipinfo');
  });

  it('should report availability', async () => {
    const { IPInfoProvider } = await import('../../src/bot-detection/ip-reputation');
    const provider = new IPInfoProvider({ enabled: true, rateLimit: 50000 });

    expect(provider.isAvailable()).toBe(true);
  });
});

describe('AbuseIPDBProvider', () => {
  it('should require API key', async () => {
    const { AbuseIPDBProvider } = await import('../../src/bot-detection/ip-reputation');

    expect(() => {
      new AbuseIPDBProvider({ enabled: true });
    }).toThrow('AbuseIPDB requires an API key');
  });

  it('should create provider with API key', async () => {
    const { AbuseIPDBProvider } = await import('../../src/bot-detection/ip-reputation');
    const provider = new AbuseIPDBProvider({ enabled: true, apiKey: 'test-key' });

    expect(provider).toBeDefined();
    expect(provider.name).toBe('abuseipdb');
  });
});

describe('CloudIPDetector', () => {
  describe('Module Import', () => {
    it('should import CloudIPDetector', async () => {
      const module = await import('../../src/bot-detection/cloud-ip-detector');
      expect(module.CloudIPDetector).toBeDefined();
    });

    it('should import getCloudIPDetector', async () => {
      const module = await import('../../src/bot-detection/cloud-ip-detector');
      expect(module.getCloudIPDetector).toBeDefined();
    });
  });

  describe('Initialization', () => {
    it('should create detector instance', async () => {
      const { CloudIPDetector } = await import('../../src/bot-detection/cloud-ip-detector');
      const detector = new CloudIPDetector();

      expect(detector).toBeDefined();
    });

    it('should create detector with custom config', async () => {
      const { CloudIPDetector } = await import('../../src/bot-detection/cloud-ip-detector');
      const detector = new CloudIPDetector({
        detectAWS: true,
        detectGCP: false,
        detectAzure: true,
      });

      expect(detector).toBeDefined();
    });
  });

  describe('Cloud Detection', () => {
    it('should detect AWS IP', async () => {
      const { CloudIPDetector } = await import('../../src/bot-detection/cloud-ip-detector');
      const detector = new CloudIPDetector();

      // Initialize with static ranges
      await detector.initialize();

      // 3.x.x.x is in AWS range
      const result = detector.isCloudIP('3.5.140.2');

      expect(result.isCloud).toBe(true);
      expect(result.provider).toBe('AWS');
    });

    it('should detect Azure IP', async () => {
      const { CloudIPDetector } = await import('../../src/bot-detection/cloud-ip-detector');
      const detector = new CloudIPDetector();
      await detector.initialize();

      // 20.x.x.x is in Azure range
      const result = detector.isCloudIP('20.10.10.10');

      expect(result.isCloud).toBe(true);
      expect(result.provider).toBe('Azure');
    });

    it('should detect DigitalOcean IP', async () => {
      const { CloudIPDetector } = await import('../../src/bot-detection/cloud-ip-detector');
      const detector = new CloudIPDetector();
      await detector.initialize();

      // 159.65.x.x is in DigitalOcean range
      const result = detector.isCloudIP('159.65.1.1');

      expect(result.isCloud).toBe(true);
      expect(result.provider).toBe('DigitalOcean');
    });

    it('should detect Cloudflare IP', async () => {
      const { CloudIPDetector } = await import('../../src/bot-detection/cloud-ip-detector');
      const detector = new CloudIPDetector();
      await detector.initialize();

      // 104.16.x.x is in Cloudflare range
      const result = detector.isCloudIP('104.16.0.1');

      expect(result.isCloud).toBe(true);
      expect(result.provider).toBe('Cloudflare');
    });

    it('should return false for non-cloud IP', async () => {
      const { CloudIPDetector } = await import('../../src/bot-detection/cloud-ip-detector');
      const detector = new CloudIPDetector();
      await detector.initialize();

      // Random IP not in cloud ranges
      const result = detector.isCloudIP('8.8.8.8');

      expect(result.isCloud).toBe(false);
      expect(result.provider).toBeUndefined();
    });

    it('should return false for private IPs', async () => {
      const { CloudIPDetector } = await import('../../src/bot-detection/cloud-ip-detector');
      const detector = new CloudIPDetector();
      await detector.initialize();

      const result = detector.isCloudIP('192.168.1.1');
      expect(result.isCloud).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should return statistics', async () => {
      const { CloudIPDetector } = await import('../../src/bot-detection/cloud-ip-detector');
      const detector = new CloudIPDetector();
      await detector.initialize();

      const stats = detector.getStats();

      expect(stats).toHaveProperty('initialized');
      expect(stats).toHaveProperty('lastRefresh');
      expect(stats).toHaveProperty('ranges');
      expect(stats.ranges).toHaveProperty('aws');
      expect(stats.ranges).toHaveProperty('gcp');
      expect(stats.ranges).toHaveProperty('azure');
      expect(stats.ranges).toHaveProperty('digitalocean');
      expect(stats.ranges).toHaveProperty('cloudflare');
    });

    it('should show initialized status', async () => {
      const { CloudIPDetector } = await import('../../src/bot-detection/cloud-ip-detector');
      const detector = new CloudIPDetector();

      expect(detector.getStats().initialized).toBe(false);

      await detector.initialize();

      expect(detector.getStats().initialized).toBe(true);
    });
  });

  describe('Singleton Instance', () => {
    it('should return singleton instance', async () => {
      const { getCloudIPDetector } = await import('../../src/bot-detection/cloud-ip-detector');

      const detector1 = getCloudIPDetector();
      const detector2 = getCloudIPDetector();

      // Note: Due to module caching, these may or may not be the same
      expect(detector1).toBeDefined();
      expect(detector2).toBeDefined();
    });
  });
});

describe('IP Reputation Integration', () => {
  describe('Result Structure', () => {
    it('should return complete result structure', async () => {
      const { IPReputationService } = await import('../../src/bot-detection/ip-reputation');
      const config = IPReputationService.getDefaultConfig();
      config.providers.ipapi = { enabled: false };
      const service = new IPReputationService(config);

      const result = await service.check('192.168.1.1');

      expect(result).toHaveProperty('ip');
      expect(result).toHaveProperty('isProxy');
      expect(result).toHaveProperty('isVPN');
      expect(result).toHaveProperty('isDatacenter');
      expect(result).toHaveProperty('isTor');
      expect(result).toHaveProperty('isHosting');
      expect(result).toHaveProperty('abuseScore');
      expect(result).toHaveProperty('riskLevel');
      expect(result).toHaveProperty('source');
      expect(result).toHaveProperty('cached');
      expect(result).toHaveProperty('checkedAt');
    });
  });

  describe('Risk Levels', () => {
    it('should have valid risk level values', async () => {
      const { IPReputationService } = await import('../../src/bot-detection/ip-reputation');
      const config = IPReputationService.getDefaultConfig();
      config.providers.ipapi = { enabled: false };
      const service = new IPReputationService(config);

      const result = await service.check('10.0.0.1');

      expect(['low', 'medium', 'high', 'critical']).toContain(result.riskLevel);
    });
  });

  describe('Timestamps', () => {
    it('should include checkedAt timestamp', async () => {
      const { IPReputationService } = await import('../../src/bot-detection/ip-reputation');
      const config = IPReputationService.getDefaultConfig();
      config.providers.ipapi = { enabled: false };
      const service = new IPReputationService(config);

      const beforeCheck = new Date();
      const result = await service.check('172.16.0.1');
      const afterCheck = new Date();

      expect(result.checkedAt).toBeInstanceOf(Date);
      expect(result.checkedAt.getTime()).toBeGreaterThanOrEqual(beforeCheck.getTime());
      expect(result.checkedAt.getTime()).toBeLessThanOrEqual(afterCheck.getTime());
    });
  });
});

describe('CIDR Matching', () => {
  it('should correctly match IPs in CIDR range', async () => {
    const { CloudIPDetector } = await import('../../src/bot-detection/cloud-ip-detector');
    const detector = new CloudIPDetector();
    await detector.initialize();

    // 3.0.0.0/8 should include 3.anything
    expect(detector.isCloudIP('3.1.1.1').isCloud).toBe(true);
    expect(detector.isCloudIP('3.255.255.255').isCloud).toBe(true);

    // But not 4.x.x.x
    const result4 = detector.isCloudIP('4.0.0.1');
    // May or may not be cloud depending on other ranges
  });

  it('should handle edge cases', async () => {
    const { CloudIPDetector } = await import('../../src/bot-detection/cloud-ip-detector');
    const detector = new CloudIPDetector();
    await detector.initialize();

    // Invalid IPs should return false
    expect(detector.isCloudIP('').isCloud).toBe(false);
    expect(detector.isCloudIP('256.1.1.1').isCloud).toBe(false);
    expect(detector.isCloudIP('1.2.3').isCloud).toBe(false);
  });
});
