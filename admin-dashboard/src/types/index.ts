/**
 * Type definitions for the Admin Dashboard
 */

export interface StatsData {
  totalRequests?: number;
  botRequests?: number;
  humanRequests?: number;
  cacheHitRate?: number;
  avgRenderTime?: number;
  activeConnections?: number;
  queueSize?: number;
  browserMetrics?: {
    queued: number;
    processing: number;
    completed: number;
    errors: number;
    maxConcurrency: number;
  };
}

export interface TrafficData {
  timestamp: number;
  requests: number;
  cacheHits: number;
  renderTime: number;
}

export interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}

export interface UseWebSocketReturn {
  socket: any; // Socket.io client instance
  isConnected: boolean;
  stats: StatsData | null;
  traffic: TrafficData[];
}

export interface CacheEntry {
  key: string;
  url: string;
  status: string;
  size: number;
  cached: string;
  lastAccessed: string;
  ttl?: number;
}

export interface ConfigOptions {
  TARGET_URL: string;
  MAX_CONCURRENT_RENDERS: number;
  PUPPETEER_TIMEOUT: number;
  CACHE_TTL: number;
  DEBUG_MODE: boolean;
}

export interface ConfigValidation {
  valid: boolean;
  errors: string[];
}