"use strict";
/**
 * config.ts
 *
 * Centralized configuration for runtime limits, timeouts, and security policies.
 * All defaults can be overridden via environment variables.
 *
 * @module config
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = void 0;
exports.createConfig = createConfig;
exports.validateConfig = validateConfig;
/**
 * Default configuration values.
 */
exports.DEFAULT_CONFIG = {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    maxBodySize: parseInt(process.env.MAX_BODY_SIZE || '1048576', 10), // 1MB
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
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
};
/**
 * Creates a runtime configuration, merging provided options with defaults.
 *
 * @param overrides - Partial configuration to override defaults
 * @returns Complete runtime configuration
 */
function createConfig(overrides) {
    return {
        ...exports.DEFAULT_CONFIG,
        ...overrides,
    };
}
/**
 * Validates configuration values are within acceptable ranges.
 *
 * @param config - Configuration to validate
 * @throws Error if configuration is invalid
 */
function validateConfig(config) {
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
    if (config.port < 1 || config.port > 65535) {
        throw new Error('port must be between 1 and 65535');
    }
}
//# sourceMappingURL=config.js.map