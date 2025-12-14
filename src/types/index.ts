/**
 * Types Index
 * Central export point for all type definitions.
 *
 * Usage:
 *   import type { ApiResponse, BotRule, TrafficLogDocument } from '../types';
 *
 * Or import specific modules:
 *   import type { DetectionResult } from '../types/bot-detection.types';
 */

// Shared types (Frontend-Backend)
export * from './shared.types';

// Bot detection types
export * from './bot-detection.types';

// Database types
export * from './database.types';

// Middleware types
export * from './middleware.types';

// Admin API types
export * from './admin.types';

// SEO types
export * from './seo.types';

// Server types
export * from './server.types';

// Cache types
export * from './cache.types';

// Browser types
export * from './browser.types';

// Re-export Puppeteer cluster types
export type {
  ClusterOptions,
  Task,
  ClusterTaskFunction,
  Cluster,
} from './puppeteer-cluster';
