/**
 * Visual Snapshot Service
 * Captures and compares screenshots for visual diff analysis
 */

import browserManager from '../browser';
import cache from '../cache';
import { Logger } from '../utils/logger';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

interface SnapshotOptions {
  width?: number;
  height?: number;
  fullPage?: boolean;
  waitFor?: string;
  deviceScaleFactor?: number;
  userAgent?: string;
}

interface SnapshotResult {
  id: string;
  url: string;
  timestamp: Date;
  screenshot: string; // Base64 image
  html: string;
  title: string;
  metaDescription?: string;
  h1?: string;
  canonical?: string;
  robots?: string;
  statusCode?: number;
  dimensions: {
    width: number;
    height: number;
  };
  deviceScaleFactor: number;
  renderTime: number;
  userAgent: string;
}

interface DiffResult {
  id: string;
  url: string;
  beforeId: string;
  afterId: string;
  timestamp: Date;
  diffScore: number; // 0-100, higher = more different
  diffImage: string; // Base64 diff image
  beforeSnapshot: SnapshotResult;
  afterSnapshot: SnapshotResult;
  // Enhanced SEO comparison
  seoComparison: {
    htmlDifferences: {
      titleDiff: boolean;
      metaDescriptionDiff: boolean;
      h1Diff: boolean;
      canonicalDiff: boolean;
      robotsDiff: boolean;
      structuredDataDiff: boolean;
      addedElements: string[];
      removedElements: string[];
    };
    statusDiff: boolean;
    renderTimeDiff: number;
    userAgentDiff: boolean;
  };
  impact: {
    high: string[];
    medium: string[];
    low: string[];
  };
  recommendations: string[];
}

class SnapshotService {
  private logger = new Logger('SnapshotService');
  private snapshotsDir = path.join(process.cwd(), 'snapshots');

  constructor() {
    // Ensure snapshots directory exists
    fs.mkdir(this.snapshotsDir, { recursive: true }).catch(() => {});
  }

  /**
   * Capture a snapshot of a URL
   */
  async captureSnapshot(url: string, options: SnapshotOptions = {}): Promise<SnapshotResult> {
    const snapshotId = `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const defaultOptions: SnapshotOptions = {
      width: 1200,
      height: 800,
      fullPage: true,
      waitFor: 'networkidle2',
      deviceScaleFactor: 1,
    };

    const mergedOptions = { ...defaultOptions, ...options };

    this.logger.info(`Capturing snapshot for ${url} with options:`, mergedOptions);

    try {
      // Use browser manager to get page screenshot and HTML
      const browser = await browserManager.getBrowser();
      const page = await browser.newPage();

      try {
        // Set viewport
        await page.setViewport({
          width: mergedOptions.width || 1200,
          height: mergedOptions.height || 800,
          deviceScaleFactor: mergedOptions.deviceScaleFactor || 1,
        });

        // Set user agent to Googlebot for SEO context
        await page.setUserAgent(
          'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
        );

        const startTime = Date.now();

        // Navigate to URL
        await page.goto(url, {
          waitUntil: mergedOptions.waitFor as any,
          timeout: 30000,
        });

        // Wait for any specific selector if provided
        if (
          mergedOptions.waitFor &&
          !['load', 'domcontentloaded', 'networkidle0', 'networkidle2'].includes(
            mergedOptions.waitFor
          )
        ) {
          try {
            await page.waitForSelector(mergedOptions.waitFor, { timeout: 5000 });
          } catch (_error) {
            this.logger.warn(`Wait selector not found: ${mergedOptions.waitFor}`);
          }
        }

        const renderTime = Date.now() - startTime;

        // Get page title
        const title = await page.title();

        // Get HTML content
        const html = await page.content();

        // Take screenshot
        const screenshot = await page.screenshot({
          fullPage: mergedOptions.fullPage,
          encoding: 'base64',
        });

        const snapshot: SnapshotResult = {
          id: snapshotId,
          url,
          timestamp: new Date(),
          screenshot: `data:image/png;base64,${screenshot}`,
          html,
          title,
          dimensions: {
            width: mergedOptions.width || 1200,
            height: mergedOptions.height || 800,
          },
          deviceScaleFactor: mergedOptions.deviceScaleFactor || 1,
          renderTime,
          userAgent: await page.evaluate(() => navigator.userAgent),
        };

        // Cache the snapshot
        await this.cacheSnapshot(snapshot);

        this.logger.info(`Snapshot captured successfully: ${snapshotId}`);
        return snapshot;
      } finally {
        await page.close();
      }
    } catch (error) {
      this.logger.error(`Failed to capture snapshot for ${url}:`, error);
      throw new Error(`Failed to capture snapshot: ${(error as Error).message}`);
    }
  }

  /**
   * Compare two snapshots
   */
  async compareSnapshots(beforeId: string, afterId: string): Promise<DiffResult> {
    const before = await this.getSnapshot(beforeId);
    const after = await this.getSnapshot(afterId);

    if (!before || !after) {
      throw new Error('One or both snapshots not found');
    }

    if (before.url !== after.url) {
      throw new Error('Snapshots must be from the same URL');
    }

    try {
      // Convert base64 to buffer
      const beforeScreenshotBuffer = Buffer.from(
        before.screenshot.replace(/^data:image\/png;base64,/, ''),
        'base64'
      );
      const afterScreenshotBuffer = Buffer.from(
        after.screenshot.replace(/^data:image\/png;base64,/, ''),
        'base64'
      );

      // Use sharp to compare images
      const beforeImage = sharp(beforeScreenshotBuffer);
      const afterImage = sharp(afterScreenshotBuffer);

      // Get image metadata
      const beforeMeta = await beforeImage.metadata();
      const afterMeta = await afterImage.metadata();

      // Ensure images have same dimensions
      if (beforeMeta.width !== afterMeta.width || beforeMeta.height !== afterMeta.height) {
        throw new Error('Image dimensions do not match');
      }

      // Create diff by processing both images
      const beforeBuffer = await beforeImage.raw().toBuffer();
      const afterBuffer = await afterImage.raw().toBuffer();

      // Create diff data by comparing pixel values
      const diffData = Buffer.alloc(beforeBuffer.length);
      for (let i = 0; i < beforeBuffer.length; i++) {
        diffData[i] = Math.abs(beforeBuffer[i] - afterBuffer[i]);
      }

      const info = {
        width: beforeMeta.width!,
        height: beforeMeta.height!,
        channels: beforeMeta.channels || 3,
      };

      // Calculate diff score (percentage of different pixels)
      let diffPixels = 0;
      const totalPixels = beforeMeta.width! * beforeMeta.height!;
      const channels = info.channels || 3;

      for (let i = 0; i < diffData.length; i += channels) {
        // Calculate channel differences
        let channelDiff = 0;
        for (let j = 0; j < channels; j++) {
          channelDiff += diffData[i + j];
        }
        const avgDiff = channelDiff / channels;
        if (avgDiff > 30) {
          // Threshold for considering pixels different
          diffPixels++;
        }
      }

      const diffScore = Math.round((diffPixels / totalPixels) * 100 * 100) / 100;

      // Create visual diff image
      const diffImage = await sharp(beforeBuffer)
        .composite([
          {
            input: afterBuffer,
            blend: 'difference',
          },
        ])
        .modulate({
          brightness: 1.5,
          saturation: 1.5,
        })
        .png()
        .toBuffer();

      const diffResult: DiffResult = {
        id: `diff_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url: before.url,
        beforeId,
        afterId,
        timestamp: new Date(),
        diffScore,
        diffImage: `data:image/png;base64,${diffImage.toString('base64')}`,
        beforeSnapshot: before,
        afterSnapshot: after,
        seoComparison: {
          htmlDifferences: {
            titleDiff: before.title !== after.title,
            metaDescriptionDiff: before.metaDescription !== after.metaDescription,
            h1Diff: before.h1 !== after.h1,
            canonicalDiff: before.canonical !== after.canonical,
            robotsDiff: before.robots !== after.robots,
            structuredDataDiff: false, // TODO: Implement structured data comparison
            addedElements: [],
            removedElements: [],
          },
          statusDiff: before.statusCode !== after.statusCode,
          renderTimeDiff: after.renderTime - before.renderTime,
          userAgentDiff: false, // TODO: Implement user agent comparison
        },
        impact: {
          high: diffScore > 50 ? ['Significant visual changes detected'] : [],
          medium: diffScore > 20 && diffScore <= 50 ? ['Moderate visual changes'] : [],
          low: diffScore <= 20 ? ['Minor visual differences'] : [],
        },
        recommendations:
          diffScore > 50
            ? ['Review significant visual changes', 'Consider A/B testing']
            : diffScore > 20
              ? ['Monitor changes for impact']
              : ['Changes appear to be minimal'],
      };

      // Cache the diff result
      await this.cacheDiff(diffResult);

      this.logger.info(`Comparison completed: ${diffScore}% difference`);
      return diffResult;
    } catch (error) {
      this.logger.error('Failed to compare snapshots:', error);
      throw new Error(`Failed to compare snapshots: ${(error as Error).message}`);
    }
  }

  /**
   * Get snapshot from cache
   */
  async getSnapshot(id: string): Promise<SnapshotResult | null> {
    try {
      const cached = cache.get(`snapshot:${id}`);
      if (!cached) return null;

      try {
        return JSON.parse(cached) as SnapshotResult;
      } catch (parseError) {
        this.logger.warn(`Failed to parse snapshot data for ID ${id}:`, parseError);
        return null;
      }
    } catch (error) {
      this.logger.warn(`Failed to get snapshot ${id}:`, error);
      return null;
    }
  }

  /**
   * Get diff result from cache
   */
  async getDiff(id: string): Promise<DiffResult | null> {
    try {
      const cached = cache.get(`diff:${id}`);
      if (!cached) return null;

      try {
        return JSON.parse(cached) as DiffResult;
      } catch (parseError) {
        this.logger.warn(`Failed to parse diff data for ID ${id}:`, parseError);
        return null;
      }
    } catch (error) {
      this.logger.warn(`Failed to get diff ${id}:`, error);
      return null;
    }
  }

  /**
   * Get snapshot history for a URL
   */
  async getSnapshotHistory(url: string, limit: number = 10): Promise<SnapshotResult[]> {
    try {
      // This would need a more sophisticated implementation in production
      // For now, we'll search through cache keys that match the URL pattern
      const allEntries = cache.getAllEntries();
      const snapshots: SnapshotResult[] = [];

      for (const entry of allEntries) {
        if (entry.url && entry.url.startsWith('snapshot:')) {
          const value = cache.get(entry.url);
          if (value) {
            try {
              const snapshot = JSON.parse(value) as SnapshotResult;
              if (snapshot.url === url) {
                snapshots.push(snapshot);
              }
            } catch (parseError) {
              this.logger.warn(`Failed to parse snapshot data for key ${entry.url}:`, parseError);
            }
          }
        }
      }

      // Sort by timestamp (newest first) and limit
      return snapshots
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    } catch (error) {
      this.logger.error('Failed to get snapshot history:', error);
      return [];
    }
  }

  /**
   * Delete a snapshot
   */
  async deleteSnapshot(id: string): Promise<boolean> {
    try {
      const deleted = cache.delete(`snapshot:${id}`);
      return deleted > 0;
    } catch (error) {
      this.logger.error(`Failed to delete snapshot ${id}:`, error);
      return false;
    }
  }

  /**
   * Get all snapshots with pagination
   */
  async getAllSnapshots(
    page: number = 1,
    limit: number = 20
  ): Promise<{
    snapshots: SnapshotResult[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const allEntries = cache.getAllEntries();
      const snapshots: SnapshotResult[] = [];

      for (const entry of allEntries) {
        if (entry.url && entry.url.startsWith('snapshot:')) {
          const value = cache.get(entry.url);
          if (value) {
            try {
              const snapshot = JSON.parse(value) as SnapshotResult;
              snapshots.push(snapshot);
            } catch (parseError) {
              this.logger.warn(`Failed to parse snapshot data for key ${entry.url}:`, parseError);
            }
          }
        }
      }

      // Sort by timestamp (newest first)
      snapshots.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const total = snapshots.length;
      const totalPages = Math.ceil(total / limit);
      const start = (page - 1) * limit;
      const end = start + limit;

      return {
        snapshots: snapshots.slice(start, end),
        total,
        page,
        totalPages,
      };
    } catch (error) {
      this.logger.error('Failed to get all snapshots:', error);
      return {
        snapshots: [],
        total: 0,
        page: 1,
        totalPages: 0,
      };
    }
  }

  /**
   * Cache a snapshot
   */
  private async cacheSnapshot(snapshot: SnapshotResult): Promise<void> {
    try {
      cache.set(`snapshot:${snapshot.id}`, JSON.stringify(snapshot), 86400 * 7); // 7 days TTL
    } catch (error) {
      this.logger.error('Failed to cache snapshot:', error);
    }
  }

  /**
   * Cache a diff result
   */
  private async cacheDiff(diff: DiffResult): Promise<void> {
    try {
      cache.set(`diff:${diff.id}`, JSON.stringify(diff), 86400 * 7); // 7 days TTL
    } catch (error) {
      this.logger.error('Failed to cache diff:', error);
    }
  }

  /**
   * Create enterprise side-by-side comparison between normal browser and bot view
   */
  async createSideBySideComparison(
    url: string,
    normalOptions: SnapshotOptions = {},
    botOptions: SnapshotOptions = {}
  ): Promise<DiffResult> {
    const comparisonId = `comparison_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    this.logger.info(`Creating side-by-side comparison for: ${url}`);

    try {
      // Capture normal browser view
      const normalSnapshot = await this.captureSnapshot(url, {
        ...normalOptions,
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      });

      // Capture bot view (Googlebot)
      const botSnapshot = await this.captureSnapshot(url, {
        ...botOptions,
        userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      });

      // Perform visual diff
      const visualDiff = await this.compareSnapshots(normalSnapshot.id, botSnapshot.id);

      // Perform SEO analysis
      const seoComparison = this.analyzeSEODifferences(normalSnapshot, botSnapshot);

      // Generate impact assessment
      const impact = this.assessSEOImpact(seoComparison, visualDiff.diffScore);

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        seoComparison,
        impact,
        visualDiff.diffScore
      );

      // Create enhanced diff result
      const enhancedDiff: DiffResult = {
        ...visualDiff,
        seoComparison,
        impact,
        recommendations,
      };

      // Cache the enhanced result
      await this.cacheDiff(enhancedDiff);

      this.logger.info(
        `Side-by-side comparison completed: ${comparisonId} (SEO issues: ${impact.high.length})`
      );

      return enhancedDiff;
    } catch (error) {
      this.logger.error(`Failed to create side-by-side comparison for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Analyze SEO differences between two snapshots
   */
  private analyzeSEODifferences(
    normal: SnapshotResult,
    bot: SnapshotResult
  ): DiffResult['seoComparison'] {
    const normalHTML = normal.html.toLowerCase();
    const botHTML = bot.html.toLowerCase();

    const differences = {
      titleDiff: this.extractTitle(normalHTML) !== this.extractTitle(botHTML),
      metaDescriptionDiff:
        this.extractMetaDescription(normalHTML) !== this.extractMetaDescription(botHTML),
      h1Diff: this.extractH1(normalHTML) !== this.extractH1(botHTML),
      canonicalDiff: this.extractCanonical(normalHTML) !== this.extractCanonical(botHTML),
      robotsDiff: this.extractRobots(normalHTML) !== this.extractRobots(botHTML),
      structuredDataDiff:
        this.extractStructuredData(normalHTML) !== this.extractStructuredData(botHTML),
      addedElements: [] as string[],
      removedElements: [] as string[],
    };

    // Find added/removed elements
    const normalElements = this.extractKeyElements(normalHTML);
    const botElements = this.extractKeyElements(botHTML);

    for (const element of botElements) {
      if (!normalElements.includes(element)) {
        differences.addedElements.push(element);
      }
    }

    for (const element of normalElements) {
      if (!botElements.includes(element)) {
        differences.removedElements.push(element);
      }
    }

    return {
      htmlDifferences: differences,
      statusDiff: normal.renderTime !== bot.renderTime, // This should be comparison of HTTP status, but we don't have it
      renderTimeDiff: Math.abs(normal.renderTime - bot.renderTime),
      userAgentDiff: true, // Always true since we're comparing bot vs normal
    };
  }

  /**
   * Assess SEO impact based on differences
   */
  private assessSEOImpact(
    comparison: DiffResult['seoComparison'],
    visualDiffScore: number
  ): DiffResult['impact'] {
    const impact = {
      high: [] as string[],
      medium: [] as string[],
      low: [] as string[],
    };

    const { htmlDifferences } = comparison;

    // High impact issues
    if (htmlDifferences.titleDiff) {
      impact.high.push('Title mismatch between bot and normal views - affects SEO rankings');
    }

    if (htmlDifferences.canonicalDiff) {
      impact.high.push('Canonical URL differs - affects duplicate content handling');
    }

    if (htmlDifferences.metaDescriptionDiff) {
      impact.high.push('Meta description differs - affects search result appearance');
    }

    // Medium impact issues
    if (htmlDifferences.h1Diff) {
      impact.medium.push('H1 tag differs - affects content hierarchy and rankings');
    }

    if (htmlDifferences.robotsDiff) {
      impact.medium.push('Robots meta tag differs - affects crawl behavior');
    }

    if (htmlDifferences.structuredDataDiff) {
      impact.medium.push('Structured data differs - affects rich snippets');
    }

    if (comparison.renderTimeDiff > 5000) {
      impact.medium.push(
        `Significant render time difference (${comparison.renderTimeDiff}ms) - affects performance`
      );
    }

    // Low impact issues
    if (htmlDifferences.addedElements.length > 0) {
      impact.low.push(`${htmlDifferences.addedElements.length} elements visible only to bots`);
    }

    if (htmlDifferences.removedElements.length > 0) {
      impact.low.push(`${htmlDifferences.removedElements.length} elements missing for bots`);
    }

    if (visualDiffScore > 20 && visualDiffScore < 50) {
      impact.low.push('Minor visual differences detected between views');
    }

    if (visualDiffScore >= 50) {
      impact.medium.push('Significant visual differences detected between views');
    }

    return impact;
  }

  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(
    comparison: DiffResult['seoComparison'],
    impact: DiffResult['impact'],
    diffScore: number
  ): string[] {
    const recommendations: string[] = [];

    if (impact.high.length > 0) {
      recommendations.push(
        '🔴 URGENT: Fix high-priority SEO differences to maintain search rankings'
      );
    }

    if (comparison.htmlDifferences.titleDiff) {
      recommendations.push('• Ensure title is consistent between bot and normal views');
    }

    if (comparison.htmlDifferences.canonicalDiff) {
      recommendations.push('• Fix canonical URL inconsistency between views');
    }

    if (comparison.htmlDifferences.metaDescriptionDiff) {
      recommendations.push('• Standardize meta description for both bots and users');
    }

    if (comparison.htmlDifferences.h1Diff) {
      recommendations.push('• Ensure H1 tag consistency across different user agents');
    }

    if (comparison.htmlDifferences.structuredDataDiff) {
      recommendations.push('• Fix structured data inconsistencies for better rich snippets');
    }

    if (comparison.renderTimeDiff > 5000) {
      recommendations.push('• Investigate performance differences between views');
    }

    if (diffScore > 50) {
      recommendations.push('• Significant differences detected - review CSS/JS loading patterns');
    }

    if (recommendations.length === 2) {
      // Only the urgent message
      recommendations.push('✅ No major SEO issues detected - views are consistent');
    }

    return recommendations;
  }

  // Helper methods for HTML parsing
  private extractTitle(html: string): string {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? match[1].trim() : '';
  }

  private extractMetaDescription(html: string): string {
    const match = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i
    );
    return match ? match[1].trim() : '';
  }

  private extractH1(html: string): string {
    const match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    return match ? match[1].trim() : '';
  }

  private extractCanonical(html: string): string {
    const match = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i);
    return match ? match[1].trim() : '';
  }

  private extractRobots(html: string): string {
    const match = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']+)["'][^>]*>/i);
    return match ? match[1].trim() : '';
  }

  private extractStructuredData(html: string): string {
    // Extract JSON-LD structured data
    const jsonLdMatch = html.match(
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([^<]+)<\/script>/i
    );
    if (jsonLdMatch) {
      return jsonLdMatch[1].trim();
    }

    // Extract microdata
    const microdataMatch = html.match(/<[^>]*itemtype=["'][^"']*["'][^>]*>/gi);
    return microdataMatch ? microdataMatch.join('') : '';
  }

  private extractKeyElements(html: string): string[] {
    const elements: string[] = [];

    // Extract meta tags
    const metaMatches = html.match(/<meta[^>]*>/gi);
    if (metaMatches) {
      elements.push(...metaMatches);
    }

    // Extract title
    const titleMatch = html.match(/<title[^>]*>.*?<\/title>/gi);
    if (titleMatch) {
      elements.push(...titleMatch);
    }

    // Extract H1-H6
    const headingMatches = html.match(/<h[1-6][^>]*>.*?<\/h[1-6]>/gi);
    if (headingMatches) {
      elements.push(...headingMatches);
    }

    // Extract canonical
    const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*>/gi);
    if (canonicalMatch) {
      elements.push(...canonicalMatch);
    }

    return elements;
  }

  /**
   * Get comparison history for a URL
   */
  async getComparisonHistory(url: string, limit: number = 20): Promise<DiffResult[]> {
    try {
      const allEntries = cache.getAllEntries();
      const comparisons: DiffResult[] = [];

      for (const entry of allEntries) {
        if (entry.url && entry.url.startsWith('diff:')) {
          const value = cache.get(entry.url);
          if (value) {
            try {
              const diff = JSON.parse(value) as DiffResult;
              if (diff.url === url) {
                comparisons.push(diff);
              }
            } catch (parseError) {
              this.logger.warn(`Failed to parse diff data for key ${entry.url}:`, parseError);
            }
          }
        }
      }

      // Sort by timestamp (newest first) and limit
      return comparisons
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    } catch (error) {
      this.logger.error('Failed to get comparison history:', error);
      return [];
    }
  }

  /**
   * Get comparison statistics
   */
  getComparisonStats(): {
    total: number;
    averageDiffScore: number;
    highRiskCount: number;
    recentCount: number;
    mostCommonIssues: Array<{ issue: string; count: number }>;
  } {
    try {
      const allEntries = cache.getAllEntries();
      const comparisons: DiffResult[] = [];

      for (const entry of allEntries) {
        if (entry.url && entry.url.startsWith('diff:')) {
          const value = cache.get(entry.url);
          if (value) {
            try {
              const diff = JSON.parse(value) as DiffResult;
              comparisons.push(diff);
            } catch (parseError) {
              this.logger.warn(`Failed to parse diff data for key ${entry.url}:`, parseError);
            }
          }
        }
      }

      const total = comparisons.length;
      const averageDiffScore =
        total > 0 ? comparisons.reduce((sum, c) => sum + c.diffScore, 0) / total : 0;

      const highRiskCount = comparisons.filter((c) => c.diffScore > 50).length;
      const recentCount = comparisons.filter(
        (c) => Date.now() - c.timestamp.getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
      ).length;

      // Analyze common issues
      const issueCounts: Record<string, number> = {};
      for (const comparison of comparisons) {
        for (const issue of comparison.impact.high) {
          issueCounts[issue] = (issueCounts[issue] || 0) + 1;
        }
      }

      const mostCommonIssues = Object.entries(issueCounts)
        .map(([issue, count]) => ({ issue, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        total,
        averageDiffScore,
        highRiskCount,
        recentCount,
        mostCommonIssues,
      };
    } catch (error) {
      this.logger.error('Failed to get comparison stats:', error);
      return {
        total: 0,
        averageDiffScore: 0,
        highRiskCount: 0,
        recentCount: 0,
        mostCommonIssues: [],
      };
    }
  }
}

export default new SnapshotService();
