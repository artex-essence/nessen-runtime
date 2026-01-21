"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = void 0;
exports.createLoggingMiddleware = createLoggingMiddleware;
/**
 * Log levels for filtering.
 */
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
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
function createLoggingMiddleware(config = {}) {
    const logger = config.logger ?? console;
    return async (ctx, next) => {
        const startTime = Date.now();
        // Log request arrival
        logEntry(logger, {
            timestamp: startTime,
            level: 'INFO',
            requestId: ctx.id,
            method: ctx.method,
            path: ctx.pathInfo,
            message: 'Request started',
        });
        try {
            // Call handler and time it
            const response = await next();
            // Log response
            const durationMs = Date.now() - startTime;
            const sizeBytes = Buffer.isBuffer(response.body)
                ? response.body.length
                : Buffer.byteLength(response.body, 'utf8');
            logEntry(logger, {
                timestamp: Date.now(),
                level: 'INFO',
                requestId: ctx.id,
                method: ctx.method,
                path: ctx.pathInfo,
                statusCode: response.statusCode,
                durationMs,
                sizeBytes,
                message: `Request completed`,
            });
            return response;
        }
        catch (error) {
            // Log error
            const durationMs = Date.now() - startTime;
            logEntry(logger, {
                timestamp: Date.now(),
                level: 'ERROR',
                requestId: ctx.id,
                method: ctx.method,
                path: ctx.pathInfo,
                durationMs,
                message: 'Request failed',
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }
    };
}
/**
 * Logs a structured log entry to console.
 *
 * Outputs JSON for easy parsing by log aggregators.
 *
 * @param entry - Log entry to write
 */
function logEntry(logger, entry) {
    logger.info(JSON.stringify(entry));
}
//# sourceMappingURL=logging.js.map