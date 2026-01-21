/**
 * utils.ts
 *
 * Security utilities and helpers for input validation, escaping, and sanitization.
 * Provides centralized, well-tested implementations for common security concerns.
 *
 * @module utils
 */
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
export declare function escapeHtml(str: string): string;
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
export declare function isValidHeaderValue(value: unknown): boolean;
/**
 * Sanitizes header value by removing dangerous characters.
 *
 * If a header value contains CRLF or null bytes, this removes them rather than
 * rejecting the entire value. Use when you want to accept the input but make it safe.
 *
 * @param value - The header value to sanitize
 * @returns The sanitized header value (empty string if value is falsy)
 */
export declare function sanitizeHeaderValue(value: unknown): string;
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
export declare function isValidHost(hostHeader: string, validHosts: string[]): boolean;
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
export declare function isValidContentType(contentType: unknown): boolean;
/**
 * Validates HTTP header name format.
 *
 * RFC 7230 specifies valid characters for header names. This ensures
 * header names conform to the standard.
 *
 * @param headerName - The header name to validate
 * @returns true if the header name is valid
 */
export declare function isValidHeaderName(headerName: string): boolean;
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
export declare function isPathSafe(path: string): boolean;
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
export declare function generateSecureRequestId(): string;
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
export declare function truncateString(str: string, maxLength: number, ellipsis?: string): string;
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
export declare function formatBytes(bytes: number): string;
/**
 * Checks if a value is a valid HTTP status code.
 *
 * @param code - The HTTP status code to validate
 * @returns true if code is between 100-599
 */
export declare function isValidStatusCode(code: number): boolean;
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
export declare function safeJsonParse<T>(json: string, fallback?: T | undefined): T | undefined;
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
export declare function safeJsonStringify(value: unknown, pretty?: boolean): string;
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
export declare function mapOptional<T, R>(value: T | null | undefined, fn: (v: T) => R): R | undefined;
//# sourceMappingURL=utils.d.ts.map