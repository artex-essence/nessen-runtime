"use strict";
/**
 * response.ts
 *
 * Response builders with safe header handling, ETags, and appropriate Content-Type.
 * Implements security headers for HTML responses and validates all header values.
 * Minimal allocations and efficient caching.
 *
 * @module response
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.htmlResponse = htmlResponse;
exports.jsonResponse = jsonResponse;
exports.svgResponse = svgResponse;
exports.textResponse = textResponse;
exports.errorResponse = errorResponse;
exports.serviceUnavailableResponse = serviceUnavailableResponse;
exports.notFoundResponse = notFoundResponse;
const crypto_1 = require("crypto");
const utils_js_1 = require("./utils.js");
const DEV_MODE = process.env.DEV_MODE === '1';
/**
 * Validates and sanitizes headers to prevent injection attacks.
 * Rejects headers with invalid names or values containing CRLF/null bytes.
 *
 * @param headers - Headers object to validate
 * @returns Sanitized headers object
 * @throws Error if header name is invalid
 */
function validateHeaders(headers) {
    const validated = {};
    for (const [name, value] of Object.entries(headers)) {
        // Validate header name (RFC 7230)
        if (!(0, utils_js_1.isValidHeaderName)(name)) {
            throw new Error(`Invalid header name: ${name}`);
        }
        // Validate header value (prevent CRLF injection)
        if (!(0, utils_js_1.isValidHeaderValue)(value)) {
            // Log but don't throw - sanitize instead
            validated[name] = (0, utils_js_1.sanitizeHeaderValue)(value);
        }
        else {
            validated[name] = value;
        }
    }
    return validated;
}
/**
 * Common security headers for HTML responses.
 */
const SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'none'",
};
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
function htmlResponse(body, statusCode = 200, extraHeaders = {}, requestId) {
    const headers = {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(body, 'utf8').toString(),
        ...SECURITY_HEADERS,
        ...extraHeaders,
    };
    if (requestId) {
        headers['X-Request-ID'] = requestId;
    }
    return {
        statusCode,
        headers: validateHeaders(headers),
        body,
    };
}
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
function jsonResponse(data, statusCode = 200, extraHeaders = {}, requestId) {
    const body = JSON.stringify(data);
    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body, 'utf8').toString(),
        ...extraHeaders,
    };
    if (requestId) {
        headers['X-Request-ID'] = requestId;
    }
    return {
        statusCode,
        headers: validateHeaders(headers),
        body,
    };
}
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
function svgResponse(svg, extraHeaders = {}, requestId) {
    const etag = generateETag(svg);
    const headers = {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Content-Length': Buffer.byteLength(svg, 'utf8').toString(),
        'ETag': etag,
        'Cache-Control': 'public, max-age=3600, immutable',
        ...extraHeaders,
    };
    if (requestId) {
        headers['X-Request-ID'] = requestId;
    }
    return {
        statusCode: 200,
        headers: validateHeaders(headers),
        body: svg,
    };
}
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
function textResponse(body, statusCode = 200, extraHeaders = {}, requestId) {
    const headers = {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Length': Buffer.byteLength(body, 'utf8').toString(),
        ...extraHeaders,
    };
    if (requestId) {
        headers['X-Request-ID'] = requestId;
    }
    return {
        statusCode,
        headers: validateHeaders(headers),
        body,
    };
}
function errorResponse(message, statusCode = 500, expectsJson = false, error, requestId) {
    if (expectsJson) {
        const body = {
            code: `ERROR_${statusCode}`,
            message,
            requestId
        };
        if (DEV_MODE && error) {
            body.details = { stack: error.stack };
        }
        return jsonResponse(body, statusCode, {}, requestId);
    }
    let body = `Error ${statusCode}: ${message}`;
    if (DEV_MODE && error?.stack) {
        body += `\n\n${error.stack}`;
    }
    return textResponse(body, statusCode, {}, requestId);
}
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
function serviceUnavailableResponse(reason = 'Service draining', requestId) {
    return textResponse(reason, 503, {
        'Retry-After': '30',
    }, requestId);
}
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
function notFoundResponse(path, expectsJson = false, requestId) {
    if (expectsJson) {
        const body = {
            code: 'ERROR_404',
            message: 'Not Found',
            requestId,
            details: { path }
        };
        return jsonResponse(body, 404, {}, requestId);
    }
    return textResponse(`Not Found: ${path}`, 404, {}, requestId);
}
// ETag cache (simple LRU with max 100 entries)
const etagCache = new Map();
const MAX_ETAG_CACHE_SIZE = 100;
/**
 * Generates ETag from content using SHA-256 hash with LRU caching.
 *
 * ETags allow browsers to validate cached content without re-downloading.
 * We cache tags to avoid recomputing hashes for frequently-served content
 * (badges are deterministic so same input = same tag).
 *
 * Uses LRU eviction to prevent unbounded cache growth.
 *
 * @param content - Content to generate ETag for
 * @returns ETag string (quoted SHA-256 hash prefix)
 *
 * @example
 * // Same content always produces same ETag (deterministic)
 * const tag1 = generateETag('Hello');
 * const tag2 = generateETag('Hello');
 * assert(tag1 === tag2);
 */
function generateETag(content) {
    // Check cache first
    const cached = etagCache.get(content);
    if (cached)
        return cached;
    // Compute hash
    const hash = (0, crypto_1.createHash)('sha256').update(content, 'utf8').digest('hex');
    const etag = `"${hash.slice(0, 16)}"`;
    // Add to cache with LRU eviction
    if (etagCache.size >= MAX_ETAG_CACHE_SIZE) {
        // Delete first (oldest) entry
        const firstKey = etagCache.keys().next().value;
        if (firstKey)
            etagCache.delete(firstKey);
    }
    etagCache.set(content, etag);
    return etag;
}
//# sourceMappingURL=response.js.map