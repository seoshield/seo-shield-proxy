import crypto from 'crypto';
import { SeoProtocolConfig } from '../config';

/**
 * ETag strategy configuration
 */
export interface ETagConfig {
  enabled: boolean;
  hashAlgorithm: 'md5' | 'sha256';
  enable304Responses: boolean;
  checkContentChanges: boolean;
  ignoredElements: string[];
  significantChanges: {
    minWordChange: number;
    minStructureChange: number;
    contentWeightThreshold: number;
  };
}

/**
 * Content hash and metadata
 */
export interface ContentHash {
  etag: string;
  lastModified: string;
  contentLength: number;
  significantHash: string;
  structureHash: string;
  fullHash: string;
  changeType: 'none' | 'minor' | 'significant' | 'major';
  timestamp: number;
}

/**
 * ETag comparison result
 */
export interface ETagComparison {
  notModified: boolean;
  etag: string;
  lastModified: string;
  cacheable: boolean;
  maxAge?: number;
  changeType?: 'none' | 'minor' | 'significant' | 'major';
  changeDetails?: {
    wordChanges: number;
    structuralChanges: number;
    newImages: number;
    removedImages: number;
  };
}

/**
 * ETag and 304 Not Modified Manager
 *
 * Advanced content change detection using sophisticated hashing algorithms
 * and browser cache optimization for improved performance.
 */
export class ETagManager {
  private config: ETagConfig;
  private etagCache = new Map<string, ContentHash>();

  constructor(config: ETagConfig) {
    this.config = config;
  }

  /**
   * Generate ETag for rendered content
   */
  async generateETag(html: string, url: string): Promise<ContentHash> {
    if (!this.config.enabled) {
      return {
        etag: '',
        lastModified: new Date().toUTCString(),
        contentLength: html.length,
        significantHash: '',
        structureHash: '',
        fullHash: '',
        changeType: 'none',
        timestamp: Date.now(),
      };
    }

    const timestamp = Date.now();
    const contentLength = html.length;

    // Generate different types of hashes for different purposes
    const fullHash = this.hashContent(html);
    const structureHash = this.hashStructure(html);
    const significantHash = this.hashSignificantContent(html);

    const etag = `"${significantHash}-${structureHash.slice(0, 8)}"`;
    const lastModified = new Date(timestamp).toUTCString();

    const contentHash: ContentHash = {
      etag,
      lastModified,
      contentLength,
      significantHash,
      structureHash,
      fullHash,
      changeType: 'none',
      timestamp,
    };

    // Cache the hash for future comparisons
    this.etagCache.set(url, contentHash);

    return contentHash;
  }

  /**
   * Check if content has changed based on ETag comparison
   */
  async compareETag(
    url: string,
    html: string,
    ifNoneMatch?: string,
    ifModifiedSince?: string
  ): Promise<ETagComparison> {
    if (!this.config.enabled) {
      return {
        notModified: false,
        etag: '',
        lastModified: new Date().toUTCString(),
        cacheable: true,
      };
    }

    const newHash = await this.generateETag(html, url);
    const cachedHash = this.etagCache.get(url);

    // If we have no cached content, it's definitely new
    if (!cachedHash) {
      return {
        notModified: false,
        etag: newHash.etag,
        lastModified: newHash.lastModified,
        cacheable: true,
        changeType: 'major',
      };
    }

    // Check If-None-Match header
    if (ifNoneMatch && ifNoneMatch === cachedHash.etag) {
      return {
        notModified: true,
        etag: cachedHash.etag,
        lastModified: cachedHash.lastModified,
        cacheable: true,
        changeType: 'none',
      };
    }

    // Check If-Modified-Since header
    if (ifModifiedSince) {
      const cachedTime = new Date(cachedHash.lastModified).getTime();
      const modifiedSinceTime = new Date(ifModifiedSince).getTime();

      if (cachedTime <= modifiedSinceTime) {
        return {
          notModified: true,
          etag: cachedHash.etag,
          lastModified: cachedHash.lastModified,
          cacheable: true,
          changeType: 'none',
        };
      }
    }

    // Analyze the type of changes
    const changeAnalysis = this.analyzeChanges(html, cachedHash, newHash);

    return {
      notModified: false,
      etag: newHash.etag,
      lastModified: newHash.lastModified,
      cacheable: true,
      changeType: changeAnalysis.changeType,
      changeDetails: changeAnalysis.details,
    };
  }

  /**
   * Analyze content changes to determine significance
   */
  private analyzeChanges(
    newHtml: string,
    cachedHash: ContentHash,
    newHash: ContentHash
  ): { changeType: 'minor' | 'significant' | 'major'; details: any } {
    const details = {
      wordChanges: 0,
      structuralChanges: 0,
      newImages: 0,
      removedImages: 0,
    };

    // Check for structural changes
    if (newHash.structureHash !== cachedHash.structureHash) {
      details.structuralChanges = this.countStructuralChanges(newHtml);
    }

    // Check for content changes
    if (newHash.significantHash !== cachedHash.significantHash) {
      details.wordChanges = this.countWordChanges(newHtml);
    }

    // Count image changes
    const imageChanges = this.countImageChanges(newHtml);
    details.newImages = imageChanges.new;
    details.removedImages = imageChanges.removed;

    // Determine change type
    const config = this.config.significantChanges;
    let changeType: 'minor' | 'significant' | 'major' = 'minor';

    if (details.structuralChanges >= config.minStructureChange) {
      changeType = 'significant';
    }

    if (details.wordChanges >= config.minWordChange) {
      changeType = 'significant';
    }

    // Major changes for significant content weight changes
    const contentChangeRatio = Math.abs(newHash.contentLength - cachedHash.contentLength) / cachedHash.contentLength;
    if (contentChangeRatio > config.contentWeightThreshold / 100) {
      changeType = 'major';
    }

    return { changeType, details };
  }

  /**
   * Hash content using specified algorithm
   */
  private hashContent(content: string): string {
    const algorithm = this.config.hashAlgorithm;
    return crypto.createHash(algorithm).update(content).digest('hex');
  }

  /**
   * Hash HTML structure (ignoring text content)
   */
  private hashStructure(html: string): string {
    // Remove text content and keep only structure
    const structure = html
      .replace(/>([^<]+)</g, '><') // Remove text between tags
      .replace(/\s+/g, '') // Remove whitespace
      .toLowerCase();

    return this.hashContent(structure);
  }

  /**
   * Hash significant content (excluding dynamic elements)
   */
  private hashSignificantContent(html: string): string {
    let content = html;

    try {
      // Remove ignored elements
      for (const selector of this.config.ignoredElements) {
        const regex = new RegExp(`<[^>]*${selector}[^>]*>.*?<\/[^>]*${selector}[^>]*>`, 'gis');
        content = content.replace(regex, '');
      }

      // Remove common dynamic patterns
      content = content
        .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z?\b/g, '[TIMESTAMP]') // Timestamps
        .replace(/\b\d{13,}\b/g, '[TIMESTAMP]') // Unix timestamps
        .replace(/\bdata-[a-z-]+="[^"]*"/gi, '') // Data attributes
        .replace(/nonce="[^"]*"/gi, 'nonce="[NONCE]"') // Nonce values
        .replace(/csrf-token[^>]*value="[^"]*"/gi, 'csrf-token value="[CSRF]"') // CSRF tokens
        .replace(/session-id[^>]*value="[^"]*"/gi, 'session-id value="[SESSION]"'); // Session IDs
    } catch (error) {
      // If pattern matching fails, return original content
      return html;
    }

    return this.hashContent(content);
  }

  /**
   * Count structural changes in HTML
   */
  private countStructuralChanges(html: string): number {
    // Count number of different HTML elements
    const elementMatches = html.match(/<\w+/g) || [];
    return elementMatches.length;
  }

  /**
   * Count word changes in content
   */
  private countWordChanges(html: string): number {
    // Extract text content and count words
    const textContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return textContent.split(/\s+/).length;
  }

  /**
   * Count image changes
   */
  private countImageChanges(html: string): { new: number; removed: number } {
    const imageMatches = html.match(/<img[^>]*src="([^"]*)"[^>]*>/gi) || [];
    return {
      new: imageMatches.length,
      removed: 0, // We would need previous HTML to count removed images
    };
  }

  /**
   * Get cache control headers based on content type
   */
  getCacheControlHeaders(changeType?: 'none' | 'minor' | 'significant' | 'major'): {
    'Cache-Control': string;
    'ETag': string;
    'Last-Modified': string;
    'Vary'?: string;
  } {
    const headers: any = {
      'Cache-Control': 'public, max-age=3600', // Default 1 hour
      'ETag': this.generateETag('cache-header', Date.now().toString()),
      'Last-Modified': new Date().toUTCString(),
    };

    // Adjust cache time based on change type
    switch (changeType) {
      case 'none':
        headers['Cache-Control'] = 'public, max-age=86400'; // 24 hours
        break;
      case 'minor':
        headers['Cache-Control'] = 'public, max-age=7200'; // 2 hours
        break;
      case 'significant':
        headers['Cache-Control'] = 'public, max-age=1800'; // 30 minutes
        break;
      case 'major':
        headers['Cache-Control'] = 'public, max-age=600'; // 10 minutes
        break;
    }

    return headers;
  }

  /**
   * Clean up old entries from cache
   */
  cleanupCache(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    const cutoffTime = Date.now() - maxAge;

    for (const [url, hash] of this.etagCache.entries()) {
      if (hash.timestamp < cutoffTime) {
        this.etagCache.delete(url);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalEntries: number;
    cacheHitRate?: number;
    memoryUsage?: number;
  } {
    return {
      totalEntries: this.etagCache.size,
      // Additional stats could be calculated if we track hits/misses
    };
  }

  /**
   * Check if URL should be cached based on patterns
   */
  shouldCacheUrl(url: string): boolean {
    // URLs with query parameters that indicate dynamic content
    const noCachePatterns = [
      /\?.*(_|=|random|timestamp|nonce|csrf|session)/i,
      /\/api\//i,
      /\/admin\//i,
      /\.(json|xml|txt|css|js|ico|png|jpg|jpeg|gif|svg|webp)$/i,
    ];

    return !noCachePatterns.some(pattern => pattern.test(url));
  }

  /**
   * Get default configuration for ETag strategy
   */
  static getDefaultConfig(): ETagConfig {
    return {
      enabled: true,
      hashAlgorithm: 'sha256',
      enable304Responses: true,
      checkContentChanges: true,
      ignoredElements: [
        'script',
        'style',
        'noscript',
        'iframe',
        'svg',
        'canvas',
        'video',
        'audio'
      ],
      significantChanges: {
        minWordChange: 50,
        minStructureChange: 10,
        contentWeightThreshold: 25, // 25% change
      },
    };
  }
}