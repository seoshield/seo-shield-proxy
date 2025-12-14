/**
 * Middleware Types
 * Types for Express middleware, request/response extensions, and handlers.
 */

import type { Request, Response, NextFunction } from 'express';
import type { DetectionResult } from './bot-detection.types';

/**
 * Extended Express Request with bot detection
 */
export interface ExtendedRequest extends Request {
  isBot?: boolean;
  botInfo?: DetectionResult;
  renderId?: string;
  startTime?: number;
  requestId?: string;
}

/**
 * Extended Express Response
 */
export interface ExtendedResponse extends Response {
  renderTime?: number;
  cacheHit?: boolean;
  ssrApplied?: boolean;
}

/**
 * Middleware function type
 */
export type MiddlewareFunction = (
  req: ExtendedRequest,
  res: ExtendedResponse,
  next: NextFunction
) => void | Promise<void>;

/**
 * Async middleware wrapper type
 */
export type AsyncMiddleware = (
  req: ExtendedRequest,
  res: ExtendedResponse,
  next: NextFunction
) => Promise<void>;

/**
 * Error handling middleware type
 */
export type ErrorMiddleware = (
  err: Error,
  req: ExtendedRequest,
  res: ExtendedResponse,
  next: NextFunction
) => void;

/**
 * Proxy options for http-proxy-middleware
 */
export interface ProxyOptions {
  target: string;
  changeOrigin?: boolean;
  ws?: boolean;
  pathRewrite?: Record<string, string>;
  onProxyReq?: (proxyReq: unknown, req: Request, res: Response) => void;
  onProxyRes?: (proxyRes: unknown, req: Request, res: Response) => void;
  onError?: (err: Error, req: Request, res: Response) => void;
}

/**
 * Rate limiting options
 */
export interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  statusCode?: number;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
  handler?: (req: Request, res: Response) => void;
}

/**
 * CORS options
 */
export interface CorsOptions {
  origin: string | string[] | boolean | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

/**
 * Authentication options
 */
export interface AuthOptions {
  secret: string;
  expiresIn?: string;
  algorithm?: 'HS256' | 'HS384' | 'HS512' | 'RS256';
  issuer?: string;
  audience?: string;
}

/**
 * JWT payload structure
 */
export interface JWTPayload {
  role?: string;
  username?: string;
  permissions?: string[];
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

/**
 * Authenticated request with user info
 */
export interface AuthenticatedRequest extends ExtendedRequest {
  user?: JWTPayload;
}

/**
 * Cache middleware options
 */
export interface CacheMiddlewareOptions {
  ttl?: number;
  keyGenerator?: (req: Request) => string;
  shouldCache?: (req: Request, res: Response) => boolean;
  onHit?: (req: Request, cachedResponse: unknown) => void;
  onMiss?: (req: Request) => void;
}

/**
 * Compression options
 */
export interface CompressionOptions {
  level?: number;
  threshold?: number;
  filter?: (req: Request, res: Response) => boolean;
}

/**
 * Request logging options
 */
export interface LoggingOptions {
  format?: 'combined' | 'common' | 'dev' | 'short' | 'tiny' | string;
  skip?: (req: Request, res: Response) => boolean;
  stream?: { write: (message: string) => void };
}

/**
 * Security headers options
 */
export interface SecurityHeadersOptions {
  contentSecurityPolicy?: string | boolean;
  xFrameOptions?: 'DENY' | 'SAMEORIGIN' | false;
  xContentTypeOptions?: boolean;
  xXssProtection?: boolean;
  strictTransportSecurity?: {
    maxAge: number;
    includeSubDomains?: boolean;
    preload?: boolean;
  };
}
