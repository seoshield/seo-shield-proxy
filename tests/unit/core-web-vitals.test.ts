/**
 * Core Web Vitals Tests
 * Tests for Core Web Vitals collector
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('../../src/utils/logger', () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

describe('CoreWebVitalsCollector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Module Import', () => {
    it('should import CoreWebVitalsCollector', async () => {
      const module = await import('../../src/admin/core-web-vitals');
      expect(module.CoreWebVitalsCollector).toBeDefined();
    });

    it('should import getCoreWebVitalsCollector', async () => {
      const module = await import('../../src/admin/core-web-vitals');
      expect(module.getCoreWebVitalsCollector).toBeDefined();
    });
  });

  describe('Initialization', () => {
    it('should create collector with default config', async () => {
      const { CoreWebVitalsCollector } = await import('../../src/admin/core-web-vitals');
      const collector = new CoreWebVitalsCollector();

      expect(collector).toBeDefined();
    });

    it('should create collector with custom config', async () => {
      const { CoreWebVitalsCollector } = await import('../../src/admin/core-web-vitals');
      const collector = new CoreWebVitalsCollector({
        enabled: true,
        timeout: 5000,
        collectLCP: true,
        collectFID: false,
      });

      expect(collector).toBeDefined();
      const config = collector.getConfig();
      expect(config.timeout).toBe(5000);
      expect(config.collectFID).toBe(false);
    });
  });

  describe('Default Configuration', () => {
    it('should provide default configuration', async () => {
      const { CoreWebVitalsCollector } = await import('../../src/admin/core-web-vitals');
      const config = CoreWebVitalsCollector.getDefaultConfig();

      expect(config.enabled).toBe(true);
      expect(config.timeout).toBe(10000);
      expect(config.injectLibrary).toBe(true);
      expect(config.collectLCP).toBe(true);
      expect(config.collectFID).toBe(true);
      expect(config.collectCLS).toBe(true);
      expect(config.collectTTFB).toBe(true);
      expect(config.collectFCP).toBe(true);
      expect(config.collectINP).toBe(true);
    });
  });

  describe('Score Calculation', () => {
    it('should calculate good LCP score', async () => {
      const { CoreWebVitalsCollector } = await import('../../src/admin/core-web-vitals');
      const collector = new CoreWebVitalsCollector();

      const metrics = {
        lcp: 2000,
        fid: 50,
        cls: 0.05,
        ttfb: 500,
        fcp: 1500,
        inp: 150,
        scores: { lcp: 'good' as const, fid: 'good' as const, cls: 'good' as const },
      };

      // Access the private method through prototype or test via public methods
      const score = collector.getOverallScore(metrics);
      expect(score).toBe(100);
    });

    it('should calculate poor LCP score', async () => {
      const { CoreWebVitalsCollector } = await import('../../src/admin/core-web-vitals');
      const collector = new CoreWebVitalsCollector();

      const metrics = {
        lcp: 5000,
        fid: 50,
        cls: 0.05,
        ttfb: 500,
        fcp: 1500,
        inp: 150,
        scores: { lcp: 'poor' as const, fid: 'good' as const, cls: 'good' as const },
      };

      const score = collector.getOverallScore(metrics);
      expect(score).toBe(65); // 100 - 35 for poor LCP
    });

    it('should calculate needs-improvement scores', async () => {
      const { CoreWebVitalsCollector } = await import('../../src/admin/core-web-vitals');
      const collector = new CoreWebVitalsCollector();

      const metrics = {
        lcp: 3000,
        fid: 200,
        cls: 0.15,
        ttfb: 1000,
        fcp: 2500,
        inp: 300,
        scores: {
          lcp: 'needs-improvement' as const,
          fid: 'needs-improvement' as const,
          cls: 'needs-improvement' as const,
        },
      };

      const score = collector.getOverallScore(metrics);
      expect(score).toBe(67); // 100 - 12 - 8 - 13
    });
  });

  describe('Assessment', () => {
    it('should pass assessment with good scores', async () => {
      const { CoreWebVitalsCollector } = await import('../../src/admin/core-web-vitals');
      const collector = new CoreWebVitalsCollector();

      const metrics = {
        lcp: 2000,
        fid: 50,
        cls: 0.05,
        ttfb: 500,
        fcp: 1500,
        inp: 150,
        scores: { lcp: 'good' as const, fid: 'good' as const, cls: 'good' as const },
      };

      expect(collector.passesAssessment(metrics)).toBe(true);
    });

    it('should fail assessment with poor LCP', async () => {
      const { CoreWebVitalsCollector } = await import('../../src/admin/core-web-vitals');
      const collector = new CoreWebVitalsCollector();

      const metrics = {
        lcp: 5000,
        fid: 50,
        cls: 0.05,
        ttfb: 500,
        fcp: 1500,
        inp: 150,
        scores: { lcp: 'poor' as const, fid: 'good' as const, cls: 'good' as const },
      };

      expect(collector.passesAssessment(metrics)).toBe(false);
    });

    it('should fail assessment with poor CLS', async () => {
      const { CoreWebVitalsCollector } = await import('../../src/admin/core-web-vitals');
      const collector = new CoreWebVitalsCollector();

      const metrics = {
        lcp: 2000,
        fid: 50,
        cls: 0.5,
        ttfb: 500,
        fcp: 1500,
        inp: 150,
        scores: { lcp: 'good' as const, fid: 'good' as const, cls: 'poor' as const },
      };

      expect(collector.passesAssessment(metrics)).toBe(false);
    });
  });

  describe('Report Generation', () => {
    it('should generate human-readable report', async () => {
      const { CoreWebVitalsCollector } = await import('../../src/admin/core-web-vitals');
      const collector = new CoreWebVitalsCollector();

      const metrics = {
        lcp: 2000,
        fid: 50,
        cls: 0.05,
        ttfb: 500,
        fcp: 1500,
        inp: 150,
        scores: { lcp: 'good' as const, fid: 'good' as const, cls: 'good' as const, inp: 'good' as const },
      };

      const report = collector.getReport(metrics);

      expect(report).toContain('Core Web Vitals Report');
      expect(report).toContain('LCP');
      expect(report).toContain('FID');
      expect(report).toContain('CLS');
      expect(report).toContain('TTFB');
      expect(report).toContain('FCP');
      expect(report).toContain('INP');
      expect(report).toContain('2000ms');
      expect(report).toContain('[good]');
    });
  });

  describe('Recommendations', () => {
    it('should return positive message for good scores', async () => {
      const { CoreWebVitalsCollector } = await import('../../src/admin/core-web-vitals');
      const collector = new CoreWebVitalsCollector();

      const metrics = {
        lcp: 2000,
        fid: 50,
        cls: 0.05,
        ttfb: 500,
        fcp: 1500,
        inp: 150,
        scores: { lcp: 'good' as const, fid: 'good' as const, cls: 'good' as const },
      };

      const recommendations = collector.getRecommendations(metrics);
      expect(recommendations).toContain('All Core Web Vitals are in good range!');
    });

    it('should recommend LCP improvements for poor LCP', async () => {
      const { CoreWebVitalsCollector } = await import('../../src/admin/core-web-vitals');
      const collector = new CoreWebVitalsCollector();

      const metrics = {
        lcp: 5000,
        fid: 50,
        cls: 0.05,
        ttfb: 500,
        fcp: 1500,
        inp: 150,
        scores: { lcp: 'poor' as const, fid: 'good' as const, cls: 'good' as const },
      };

      const recommendations = collector.getRecommendations(metrics);
      expect(recommendations.some((r) => r.includes('LCP is poor'))).toBe(true);
      expect(recommendations.some((r) => r.includes('Optimize server response time'))).toBe(true);
    });

    it('should recommend CLS improvements for poor CLS', async () => {
      const { CoreWebVitalsCollector } = await import('../../src/admin/core-web-vitals');
      const collector = new CoreWebVitalsCollector();

      const metrics = {
        lcp: 2000,
        fid: 50,
        cls: 0.5,
        ttfb: 500,
        fcp: 1500,
        inp: 150,
        scores: { lcp: 'good' as const, fid: 'good' as const, cls: 'poor' as const },
      };

      const recommendations = collector.getRecommendations(metrics);
      expect(recommendations.some((r) => r.includes('CLS is poor'))).toBe(true);
      expect(recommendations.some((r) => r.toLowerCase().includes('layout'))).toBe(true);
    });

    it('should recommend FID improvements for poor FID', async () => {
      const { CoreWebVitalsCollector } = await import('../../src/admin/core-web-vitals');
      const collector = new CoreWebVitalsCollector();

      const metrics = {
        lcp: 2000,
        fid: 500,
        cls: 0.05,
        ttfb: 500,
        fcp: 1500,
        inp: 150,
        scores: { lcp: 'good' as const, fid: 'poor' as const, cls: 'good' as const },
      };

      const recommendations = collector.getRecommendations(metrics);
      expect(recommendations.some((r) => r.includes('FID is poor'))).toBe(true);
    });

    it('should recommend TTFB improvements for high TTFB', async () => {
      const { CoreWebVitalsCollector } = await import('../../src/admin/core-web-vitals');
      const collector = new CoreWebVitalsCollector();

      const metrics = {
        lcp: 2000,
        fid: 50,
        cls: 0.05,
        ttfb: 2000,
        fcp: 1500,
        inp: 150,
        scores: { lcp: 'good' as const, fid: 'good' as const, cls: 'good' as const },
      };

      const recommendations = collector.getRecommendations(metrics);
      expect(recommendations.some((r) => r.includes('TTFB is high'))).toBe(true);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration', async () => {
      const { CoreWebVitalsCollector } = await import('../../src/admin/core-web-vitals');
      const collector = new CoreWebVitalsCollector();

      collector.updateConfig({ timeout: 5000, collectINP: false });

      const config = collector.getConfig();
      expect(config.timeout).toBe(5000);
      expect(config.collectINP).toBe(false);
    });
  });

  describe('Singleton Instance', () => {
    it('should return singleton instance', async () => {
      const { getCoreWebVitalsCollector } = await import('../../src/admin/core-web-vitals');

      const collector1 = getCoreWebVitalsCollector();
      const collector2 = getCoreWebVitalsCollector();

      expect(collector1).toBeDefined();
      expect(collector2).toBeDefined();
    });
  });
});

describe('Core Web Vitals Types', () => {
  it('should export CWV_THRESHOLDS', async () => {
    const { CWV_THRESHOLDS } = await import('../../src/types/seo.types');

    expect(CWV_THRESHOLDS.lcp.good).toBe(2500);
    expect(CWV_THRESHOLDS.lcp.needsImprovement).toBe(4000);
    expect(CWV_THRESHOLDS.fid.good).toBe(100);
    expect(CWV_THRESHOLDS.fid.needsImprovement).toBe(300);
    expect(CWV_THRESHOLDS.cls.good).toBe(0.1);
    expect(CWV_THRESHOLDS.cls.needsImprovement).toBe(0.25);
  });

  it('should export DEFAULT_CWV_CONFIG', async () => {
    const { DEFAULT_CWV_CONFIG } = await import('../../src/types/seo.types');

    expect(DEFAULT_CWV_CONFIG.enabled).toBe(true);
    expect(DEFAULT_CWV_CONFIG.timeout).toBe(10000);
  });
});
