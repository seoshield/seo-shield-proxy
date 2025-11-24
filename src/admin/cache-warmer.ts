/**
 * Cache Warmer Service
 * Pre-warms cache by rendering URLs in background
 */

import browserManager from '../browser';
import cache from '../cache';
import configManager from './config-manager';
import { Logger } from '../utils/logger';

interface WarmJob {
  id: string;
  url: string;
  priority: 'high' | 'normal' | 'low';
  scheduledAt: Date;
  retryCount: number;
  maxRetries: number;
  source: 'sitemap' | 'manual' | 'scheduled' | 'api';
  metadata?: {
    sitemapUrl?: string;
    schedulePattern?: string;
    batchSize?: number;
  };
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  renderTime?: number;
  cacheHit?: boolean;
}

interface WarmStats {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  queued: number;
  lastWarmed?: Date;
  averageRenderTime: number;
  totalRenderTime: number;
  cacheHitRate: number;
  successRate: number;
  activeJobs: WarmJob[];
  recentJobs: WarmJob[];
}

interface WarmSchedule {
  id: string;
  name: string;
  sitemapUrl: string;
  cronPattern: string;
  priority: 'high' | 'normal' | 'low';
  isActive: boolean;
  lastRun?: Date;
  nextRun?: Date;
  totalRuns: number;
  successRate: number;
  averageDuration: number;
}

class CacheWarmer {
  private jobs: Map<string, WarmJob> = new Map();
  private schedules: Map<string, WarmSchedule> = new Map();
  private jobHistory: WarmJob[] = [];
  private isProcessing = false;
  private logger = new Logger('CacheWarmer');
  private intervalTimer: NodeJS.Timeout | null = null;
  private stats: WarmStats = {
    total: 0,
    completed: 0,
    failed: 0,
    inProgress: 0,
    queued: 0,
    lastWarmed: undefined,
    averageRenderTime: 0,
    totalRenderTime: 0,
    cacheHitRate: 0,
    successRate: 0,
    activeJobs: [],
    recentJobs: [],
  };

  /**
   * Add URLs to warm from sitemap or manual list with enterprise features
   */
  async addUrls(
    urls: string[],
    priority: 'high' | 'normal' | 'low' = 'normal',
    source: 'sitemap' | 'manual' | 'scheduled' | 'api' = 'manual',
    metadata?: WarmJob['metadata']
  ): Promise<{ added: number; skipped: number; duplicates: number }> {
    let added = 0;
    let skipped = 0;
    let duplicates = 0;

    for (const url of urls) {
      try {
        // Validate URL
        new URL(url);

        // Check if already cached and fresh
        const cached = cache.get(url);
        if (cached) {
          const cacheEntry = typeof cached === 'string' ? JSON.parse(cached) : cached;
          if (cacheEntry.timestamp && Date.now() - cacheEntry.timestamp < 3600000) { // 1 hour
            skipped++;
            continue;
          }
        }

        // Check if already in queue
        if (this.jobs.has(url)) {
          duplicates++;
          continue;
        }

        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const job: WarmJob = {
          id: jobId,
          url,
          priority,
          scheduledAt: new Date(),
          retryCount: 0,
          maxRetries: priority === 'high' ? 3 : 2,
          source,
          metadata,
          status: 'pending',
        };

        this.jobs.set(jobId, job);
        added++;
        this.stats.total++;
        this.stats.queued++;
      } catch (error) {
        this.logger.warn(`Invalid URL skipped: ${url} - ${(error as Error).message}`);
      }
    }

    // Start processing if not already running
    if (added > 0 && !this.isProcessing) {
      this.processQueue();
    }

    this.logger.info(`Added ${added} URLs to warm queue (skipped: ${skipped}, duplicates: ${duplicates})`);

    return { added, skipped, duplicates };
  }

  /**
   * Bulk warm URLs from sitemap with progress tracking
   */
  async warmFromSitemap(
    sitemapUrl: string,
    priority: 'high' | 'normal' | 'low' = 'normal',
    options: { batchSize?: number; delayMs?: number } = {}
  ): Promise<{ total: number; added: number; skipped: number }> {
    const { batchSize = 50, delayMs = 1000 } = options;

    this.logger.info(`Starting bulk warm from sitemap: ${sitemapUrl}`);

    try {
      const urls = await this.parseSitemap(sitemapUrl);
      const total = urls.length;

      // Process in batches to avoid overwhelming the system
      let totalAdded = 0;
      let totalSkipped = 0;

      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        const result = await this.addUrls(
          batch,
          priority,
          'sitemap',
          { sitemapUrl, batchSize }
        );

        totalAdded += result.added;
        totalSkipped += result.skipped;

        // Progress logging
        const progress = Math.min(i + batchSize, urls.length);
        this.logger.info(`Batch ${Math.ceil(progress / batchSize)}/${Math.ceil(urls.length / batchSize)}: ${progress}/${urls.length} URLs processed`);

        // Delay between batches
        if (i + batchSize < urls.length && delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }

      this.logger.info(`Bulk warm completed from sitemap: ${sitemapUrl} (added: ${totalAdded}, skipped: ${totalSkipped})`);

      return { total, added: totalAdded, skipped: totalSkipped };
    } catch (error) {
      this.logger.error(`Bulk warm failed for sitemap: ${sitemapUrl}`, error);
      throw error;
    }
  }

  /**
   * Schedule recurring warm jobs
   */
  async createSchedule(
    name: string,
    sitemapUrl: string,
    cronPattern: string,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<string> {
    const scheduleId = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const schedule: WarmSchedule = {
      id: scheduleId,
      name,
      sitemapUrl,
      cronPattern,
      priority,
      isActive: true,
      totalRuns: 0,
      successRate: 0,
      averageDuration: 0,
    };

    this.schedules.set(scheduleId, schedule);
    this.logger.info(`Created warm schedule: ${name} (${scheduleId})`);

    // Start scheduler if not already running
    this.startScheduler();

    return scheduleId;
  }

  /**
   * Simple scheduler using setInterval (in production, use node-cron)
   */
  private startScheduler(): void {
    if (this.intervalTimer) return;

    this.intervalTimer = setInterval(() => {
      this.processScheduledJobs();
    }, 60000); // Check every minute

    this.logger.info('Cache warmer scheduler started');
  }

  private async processScheduledJobs(): Promise<void> {
    const now = new Date();

    for (const [scheduleId, schedule] of this.schedules.entries()) {
      if (!schedule.isActive) continue;

      // Simple implementation - in production use proper cron parsing
      // For now, just run if it's been more than 1 hour since last run
      const timeSinceLastRun = schedule.lastRun ? now.getTime() - schedule.lastRun.getTime() : Infinity;
      const oneHour = 3600000;

      if (timeSinceLastRun >= oneHour) {
        try {
          this.logger.info(`Running scheduled warm job: ${schedule.name}`);
          const startTime = Date.now();

          const result = await this.warmFromSitemap(schedule.sitemapUrl, schedule.priority, {
            batchSize: 25,
            delayMs: 2000,
          });

          const duration = Date.now() - startTime;
          const successRate = result.total > 0 ? (result.added / result.total) * 100 : 0;

          // Update schedule stats
          schedule.lastRun = now;
          schedule.totalRuns++;
          schedule.successRate = successRate;
          schedule.averageDuration = (schedule.averageDuration + duration) / 2;

          this.logger.info(`Scheduled warm job completed: ${schedule.name} (${duration}ms, success: ${successRate.toFixed(1)}%)`);
        } catch (error) {
          this.logger.error(`Scheduled warm job failed: ${schedule.name}`, error);
        }
      }
    }
  }

  /**
   * Parse sitemap.xml and extract URLs
   */
  async parseSitemap(sitemapUrl: string): Promise<string[]> {
    try {
      const response = await fetch(sitemapUrl);
      const xml = await response.text();

      // Extract URLs from sitemap
      const urlMatch = xml.match(/<url>[\s\S]*?<\/url>/g) || [];
      const urls: string[] = [];

      for (const urlBlock of urlMatch) {
        const locMatch = urlBlock.match(/<loc>(.*?)<\/loc>/);
        if (locMatch) {
          urls.push(locMatch[1]);
        }
      }

      this.logger.info(`Parsed ${urls.length} URLs from sitemap: ${sitemapUrl}`);
      return urls;
    } catch (error) {
      this.logger.error(`Failed to parse sitemap: ${sitemapUrl}`, error);
      throw new Error(`Failed to parse sitemap: ${(error as Error).message}`);
    }
  }

  /**
   * Process warm queue with enhanced tracking
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    this.logger.info('Starting cache warmer processing');

    try {
      while (this.jobs.size > 0) {
        // Sort by priority and scheduled time
        const sortedJobs = Array.from(this.jobs.entries()).sort(([, a], [, b]) => {
          const priorityOrder = { high: 0, normal: 1, low: 2 };
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          }
          return a.scheduledAt.getTime() - b.scheduledAt.getTime();
        });

        if (sortedJobs.length === 0) break;

        const [jobId, job] = sortedJobs[0];

        // Skip if job is already processing
        if (job.status === 'processing') {
          continue;
        }

        // Update job status
        job.status = 'processing';
        job.startedAt = new Date();
        this.stats.inProgress = 1;
        this.updateStats();

        try {
          // Warm the URL
          const renderTime = await this.warmUrl(job.url);

          // Mark as completed
          job.status = 'completed';
          job.completedAt = new Date();
          job.renderTime = renderTime;

          // Add to history
          this.jobHistory.unshift(job);
          if (this.jobHistory.length > 1000) {
            this.jobHistory = this.jobHistory.slice(0, 1000);
          }

          // Remove from active queue
          this.jobs.delete(jobId);
          this.stats.completed++;
          this.stats.inProgress = 0;
          this.stats.lastWarmed = new Date();
          this.stats.totalRenderTime += renderTime;
          this.updateStats();

          this.logger.info(`Warmed URL: ${job.url} (${renderTime}ms)`);
        } catch (error) {
          job.retryCount++;
          job.error = (error as Error).message;

          if (job.retryCount >= job.maxRetries) {
            job.status = 'failed';
            job.completedAt = new Date();

            // Add to history
            this.jobHistory.unshift(job);
            if (this.jobHistory.length > 1000) {
              this.jobHistory = this.jobHistory.slice(0, 1000);
            }

            this.jobs.delete(jobId);
            this.stats.failed++;
            this.stats.inProgress = 0;
            this.updateStats();

            this.logger.warn(`Failed to warm URL after ${job.maxRetries} retries: ${job.url} - ${job.error}`);
          } else {
            job.status = 'pending';
            // Reschedule with exponential backoff
            const delay = Math.pow(2, job.retryCount) * 1000; // 1s, 2s, 4s
            job.scheduledAt = new Date(Date.now() + delay);
            this.stats.inProgress = 0;
            this.updateStats();

            this.logger.debug(`Retrying URL in ${delay}ms: ${job.url}`);
          }
        }

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      this.isProcessing = false;
      this.stats.inProgress = 0;
      this.updateStats();
      this.logger.info('Cache warmer processing completed');
    }
  }

  /**
   * Warm a single URL with enhanced tracking
   */
  private async warmUrl(url: string): Promise<number> {
    const config = configManager.getConfig();
    const startTime = Date.now();

    // Use browser manager to render the page
    const result = await browserManager.render(url);

    if (!result.html) {
      throw new Error('Failed to render page - no HTML returned');
    }

    const renderTime = Date.now() - startTime;

    // Cache the result with enhanced metadata
    const cacheEntry = {
      html: result.html,
      status: result.statusCode || 200,
      headers: {},
      timestamp: Date.now(),
      renderTime,
      userAgent: config.userAgent || 'Mozilla/5.0 (compatible; SEOShieldProxy/1.0)',
      warmedBy: 'cache-warmer',
      warmpJobId: Date.now().toString(),
    };

    cache.set(url, JSON.stringify(cacheEntry));

    return renderTime;
  }

  /**
   * Update comprehensive statistics
   */
  private updateStats(): void {
    const total = this.stats.total;
    const completed = this.stats.completed;
    const failed = this.stats.failed;

    this.stats.queued = Array.from(this.jobs.values()).filter(job => job.status === 'pending').length;
    this.stats.successRate = total > 0 ? (completed / total) * 100 : 0;
    this.stats.averageRenderTime = completed > 0 ? this.stats.totalRenderTime / completed : 0;
    this.stats.activeJobs = Array.from(this.jobs.values()).filter(job => job.status === 'processing');
    this.stats.recentJobs = this.jobHistory.slice(0, 20); // Last 20 jobs
  }

  /**
   * Get comprehensive warmer stats
   */
  getStats(): WarmStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Get active schedules
   */
  getSchedules(): WarmSchedule[] {
    return Array.from(this.schedules.values());
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): WarmJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get schedule by ID
   */
  getSchedule(scheduleId: string): WarmSchedule | undefined {
    return this.schedules.get(scheduleId);
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (job && job.status !== 'completed' && job.status !== 'failed') {
      job.status = 'cancelled';
      job.completedAt = new Date();
      job.error = 'Cancelled by user';

      this.jobHistory.unshift(job);
      this.jobs.delete(jobId);
      this.updateStats();

      this.logger.info(`Cancelled job: ${jobId}`);
      return true;
    }
    return false;
  }

  /**
   * Cancel all pending jobs
   */
  cancelAllJobs(): number {
    let cancelled = 0;
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status !== 'completed' && job.status !== 'failed') {
        job.status = 'cancelled';
        job.completedAt = new Date();
        job.error = 'Cancelled by user';

        this.jobHistory.unshift(job);
        this.jobs.delete(jobId);
        cancelled++;
      }
    }

    this.updateStats();
    this.logger.info(`Cancelled ${cancelled} jobs`);
    return cancelled;
  }

  /**
   * Enable/disable schedule
   */
  toggleSchedule(scheduleId: string, isActive: boolean): boolean {
    const schedule = this.schedules.get(scheduleId);
    if (schedule) {
      schedule.isActive = isActive;
      this.logger.info(`Schedule ${scheduleId} ${isActive ? 'enabled' : 'disabled'}`);
      return true;
    }
    return false;
  }

  /**
   * Delete schedule
   */
  deleteSchedule(scheduleId: string): boolean {
    const deleted = this.schedules.delete(scheduleId);
    if (deleted) {
      this.logger.info(`Deleted schedule: ${scheduleId}`);
    }
    return deleted;
  }

  /**
   * Clear warm queue
   */
  clearQueue(): void {
    const cancelled = this.cancelAllJobs();
    this.stats.inProgress = 0;
    this.logger.info(`Cache warmer queue cleared (${cancelled} jobs cancelled)`);
  }

  /**
   * Get estimated time to complete queue
   */
  getEstimatedTime(): number {
    const pendingJobs = Array.from(this.jobs.values()).filter(job => job.status === 'pending');
    if (pendingJobs.length === 0) return 0;

    // Estimate: 3 seconds per URL on average
    return pendingJobs.length * 3000;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): {
    jobsPerHour: number;
    averageRenderTime: number;
    successRate: number;
    cacheHitRate: number;
    topErrorMessages: Array<{ message: string; count: number }>;
  } {
    const recentJobs = this.jobHistory.slice(0, 100); // Last 100 jobs
    const timeSpan = recentJobs.length > 0 ? (Date.now() - recentJobs[recentJobs.length - 1].completedAt!.getTime()) : 0;
    const hours = timeSpan / (1000 * 60 * 60);

    // Count error messages
    const errorCounts: Record<string, number> = {};
    for (const job of recentJobs) {
      if (job.error) {
        errorCounts[job.error] = (errorCounts[job.error] || 0) + 1;
      }
    }

    const topErrorMessages = Object.entries(errorCounts)
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      jobsPerHour: hours > 0 ? recentJobs.length / hours : 0,
      averageRenderTime: this.stats.averageRenderTime,
      successRate: this.stats.successRate,
      cacheHitRate: this.stats.cacheHitRate,
      topErrorMessages,
    };
  }

  /**
   * Cleanup old history
   */
  cleanupHistory(maxAge: number = 7 * 24 * 60 * 60 * 1000): void { // 7 days default
    const cutoffTime = Date.now() - maxAge;
    const originalLength = this.jobHistory.length;

    this.jobHistory = this.jobHistory.filter(job =>
      job.completedAt && job.completedAt.getTime() > cutoffTime
    );

    const cleaned = originalLength - this.jobHistory.length;
    if (cleaned > 0) {
      this.logger.info(`Cleaned up ${cleaned} old job history entries`);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down cache warmer...');

    // Stop scheduler
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }

    // Cancel pending jobs
    this.cancelAllJobs();

    // Wait for processing to complete
    let attempts = 0;
    while (this.isProcessing && attempts < 30) { // Wait up to 30 seconds
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    this.logger.info('Cache warmer shutdown complete');
  }
}

export default new CacheWarmer();