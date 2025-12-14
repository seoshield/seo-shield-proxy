/**
 * Core Web Vitals Collector
 * Collects LCP, FID, CLS, TTFB, FCP, and INP metrics from pages
 */

import { Page } from 'puppeteer';
import { Logger } from '../utils/logger';
import {
  CoreWebVitals,
  CoreWebVitalsConfig,
  DEFAULT_CWV_CONFIG,
  CWV_THRESHOLDS,
} from '../types/seo.types';

const logger = new Logger('CoreWebVitals');

/**
 * Core Web Vitals Collector
 * Uses web-vitals library or Performance API to collect metrics
 */
export class CoreWebVitalsCollector {
  private config: CoreWebVitalsConfig;

  constructor(config: Partial<CoreWebVitalsConfig> = {}) {
    this.config = { ...DEFAULT_CWV_CONFIG, ...config };
  }

  /**
   * Collect Core Web Vitals from a page
   */
  async collect(page: Page): Promise<CoreWebVitals> {
    if (!this.config.enabled) {
      return this.getEmptyMetrics();
    }

    const startTime = Date.now();

    try {
      // Try to collect metrics using Performance API first
      const metrics = await this.collectFromPerformanceAPI(page);

      // If library injection is enabled and we're missing metrics, try web-vitals
      if (this.config.injectLibrary && this.hasMissingMetrics(metrics)) {
        const libraryMetrics = await this.collectWithWebVitalsLibrary(page);
        // Merge metrics, preferring non-zero values
        Object.keys(libraryMetrics).forEach((key) => {
          const k = key as keyof CoreWebVitals;
          if (k !== 'scores' && (metrics[k] === 0 || metrics[k] === undefined)) {
            (metrics as unknown as Record<string, unknown>)[k] = libraryMetrics[k];
          }
        });
      }

      // Calculate scores
      metrics.scores = this.calculateScores(metrics);

      const duration = Date.now() - startTime;
      logger.debug(`Core Web Vitals collected in ${duration}ms`, {
        lcp: metrics.lcp,
        fid: metrics.fid,
        cls: metrics.cls,
      });

      return metrics;
    } catch (error) {
      logger.warn('Failed to collect Core Web Vitals:', error);
      return this.getEmptyMetrics();
    }
  }

  /**
   * Collect metrics using Performance API
   */
  private async collectFromPerformanceAPI(page: Page): Promise<CoreWebVitals> {
    return page.evaluate(() => {
      const metrics: Partial<CoreWebVitals> = {
        lcp: 0,
        fid: 0,
        cls: 0,
        ttfb: 0,
        fcp: 0,
        inp: 0,
      };

      // Get navigation timing for TTFB
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        metrics.ttfb = navigation.responseStart - navigation.requestStart;
      }

      // Get paint timing for FCP
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find((e) => e.name === 'first-contentful-paint');
      if (fcpEntry) {
        metrics.fcp = fcpEntry.startTime;
      }

      // Get LCP from largest-contentful-paint entries
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      if (lcpEntries.length > 0) {
        const lastLCP = lcpEntries[lcpEntries.length - 1] as PerformanceEntry & { startTime: number };
        metrics.lcp = lastLCP.startTime;
      }

      // Get CLS from layout-shift entries
      const layoutShiftEntries = performance.getEntriesByType('layout-shift') as Array<
        PerformanceEntry & { hadRecentInput: boolean; value: number }
      >;
      let clsValue = 0;
      let sessionValue = 0;
      let sessionEntries: typeof layoutShiftEntries = [];

      for (const entry of layoutShiftEntries) {
        if (!entry.hadRecentInput) {
          // Session window: 5 seconds max, 1 second gap max
          const lastEntry = sessionEntries[sessionEntries.length - 1];
          if (
            sessionEntries.length === 0 ||
            (entry.startTime - lastEntry.startTime < 1000 &&
              entry.startTime - sessionEntries[0].startTime < 5000)
          ) {
            sessionEntries.push(entry);
            sessionValue += entry.value;
          } else {
            // New session
            if (sessionValue > clsValue) {
              clsValue = sessionValue;
            }
            sessionEntries = [entry];
            sessionValue = entry.value;
          }
        }
      }
      // Check final session
      if (sessionValue > clsValue) {
        clsValue = sessionValue;
      }
      metrics.cls = clsValue;

      // FID and INP require user interaction - return 0 for SSR context
      metrics.fid = 0;
      metrics.inp = 0;

      return metrics as CoreWebVitals;
    });
  }

  /**
   * Collect metrics using web-vitals library injection
   */
  private async collectWithWebVitalsLibrary(page: Page): Promise<Partial<CoreWebVitals>> {
    try {
      // Inject web-vitals library
      await page.addScriptTag({
        url: 'https://unpkg.com/web-vitals@3/dist/web-vitals.iife.js',
      });

      // Wait a bit for library to initialize
      await page.waitForFunction(() => typeof (window as unknown as { webVitals: unknown }).webVitals !== 'undefined', {
        timeout: 5000,
      });

      // Collect metrics
      const metrics = await page.evaluate(() => {
        return new Promise<Partial<CoreWebVitals>>((resolve) => {
          const vitals: Partial<CoreWebVitals> = {
            lcp: 0,
            fid: 0,
            cls: 0,
            ttfb: 0,
            fcp: 0,
          };

          const wv = (window as unknown as { webVitals: {
            onLCP: (cb: (m: { value: number }) => void) => void;
            onFID: (cb: (m: { value: number }) => void) => void;
            onCLS: (cb: (m: { value: number }) => void) => void;
            onTTFB: (cb: (m: { value: number }) => void) => void;
            onFCP: (cb: (m: { value: number }) => void) => void;
            onINP?: (cb: (m: { value: number }) => void) => void;
          } }).webVitals;

          try {
            wv.onLCP((metric) => {
              vitals.lcp = metric.value;
            });
            wv.onCLS((metric) => {
              vitals.cls = metric.value;
            });
            wv.onTTFB((metric) => {
              vitals.ttfb = metric.value;
            });
            wv.onFCP((metric) => {
              vitals.fcp = metric.value;
            });
            if (wv.onINP) {
              wv.onINP((metric) => {
                vitals.inp = metric.value;
              });
            }
          } catch {
            // Ignore callback errors
          }

          // Wait for metrics to be collected
          setTimeout(() => {
            resolve(vitals);
          }, 3000);
        });
      });

      return metrics;
    } catch (error) {
      logger.debug('web-vitals library injection failed:', error);
      return {};
    }
  }

  /**
   * Check if we have missing metrics
   */
  private hasMissingMetrics(metrics: CoreWebVitals): boolean {
    return metrics.lcp === 0 || metrics.cls === 0 || metrics.ttfb === 0 || metrics.fcp === 0;
  }

  /**
   * Calculate scores based on thresholds
   */
  private calculateScores(metrics: CoreWebVitals): CoreWebVitals['scores'] {
    return {
      lcp: this.getScore(metrics.lcp, CWV_THRESHOLDS.lcp),
      fid: this.getScore(metrics.fid, CWV_THRESHOLDS.fid),
      cls: this.getScore(metrics.cls, CWV_THRESHOLDS.cls),
      inp: metrics.inp !== undefined ? this.getScore(metrics.inp, CWV_THRESHOLDS.inp) : undefined,
    };
  }

  /**
   * Get score category based on value and thresholds
   */
  private getScore(
    value: number,
    thresholds: { good: number; needsImprovement: number }
  ): 'good' | 'needs-improvement' | 'poor' {
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.needsImprovement) return 'needs-improvement';
    return 'poor';
  }

  /**
   * Get empty metrics object
   */
  private getEmptyMetrics(): CoreWebVitals {
    return {
      lcp: 0,
      fid: 0,
      cls: 0,
      ttfb: 0,
      fcp: 0,
      inp: 0,
      scores: {
        lcp: 'good',
        fid: 'good',
        cls: 'good',
        inp: 'good',
      },
    };
  }

  /**
   * Get human-readable report
   */
  getReport(metrics: CoreWebVitals): string {
    const lines = [
      '=== Core Web Vitals Report ===',
      '',
      `LCP (Largest Contentful Paint): ${metrics.lcp.toFixed(0)}ms [${metrics.scores.lcp}]`,
      `FID (First Input Delay): ${metrics.fid.toFixed(0)}ms [${metrics.scores.fid}]`,
      `CLS (Cumulative Layout Shift): ${metrics.cls.toFixed(3)} [${metrics.scores.cls}]`,
      `TTFB (Time to First Byte): ${metrics.ttfb.toFixed(0)}ms`,
      `FCP (First Contentful Paint): ${metrics.fcp.toFixed(0)}ms`,
    ];

    if (metrics.inp !== undefined) {
      lines.push(`INP (Interaction to Next Paint): ${metrics.inp.toFixed(0)}ms [${metrics.scores.inp}]`);
    }

    lines.push('');
    lines.push('Thresholds:');
    lines.push(`  LCP: good <= ${CWV_THRESHOLDS.lcp.good}ms, poor > ${CWV_THRESHOLDS.lcp.needsImprovement}ms`);
    lines.push(`  FID: good <= ${CWV_THRESHOLDS.fid.good}ms, poor > ${CWV_THRESHOLDS.fid.needsImprovement}ms`);
    lines.push(
      `  CLS: good <= ${CWV_THRESHOLDS.cls.good}, poor > ${CWV_THRESHOLDS.cls.needsImprovement}`
    );

    return lines.join('\n');
  }

  /**
   * Check if metrics pass Core Web Vitals assessment
   */
  passesAssessment(metrics: CoreWebVitals): boolean {
    return (
      metrics.scores.lcp !== 'poor' && metrics.scores.fid !== 'poor' && metrics.scores.cls !== 'poor'
    );
  }

  /**
   * Get overall score (0-100)
   */
  getOverallScore(metrics: CoreWebVitals): number {
    let score = 100;

    // LCP scoring (35% weight)
    if (metrics.scores.lcp === 'needs-improvement') score -= 12;
    else if (metrics.scores.lcp === 'poor') score -= 35;

    // FID scoring (25% weight)
    if (metrics.scores.fid === 'needs-improvement') score -= 8;
    else if (metrics.scores.fid === 'poor') score -= 25;

    // CLS scoring (40% weight)
    if (metrics.scores.cls === 'needs-improvement') score -= 13;
    else if (metrics.scores.cls === 'poor') score -= 40;

    return Math.max(0, score);
  }

  /**
   * Get recommendations based on metrics
   */
  getRecommendations(metrics: CoreWebVitals): string[] {
    const recommendations: string[] = [];

    if (metrics.scores.lcp === 'poor') {
      recommendations.push('LCP is poor. Consider optimizing largest content element:');
      recommendations.push('  - Optimize server response time');
      recommendations.push('  - Use CDN for static assets');
      recommendations.push('  - Preload critical resources');
      recommendations.push('  - Optimize images (WebP, lazy loading)');
    } else if (metrics.scores.lcp === 'needs-improvement') {
      recommendations.push('LCP needs improvement. Consider preloading hero images or fonts.');
    }

    if (metrics.scores.fid === 'poor') {
      recommendations.push('FID is poor. Consider optimizing JavaScript:');
      recommendations.push('  - Break up long tasks');
      recommendations.push('  - Use web workers for heavy computation');
      recommendations.push('  - Defer non-critical JavaScript');
    } else if (metrics.scores.fid === 'needs-improvement') {
      recommendations.push('FID needs improvement. Review main thread blocking time.');
    }

    if (metrics.scores.cls === 'poor') {
      recommendations.push('CLS is poor. Layout shifts detected:');
      recommendations.push('  - Set explicit dimensions for images and embeds');
      recommendations.push('  - Reserve space for dynamic content');
      recommendations.push('  - Avoid inserting content above existing content');
      recommendations.push('  - Use transform animations instead of layout-triggering properties');
    } else if (metrics.scores.cls === 'needs-improvement') {
      recommendations.push('CLS needs improvement. Check for unexpected layout shifts.');
    }

    if (metrics.ttfb > CWV_THRESHOLDS.ttfb.needsImprovement) {
      recommendations.push('TTFB is high. Server response time needs optimization:');
      recommendations.push('  - Optimize server-side rendering');
      recommendations.push('  - Use caching (Redis, CDN)');
      recommendations.push('  - Optimize database queries');
    }

    if (recommendations.length === 0) {
      recommendations.push('All Core Web Vitals are in good range!');
    }

    return recommendations;
  }

  /**
   * Get configuration
   */
  getConfig(): CoreWebVitalsConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CoreWebVitalsConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get default configuration
   */
  static getDefaultConfig(): CoreWebVitalsConfig {
    return { ...DEFAULT_CWV_CONFIG };
  }
}

// Export singleton instance
let cwvCollectorInstance: CoreWebVitalsCollector | null = null;

export function getCoreWebVitalsCollector(
  config?: Partial<CoreWebVitalsConfig>
): CoreWebVitalsCollector {
  if (!cwvCollectorInstance) {
    cwvCollectorInstance = new CoreWebVitalsCollector(config);
  }
  return cwvCollectorInstance;
}
