"use strict";
/**
 * classify.ts
 * Request classification: intent, expected response type, base path handling, path info.
 * HTTP-driven but produces transport-neutral metadata.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyRequest = classifyRequest;
exports.isPathSafe = isPathSafe;
const BASE_PATH = process.env.BASE_PATH || '/';
const normalizedBasePath = BASE_PATH.endsWith('/') ? BASE_PATH.slice(0, -1) : BASE_PATH;
/**
 * Classify request based on URL, method, and headers.
 */
function classifyRequest(envelope) {
    const url = new URL(envelope.url, 'http://localhost');
    const pathname = url.pathname;
    // Check base path
    if (!pathname.startsWith(normalizedBasePath)) {
        return {
            intent: 'unknown',
            expects: 'text',
            basePath: normalizedBasePath,
            pathInfo: pathname,
            isAjax: false,
        };
    }
    // Strip base path to get pathInfo
    const pathInfo = pathname === normalizedBasePath
        ? '/'
        : pathname.slice(normalizedBasePath.length) || '/';
    const isAjax = isAjaxRequest(envelope);
    // Classify intent and expectations
    let intent = 'unknown';
    let expects = 'text';
    if (pathInfo === '/health' || pathInfo === '/ready') {
        intent = 'health';
        expects = 'text';
    }
    else if (pathInfo.startsWith('/api/')) {
        intent = 'api';
        expects = 'json';
    }
    else if (pathInfo.endsWith('.svg')) {
        intent = 'asset';
        expects = 'svg';
    }
    else if (pathInfo === '/') {
        intent = 'page';
        expects = 'html';
    }
    else {
        // Default
        intent = 'page';
        expects = isAjax ? 'json' : 'html';
    }
    return {
        intent,
        expects,
        basePath: normalizedBasePath,
        pathInfo,
        isAjax,
    };
}
/**
 * Detect AJAX/API requests via headers.
 */
function isAjaxRequest(envelope) {
    const accept = envelope.headers['accept'];
    const xRequestedWith = envelope.headers['x-requested-with'];
    if (xRequestedWith === 'XMLHttpRequest')
        return true;
    if (typeof accept === 'string' && accept.includes('application/json'))
        return true;
    return false;
}
/**
 * Validate path for security issues.
 * Rejects null bytes, path traversal attempts, etc.
 */
function isPathSafe(path) {
    // Reject null bytes
    if (path.includes('\0'))
        return false;
    // Reject suspicious sequences
    if (path.includes('../') || path.includes('..\\'))
        return false;
    // Reject all forms of encoded traversal and null bytes
    const lower = path.toLowerCase();
    if (lower.includes('%00') || // null byte
        lower.includes('%2e%2e') || // ..
        lower.includes('%252e') || // double-encoded .
        lower.includes('%5c') || // backslash
        lower.includes('%2f%2e%2e') // /..
    ) {
        return false;
    }
    return true;
}
//# sourceMappingURL=classify.js.map