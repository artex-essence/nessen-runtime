"use strict";
/**
 * middleware/compression.ts
 *
 * Response compression middleware using gzip or brotli based on client capabilities.
 * Reduces response sizes by 3-10x for text content, saving bandwidth and improving latency.
 *
 * Features:
 * - Content-Encoding negotiation (gzip preferred, brotli if available)
 * - Compression level configuration (1-11, default 6)
 * - Content-Type filtering (compress only compressible types)
 * - Minimum size threshold (don't compress small responses)
 * - Automatic decompression flag removal
 *
 * Supported encoding in order of preference:
 * 1. gzip (widely supported, built-in Node.js)
 * 2. brotli (better compression, supported in Node.js 10.16+)
 * 3. deflate (legacy support)
 *
 * @module middleware/compression
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompressionAlgorithm = void 0;
exports.createCompressionMiddleware = createCompressionMiddleware;
exports.createNoCompressionMiddleware = createNoCompressionMiddleware;
const zlib_1 = require("zlib");
/**
 * Compression algorithm enumeration.
 */
var CompressionAlgorithm;
(function (CompressionAlgorithm) {
    CompressionAlgorithm["GZIP"] = "gzip";
    CompressionAlgorithm["BROTLI"] = "br";
    CompressionAlgorithm["DEFLATE"] = "deflate";
    CompressionAlgorithm["NONE"] = "identity";
})(CompressionAlgorithm || (exports.CompressionAlgorithm = CompressionAlgorithm = {}));
/**
 * Default compressible content types.
 * Regex patterns to match against Content-Type header.
 */
const DEFAULT_COMPRESSIBLE_TYPES = [
    /^text\//i,
    /^application\/(json|xml|javascript)$/i,
    /^application\/.*\+json$/i,
    /^application\/.*\+xml$/i,
];
/**
 * Check if content type should be compressed.
 *
 * @param contentType - Content-Type header value
 * @param compressibleTypes - Array of regex patterns
 * @returns true if content should be compressed
 */
function shouldCompress(contentType, compressibleTypes) {
    if (!contentType)
        return false;
    return compressibleTypes.some((pattern) => pattern.test(contentType));
}
/**
 * Parse Accept-Encoding header to determine client preferences.
 *
 * @param acceptEncoding - Accept-Encoding header value
 * @returns Array of accepted encodings in preference order
 */
function parseAcceptEncoding(acceptEncoding) {
    if (!acceptEncoding)
        return ['identity'];
    const encodings = acceptEncoding
        .split(',')
        .map((enc) => {
        const [encoding, qPart] = enc.trim().split(';');
        const q = qPart ? parseFloat(qPart.split('=')[1] || '1') : 1;
        return { encoding: encoding.trim().toLowerCase(), q };
    })
        .filter((enc) => enc.q > 0)
        .sort((a, b) => b.q - a.q)
        .map((enc) => enc.encoding);
    return encodings.length > 0 ? encodings : ['identity'];
}
/**
 * Select compression algorithm based on client Accept-Encoding.
 *
 * @param acceptedEncodings - Client's accepted encodings
 * @param preferredAlgorithm - Preferred algorithm if available
 * @returns Selected algorithm or 'identity' if none acceptable
 */
function selectEncoding(acceptedEncodings, preferredAlgorithm) {
    // If client supports identity (no compression), it's always acceptable
    if (!acceptedEncodings.includes('gzip') && !acceptedEncodings.includes('br')) {
        return CompressionAlgorithm.NONE;
    }
    // Prefer brotli if client and config support it
    if (acceptedEncodings.includes('br') && preferredAlgorithm !== CompressionAlgorithm.GZIP) {
        try {
            // Check if brotli is available (Node.js 10.16+)
            require.resolve('zlib').includes('zlib');
            return CompressionAlgorithm.BROTLI;
        }
        catch {
            // Brotli not available, fall back to gzip
        }
    }
    // Use gzip if available
    if (acceptedEncodings.includes('gzip')) {
        return CompressionAlgorithm.GZIP;
    }
    // Use deflate as final fallback
    if (acceptedEncodings.includes('deflate')) {
        return CompressionAlgorithm.DEFLATE;
    }
    return CompressionAlgorithm.NONE;
}
/**
 * Creates a compression middleware with configuration.
 *
 * Automatically compresses responses based on:
 * - Client Accept-Encoding header
 * - Response Content-Type
 * - Response size (minimum threshold)
 * - Configured compression algorithm
 *
 * @param config - Configuration options
 * @returns Middleware function
 *
 * @example
 * const compression = createCompressionMiddleware({
 *   level: 6,
 *   threshold: 1024,
 *   algorithm: CompressionAlgorithm.GZIP,
 * });
 * pipeline.use(compression);
 */
function createCompressionMiddleware(config = {}) {
    const level = Math.max(1, Math.min(11, config.level ?? 6));
    const threshold = config.threshold ?? 1024;
    const compressibleTypes = config.compressibleTypes?.map((t) => new RegExp(t, 'i')) ??
        DEFAULT_COMPRESSIBLE_TYPES;
    const preferredAlgorithm = config.algorithm;
    const forceCompression = config.forceCompression ?? false;
    return async (ctx, next) => {
        const response = await next();
        // Check if response has body
        if (!response.body) {
            return response;
        }
        // Check response size
        const bodySize = typeof response.body === 'string'
            ? Buffer.byteLength(response.body, 'utf-8')
            : response.body.length;
        if (bodySize < threshold) {
            return response;
        }
        // Check content type
        const contentType = response.headers?.['Content-Type'];
        if (!shouldCompress(contentType, compressibleTypes)) {
            return response;
        }
        // Get Accept-Encoding from request if not forcing compression
        const acceptEncoding = forceCompression
            ? 'br, gzip'
            : ctx.headers['accept-encoding'];
        const acceptedEncodings = parseAcceptEncoding(acceptEncoding);
        const encoding = selectEncoding(acceptedEncodings, preferredAlgorithm);
        // No compression if identity or body is already a stream
        if (encoding === CompressionAlgorithm.NONE || typeof response.body !== 'string') {
            return response;
        }
        // Convert body to buffer if string
        const buffer = typeof response.body === 'string'
            ? Buffer.from(response.body, 'utf-8')
            : response.body;
        try {
            let compressedBody = null;
            // Create appropriate compressor
            if (encoding === CompressionAlgorithm.GZIP) {
                compressedBody = await new Promise((resolve, reject) => {
                    const compressor = (0, zlib_1.createGzip)({ level });
                    const chunks = [];
                    compressor.on('data', (chunk) => chunks.push(chunk));
                    compressor.on('end', () => resolve(Buffer.concat(chunks)));
                    compressor.on('error', reject);
                    compressor.end(buffer);
                });
            }
            else if (encoding === CompressionAlgorithm.BROTLI) {
                compressedBody = await new Promise((resolve, reject) => {
                    const compressor = (0, zlib_1.createBrotliCompress)({ params: { [0]: level } });
                    const chunks = [];
                    compressor.on('data', (chunk) => chunks.push(chunk));
                    compressor.on('end', () => resolve(Buffer.concat(chunks)));
                    compressor.on('error', reject);
                    compressor.end(buffer);
                });
            }
            // Only use compression if it actually reduces size
            if (compressedBody && compressedBody.length < bodySize) {
                const headers = { ...response.headers };
                headers['Content-Encoding'] = encoding;
                headers['Content-Length'] = String(compressedBody.length);
                // Remove Content-Length if present (will be recalculated)
                delete headers['Content-Length'];
                return {
                    ...response,
                    body: compressedBody,
                    headers,
                };
            }
            // Compression didn't save space, return uncompressed
            return response;
        }
        catch (error) {
            // Compression failed, return original response
            console.error(`Compression error (${encoding}):`, error);
            return response;
        }
    };
}
/**
 * Creates a disabled compression middleware (useful for opt-out).
 * Useful for testing or per-route disable.
 *
 * @returns Middleware that skips compression
 */
function createNoCompressionMiddleware() {
    return async (_ctx, next) => {
        const response = await next();
        return {
            ...response,
            headers: {
                ...response.headers,
                'Content-Encoding': 'identity',
            },
        };
    };
}
//# sourceMappingURL=compression.js.map