/**
 * middleware/securityHeaders.ts
 *
 * Security headers middleware for protecting against common web vulnerabilities.
 * Implements OWASP best practices for HTTP security headers.
 *
 * Features:
 * - X-Content-Type-Options: Prevents MIME type sniffing
 * - X-Frame-Options: Prevents clickjacking attacks
 * - X-XSS-Protection: Enables XSS filter in older browsers
 * - Strict-Transport-Security: Enforces HTTPS connections
 * - Referrer-Policy: Controls referrer information leakage
 * - Permissions-Policy: Controls browser feature access
 * - Content-Security-Policy: Prevents XSS and injection attacks
 *
 * @module middleware/securityHeaders
 */
import type { MiddlewareHandler } from '../middleware.js';
/**
 * Security headers configuration.
 */
export interface SecurityHeadersConfig {
    /** Enable X-Content-Type-Options: nosniff (default: true) */
    contentTypeOptions?: boolean;
    /** X-Frame-Options value (default: 'DENY') */
    frameOptions?: 'DENY' | 'SAMEORIGIN' | false;
    /** Enable X-XSS-Protection (default: true) */
    xssProtection?: boolean;
    /** HSTS max-age in seconds (default: 31536000 = 1 year, false to disable) */
    hstsMaxAge?: number | false;
    /** Include subdomains in HSTS (default: true) */
    hstsIncludeSubDomains?: boolean;
    /** Referrer-Policy value (default: 'strict-origin-when-cross-origin') */
    referrerPolicy?: 'no-referrer' | 'no-referrer-when-downgrade' | 'origin' | 'origin-when-cross-origin' | 'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url' | false;
    /** Permissions-Policy directives (default: restrictive policy) */
    permissionsPolicy?: string | false;
    /** Content-Security-Policy directives (default: restrictive policy) */
    contentSecurityPolicy?: string | false;
}
/**
 * Creates security headers middleware.
 *
 * Adds security headers to all responses to protect against common vulnerabilities.
 * Headers are configurable to support different deployment scenarios.
 *
 * @param config - Security headers configuration
 * @returns Middleware function
 *
 * @example
 * const securityHeaders = createSecurityHeadersMiddleware({
 *   frameOptions: 'SAMEORIGIN',
 *   hstsMaxAge: 31536000,
 * });
 * pipeline.use(securityHeaders);
 */
export declare function createSecurityHeadersMiddleware(config?: SecurityHeadersConfig): MiddlewareHandler;
//# sourceMappingURL=securityHeaders.d.ts.map