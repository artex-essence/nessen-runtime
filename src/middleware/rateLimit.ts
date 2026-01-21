/**
 * middleware/rateLimit.ts
 *
 * Rate limiting middleware for protecting against abuse and DoS attacks.
 * Implements token bucket algorithm for fair and flexible rate limiting.
 *
 * Features:
 * - Per-IP rate limiting
 * - Configurable limits and window sizes
 * - Graceful degradation (returns 429 when limit exceeded)
 * - Memory-efficient with automatic cleanup
 * - Supports custom key extraction (IP, user ID, API key, etc.)
 *
 * @module middleware/rateLimit
 */

import type { MiddlewareHandler } from '../middleware.js';
import { textResponse } from '../response.js';

/**
 * Token bucket for rate limiting.
 *
 * Tracks when tokens are available for a key.
 * Used by token bucket algorithm: one request = one token.
 */
interface TokenBucket {
  tokens: number;
  lastRefillTime: number;
}

/**
 * Rate limiting configuration.
 */
export interface RateLimitConfig {
  /** Maximum requests per window (default: 100) */
  maxRequests?: number;

  /** Time window in milliseconds (default: 60000 = 1 minute) */
  windowMs?: number;

  /** Function to extract rate limit key from headers (default: client IP) */
  keyGenerator?: (headers: Record<string, string | string[] | undefined>, remoteAddress: string | undefined) => string;

  /** Maximum keys to track in memory (default: 10000) */
  maxKeys?: number;

  /** Cleanup interval in milliseconds (default: 60000) */
  cleanupIntervalMs?: number;
}

/**
 * Creates a rate limiting middleware.
 *
 * Limits requests per key (by default, per client IP) using token bucket algorithm.
 * Returns 429 Too Many Requests when limit is exceeded.
 *
 * @param config - Rate limiting configuration
 * @returns Middleware function
 *
 * @example
 * const rateLimit = createRateLimitMiddleware({
 *   maxRequests: 100,
 *   windowMs: 60000,  // Per minute
 * });
 * pipeline.use(rateLimit);
 */
export function createRateLimitMiddleware(config: RateLimitConfig = {}): MiddlewareHandler {
  const maxRequests = config.maxRequests ?? 100;
  const windowMs = config.windowMs ?? 60000;
  const keyGenerator = config.keyGenerator ?? ((_headers, remoteAddress) => remoteAddress ?? 'unknown');
  const maxKeys = config.maxKeys ?? 10000;
  const cleanupIntervalMs = config.cleanupIntervalMs ?? 60000;

  const buckets = new Map<string, TokenBucket>();

  // Cleanup old entries periodically
  const cleanupInterval = setInterval(() => {
    cleanupOldBuckets(buckets, windowMs);
  }, cleanupIntervalMs);

  // Make sure cleanup doesn't keep process alive
  cleanupInterval.unref();

  return async (ctx, next) => {
    const key = keyGenerator(ctx.headers, ctx.remoteAddress);

    // Check rate limit
    if (!allowRequest(key, maxRequests, windowMs, buckets, maxKeys)) {
      // Rate limit exceeded
      return textResponse('Too Many Requests', 429, {
        'Retry-After': Math.ceil(windowMs / 1000).toString(),
      }, ctx.id);
    }

    // Within limits: continue
    return next();
  };
}

/**
 * Checks if a request should be allowed based on rate limit.
 *
 * Implements token bucket algorithm:
 * - Refill tokens based on elapsed time
 * - One token per request
 * - Block if no tokens available
 *
 * @param key - Rate limit key (typically IP address)
 * @param maxRequests - Max requests per window
 * @param windowMs - Time window in milliseconds
 * @param buckets - Token bucket map
 * @param maxKeys - Max keys to track (prevents memory exhaustion)
 * @returns true if request is allowed, false if rate limited
 */
function allowRequest(
  key: string,
  maxRequests: number,
  windowMs: number,
  buckets: Map<string, TokenBucket>,
  maxKeys: number
): boolean {
  const now = Date.now();

  // Get or create bucket
  let bucket = buckets.get(key);

  if (!bucket) {
    // First request: create new bucket
    if (buckets.size >= maxKeys) {
      // Too many tracked keys: reject to prevent memory exhaustion
      return false;
    }

    bucket = {
      tokens: maxRequests - 1, // Use one token for this request
      lastRefillTime: now,
    };

    buckets.set(key, bucket);
    return true;
  }

  // Refill tokens based on elapsed time
  const elapsed = now - bucket.lastRefillTime;
  const refill = windowMs > 0 ? (elapsed / windowMs) * maxRequests : 0;

  bucket.tokens = Math.min(maxRequests, bucket.tokens + refill);
  bucket.lastRefillTime = now;

  // Check if we have tokens
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }

  // No tokens: rate limited
  return false;
}

/**
 * Removes old/expired buckets to prevent unbounded memory growth.
 *
 * @param buckets - Token bucket map
 * @param windowMs - Time window in milliseconds
 */
function cleanupOldBuckets(
  buckets: Map<string, TokenBucket>,
  windowMs: number
): void {
  const now = Date.now();
  const maxAge = windowMs * 2; // Keep buckets for 2 windows (conservative)

  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.lastRefillTime > maxAge) {
      buckets.delete(key);
    }
  }
}
