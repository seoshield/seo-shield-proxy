/**
 * SEO Health Checker
 * Comprehensive SEO analysis and health scoring for web pages
 */

import { Page } from 'puppeteer';
import { Logger } from '../utils/logger';
import { CoreWebVitalsCollector } from './core-web-vitals';
import {
  SEOHealthReport,
  SEOHealthConfig,
  SEOCheck,
  SEOIssue,
  HeadingStructure,
  ImageAnalysis,
  ImageInfo,
  LinkAnalysis,
  LinkInfo,
  MetaTagAnalysis,
  StructuredDataCheck,
  DEFAULT_SEO_HEALTH_CONFIG,
  GRADE_THRESHOLDS,
} from '../types/seo.types';

const logger = new Logger('SEOHealthChecker');

/**
 * SEO Health Checker
 * Performs comprehensive SEO analysis on web pages
 */
export class SEOHealthChecker {
  private config: SEOHealthConfig;
  private coreWebVitals: CoreWebVitalsCollector;

  constructor(config: Partial<SEOHealthConfig> = {}) {
    this.config = { ...DEFAULT_SEO_HEALTH_CONFIG, ...config };
    this.coreWebVitals = new CoreWebVitalsCollector({
      timeout: this.config.coreWebVitalsTimeout,
    });
  }

  /**
   * Perform comprehensive SEO health check
   */
  async check(page: Page, url: string): Promise<SEOHealthReport> {
    const startTime = Date.now();
    const checks: SEOCheck[] = [];
    const issues: SEOIssue[] = [];
    const recommendations: string[] = [];

    try {
      // Collect meta tags
      const meta = await this.collectMetaTags(page);

      // Title check
      if (this.config.checkTitle) {
        const titleCheck = this.checkTitle(meta.title);
        checks.push(titleCheck);
        if (titleCheck.status !== 'pass') {
          issues.push(this.createIssue('title', titleCheck));
        }
      }

      // Meta description check
      if (this.config.checkDescription) {
        const descCheck = this.checkDescription(meta.description);
        checks.push(descCheck);
        if (descCheck.status !== 'pass') {
          issues.push(this.createIssue('description', descCheck));
        }
      }

      // Heading structure check
      const headings = await this.collectHeadings(page);
      if (this.config.checkHeadings) {
        const headingChecks = this.checkHeadings(headings);
        checks.push(...headingChecks);
        headingChecks
          .filter((c) => c.status !== 'pass')
          .forEach((c) => issues.push(this.createIssue('heading', c)));
      }

      // Image check
      const images = await this.collectImages(page);
      if (this.config.checkImages) {
        const imageChecks = this.checkImages(images);
        checks.push(...imageChecks);
        imageChecks
          .filter((c) => c.status !== 'pass')
          .forEach((c) => issues.push(this.createIssue('image', c)));
      }

      // Link check
      const links = await this.collectLinks(page);
      if (this.config.checkLinks) {
        const linkChecks = this.checkLinks(links);
        checks.push(...linkChecks);
      }

      // Canonical check
      if (this.config.checkCanonical) {
        const canonicalCheck = this.checkCanonical(meta.canonical, url);
        checks.push(canonicalCheck);
        if (canonicalCheck.status !== 'pass') {
          issues.push(this.createIssue('canonical', canonicalCheck));
        }
      }

      // Open Graph check
      if (this.config.checkOpenGraph) {
        const ogChecks = this.checkOpenGraph(meta);
        checks.push(...ogChecks);
      }

      // Twitter Cards check
      if (this.config.checkTwitterCards) {
        const twitterCheck = this.checkTwitterCards(meta);
        checks.push(twitterCheck);
      }

      // Mobile friendly check
      if (this.config.checkMobileFriendly) {
        const mobileCheck = await this.checkMobileFriendly(page, meta);
        checks.push(mobileCheck);
      }

      // Structured data check
      let structuredData: StructuredDataCheck = {
        valid: true,
        types: [],
        errors: [],
        warnings: [],
        schemas: [],
      };
      if (this.config.checkStructuredData) {
        structuredData = await this.validateStructuredData(page);
        const sdCheck = this.checkStructuredDataResult(structuredData);
        checks.push(sdCheck);
      }

      // Core Web Vitals
      let cwv = this.coreWebVitals['getEmptyMetrics']();
      if (this.config.checkCoreWebVitals) {
        cwv = await this.coreWebVitals.collect(page);
        recommendations.push(...this.coreWebVitals.getRecommendations(cwv));
      }

      // Calculate score
      const score = this.calculateScore(checks, cwv);
      const grade = this.calculateGrade(score);

      // Generate recommendations
      recommendations.push(...this.generateRecommendations(checks, issues));

      const duration = Date.now() - startTime;

      logger.info(`SEO health check completed for ${url}`, {
        score,
        grade,
        checksCount: checks.length,
        issuesCount: issues.length,
        duration,
      });

      return {
        url,
        score,
        grade,
        timestamp: new Date(),
        duration,
        checks,
        coreWebVitals: cwv,
        structuredData,
        issues,
        meta,
        headings,
        images,
        links,
        recommendations: [...new Set(recommendations)], // Remove duplicates
      };
    } catch (error) {
      logger.error('SEO health check failed:', error);
      throw error;
    }
  }

  /**
   * Collect meta tags from page
   */
  private async collectMetaTags(page: Page): Promise<MetaTagAnalysis> {
    return page.evaluate(() => {
      const getMeta = (name: string): string | undefined => {
        const el =
          document.querySelector(`meta[name="${name}"]`) ||
          document.querySelector(`meta[property="${name}"]`);
        return el?.getAttribute('content') || undefined;
      };

      const getLink = (rel: string): string | undefined => {
        const el = document.querySelector(`link[rel="${rel}"]`);
        return el?.getAttribute('href') || undefined;
      };

      return {
        title: document.title || undefined,
        description: getMeta('description'),
        canonical: getLink('canonical'),
        robots: getMeta('robots'),
        ogTitle: getMeta('og:title'),
        ogDescription: getMeta('og:description'),
        ogImage: getMeta('og:image'),
        twitterCard: getMeta('twitter:card'),
        viewport: getMeta('viewport'),
        charset: document.characterSet || undefined,
      };
    });
  }

  /**
   * Collect heading structure
   */
  private async collectHeadings(page: Page): Promise<HeadingStructure> {
    return page.evaluate(() => {
      const getHeadings = (tag: string): string[] =>
        Array.from(document.querySelectorAll(tag)).map((el) => el.textContent?.trim() || '');

      const h1s = getHeadings('h1');
      const h2s = getHeadings('h2');
      const h3s = getHeadings('h3');
      const h4s = getHeadings('h4');
      const h5s = getHeadings('h5');
      const h6s = getHeadings('h6');

      // Check hierarchy validity (no skipped levels)
      let hierarchyValid = true;
      const levels = [h1s.length, h2s.length, h3s.length, h4s.length, h5s.length, h6s.length];
      let foundContent = false;
      for (let i = 0; i < levels.length; i++) {
        if (levels[i] > 0) {
          foundContent = true;
        } else if (foundContent && levels[i] === 0 && i < levels.length - 1 && levels[i + 1] > 0) {
          hierarchyValid = false;
          break;
        }
      }

      return {
        h1: h1s,
        h2: h2s,
        h3: h3s,
        h4: h4s,
        h5: h5s,
        h6: h6s,
        hasMultipleH1: h1s.length > 1,
        missingH1: h1s.length === 0,
        hierarchyValid,
      };
    });
  }

  /**
   * Collect images from page
   */
  private async collectImages(page: Page): Promise<ImageAnalysis> {
    return page.evaluate(() => {
      const images: ImageInfo[] = Array.from(document.querySelectorAll('img')).map((img) => ({
        src: img.src || img.getAttribute('data-src') || '',
        alt: img.alt || undefined,
        hasAlt: img.hasAttribute('alt'),
        isLazy: img.loading === 'lazy' || img.hasAttribute('data-src'),
        dimensions:
          img.naturalWidth && img.naturalHeight
            ? { width: img.naturalWidth, height: img.naturalHeight }
            : undefined,
      }));

      const withAlt = images.filter((i) => i.hasAlt && i.alt && i.alt.trim().length > 0).length;
      const withoutAlt = images.filter((i) => !i.hasAlt).length;
      const withEmptyAlt = images.filter((i) => i.hasAlt && (!i.alt || i.alt.trim().length === 0)).length;
      const lazyLoaded = images.filter((i) => i.isLazy).length;

      return {
        total: images.length,
        withAlt,
        withoutAlt,
        withEmptyAlt,
        lazyLoaded,
        images,
      };
    });
  }

  /**
   * Collect links from page
   */
  private async collectLinks(page: Page): Promise<LinkAnalysis> {
    const currentHost = await page.evaluate(() => window.location.host);

    return page.evaluate((host) => {
      const links: LinkInfo[] = Array.from(document.querySelectorAll('a[href]')).map((a) => {
        const href = a.getAttribute('href') || '';
        let isExternal = false;
        try {
          if (href.startsWith('http')) {
            const url = new URL(href);
            isExternal = url.host !== host;
          }
        } catch {
          // Invalid URL
        }

        return {
          href,
          text: a.textContent?.trim() || '',
          isExternal,
          rel: a.getAttribute('rel') || undefined,
          target: a.getAttribute('target') || undefined,
        };
      });

      const internal = links.filter((l) => !l.isExternal).length;
      const external = links.filter((l) => l.isExternal).length;
      const nofollow = links.filter((l) => l.rel?.includes('nofollow')).length;

      return {
        internal,
        external,
        broken: 0, // Would need additional requests to check
        nofollow,
        links,
      };
    }, currentHost);
  }

  /**
   * Validate structured data
   */
  private async validateStructuredData(page: Page): Promise<StructuredDataCheck> {
    return page.evaluate(() => {
      const schemas: { type: string; properties: Record<string, unknown>; isValid: boolean; errors?: string[] }[] = [];
      const types: string[] = [];
      const errors: string[] = [];
      const warnings: string[] = [];

      // Check JSON-LD
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      jsonLdScripts.forEach((script) => {
        try {
          const data = JSON.parse(script.textContent || '{}');
          const schemaType = data['@type'] || 'Unknown';
          types.push(schemaType);
          schemas.push({
            type: schemaType,
            properties: data,
            isValid: true,
          });
        } catch (e) {
          errors.push(`Invalid JSON-LD: ${(e as Error).message}`);
        }
      });

      // Check Microdata
      const itemscopes = document.querySelectorAll('[itemscope]');
      itemscopes.forEach((el) => {
        const itemtype = el.getAttribute('itemtype');
        if (itemtype) {
          const type = itemtype.split('/').pop() || 'Unknown';
          if (!types.includes(type)) {
            types.push(type);
          }
        }
      });

      // Warnings for missing common schemas
      if (types.length === 0) {
        warnings.push('No structured data found. Consider adding Schema.org markup.');
      }

      return {
        valid: errors.length === 0,
        types,
        errors,
        warnings,
        schemas,
      };
    });
  }

  /**
   * Check title tag
   */
  private checkTitle(title?: string): SEOCheck {
    if (!title) {
      return {
        name: 'Title',
        status: 'fail',
        impact: 'critical',
        details: 'Page is missing a title tag',
      };
    }

    const length = title.length;
    if (length < this.config.titleMinLength) {
      return {
        name: 'Title',
        status: 'warning',
        value: title,
        expected: `${this.config.titleMinLength}-${this.config.titleMaxLength} chars`,
        impact: 'medium',
        details: `Title is too short (${length} chars)`,
      };
    }

    if (length > this.config.titleMaxLength) {
      return {
        name: 'Title',
        status: 'warning',
        value: title,
        expected: `${this.config.titleMinLength}-${this.config.titleMaxLength} chars`,
        impact: 'low',
        details: `Title may be truncated in search results (${length} chars)`,
      };
    }

    return {
      name: 'Title',
      status: 'pass',
      value: title,
      impact: 'low',
    };
  }

  /**
   * Check meta description
   */
  private checkDescription(description?: string): SEOCheck {
    if (!description) {
      return {
        name: 'Meta Description',
        status: 'fail',
        impact: 'high',
        details: 'Page is missing a meta description',
      };
    }

    const length = description.length;
    if (length < this.config.descriptionMinLength) {
      return {
        name: 'Meta Description',
        status: 'warning',
        value: description,
        expected: `${this.config.descriptionMinLength}-${this.config.descriptionMaxLength} chars`,
        impact: 'medium',
        details: `Description is too short (${length} chars)`,
      };
    }

    if (length > this.config.descriptionMaxLength) {
      return {
        name: 'Meta Description',
        status: 'warning',
        value: description,
        expected: `${this.config.descriptionMinLength}-${this.config.descriptionMaxLength} chars`,
        impact: 'low',
        details: `Description may be truncated (${length} chars)`,
      };
    }

    return {
      name: 'Meta Description',
      status: 'pass',
      value: description,
      impact: 'low',
    };
  }

  /**
   * Check heading structure
   */
  private checkHeadings(headings: HeadingStructure): SEOCheck[] {
    const checks: SEOCheck[] = [];

    // H1 check
    if (headings.missingH1) {
      checks.push({
        name: 'H1 Tag',
        status: 'fail',
        impact: 'high',
        details: 'Page is missing an H1 heading',
      });
    } else if (headings.hasMultipleH1) {
      checks.push({
        name: 'H1 Tag',
        status: 'warning',
        value: `${headings.h1.length} H1 tags found`,
        impact: 'medium',
        details: 'Multiple H1 tags may confuse search engines',
      });
    } else {
      checks.push({
        name: 'H1 Tag',
        status: 'pass',
        value: headings.h1[0],
        impact: 'low',
      });
    }

    // Hierarchy check
    if (!headings.hierarchyValid) {
      checks.push({
        name: 'Heading Hierarchy',
        status: 'warning',
        impact: 'medium',
        details: 'Heading levels are skipped (e.g., H1 -> H3)',
      });
    } else {
      checks.push({
        name: 'Heading Hierarchy',
        status: 'pass',
        impact: 'low',
      });
    }

    return checks;
  }

  /**
   * Check images
   */
  private checkImages(images: ImageAnalysis): SEOCheck[] {
    const checks: SEOCheck[] = [];

    // Alt text check
    if (images.withoutAlt > 0) {
      checks.push({
        name: 'Image Alt Text',
        status: 'fail',
        value: `${images.withoutAlt}/${images.total} missing`,
        impact: 'medium',
        details: `${images.withoutAlt} images are missing alt attributes`,
      });
    } else if (images.withEmptyAlt > 0) {
      checks.push({
        name: 'Image Alt Text',
        status: 'warning',
        value: `${images.withEmptyAlt}/${images.total} empty`,
        impact: 'low',
        details: `${images.withEmptyAlt} images have empty alt attributes`,
      });
    } else if (images.total > 0) {
      checks.push({
        name: 'Image Alt Text',
        status: 'pass',
        value: `${images.withAlt}/${images.total} have alt`,
        impact: 'low',
      });
    }

    // Lazy loading check
    if (images.total > 5 && images.lazyLoaded === 0) {
      checks.push({
        name: 'Lazy Loading',
        status: 'warning',
        value: `0/${images.total} lazy loaded`,
        impact: 'medium',
        details: 'Consider lazy loading images for better performance',
      });
    } else if (images.lazyLoaded > 0) {
      checks.push({
        name: 'Lazy Loading',
        status: 'pass',
        value: `${images.lazyLoaded}/${images.total} lazy loaded`,
        impact: 'low',
      });
    }

    return checks;
  }

  /**
   * Check links
   */
  private checkLinks(links: LinkAnalysis): SEOCheck[] {
    const checks: SEOCheck[] = [];

    // Internal links check
    if (links.internal === 0) {
      checks.push({
        name: 'Internal Links',
        status: 'warning',
        impact: 'medium',
        details: 'No internal links found',
      });
    } else {
      checks.push({
        name: 'Internal Links',
        status: 'pass',
        value: `${links.internal} found`,
        impact: 'low',
      });
    }

    // External links with nofollow
    if (links.external > 0) {
      checks.push({
        name: 'External Links',
        status: 'pass',
        value: `${links.external} external (${links.nofollow} nofollow)`,
        impact: 'low',
      });
    }

    return checks;
  }

  /**
   * Check canonical URL
   */
  private checkCanonical(canonical?: string, pageUrl?: string): SEOCheck {
    if (!canonical) {
      return {
        name: 'Canonical URL',
        status: 'warning',
        impact: 'medium',
        details: 'Page is missing a canonical URL',
      };
    }

    // Check if canonical matches page URL
    if (pageUrl) {
      try {
        const canonicalUrl = new URL(canonical, pageUrl);
        const currentUrl = new URL(pageUrl);
        if (canonicalUrl.pathname !== currentUrl.pathname) {
          return {
            name: 'Canonical URL',
            status: 'warning',
            value: canonical,
            impact: 'medium',
            details: 'Canonical URL differs from page URL',
          };
        }
      } catch {
        // URL parsing failed
      }
    }

    return {
      name: 'Canonical URL',
      status: 'pass',
      value: canonical,
      impact: 'low',
    };
  }

  /**
   * Check Open Graph tags
   */
  private checkOpenGraph(meta: MetaTagAnalysis): SEOCheck[] {
    const checks: SEOCheck[] = [];
    const missing: string[] = [];

    if (!meta.ogTitle) missing.push('og:title');
    if (!meta.ogDescription) missing.push('og:description');
    if (!meta.ogImage) missing.push('og:image');

    if (missing.length > 0) {
      checks.push({
        name: 'Open Graph',
        status: missing.length === 3 ? 'warning' : 'pass',
        value: missing.length === 0 ? 'Complete' : `Missing: ${missing.join(', ')}`,
        impact: 'medium',
        details: missing.length > 0 ? 'Some Open Graph tags are missing' : undefined,
      });
    } else {
      checks.push({
        name: 'Open Graph',
        status: 'pass',
        value: 'Complete',
        impact: 'low',
      });
    }

    return checks;
  }

  /**
   * Check Twitter Cards
   */
  private checkTwitterCards(meta: MetaTagAnalysis): SEOCheck {
    if (!meta.twitterCard) {
      return {
        name: 'Twitter Card',
        status: 'warning',
        impact: 'low',
        details: 'Twitter Card meta tag is missing',
      };
    }

    return {
      name: 'Twitter Card',
      status: 'pass',
      value: meta.twitterCard,
      impact: 'low',
    };
  }

  /**
   * Check mobile friendliness
   */
  private async checkMobileFriendly(page: Page, meta: MetaTagAnalysis): Promise<SEOCheck> {
    // Check viewport meta
    if (!meta.viewport) {
      return {
        name: 'Mobile Friendly',
        status: 'fail',
        impact: 'high',
        details: 'Viewport meta tag is missing',
      };
    }

    // Check if viewport is properly configured
    if (!meta.viewport.includes('width=device-width')) {
      return {
        name: 'Mobile Friendly',
        status: 'warning',
        value: meta.viewport,
        impact: 'medium',
        details: 'Viewport should include width=device-width',
      };
    }

    // Check for horizontal scroll (basic check)
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    if (hasHorizontalScroll) {
      return {
        name: 'Mobile Friendly',
        status: 'warning',
        impact: 'medium',
        details: 'Page has horizontal scroll which may indicate mobile issues',
      };
    }

    return {
      name: 'Mobile Friendly',
      status: 'pass',
      value: 'Viewport configured correctly',
      impact: 'low',
    };
  }

  /**
   * Check structured data result
   */
  private checkStructuredDataResult(sd: StructuredDataCheck): SEOCheck {
    if (sd.errors.length > 0) {
      return {
        name: 'Structured Data',
        status: 'fail',
        value: sd.errors.join('; '),
        impact: 'medium',
        details: 'Structured data has validation errors',
      };
    }

    if (sd.types.length === 0) {
      return {
        name: 'Structured Data',
        status: 'warning',
        impact: 'medium',
        details: 'No structured data found',
      };
    }

    return {
      name: 'Structured Data',
      status: 'pass',
      value: sd.types.join(', '),
      impact: 'low',
    };
  }

  /**
   * Create issue from check
   */
  private createIssue(type: string, check: SEOCheck): SEOIssue {
    return {
      type,
      severity: check.status === 'fail' ? 'error' : 'warning',
      message: check.details || `${check.name} check ${check.status}`,
      suggestion: this.getSuggestion(type, check),
    };
  }

  /**
   * Get suggestion for issue
   */
  private getSuggestion(type: string, check: SEOCheck): string {
    const suggestions: Record<string, string> = {
      title: 'Add a unique, descriptive title between 30-60 characters',
      description: 'Add a compelling meta description between 120-160 characters',
      heading: 'Ensure page has exactly one H1 tag and follows heading hierarchy',
      image: 'Add descriptive alt text to all images',
      canonical: 'Add a canonical URL to prevent duplicate content issues',
    };
    return suggestions[type] || `Review and fix ${check.name}`;
  }

  /**
   * Calculate overall score
   */
  private calculateScore(checks: SEOCheck[], cwv: { scores: { lcp: string; fid: string; cls: string } }): number {
    let score = 100;

    // Deduct for failed checks
    for (const check of checks) {
      if (check.status === 'fail') {
        switch (check.impact) {
          case 'critical':
            score -= 20;
            break;
          case 'high':
            score -= 10;
            break;
          case 'medium':
            score -= 5;
            break;
          default:
            score -= 2;
        }
      } else if (check.status === 'warning') {
        switch (check.impact) {
          case 'critical':
            score -= 10;
            break;
          case 'high':
            score -= 5;
            break;
          case 'medium':
            score -= 3;
            break;
          default:
            score -= 1;
        }
      }
    }

    // Deduct for poor Core Web Vitals
    if (cwv.scores.lcp === 'poor') score -= 10;
    else if (cwv.scores.lcp === 'needs-improvement') score -= 5;

    if (cwv.scores.fid === 'poor') score -= 10;
    else if (cwv.scores.fid === 'needs-improvement') score -= 5;

    if (cwv.scores.cls === 'poor') score -= 10;
    else if (cwv.scores.cls === 'needs-improvement') score -= 5;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate grade from score
   */
  private calculateGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= GRADE_THRESHOLDS.A) return 'A';
    if (score >= GRADE_THRESHOLDS.B) return 'B';
    if (score >= GRADE_THRESHOLDS.C) return 'C';
    if (score >= GRADE_THRESHOLDS.D) return 'D';
    return 'F';
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(checks: SEOCheck[], issues: SEOIssue[]): string[] {
    const recommendations: string[] = [];

    // Critical issues first
    const criticalFails = checks.filter((c) => c.status === 'fail' && c.impact === 'critical');
    if (criticalFails.length > 0) {
      recommendations.push('Fix critical issues first:');
      criticalFails.forEach((c) => {
        recommendations.push(`  - ${c.name}: ${c.details || 'Needs attention'}`);
      });
    }

    // High impact issues
    const highImpactFails = checks.filter((c) => c.status === 'fail' && c.impact === 'high');
    if (highImpactFails.length > 0) {
      recommendations.push('Address high-impact issues:');
      highImpactFails.forEach((c) => {
        recommendations.push(`  - ${c.name}: ${c.details || 'Needs attention'}`);
      });
    }

    // Suggestions from issues
    issues.forEach((issue) => {
      if (issue.suggestion && !recommendations.includes(issue.suggestion)) {
        recommendations.push(issue.suggestion);
      }
    });

    return recommendations;
  }

  /**
   * Get configuration
   */
  getConfig(): SEOHealthConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SEOHealthConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get default configuration
   */
  static getDefaultConfig(): SEOHealthConfig {
    return { ...DEFAULT_SEO_HEALTH_CONFIG };
  }
}

// Export singleton instance
let seoHealthCheckerInstance: SEOHealthChecker | null = null;

export function getSEOHealthChecker(config?: Partial<SEOHealthConfig>): SEOHealthChecker {
  if (!seoHealthCheckerInstance) {
    seoHealthCheckerInstance = new SEOHealthChecker(config);
  }
  return seoHealthCheckerInstance;
}
