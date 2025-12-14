import { Request, Response, NextFunction } from 'express';
import { ETagManager, ETagComparison } from './etag-manager';
import { SeoProtocolConfig } from '../config';
import { Logger } from '../utils/logger';

const logger = new Logger('ETagService');

/**
 * ETag Service for Express middleware integration
 */
export class ETagService {
  private etagManager: ETagManager;
  private config: SeoProtocolConfig['etagStrategy'];

  constructor(config: SeoProtocolConfig['etagStrategy']) {
    this.config = config;
    this.etagManager = new ETagManager(config);
  }

  /**
   * Express middleware for ETag handling
   */
  middleware() {
    // Arrow function preserves 'this' context from class
    return async (req: Request, res: Response, next: NextFunction) => {
      // Skip ETag handling if disabled
      if (!this.config.enabled) {
        return next();
      }

      // Only handle GET and HEAD requests
      if (!['GET', 'HEAD'].includes(req.method)) {
        return next();
      }

      // Check if we should cache this URL
      if (!this.etagManager.shouldCacheUrl(req.url)) {
        return next();
      }

      // Get ETag headers from request
      const ifNoneMatch = req.headers['if-none-match'] as string;
      const ifModifiedSince = req.headers['if-modified-since'] as string;

      // Store the original res.end to intercept response
      const originalEnd = res.end.bind(res);
      let responseContent = '';

      // Override res.write to capture content (cast needed for Express overloads)
      const originalWrite = res.write.bind(res);
      (res as { write: typeof res.write }).write = function (
        chunk: unknown,
        encodingOrCallback?: BufferEncoding | ((error: Error | null | undefined) => void),
        callback?: (error: Error | null | undefined) => void
      ): boolean {
        if (typeof chunk === 'string') {
          responseContent += chunk;
        } else if (Buffer.isBuffer(chunk)) {
          responseContent += chunk.toString();
        }
        if (typeof encodingOrCallback === 'function') {
          return originalWrite(chunk as string, encodingOrCallback);
        }
        if (encodingOrCallback) {
          return originalWrite(chunk as string, encodingOrCallback, callback);
        }
        return originalWrite(chunk as string);
      };

      // Override res.end to add ETag logic (cast needed for Express overloads)
      (res as { end: typeof res.end }).end = (
        chunk?: unknown,
        encodingOrCallback?: BufferEncoding | (() => void),
        callback?: () => void
      ): Response => {
        if (chunk) {
          if (typeof chunk === 'string') {
            responseContent += chunk;
          } else if (Buffer.isBuffer(chunk)) {
            responseContent += chunk.toString();
          }
        }

        // Generate ETag and check if content has changed
        this.processETag(req, res, responseContent, ifNoneMatch, ifModifiedSince);

        // Call original end with the content
        if (typeof encodingOrCallback === 'function') {
          return originalEnd(chunk, encodingOrCallback);
        }
        if (encodingOrCallback) {
          return originalEnd(chunk, encodingOrCallback, callback);
        }
        return originalEnd(chunk);
      };

      // Continue to next middleware
      next();
    };
  }

  /**
   * Process ETag logic for response
   */
  private async processETag(
    req: Request,
    res: Response,
    content: string,
    ifNoneMatch?: string,
    ifModifiedSince?: string
  ): Promise<void> {
    try {
      // Compare ETags
      const comparison: ETagComparison = await this.etagManager.compareETag(
        req.url,
        content,
        ifNoneMatch,
        ifModifiedSince
      );

      // Set cache control headers
      const cacheHeaders = this.etagManager.getCacheControlHeaders(comparison.changeType);

      // Apply headers
      res.set('ETag', comparison.etag);
      res.set('Last-Modified', comparison.lastModified);
      res.set('Cache-Control', cacheHeaders['Cache-Control']);

      if (cacheHeaders['Vary']) {
        res.set('Vary', cacheHeaders['Vary']);
      }

      // If content hasn't changed, send 304 response
      if (comparison.notModified && this.config.enable304Responses) {
        res.status(304);
        res.end();
        return;
      }

      // Log ETag information for monitoring
      this.logETagInfo(req.url, comparison);
    } catch (error) {
      logger.warn(
        `ETag processing error for ${req.url}:`,
        error instanceof Error ? error.message : error
      );
      // Don't fail the request if ETag processing has issues
    }
  }

  /**
   * Manual ETag generation for SSR content
   */
  async generateETagForSSR(
    url: string,
    html: string
  ): Promise<{
    etag: string;
    lastModified: string;
    cacheControl: string;
  }> {
    const contentHash = await this.etagManager.generateETag(html, url);
    const cacheHeaders = this.etagManager.getCacheControlHeaders();

    return {
      etag: contentHash.etag,
      lastModified: contentHash.lastModified,
      cacheControl: cacheHeaders['Cache-Control'],
    };
  }

  /**
   * Check if content should be served from cache
   */
  async shouldServeFromCache(req: Request, cachedHtml: string): Promise<boolean> {
    if (!this.config.enabled || !this.config.enable304Responses) {
      return false;
    }

    const ifNoneMatch = req.headers['if-none-match'] as string;
    const ifModifiedSince = req.headers['if-modified-since'] as string;

    const comparison = await this.etagManager.compareETag(
      req.url,
      cachedHtml,
      ifNoneMatch,
      ifModifiedSince
    );

    return comparison.notModified;
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.etagManager.getCacheStats();
  }

  /**
   * Clean up old cache entries
   */
  cleanupCache(maxAge?: number) {
    this.etagManager.cleanupCache(maxAge);
  }

  /**
   * Log ETag information for monitoring and debugging
   */
  private logETagInfo(url: string, comparison: ETagComparison): void {
    const status = comparison.notModified ? '304' : '200';
    const etagShort = comparison.etag ? comparison.etag.slice(0, 20) + '...' : 'none';

    logger.debug(`[${status}] ETag: ${etagShort} for ${url}`);

    if (comparison.changeType && comparison.changeType !== 'none') {
      logger.debug(`Content change: ${comparison.changeType.toUpperCase()}`);

      if (comparison.changeDetails) {
        const details = comparison.changeDetails;
        logger.debug(
          `Details: ${details.wordChanges} words, ${details.structuralChanges} structural elements`
        );
        if (details.newImages > 0 || details.removedImages > 0) {
          logger.debug(`Images: +${details.newImages} -${details.removedImages}`);
        }
      }
    }

    if (!comparison.cacheable) {
      logger.warn(`Content marked as non-cacheable: ${url}`);
    }
  }

  /**
   * Initialize ETag service with configuration
   */
  static create(config?: Partial<SeoProtocolConfig['etagStrategy']>): ETagService {
    const defaultConfig = ETagManager.getDefaultConfig();
    const finalConfig = { ...defaultConfig, ...config };

    return new ETagService(finalConfig);
  }
}

// Singleton instance for easy access
let etagService: ETagService | null = null;

/**
 * Get or create ETag service singleton
 */
export function getETagService(config?: SeoProtocolConfig['etagStrategy']): ETagService {
  if (!etagService) {
    if (!config) {
      config = ETagManager.getDefaultConfig();
    }
    etagService = new ETagService(config);
  }
  return etagService;
}
