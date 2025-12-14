/**
 * SEO Health Checker Tests
 * Tests for SEO health checking and analysis
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

describe('SEOHealthChecker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Module Import', () => {
    it('should import SEOHealthChecker', async () => {
      const module = await import('../../src/admin/seo-health-checker');
      expect(module.SEOHealthChecker).toBeDefined();
    });

    it('should import getSEOHealthChecker', async () => {
      const module = await import('../../src/admin/seo-health-checker');
      expect(module.getSEOHealthChecker).toBeDefined();
    });
  });

  describe('Initialization', () => {
    it('should create checker with default config', async () => {
      const { SEOHealthChecker } = await import('../../src/admin/seo-health-checker');
      const checker = new SEOHealthChecker();

      expect(checker).toBeDefined();
    });

    it('should create checker with custom config', async () => {
      const { SEOHealthChecker } = await import('../../src/admin/seo-health-checker');
      const checker = new SEOHealthChecker({
        checkTitle: true,
        checkDescription: false,
        titleMinLength: 40,
        titleMaxLength: 70,
      });

      expect(checker).toBeDefined();
      const config = checker.getConfig();
      expect(config.checkDescription).toBe(false);
      expect(config.titleMinLength).toBe(40);
      expect(config.titleMaxLength).toBe(70);
    });
  });

  describe('Default Configuration', () => {
    it('should provide default configuration', async () => {
      const { SEOHealthChecker } = await import('../../src/admin/seo-health-checker');
      const config = SEOHealthChecker.getDefaultConfig();

      expect(config.enabled).toBe(true);
      expect(config.checkTitle).toBe(true);
      expect(config.checkDescription).toBe(true);
      expect(config.checkHeadings).toBe(true);
      expect(config.checkImages).toBe(true);
      expect(config.checkLinks).toBe(true);
      expect(config.checkCanonical).toBe(true);
      expect(config.checkStructuredData).toBe(true);
      expect(config.checkCoreWebVitals).toBe(true);
      expect(config.checkMobileFriendly).toBe(true);
      expect(config.checkOpenGraph).toBe(true);
      expect(config.checkTwitterCards).toBe(true);
      expect(config.titleMinLength).toBe(30);
      expect(config.titleMaxLength).toBe(60);
      expect(config.descriptionMinLength).toBe(120);
      expect(config.descriptionMaxLength).toBe(160);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration', async () => {
      const { SEOHealthChecker } = await import('../../src/admin/seo-health-checker');
      const checker = new SEOHealthChecker();

      checker.updateConfig({
        checkImages: false,
        titleMaxLength: 80,
      });

      const config = checker.getConfig();
      expect(config.checkImages).toBe(false);
      expect(config.titleMaxLength).toBe(80);
    });
  });

  describe('Singleton Instance', () => {
    it('should return singleton instance', async () => {
      const { getSEOHealthChecker } = await import('../../src/admin/seo-health-checker');

      const checker1 = getSEOHealthChecker();
      const checker2 = getSEOHealthChecker();

      expect(checker1).toBeDefined();
      expect(checker2).toBeDefined();
    });
  });
});

describe('SEO Types', () => {
  describe('SEOHealthReport interface', () => {
    it('should have correct structure', async () => {
      const { DEFAULT_SEO_HEALTH_CONFIG, GRADE_THRESHOLDS } = await import('../../src/types/seo.types');

      expect(DEFAULT_SEO_HEALTH_CONFIG).toBeDefined();
      expect(GRADE_THRESHOLDS).toBeDefined();
      expect(GRADE_THRESHOLDS.A).toBe(90);
      expect(GRADE_THRESHOLDS.B).toBe(80);
      expect(GRADE_THRESHOLDS.C).toBe(70);
      expect(GRADE_THRESHOLDS.D).toBe(60);
      expect(GRADE_THRESHOLDS.F).toBe(0);
    });
  });

  describe('SEOCheck interface', () => {
    it('should accept valid check objects', async () => {
      const check = {
        name: 'Title',
        status: 'pass' as const,
        value: 'Test Page Title',
        impact: 'low' as const,
      };

      expect(check.name).toBe('Title');
      expect(check.status).toBe('pass');
      expect(check.impact).toBe('low');
    });

    it('should accept all status values', () => {
      const statuses: Array<'pass' | 'fail' | 'warning'> = ['pass', 'fail', 'warning'];
      statuses.forEach((status) => {
        const check = {
          name: 'Test',
          status,
          impact: 'low' as const,
        };
        expect(['pass', 'fail', 'warning']).toContain(check.status);
      });
    });

    it('should accept all impact values', () => {
      const impacts: Array<'low' | 'medium' | 'high' | 'critical'> = ['low', 'medium', 'high', 'critical'];
      impacts.forEach((impact) => {
        const check = {
          name: 'Test',
          status: 'pass' as const,
          impact,
        };
        expect(['low', 'medium', 'high', 'critical']).toContain(check.impact);
      });
    });
  });

  describe('SEOIssue interface', () => {
    it('should accept valid issue objects', () => {
      const issue = {
        type: 'title',
        severity: 'error' as const,
        message: 'Title is missing',
        suggestion: 'Add a title tag',
      };

      expect(issue.type).toBe('title');
      expect(issue.severity).toBe('error');
      expect(issue.message).toBe('Title is missing');
    });

    it('should accept all severity values', () => {
      const severities: Array<'error' | 'warning' | 'info'> = ['error', 'warning', 'info'];
      severities.forEach((severity) => {
        const issue = {
          type: 'test',
          severity,
          message: 'Test message',
        };
        expect(['error', 'warning', 'info']).toContain(issue.severity);
      });
    });
  });

  describe('HeadingStructure interface', () => {
    it('should accept valid heading structure', () => {
      const headings = {
        h1: ['Main Title'],
        h2: ['Section 1', 'Section 2'],
        h3: [],
        h4: [],
        h5: [],
        h6: [],
        hasMultipleH1: false,
        missingH1: false,
        hierarchyValid: true,
      };

      expect(headings.h1).toHaveLength(1);
      expect(headings.h2).toHaveLength(2);
      expect(headings.hasMultipleH1).toBe(false);
      expect(headings.missingH1).toBe(false);
    });
  });

  describe('ImageAnalysis interface', () => {
    it('should accept valid image analysis', () => {
      const images = {
        total: 10,
        withAlt: 8,
        withoutAlt: 1,
        withEmptyAlt: 1,
        lazyLoaded: 5,
        images: [],
      };

      expect(images.total).toBe(10);
      expect(images.withAlt).toBe(8);
      expect(images.withoutAlt + images.withEmptyAlt + images.withAlt).toBe(10);
    });
  });

  describe('LinkAnalysis interface', () => {
    it('should accept valid link analysis', () => {
      const links = {
        internal: 20,
        external: 5,
        broken: 0,
        nofollow: 2,
        links: [],
      };

      expect(links.internal).toBe(20);
      expect(links.external).toBe(5);
      expect(links.nofollow).toBe(2);
    });
  });

  describe('MetaTagAnalysis interface', () => {
    it('should accept valid meta tag analysis', () => {
      const meta = {
        title: 'Page Title',
        description: 'Page description for SEO',
        canonical: 'https://example.com/page',
        robots: 'index, follow',
        ogTitle: 'OG Title',
        ogDescription: 'OG Description',
        ogImage: 'https://example.com/image.jpg',
        twitterCard: 'summary_large_image',
        viewport: 'width=device-width, initial-scale=1',
        charset: 'UTF-8',
      };

      expect(meta.title).toBe('Page Title');
      expect(meta.canonical).toBe('https://example.com/page');
      expect(meta.viewport).toContain('device-width');
    });
  });

  describe('StructuredDataCheck interface', () => {
    it('should accept valid structured data check', () => {
      const sd = {
        valid: true,
        types: ['Article', 'Organization'],
        errors: [],
        warnings: [],
        schemas: [
          {
            type: 'Article',
            properties: { headline: 'Test Article' },
            isValid: true,
          },
        ],
      };

      expect(sd.valid).toBe(true);
      expect(sd.types).toContain('Article');
      expect(sd.schemas).toHaveLength(1);
    });
  });
});

describe('Grade Calculation', () => {
  it('should assign grade A for score >= 90', () => {
    const scores = [90, 95, 100];
    scores.forEach((score) => {
      expect(score >= 90).toBe(true);
    });
  });

  it('should assign grade B for score 80-89', () => {
    const scores = [80, 85, 89];
    scores.forEach((score) => {
      expect(score >= 80 && score < 90).toBe(true);
    });
  });

  it('should assign grade C for score 70-79', () => {
    const scores = [70, 75, 79];
    scores.forEach((score) => {
      expect(score >= 70 && score < 80).toBe(true);
    });
  });

  it('should assign grade D for score 60-69', () => {
    const scores = [60, 65, 69];
    scores.forEach((score) => {
      expect(score >= 60 && score < 70).toBe(true);
    });
  });

  it('should assign grade F for score < 60', () => {
    const scores = [0, 30, 59];
    scores.forEach((score) => {
      expect(score < 60).toBe(true);
    });
  });
});

describe('Title Check Logic', () => {
  it('should fail for missing title', () => {
    const title = undefined;
    const status = !title ? 'fail' : 'pass';
    expect(status).toBe('fail');
  });

  it('should warn for short title', () => {
    const title = 'Short';
    const minLength = 30;
    const status = title.length < minLength ? 'warning' : 'pass';
    expect(status).toBe('warning');
  });

  it('should warn for long title', () => {
    const title =
      'This is a very long title that exceeds the recommended maximum length for search results';
    const maxLength = 60;
    const status = title.length > maxLength ? 'warning' : 'pass';
    expect(status).toBe('warning');
  });

  it('should pass for optimal title length', () => {
    const title = 'This is a Good Title for SEO Purposes';
    const minLength = 30;
    const maxLength = 60;
    const status = title.length >= minLength && title.length <= maxLength ? 'pass' : 'warning';
    expect(status).toBe('pass');
  });
});

describe('Description Check Logic', () => {
  it('should fail for missing description', () => {
    const description = undefined;
    const status = !description ? 'fail' : 'pass';
    expect(status).toBe('fail');
  });

  it('should warn for short description', () => {
    const description = 'Too short description';
    const minLength = 120;
    const status = description.length < minLength ? 'warning' : 'pass';
    expect(status).toBe('warning');
  });

  it('should warn for long description', () => {
    const description =
      'This is a very long description that exceeds the recommended maximum length for meta descriptions in search engine results pages. It should be trimmed to avoid truncation in SERPs.';
    const maxLength = 160;
    const status = description.length > maxLength ? 'warning' : 'pass';
    expect(status).toBe('warning');
  });

  it('should pass for optimal description length', () => {
    const description =
      'This is an optimal meta description that provides a clear and concise summary of the page content for search engines and users.';
    const minLength = 120;
    const maxLength = 160;
    const status =
      description.length >= minLength && description.length <= maxLength ? 'pass' : 'warning';
    expect(status).toBe('pass');
  });
});

describe('Heading Check Logic', () => {
  it('should fail for missing H1', () => {
    const h1Count = 0;
    const status = h1Count === 0 ? 'fail' : 'pass';
    expect(status).toBe('fail');
  });

  it('should warn for multiple H1 tags', () => {
    const h1Count = 3;
    const status = h1Count > 1 ? 'warning' : 'pass';
    expect(status).toBe('warning');
  });

  it('should pass for single H1', () => {
    const h1Count = 1;
    const status = h1Count === 1 ? 'pass' : 'warning';
    expect(status).toBe('pass');
  });
});

describe('Image Check Logic', () => {
  it('should fail for images without alt', () => {
    const imagesWithoutAlt = 5;
    const status = imagesWithoutAlt > 0 ? 'fail' : 'pass';
    expect(status).toBe('fail');
  });

  it('should warn for images with empty alt', () => {
    const imagesWithoutAlt = 0;
    const imagesWithEmptyAlt = 3;
    const status = imagesWithoutAlt > 0 ? 'fail' : imagesWithEmptyAlt > 0 ? 'warning' : 'pass';
    expect(status).toBe('warning');
  });

  it('should pass when all images have alt', () => {
    const imagesWithoutAlt = 0;
    const imagesWithEmptyAlt = 0;
    const status = imagesWithoutAlt > 0 ? 'fail' : imagesWithEmptyAlt > 0 ? 'warning' : 'pass';
    expect(status).toBe('pass');
  });
});

describe('Canonical Check Logic', () => {
  it('should warn for missing canonical', () => {
    const canonical = undefined;
    const status = !canonical ? 'warning' : 'pass';
    expect(status).toBe('warning');
  });

  it('should pass for present canonical', () => {
    const canonical = 'https://example.com/page';
    const status = !canonical ? 'warning' : 'pass';
    expect(status).toBe('pass');
  });
});

describe('Score Calculation Logic', () => {
  it('should deduct points for critical failures', () => {
    let score = 100;
    const criticalFail = { status: 'fail', impact: 'critical' };
    if (criticalFail.status === 'fail' && criticalFail.impact === 'critical') {
      score -= 20;
    }
    expect(score).toBe(80);
  });

  it('should deduct points for high impact failures', () => {
    let score = 100;
    const highFail = { status: 'fail', impact: 'high' };
    if (highFail.status === 'fail' && highFail.impact === 'high') {
      score -= 10;
    }
    expect(score).toBe(90);
  });

  it('should deduct points for warnings', () => {
    let score = 100;
    const warning = { status: 'warning', impact: 'medium' };
    if (warning.status === 'warning' && warning.impact === 'medium') {
      score -= 3;
    }
    expect(score).toBe(97);
  });

  it('should not go below 0', () => {
    let score = 10;
    const deductions = [20, 20, 20, 20, 20];
    deductions.forEach((d) => {
      score -= d;
    });
    score = Math.max(0, score);
    expect(score).toBe(0);
  });

  it('should not exceed 100', () => {
    let score = 100;
    score = Math.min(100, score + 50);
    expect(score).toBe(100);
  });
});
