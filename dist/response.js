"use strict";
/**
 * response.ts
 * Response builders with safe header handling, ETags, and appropriate Content-Type.
 * Security headers for HTML responses. Minimal allocations.
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
const DEV_MODE = process.env.DEV_MODE === '1';
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
 * Build HTML response with security headers.
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
        headers,
        body,
    };
}
/**
 * Build JSON response.
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
        headers,
        body,
    };
}
/**
 * Build SVG response with ETag and caching headers.
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
        headers,
        body: svg,
    };
}
/**
 * Build text response.
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
        headers,
        body,
    };
}
/**
 * Build error response (text or JSON based on accept header).
 */
function errorResponse(message, statusCode = 500, expectsJson = false, error, requestId) {
    if (expectsJson) {
        const body = {
            error: true,
            message
        };
        if (DEV_MODE && error) {
            body.stack = error.stack;
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
 * Build 503 Service Unavailable response (for draining/stopping).
 */
function serviceUnavailableResponse(reason = 'Service draining', requestId) {
    return textResponse(reason, 503, {
        'Retry-After': '30',
    }, requestId);
}
/**
 * Build 404 Not Found response.
 */
function notFoundResponse(path, expectsJson = false, requestId) {
    if (expectsJson) {
        return jsonResponse({ error: true, message: 'Not Found', path }, 404, {}, requestId);
    }
    return textResponse(`Not Found: ${path}`, 404, {}, requestId);
}
// ETag cache (simple LRU with max 100 entries)
const etagCache = new Map();
const MAX_ETAG_CACHE_SIZE = 100;
/**
 * Generate ETag from content using SHA-256 hash (with caching).
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