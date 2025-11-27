import rateLimit from 'express-rate-limit';
import config from '../config';

/**
 * General rate limiter for all requests
 * Prevents abuse and DoS attacks
 */
export const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.NODE_ENV === 'production' ? 1000 : 10000, // Limit each IP
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks and localhost
    const ip = req.ip || '';
    const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    const isHealthCheck = req.path === '/shieldhealth';
    return isLocalhost || isHealthCheck;
  },
});

/**
 * Strict rate limiter for SSR rendering
 * Prevents abuse of expensive Puppeteer operations
 */
export const ssrRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: config.NODE_ENV === 'production' ? 10 : 100, // Very strict for SSR
  message: {
    error: 'Too many rendering requests, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Admin panel rate limiter
 * Protects authentication and admin endpoints
 * More permissive for dashboard polling (stats, metrics, etc.)
 */
export const adminRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window (shorter, more responsive)
  max: config.NODE_ENV === 'production' ? 120 : 1000, // 120/min in prod, 1000/min in dev
  message: {
    error: 'Too many admin requests, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skip: (req) => {
    // Skip rate limiting for localhost/dashboard and health checks
    const ip = req.ip || '';
    const isLocalhost = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    const isHealthCheck = req.path === '/shieldhealth';
    return isLocalhost || isHealthCheck;
  },
  handler: (req, res, _next) => {
    // Log admin rate limit violations
    console.warn(`🚨 Admin rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
    res.status(429).json({
      error: 'Too many admin requests, please try again later.',
      retryAfter: '1 minute'
    });
  },
});

/**
 * API endpoints rate limiter
 * For general API usage
 */
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: config.NODE_ENV === 'production' ? 60 : 600, // Per minute
  message: {
    error: 'Too many API requests, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Cache management rate limiter
 * Prevents cache flooding/clearing abuse
 */
export const cacheRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: config.NODE_ENV === 'production' ? 20 : 200, // Cache operations
  message: {
    error: 'Too many cache operations, please try again later.',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next) => {
    console.warn(`🚨 Cache rate limit exceeded for IP: ${req.ip}, Method: ${req.method}`);
    res.status(429).json({
      error: 'Too many cache operations, please try again later.',
      retryAfter: '5 minutes'
    });
  },
});

/**
 * Intelligent rate limiter that adapts based on system load
 */
// Temporarily disabled adaptive rate limiter due to IPv6 issues
// export const adaptiveRateLimiter = rateLimit({ ... });