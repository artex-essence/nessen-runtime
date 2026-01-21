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
export const DEFAULT_CONFIG: RuntimeConfig = {
  port: (() => {
    const parsed = parseInt(process.env.PORT || '3000', 10);
    return Number.isNaN(parsed) ? 3000 : parsed;
  })(),
  host: process.env.HOST || '0.0.0.0',
  maxBodySize: (() => {
    const parsed = parseInt(process.env.MAX_BODY_SIZE || '1048576', 10);
    return Number.isNaN(parsed) ? 1048576 : parsed;
  })(), // 1MB
  maxUrlLength: 8192, // 8KB
  maxHeaderCount: 100,
  maxHeaderSize: 16384, // 16KB
  maxResponseSize: 10 * 1024 * 1024, // 10MB
  requestTimeoutMs: 30000, // 30 seconds
  idleTimeoutMs: 60000, // 60 seconds
  headersTimeoutMs: 10000, // 10 seconds
  shutdownTimeoutMs: 30000, // 30 seconds
  rateLimitMaxRequests: 100,
  rateLimitWindowMs: 60000,
  rateLimitMaxKeys: 10000,
  rateLimitCleanupMs: 60000,
  trustProxy: process.env.TRUST_PROXY === 'true',
  requestIdHeader: 'x-request-id',
  generateRequestId: true,
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'] as const,
};

/**
 * Creates a runtime configuration, merging provided options with defaults.
 *
 * @param overrides - Partial configuration to override defaults
 * @returns Complete runtime configuration
 */
export function createConfig(overrides?: Partial<RuntimeConfig>): RuntimeConfig {
  return {
    ...DEFAULT_CONFIG,
    ...overrides,
  };
}

/**
 * Validates configuration values are within acceptable ranges.
 *
 * @param config - Configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateConfig(config: RuntimeConfig): void {
  if (config.maxBodySize < 0) {
    throw new Error('maxBodySize must be non-negative');
  }
  
  if (config.maxBodySize > 100 * 1024 * 1024) { // 100MB
    throw new Error('maxBodySize cannot exceed 100MB');
  }
  
  if (config.maxUrlLength < 1024) {
    throw new Error('maxUrlLength must be at least 1KB');
  }
  
  if (config.maxHeaderCount < 10) {
    throw new Error('maxHeaderCount must be at least 10');
  }
  
  if (config.requestTimeoutMs < 1000) {
    throw new Error('requestTimeoutMs must be at least 1 second');
  }

  if (config.shutdownTimeoutMs < 1000) {
    throw new Error('shutdownTimeoutMs must be at least 1 second');
  }

  if (config.rateLimitMaxRequests < 1) {
    throw new Error('rateLimitMaxRequests must be at least 1');
  }

  if (config.rateLimitWindowMs < 1000) {
    throw new Error('rateLimitWindowMs must be at least 1 second');
  }

  if (config.rateLimitMaxKeys < 1) {
    throw new Error('rateLimitMaxKeys must be at least 1');
  }

  if (config.maxResponseSize < 1024) {
    throw new Error('maxResponseSize must be at least 1KB');
  }
  
  if (config.port !== 0 && (config.port < 1 || config.port > 65535)) {
    throw new Error('port must be 0 (ephemeral) or between 1 and 65535');
  }
}
