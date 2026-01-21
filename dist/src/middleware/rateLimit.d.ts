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
import type { MiddlewareContext, MiddlewareHandler } from '../middleware.js';
/**
 * Rate limiting configuration.
 */
export interface RateLimitConfig {
    /** Maximum requests per window (default: 100) */
    maxRequests?: number;
    /** Time window in milliseconds (default: 60000 = 1 minute) */
    windowMs?: number;
    /** Function to extract rate limit key from context (default: client IP) */
    keyGenerator?: (ctx: MiddlewareContext) => string;
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
export declare function createRateLimitMiddleware(config?: RateLimitConfig): MiddlewareHandler;
//# sourceMappingURL=rateLimit.d.ts.map