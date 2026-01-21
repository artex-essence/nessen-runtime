/**
 * config.ts
 *
 * Centralized configuration for runtime limits, timeouts, and security policies.
 * All defaults can be overridden via environment variables.
 *
 * @module config
 */
/**
 * Runtime configuration with sensible defaults.
 */
export interface RuntimeConfig {
    /** Server listening port */
    readonly port: number;
    /** Server bind address */
    readonly host: string;
    /** Maximum request body size in bytes (default: 1MB) */
    readonly maxBodySize: number;
    /** Maximum URL length in bytes (default: 8KB) */
    readonly maxUrlLength: number;
    /** Maximum number of headers (default: 100) */
    readonly maxHeaderCount: number;
    /** Maximum header size in bytes (default: 16KB) */
    readonly maxHeaderSize: number;
    /** Maximum response size in bytes (default: 10MB) */
    readonly maxResponseSize: number;
    /** Per-request timeout in milliseconds (default: 30s) */
    readonly requestTimeoutMs: number;
    /** Idle connection timeout in milliseconds (default: 60s) */
    readonly idleTimeoutMs: number;
    /** Headers parsing timeout in milliseconds (default: 10s) */
    readonly headersTimeoutMs: number;
    /** Graceful shutdown drain timeout in milliseconds (default: 30s) */
    readonly shutdownTimeoutMs: number;
    /** Rate limit: max requests per window (default: 100) */
    readonly rateLimitMaxRequests: number;
    /** Rate limit: window duration in milliseconds (default: 60s) */
    readonly rateLimitWindowMs: number;
    /** Rate limit: maximum tracked keys to avoid memory blowup (default: 10000) */
    readonly rateLimitMaxKeys: number;
    /** Rate limit: cleanup interval in milliseconds (default: 60s) */
    readonly rateLimitCleanupMs: number;
    /** Rate limit: custom key extraction function (default: client IP) */
    readonly rateLimitKeyExtractor?: (headers: Record<string, string | string[] | undefined>, remoteAddress: string | undefined) => string;
    /** Whether to trust X-Forwarded-For header (default: false) */
    readonly trustProxy: boolean;
    /** Header name to read/write request IDs (default: x-request-id) */
    readonly requestIdHeader: string;
    /** If true, generate a request ID when missing (default: true) */
    readonly generateRequestId: boolean;
    /** Allowed HTTP methods */
    readonly allowedMethods: readonly string[];
}
/**
 * Default configuration values.
 */
export declare const DEFAULT_CONFIG: RuntimeConfig;
/**
 * Creates a runtime configuration, merging provided options with defaults.
 *
 * @param overrides - Partial configuration to override defaults
 * @returns Complete runtime configuration
 */
export declare function createConfig(overrides?: Partial<RuntimeConfig>): RuntimeConfig;
/**
 * Validates configuration values are within acceptable ranges.
 *
 * @param config - Configuration to validate
 * @throws Error if configuration is invalid
 */
export declare function validateConfig(config: RuntimeConfig): void;
//# sourceMappingURL=config.d.ts.map