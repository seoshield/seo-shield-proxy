/**
 * SEO Types
 * Type definitions for SEO health checking and Core Web Vitals
 */

/**
 * Core Web Vitals metrics
 */
export interface CoreWebVitals {
  lcp: number; // Largest Contentful Paint (ms)
  fid: number; // First Input Delay (ms)
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte (ms)
  fcp: number; // First Contentful Paint (ms)
  inp?: number; // Interaction to Next Paint (ms) - replacement for FID
  scores: {
    lcp: 'good' | 'needs-improvement' | 'poor';
    fid: 'good' | 'needs-improvement' | 'poor';
    cls: 'good' | 'needs-improvement' | 'poor';
    inp?: 'good' | 'needs-improvement' | 'poor';
  };
}

/**
 * SEO check result
 */
export interface SEOCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  value?: string | number;
  expected?: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  details?: string;
}

/**
 * SEO issue found during analysis
 */
export interface SEOIssue {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  element?: string;
  selector?: string;
  suggestion?: string;
}

/**
 * Structured data validation result
 */
export interface StructuredDataCheck {
  valid: boolean;
  types: string[];
  errors: string[];
  warnings: string[];
  schemas: StructuredDataSchema[];
}

/**
 * Individual structured data schema
 */
export interface StructuredDataSchema {
  type: string;
  properties: Record<string, unknown>;
  isValid: boolean;
  errors?: string[];
}

/**
 * Heading structure analysis
 */
export interface HeadingStructure {
  h1: string[];
  h2: string[];
  h3: string[];
  h4: string[];
  h5: string[];
  h6: string[];
  hasMultipleH1: boolean;
  missingH1: boolean;
  hierarchyValid: boolean;
}

/**
 * Image analysis result
 */
export interface ImageAnalysis {
  total: number;
  withAlt: number;
  withoutAlt: number;
  withEmptyAlt: number;
  lazyLoaded: number;
  images: ImageInfo[];
}

/**
 * Individual image info
 */
export interface ImageInfo {
  src: string;
  alt?: string;
  hasAlt: boolean;
  isLazy: boolean;
  dimensions?: {
    width: number;
    height: number;
  };
}

/**
 * Link analysis result
 */
export interface LinkAnalysis {
  internal: number;
  external: number;
  broken: number;
  nofollow: number;
  links: LinkInfo[];
}

/**
 * Individual link info
 */
export interface LinkInfo {
  href: string;
  text: string;
  isExternal: boolean;
  rel?: string;
  target?: string;
}

/**
 * Meta tag analysis
 */
export interface MetaTagAnalysis {
  title?: string;
  description?: string;
  canonical?: string;
  robots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterCard?: string;
  viewport?: string;
  charset?: string;
}

/**
 * Complete SEO health report
 */
export interface SEOHealthReport {
  url: string;
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  timestamp: Date;
  duration: number; // ms
  checks: SEOCheck[];
  coreWebVitals: CoreWebVitals;
  structuredData: StructuredDataCheck;
  issues: SEOIssue[];
  meta: MetaTagAnalysis;
  headings: HeadingStructure;
  images: ImageAnalysis;
  links: LinkAnalysis;
  recommendations: string[];
}

/**
 * SEO health checker configuration
 */
export interface SEOHealthConfig {
  enabled: boolean;
  checkTitle: boolean;
  checkDescription: boolean;
  checkHeadings: boolean;
  checkImages: boolean;
  checkLinks: boolean;
  checkCanonical: boolean;
  checkStructuredData: boolean;
  checkCoreWebVitals: boolean;
  checkMobileFriendly: boolean;
  checkOpenGraph: boolean;
  checkTwitterCards: boolean;
  titleMinLength: number;
  titleMaxLength: number;
  descriptionMinLength: number;
  descriptionMaxLength: number;
  coreWebVitalsTimeout: number;
}

/**
 * Core Web Vitals collector configuration
 */
export interface CoreWebVitalsConfig {
  enabled: boolean;
  timeout: number;
  injectLibrary: boolean;
  collectLCP: boolean;
  collectFID: boolean;
  collectCLS: boolean;
  collectTTFB: boolean;
  collectFCP: boolean;
  collectINP: boolean;
}

/**
 * Core Web Vitals thresholds
 */
export const CWV_THRESHOLDS = {
  lcp: {
    good: 2500,
    needsImprovement: 4000,
  },
  fid: {
    good: 100,
    needsImprovement: 300,
  },
  cls: {
    good: 0.1,
    needsImprovement: 0.25,
  },
  inp: {
    good: 200,
    needsImprovement: 500,
  },
  ttfb: {
    good: 800,
    needsImprovement: 1800,
  },
  fcp: {
    good: 1800,
    needsImprovement: 3000,
  },
} as const;

/**
 * Grade thresholds
 */
export const GRADE_THRESHOLDS = {
  A: 90,
  B: 80,
  C: 70,
  D: 60,
  F: 0,
} as const;

/**
 * Default SEO health configuration
 */
export const DEFAULT_SEO_HEALTH_CONFIG: SEOHealthConfig = {
  enabled: true,
  checkTitle: true,
  checkDescription: true,
  checkHeadings: true,
  checkImages: true,
  checkLinks: true,
  checkCanonical: true,
  checkStructuredData: true,
  checkCoreWebVitals: true,
  checkMobileFriendly: true,
  checkOpenGraph: true,
  checkTwitterCards: true,
  titleMinLength: 30,
  titleMaxLength: 60,
  descriptionMinLength: 120,
  descriptionMaxLength: 160,
  coreWebVitalsTimeout: 10000,
};

/**
 * Default Core Web Vitals configuration
 */
export const DEFAULT_CWV_CONFIG: CoreWebVitalsConfig = {
  enabled: true,
  timeout: 10000,
  injectLibrary: true,
  collectLCP: true,
  collectFID: true,
  collectCLS: true,
  collectTTFB: true,
  collectFCP: true,
  collectINP: true,
};
