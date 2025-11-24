import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import puppeteer, { Browser, Page } from 'puppeteer';
import { SeoProtocolConfig } from '../config';

/**
 * Render job definition
 */
export interface RenderJob {
  id: string;
  url: string;
  priority: number;
  attempts: number;
  createdAt: Date;
  scheduledAt?: Date;
  metadata: {
    userAgent: string;
    referer?: string;
    protocol: string;
    headers: Record<string, string>;
  };
  options: {
    timeout: number;
    waitUntil: 'networkidle0' | 'networkidle2' | 'domcontentloaded';
    viewport?: {
      width: number;
      height: number;
    };
    userAgent?: string;
    blockResources?: boolean;
  };
}

/**
 * Render job result
 */
export interface RenderJobResult {
  jobId: string;
  url: string;
  success: boolean;
  html?: string;
  statusCode?: number;
  error?: string;
  duration: number;
  metrics: {
    renderTime: number;
    memoryUsage: number;
    cpuTime?: number;
    networkRequests: number;
  };
  metadata: {
    workerId: string;
    browserVersion: string;
    platform: string;
  };
}

/**
 * Cluster configuration
 */
export interface ClusterConfig {
  enabled: boolean;
  useRedisQueue: boolean;
  maxWorkers: number;
  jobTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  redis?: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  browser: {
    headless: boolean;
    args: string[];
    defaultViewport: {
      width: number;
      height: number;
    };
  };
}

/**
 * Cluster statistics
 */
export interface ClusterStats {
  workers: {
    active: number;
    idle: number;
    total: number;
  };
  jobs: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  performance: {
    avgRenderTime: number;
    successRate: number;
    throughput: number;
    memoryUsage: number;
  };
}

/**
 * Cluster Manager with Redis BullMQ
 *
 * Enterprise-grade distributed processing with Redis BullMQ for high
 * scalability and reliability of SSR rendering operations.
 */
export class ClusterManager {
  private config: ClusterConfig;
  private queue: Queue<RenderJob, RenderJobResult> | null = null;
  private workers: Worker<RenderJob, RenderJobResult>[] = [];
  private queueEvents: QueueEvents | null = null;
  private redisConnection: Redis | null = null;
  private workerId: string;
  private browser: Browser | null = null;
  private isInitialized = false;

  constructor(config: ClusterConfig) {
    this.config = config;
    this.workerId = `worker-${process.pid}-${Date.now()}`;
  }

  /**
   * Initialize the cluster manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (!this.config.enabled) {
      console.log('🔧 Cluster Mode is disabled');
      return;
    }

    try {
      console.log(`🚀 Initializing Cluster Mode with ${this.config.maxWorkers} workers...`);

      // Initialize Redis connection if using Redis queue
      if (this.config.useRedisQueue) {
        await this.initializeRedis();
        await this.initializeQueue();
        await this.initializeWorkers();
        await this.initializeQueueEvents();
      } else {
        // Initialize in-memory cluster mode
        await this.initializeInMemoryCluster();
      }

      this.isInitialized = true;
      console.log('✅ Cluster Manager initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Cluster Manager:', error);
      throw error;
    }
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    const redisConfig = this.config.redis;
    if (!redisConfig) {
      throw new Error('Redis configuration is required for Redis queue mode');
    }

    this.redisConnection = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db,
      maxRetriesPerRequest: 3,
    });

    // Test connection
    await this.redisConnection.ping();
    console.log(`🔗 Connected to Redis at ${redisConfig.host}:${redisConfig.port}`);
  }

  /**
   * Initialize BullMQ queue
   */
  private async initializeQueue(): Promise<void> {
    if (!this.redisConnection) {
      throw new Error('Redis connection is required for queue initialization');
    }

    this.queue = new Queue<RenderJob, RenderJobResult>('ssr-render', {
      connection: this.redisConnection,
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 100,
        attempts: this.config.retryAttempts,
        backoff: {
          type: 'exponential',
          delay: this.config.retryDelay,
        },
        delay: 0,
      },
    });

    console.log('📋 BullMQ queue initialized');
  }

  /**
   * Initialize workers
   */
  private async initializeWorkers(): Promise<void> {
    if (!this.redisConnection) {
      throw new Error('Redis connection is required for worker initialization');
    }

    // Initialize browser for workers
    await this.initializeBrowser();

    // Create worker instances
    for (let i = 0; i < this.config.maxWorkers; i++) {
      const workerId = `${this.workerId}-${i}`;

      const worker = new Worker<RenderJob, RenderJobResult>(
        'ssr-render',
        (job: Job<RenderJob, RenderJobResult>) => this.processRenderJob(job, workerId),
        {
          connection: this.redisConnection,
          concurrency: 1,
          limiter: {
            max: 5,
            duration: 60000, // 5 jobs per minute per worker
          },
        }
      );

      // Handle worker events
      worker.on('completed', (job) => {
        console.log(`✅ Worker ${workerId} completed job ${job.id}`);
      });

      worker.on('failed', (job, err) => {
        console.error(`❌ Worker ${workerId} failed job ${job?.id}:`, err.message);
      });

      worker.on('error', (err) => {
        console.error(`💥 Worker ${workerId} error:`, err);
      });

      this.workers.push(worker);
    }

    console.log(`👷 Created ${this.config.maxWorkers} render workers`);
  }

  /**
   * Initialize queue events for monitoring
   */
  private async initializeQueueEvents(): Promise<void> {
    if (!this.redisConnection) {
      throw new Error('Redis connection is required for queue events initialization');
    }

    this.queueEvents = new QueueEvents('ssr-render', {
      connection: this.redisConnection,
    });

    this.queueEvents.on('completed', ({ jobId, returnvalue }) => {
      console.log(`🎉 Job ${jobId} completed successfully`);
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`💥 Job ${jobId} failed: ${failedReason}`);
    });

    this.queueEvents.on('progress', ({ jobId, data }) => {
      console.log(`📊 Job ${jobId} progress:`, data);
    });

    console.log('📡 Queue events listener initialized');
  }

  /**
   * Initialize in-memory cluster (fallback mode)
   */
  private async initializeInMemoryCluster(): Promise<void> {
    console.log('🧠 Initializing in-memory cluster mode (no Redis)');
    // In-memory mode would use the existing puppeteer-cluster
    // This is a fallback when Redis is not available
  }

  /**
   * Initialize browser instance for workers
   */
  private async initializeBrowser(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: this.config.browser.headless,
      args: this.config.browser.args,
      defaultViewport: this.config.browser.defaultViewport,
    });

    console.log('🌐 Browser instance initialized for cluster workers');
  }

  /**
   * Process a render job
   */
  private async processRenderJob(
    job: Job<RenderJob, RenderJobResult>,
    workerId: string
  ): Promise<RenderJobResult> {
    const startTime = Date.now();
    const { url, options, metadata } = job.data;

    console.log(`🔄 Worker ${workerId} processing job ${job.id}: ${url}`);

    try {
      if (!this.browser) {
        throw new Error('Browser instance not available');
      }

      const page = await this.browser.newPage();
      let html = '';
      let statusCode = 200;

      try {
        // Set user agent
        if (options.userAgent) {
          await page.setUserAgent(options.userAgent);
        }

        // Set viewport
        if (options.viewport) {
          await page.setViewport(options.viewport);
        }

        // Block resources if configured
        if (options.blockResources) {
          await page.setRequestInterception(true);
          page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
              req.abort();
            } else {
              req.continue();
            }
          });
        }

        // Navigate to URL
        const response = await page.goto(url, {
          waitUntil: options.waitUntil,
          timeout: options.timeout,
        });

        // Get status code
        statusCode = response?.status() || 200;

        // Get HTML content
        html = await page.content();

      } finally {
        await page.close();
      }

      const duration = Date.now() - startTime;

      const result: RenderJobResult = {
        jobId: job.id,
        url,
        success: true,
        html,
        statusCode,
        duration,
        metrics: {
          renderTime: duration,
          memoryUsage: process.memoryUsage().heapUsed,
          networkRequests: 0, // Would need additional tracking
        },
        metadata: {
          workerId,
          browserVersion: await this.browser.version(),
          platform: process.platform,
        },
      };

      console.log(`✅ Worker ${workerId} completed job ${job.id} in ${duration}ms`);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;

      const result: RenderJobResult = {
        jobId: job.id,
        url,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        metrics: {
          renderTime: duration,
          memoryUsage: process.memoryUsage().heapUsed,
          networkRequests: 0,
        },
        metadata: {
          workerId,
          browserVersion: this.browser ? await this.browser.version() : 'unknown',
          platform: process.platform,
        },
      };

      console.error(`❌ Worker ${workerId} failed job ${job.id}:`, error);
      return result;
    }
  }

  /**
   * Add a render job to the queue
   */
  async addRenderJob(
    url: string,
    options: Partial<RenderJob['options']> = {},
    metadata: Partial<RenderJob['metadata']> = {},
    priority: number = 0
  ): Promise<Job<RenderJob, RenderJobResult> | null> {
    if (!this.queue) {
      console.warn('⚠️  Queue not available, falling back to direct rendering');
      return null;
    }

    const job: RenderJob = {
      id: `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url,
      priority,
      attempts: 0,
      createdAt: new Date(),
      metadata: {
        userAgent: metadata.userAgent || 'SEOShieldProxy/1.0',
        referer: metadata.referer,
        protocol: metadata.protocol || 'https',
        headers: metadata.headers || {},
      },
      options: {
        timeout: options.timeout || 30000,
        waitUntil: options.waitUntil || 'networkidle0',
        viewport: options.viewport || { width: 1920, height: 1080 },
        userAgent: options.userAgent,
        blockResources: options.blockResources || false,
      },
    };

    return await this.queue.add('render', job, {
      priority,
      delay: 0,
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  }

  /**
   * Get queue statistics
   */
  async getStats(): Promise<ClusterStats> {
    const stats: ClusterStats = {
      workers: {
        active: this.workers.filter(w => w.isRunning()).length,
        idle: this.workers.filter(w => !w.isRunning()).length,
        total: this.workers.length,
      },
      jobs: {
        waiting: this.queue ? (await this.queue.getWaiting()).length : 0,
        active: this.queue ? (await this.queue.getActive()).length : 0,
        completed: this.queue ? (await this.queue.getCompleted()).length : 0,
        failed: this.queue ? (await this.queue.getFailed()).length : 0,
        delayed: this.queue ? (await this.queue.getDelayed()).length : 0,
      },
      performance: {
        avgRenderTime: 0,
        successRate: 0,
        throughput: 0,
        memoryUsage: process.memoryUsage().heapUsed,
      },
    };

    // Convert arrays to counts
    stats.jobs.waiting = (stats.jobs.waiting as any).length;
    stats.jobs.active = (stats.jobs.active as any).length;
    stats.jobs.completed = (stats.jobs.completed as any).length;
    stats.jobs.failed = (stats.jobs.failed as any).length;
    stats.jobs.delayed = (stats.jobs.delayed as any).length;

    // Calculate performance metrics
    const completed = stats.jobs.completed as number;
    const failed = stats.jobs.failed as number;
    const total = completed + failed;

    if (total > 0) {
      stats.performance.successRate = (completed / total) * 100;
    }

    return stats;
  }

  /**
   * Pause the queue (stop processing new jobs)
   */
  async pause(): Promise<void> {
    if (this.queue) {
      await this.queue.pause();
      console.log('⏸️  Queue paused');
    }
  }

  /**
   * Resume the queue (continue processing jobs)
   */
  async resume(): Promise<void> {
    if (this.queue) {
      await this.queue.resume();
      console.log('▶️  Queue resumed');
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Cluster Manager...');

    // Close workers
    for (const worker of this.workers) {
      await worker.close();
    }
    this.workers = [];

    // Close queue
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }

    // Close queue events
    if (this.queueEvents) {
      await this.queueEvents.close();
      this.queueEvents = null;
    }

    // Close browser
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    // Close Redis connection
    if (this.redisConnection) {
      await this.redisConnection.quit();
      this.redisConnection = null;
    }

    this.isInitialized = false;
    console.log('✅ Cluster Manager shutdown complete');
  }

  /**
   * Get default configuration
   */
  static getDefaultConfig(): ClusterConfig {
    return {
      enabled: false, // Disabled by default
      useRedisQueue: true,
      maxWorkers: 3,
      jobTimeout: 30000,
      retryAttempts: 3,
      retryDelay: 5000,
      redis: {
        host: 'localhost',
        port: 6379,
        db: 0,
      },
      browser: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
        ],
        defaultViewport: {
          width: 1920,
          height: 1080,
        },
      },
    };
  }
}