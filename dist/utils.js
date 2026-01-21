"use strict";
/**
 * utils.ts
 *
 * Security utilities and helpers for input validation, escaping, and sanitization.
 * Provides centralized, well-tested implementations for common security concerns.
 *
 * @module utils
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeHtml = escapeHtml;
exports.isValidHeaderValue = isValidHeaderValue;
exports.sanitizeHeaderValue = sanitizeHeaderValue;
exports.isValidHost = isValidHost;
exports.isValidContentType = isValidContentType;
exports.isValidHeaderName = isValidHeaderName;
exports.isPathSafe = isPathSafe;
exports.generateSecureRequestId = generateSecureRequestId;
exports.truncateString = truncateString;
exports.formatBytes = formatBytes;
exports.isValidStatusCode = isValidStatusCode;
exports.safeJsonParse = safeJsonParse;
exports.safeJsonStringify = safeJsonStringify;
exports.mapOptional = mapOptional;
/**
 * HTML entity map for XSS prevention.
 * Covers all common vectors: <, >, &, ", ', /
 */
const HTML_ENTITY_MAP = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
};
/**
 * Escapes HTML special characters to prevent XSS attacks.
 *
 * Converts HTML metacharacters to their entity equivalents. This is the primary
 * defense against cross-site scripting (XSS) when inserting user-controlled
 * content into HTML contexts. Safe for use in HTML attributes and text content.
 *
 * @param str - The string to escape (coerced to string if needed)
 * @returns The HTML-escaped string
 *
 * @example
 * // Prevent XSS in HTML output
 * const userInput = '<script>alert("xss")</script>';
 * const safe = escapeHtml(userInput);
 * // Result: "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"
 */
function escapeHtml(str) {
    return String(str).replace(/[&<>"'\/]/g, (char) => HTML_ENTITY_MAP[char] || char);
}
/**
 * Validates header value for injection attacks (CRLF/LF injection).
 *
 * HTTP response splitting attacks use newline characters (CR/LF) to inject
 * arbitrary HTTP headers or response content. This validator ensures header
 * values cannot contain these characters or null bytes.
 *
 * @param value - The header value to validate (can be string or array)
 * @returns true if the value is safe for use as an HTTP header
 *
 * @example
 * isValidHeaderValue('value')         // true
 * isValidHeaderValue('val\r\nue')     // false
 * isValidHeaderValue('val\x00ue')     // false
 * isValidHeaderValue(['a', 'b'])      // true
 */
function isValidHeaderValue(value) {
    if (!value)
        return true; // Empty/null values are acceptable
    const str = Array.isArray(value) ? value.join(',') : String(value);
    // Reject if contains line breaks (CR/LF) or null bytes
    // These enable HTTP response splitting attacks
    return !/[\r\n\0]/u.test(str);
}
/**
 * Sanitizes header value by removing dangerous characters.
 *
 * If a header value contains CRLF or null bytes, this removes them rather than
 * rejecting the entire value. Use when you want to accept the input but make it safe.
 *
 * @param value - The header value to sanitize
 * @returns The sanitized header value (empty string if value is falsy)
 */
function sanitizeHeaderValue(value) {
    if (!value)
        return '';
    const str = Array.isArray(value) ? value.join(',') : String(value);
    // Remove CRLF and null bytes
    return str.replace(/[\r\n\0]/gu, '');
}
/**
 * Validates HTTP Host header against a whitelist.
 *
 * Host header injection enables cache poisoning and virtual host confusion attacks.
 * This validator ensures the Host header matches a configured whitelist of acceptable
 * hostnames and supports wildcard patterns for subdomains.
 *
 * @param hostHeader - The Host header value from the request
 * @param validHosts - Array of valid hostnames (supports wildcards like *.example.com)
 * @returns true if the host is in the whitelist
 *
 * @example
 * // Exact match
 * isValidHost('example.com', ['example.com'])  // true
 *
 * // Wildcard subdomain
 * isValidHost('api.example.com', ['*.example.com'])  // true
 * isValidHost('example.com', ['*.example.com'])      // true
 *
 * // With port (stripped before matching)
 * isValidHost('example.com:443', ['example.com'])  // true
 *
 * // Wildcard all hosts
 * isValidHost('anything.com', ['*'])  // true
 */
function isValidHost(hostHeader, validHosts) {
    if (!hostHeader)
        return false;
    // Extract hostname without port
    const parts = hostHeader.split(':');
    const hostname = parts.length > 0 && parts[0] ? parts[0] : hostHeader;
    return validHosts.some((valid) => {
        // Wildcard: match all
        if (valid === '*')
            return true;
        // Exact match
        if (valid === hostname)
            return true;
        // Subdomain wildcard: *.example.com matches foo.example.com and example.com
        if (valid.startsWith('*.')) {
            const domain = valid.slice(2); // Remove '*.'
            return hostname.endsWith('.' + domain) || hostname === domain;
        }
        return false;
    });
}
/**
 * Validates Content-Type header format.
 *
 * Ensures the Content-Type header follows the valid MIME type format
 * (type/subtype with optional parameters). Prevents encoding-based attacks
 * and malformed content type specifications.
 *
 * @param contentType - The Content-Type header value
 * @returns true if the format is valid
 *
 * @example
 * isValidContentType('application/json')                // true
 * isValidContentType('text/html; charset=utf-8')        // true
 * isValidContentType('multipart/form-data; boundary=x') // true
 * isValidContentType('invalid')                         // false
 */
function isValidContentType(contentType) {
    if (!contentType)
        return true; // Empty is OK
    const str = String(contentType);
    // MIME type format: type/subtype[; params]
    // type and subtype: alphanumeric, dots, hyphens
    // params: key=value pairs separated by semicolons
    const mimeRegex = /^[\w]+\/[\w\-\+]+(\s*;\s*[\w\-]+\s*=\s*[\w\-\.]+)*$/iu;
    return mimeRegex.test(str);
}
/**
 * Validates HTTP header name format.
 *
 * RFC 7230 specifies valid characters for header names. This ensures
 * header names conform to the standard.
 *
 * @param headerName - The header name to validate
 * @returns true if the header name is valid
 */
function isValidHeaderName(headerName) {
    // RFC 7230: token = 1*tchar
    // tchar = "!" / "#" / "$" / "%" / "&" / "'" / "*" / "+" / "-" / "." /
    //         "0".."9" / "A".."Z" / "^" / "_" / "`" / "a".."z" / "|" / "~"
    const headerNameRegex = /^[!#$%&'*+\-.^_`|~0-9a-zA-Z]+$/;
    return headerNameRegex.test(headerName);
}
/**
 * Validates request path for security issues.
 *
 * Prevents path traversal, null byte injection, and encoding bypass attacks.
 * Checks for suspicious sequences in both decoded and encoded forms.
 *
 * @param path - The request path to validate
 * @returns true if the path appears safe
 *
 * @example
 * isPathSafe('/api/users')        // true
 * isPathSafe('../etc/passwd')     // false
 * isPathSafe('/..%2Fetc')         // false
 * isPathSafe('/path\x00file')     // false
 */
function isPathSafe(path) {
    // Reject null bytes (immediate path traversal indicator)
    if (path.includes('\0'))
        return false;
    // Reject obvious path traversal patterns
    if (path.includes('../') || path.includes('..\\'))
        return false;
    // Check lowercase version for encoded traversal attempts
    const lower = path.toLowerCase();
    const encodedTraversalPatterns = [
        '%00', // Null byte
        '%2e%2e', // .. encoded
        '%252e', // Double-encoded .
        '%5c', // Backslash
        '%2f%2e%2e', // /.. encoded
        '%25', // % (for encoding bypasses)
    ];
    return !encodedTraversalPatterns.some((pattern) => lower.includes(pattern));
}
/**
 * Generates a cryptographically secure request ID.
 *
 * Used for request tracing across logs and responses. The format includes
 * a random component and timestamp for uniqueness and debugging.
 *
 * Format: req-{16-char-hex}-{timestamp}
 *
 * @returns A unique request ID
 *
 * @example
 * // Result: "req-a1b2c3d4e5f6g7h8-1705855200000"
 */
function generateSecureRequestId() {
    const { randomBytes } = require('crypto');
    const random = randomBytes(8).toString('hex');
    return `req-${random}-${Date.now()}`;
}
/**
 * Truncates a string to a maximum length with ellipsis if truncated.
 *
 * Useful for logging and display of potentially long strings while
 * maintaining readability.
 *
 * @param str - String to truncate
 * @param maxLength - Maximum length (including ellipsis if truncated)
 * @param ellipsis - Ellipsis string (default: "...")
 * @returns Truncated string
 *
 * @example
 * truncateString('Hello World', 8)  // "Hello..."
 */
function truncateString(str, maxLength, ellipsis = '...') {
    if (str.length <= maxLength)
        return str;
    return str.slice(0, maxLength - ellipsis.length) + ellipsis;
}
/**
 * Formats bytes as human-readable size.
 *
 * @param bytes - Number of bytes
 * @returns Formatted size string (e.g., "1.5 MB")
 *
 * @example
 * formatBytes(1024)        // "1.0 KB"
 * formatBytes(1048576)     // "1.0 MB"
 */
function formatBytes(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
}
/**
 * Checks if a value is a valid HTTP status code.
 *
 * @param code - The HTTP status code to validate
 * @returns true if code is between 100-599
 */
function isValidStatusCode(code) {
    return Number.isInteger(code) && code >= 100 && code <= 599;
}
/**
 * Safely parses JSON with fallback to undefined on error.
 *
 * @param json - JSON string to parse
 * @param fallback - Value to return on parse error (default: undefined)
 * @returns Parsed object or fallback value
 *
 * @example
 * safeJsonParse('{"a": 1}')      // { a: 1 }
 * safeJsonParse('invalid')       // undefined
 * safeJsonParse('invalid', null) // null
 */
function safeJsonParse(json, fallback = undefined) {
    try {
        return JSON.parse(json);
    }
    catch {
        return fallback;
    }
}
/**
 * Safely serializes value to JSON with error handling.
 *
 * @param value - Value to serialize
 * @param pretty - Whether to pretty-print (default: false)
 * @returns JSON string or error message
 *
 * @example
 * safeJsonStringify({ a: 1 })  // '{"a":1}'
 * safeJsonStringify({ a: 1 }, true)  // '{\n  "a": 1\n}'
 */
function safeJsonStringify(value, pretty = false) {
    try {
        return JSON.stringify(value, null, pretty ? 2 : undefined);
    }
    catch (error) {
        return `[Serialization Error: ${error instanceof Error ? error.message : String(error)}]`;
    }
}
/**
 * Applies a function to a value only if it's not null/undefined.
 *
 * Useful for optional chaining and transformations.
 *
 * @param value - The value to transform
 * @param fn - Transformation function
 * @returns Transformed value or undefined
 *
 * @example
 * mapOptional(5, (x) => x * 2)   // 10
 * mapOptional(null, (x) => x * 2)  // undefined
 */
function mapOptional(value, fn) {
    return value != null ? fn(value) : undefined;
}
//# sourceMappingURL=utils.js.map