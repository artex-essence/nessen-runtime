/**
 * response.ts
 *
 * Response builders with safe header handling, ETags, and appropriate Content-Type.
 * Implements security headers for HTML responses and validates all header values.
 * Minimal allocations and efficient caching.
 *
 * @module response
 */
import type { RuntimeResponse } from './envelope.js';
/**
 * Builds HTML response with security headers and XSS prevention.
 *
 * Includes CSP, X-Frame-Options, and other security headers to protect against
 * common web vulnerabilities. Headers are validated to prevent injection attacks.
 *
 * @param body - HTML content to send
 * @param statusCode - HTTP status code (default: 200)
 * @param extraHeaders - Additional headers (merged after security headers)
 * @param requestId - Request ID to add to X-Request-ID header
 * @returns RuntimeResponse ready for transmission
 */
export declare function htmlResponse(body: string, statusCode?: number, extraHeaders?: Record<string, string>, requestId?: string): RuntimeResponse;
/**
 * Builds JSON response with appropriate Content-Type.
 *
 * Safely serializes data to JSON and sets proper headers for JSON content.
 * All headers are validated to prevent injection attacks.
 *
 * @param data - Data to serialize as JSON
 * @param statusCode - HTTP status code (default: 200)
 * @param extraHeaders - Additional headers to include
 * @param requestId - Request ID to add to X-Request-ID header
 * @returns RuntimeResponse ready for transmission
 */
export declare function jsonResponse(data: unknown, statusCode?: number, extraHeaders?: Record<string, string>, requestId?: string): RuntimeResponse;
/**
 * Builds SVG response with ETag and aggressive caching headers.
 *
 * SVG content is immutable by design (badges are deterministic), so we use strong
 * ETag headers and cache-control to minimize bandwidth and improve performance.
 *
 * @param svg - SVG content to send
 * @param extraHeaders - Additional headers to include
 * @param requestId - Request ID to add to X-Request-ID header
 * @returns RuntimeResponse ready for transmission
 */
export declare function svgResponse(svg: string, extraHeaders?: Record<string, string>, requestId?: string): RuntimeResponse;
/**
 * Builds plain text response.
 *
 * Used for error messages and health check outputs. Simple, direct format
 * without any rendering or parsing.
 *
 * @param body - Text content to send
 * @param statusCode - HTTP status code (default: 200)
 * @param extraHeaders - Additional headers to include
 * @param requestId - Request ID to add to X-Request-ID header
 * @returns RuntimeResponse ready for transmission
 */
export declare function textResponse(body: string, statusCode?: number, extraHeaders?: Record<string, string>, requestId?: string): RuntimeResponse;
/**
 * Builds error response in appropriate format (JSON or text).
 *
 * Automatically selects response format based on client's Accept header.
 * In development mode, includes stack traces for debugging. In production,
 * only the error message is sent.
 *
 * @param message - Error message to send
 * @param statusCode - HTTP status code (default: 500)
 * @param expectsJson - Whether client expects JSON format
 * @param error - Optional Error object (used for stack traces in DEV_MODE)
 * @param requestId - Request ID to add to X-Request-ID header
 * @returns RuntimeResponse ready for transmission
 */
/**
 * Standard error envelope structure for consistent error handling.
 */
export interface ErrorEnvelope {
    code: string;
    message: string;
    requestId?: string;
    details?: unknown;
}
export declare function errorResponse(message: string, statusCode?: number, expectsJson?: boolean, error?: Error, requestId?: string): RuntimeResponse;
/**
 * Builds 503 Service Unavailable response (for graceful shutdown/draining).
 *
 * Used when the runtime is transitioning to degraded or stopping state.
 * Includes Retry-After header to guide clients on when to retry.
 *
 * @param reason - Reason for unavailability (default: 'Service draining')
 * @param requestId - Request ID to add to X-Request-ID header
 * @returns RuntimeResponse ready for transmission
 */
export declare function serviceUnavailableResponse(reason?: string, requestId?: string): RuntimeResponse;
/**
 * Builds 404 Not Found response.
 *
 * Standard response for requests that don't match any registered routes.
 * Format (JSON or text) is determined by client expectations.
 *
 * @param path - The requested path
 * @param expectsJson - Whether client expects JSON format
 * @param requestId - Request ID to add to X-Request-ID header
 * @returns RuntimeResponse ready for transmission
 */
export declare function notFoundResponse(path: string, expectsJson?: boolean, requestId?: string): RuntimeResponse;
//# sourceMappingURL=response.d.ts.map