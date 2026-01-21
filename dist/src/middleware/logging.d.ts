/**
 * middleware/logging.ts
 *
 * Structured logging middleware for request tracking and debugging.
 * Logs request arrival, processing time, and response details in JSON format.
 *
 * Features:
 * - Request ID correlation
 * - Response time measurement
 * - Status code and size tracking
 * - Configurable log levels
 * - Structured JSON output for easy parsing
 *
 * @module middleware/logging
 */
import type { MiddlewareHandler } from '../middleware.js';
export interface Logger {
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
}
/**
 * Log levels for filtering.
 */
export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}
/**
 * Structured log entry.
 */
export interface LogEntry {
    timestamp: number;
    level: string;
    requestId: string;
    method: string;
    path: string;
    statusCode?: number;
    durationMs?: number;
    sizeBytes?: number;
    message: string;
    error?: string;
}
/**
 * Logging middleware configuration.
 */
export interface LoggingConfig {
    minLevel?: LogLevel;
    includeHeaders?: boolean;
    includeBody?: boolean;
    logger?: Logger;
}
/**
 * Creates a logging middleware with configuration.
 *
 * Logs request entry/exit with detailed information useful for:
 * - Debugging request flow
 * - Performance monitoring
 * - Security auditing
 * - Error tracking
 *
 * @param config - Configuration options
 * @returns Middleware function
 *
 * @example
 * const logging = createLoggingMiddleware({ minLevel: LogLevel.INFO });
 * pipeline.use(logging);
 */
export declare function createLoggingMiddleware(config?: LoggingConfig): MiddlewareHandler;
//# sourceMappingURL=logging.d.ts.map