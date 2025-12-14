/**
 * Bot Detection Types
 * Types for bot detection, rules, and analysis results.
 */

import type { BaseEntity } from './shared.types';

/**
 * Bot rule type
 */
export type BotRuleType = 'user-agent' | 'ip' | 'behavior' | 'pattern' | 'composite';

/**
 * Bot rule action
 */
export type BotRuleAction = 'allow' | 'block' | 'render' | 'challenge' | 'monitor';

/**
 * Bot category classification
 */
export type BotCategory =
  | 'search-engine'
  | 'social'
  | 'monitoring'
  | 'ai'
  | 'security'
  | 'advertising'
  | 'malicious'
  | 'other';

/**
 * Bot detection rule
 */
export interface BotRule extends BaseEntity {
  name: string;
  description?: string;
  pattern: string;
  type: BotRuleType;
  action: BotRuleAction;
  priority: number;
  enabled: boolean;
  category?: BotCategory;
  metadata?: Record<string, unknown>;
}

/**
 * Detection signal from analysis
 */
export interface DetectionSignal {
  type: string;
  value: string;
  weight: number;
  source: 'user-agent' | 'ip' | 'behavior' | 'header' | 'fingerprint';
}

/**
 * Bot detection result
 */
export interface DetectionResult {
  isBot: boolean;
  confidence: number;
  botName?: string;
  botCategory?: BotCategory;
  matchedRule?: BotRule;
  signals: DetectionSignal[];
  processingTime: number;
}

/**
 * IP reputation data
 */
export interface IPReputation {
  ip: string;
  score: number;
  isTor: boolean;
  isVPN: boolean;
  isProxy: boolean;
  isDatacenter: boolean;
  country?: string;
  asn?: string;
  lastSeen: Date;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * User agent analysis result
 */
export interface UserAgentAnalysis {
  raw: string;
  browser?: string;
  browserVersion?: string;
  os?: string;
  osVersion?: string;
  device?: string;
  isBot: boolean;
  botName?: string;
  isValid: boolean;
  suspiciousPatterns: string[];
}

/**
 * Behavior analysis metrics
 */
export interface BehaviorMetrics {
  requestRate: number;
  uniquePages: number;
  avgRequestInterval: number;
  hasJavaScript: boolean;
  hasCookies: boolean;
  mouseMovements: boolean;
  keyboardEvents: boolean;
  scrollBehavior: boolean;
  anomalyScore: number;
}

/**
 * Bot detection configuration
 */
export interface BotDetectionConfig {
  enabled: boolean;
  strictMode: boolean;
  allowedBots: string[];
  blockedBots: string[];
  customRules: BotRule[];
  ipReputationEnabled: boolean;
  behaviorAnalysisEnabled: boolean;
  challengeEnabled: boolean;
  logAllRequests: boolean;
}

/**
 * Bot statistics
 */
export interface BotStats {
  totalDetections: number;
  allowedBots: number;
  blockedBots: number;
  challengedBots: number;
  byCategory: Record<BotCategory, number>;
  topBots: Array<{ name: string; count: number }>;
  detectionAccuracy?: number;
}
