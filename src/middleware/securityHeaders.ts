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
  referrerPolicy?:
    | 'no-referrer'
    | 'no-referrer-when-downgrade'
    | 'origin'
    | 'origin-when-cross-origin'
    | 'same-origin'
    | 'strict-origin'
    | 'strict-origin-when-cross-origin'
    | 'unsafe-url'
    | false;

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
export function createSecurityHeadersMiddleware(
  config: SecurityHeadersConfig = {}
): MiddlewareHandler {
  const {
    contentTypeOptions = true,
    frameOptions = 'DENY',
    xssProtection = true,
    hstsMaxAge = 31536000,
    hstsIncludeSubDomains = true,
    referrerPolicy = 'strict-origin-when-cross-origin',
    permissionsPolicy = 'geolocation=(), microphone=(), camera=()',
    contentSecurityPolicy = "default-src 'self'; script-src 'self'; object-src 'none'",
  } = config;

  return async (_ctx, next) => {
    const response = await next();

    // Clone headers to avoid mutating original
    const headers = { ...response.headers };

    // X-Content-Type-Options: Prevents MIME type sniffing
    if (contentTypeOptions) {
      headers['X-Content-Type-Options'] = 'nosniff';
    }

    // X-Frame-Options: Prevents clickjacking
    if (frameOptions) {
      headers['X-Frame-Options'] = frameOptions;
    }

    // X-XSS-Protection: Enables XSS filter (legacy browsers)
    if (xssProtection) {
      headers['X-XSS-Protection'] = '1; mode=block';
    }

    // Strict-Transport-Security: Enforces HTTPS
    if (hstsMaxAge !== false) {
      const hstsValue = hstsIncludeSubDomains
        ? `max-age=${hstsMaxAge}; includeSubDomains`
        : `max-age=${hstsMaxAge}`;
      headers['Strict-Transport-Security'] = hstsValue;
    }

    // Referrer-Policy: Controls referrer information
    if (referrerPolicy) {
      headers['Referrer-Policy'] = referrerPolicy;
    }

    // Permissions-Policy: Controls browser features
    if (permissionsPolicy) {
      headers['Permissions-Policy'] = permissionsPolicy;
    }

    // Content-Security-Policy: Prevents injection attacks
    if (contentSecurityPolicy) {
      headers['Content-Security-Policy'] = contentSecurityPolicy;
    }

    return {
      ...response,
      headers,
    };
  };
}
