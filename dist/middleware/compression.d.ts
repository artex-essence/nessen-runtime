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
 * Compression is automatically skipped for:
 * - HEAD requests (no body)
 * - Responses below threshold size (default: 1024 bytes)
 * - Already-compressed content (image/*, video/*, application/zip, etc.)
 * - Responses without Accept-Encoding header (unless forceCompression=true)
 * - Non-compressible Content-Types (binary data, already compressed formats)
 *
 * @module middleware/compression
 */
import type { MiddlewareHandler } from '../middleware.js';
/**
 * Compression algorithm enumeration.
 */
export declare enum CompressionAlgorithm {
    GZIP = "gzip",
    BROTLI = "br",
    DEFLATE = "deflate",
    NONE = "identity"
}
/**
 * Compression middleware configuration.
 */
export interface CompressionConfig {
    /** Compression algorithm to use (default: prefer brotli, fallback to gzip) */
    algorithm?: CompressionAlgorithm;
    /** Compression level 1-11 (default: 6) */
    level?: number;
    /** Minimum response size to compress in bytes (default: 1024) */
    threshold?: number;
    /** Content-Types to compress (default: text/*, application/json, application/xml) */
    compressibleTypes?: string[];
    /** Whether to compress even if client doesn't request it (default: false) */
    forceCompression?: boolean;
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
export declare function createCompressionMiddleware(config?: CompressionConfig): MiddlewareHandler;
/**
 * Creates a disabled compression middleware (useful for opt-out).
 * Useful for testing or per-route disable.
 *
 * @returns Middleware that skips compression
 */
export declare function createNoCompressionMiddleware(): MiddlewareHandler;
//# sourceMappingURL=compression.d.ts.map