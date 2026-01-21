"use strict";
/**
 * logger.ts
 *
 * Production-grade structured logging with JSON output.
 * Provides consistent log formatting for machine parsing and log aggregation.
 *
 * @module logger
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleLogger = exports.StructuredLogger = void 0;
exports.createDefaultLogger = createDefaultLogger;
/**
 * Creates a production logger that outputs structured JSON.
 */
class StructuredLogger {
    minLevel;
    constructor(minLevel = 'info') {
        this.minLevel = minLevel;
    }
    debug(message, meta) {
        this.log('debug', message, meta);
    }
    info(message, meta) {
        this.log('info', message, meta);
    }
    warn(message, meta) {
        this.log('warn', message, meta);
    }
    error(message, meta) {
        this.log('error', message, meta);
    }
    log(level, message, meta) {
        if (!this.shouldLog(level)) {
            return;
        }
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...meta,
        };
        const output = JSON.stringify(entry);
        // Route to stderr for warn/error, stdout otherwise
        if (level === 'error' || level === 'warn') {
            console.error(output);
        }
        else {
            console.log(output);
        }
    }
    shouldLog(level) {
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentIndex = levels.indexOf(level);
        const minIndex = levels.indexOf(this.minLevel);
        return currentIndex >= minIndex;
    }
}
exports.StructuredLogger = StructuredLogger;
/**
 * Console logger adapter (for development/backwards compat).
 */
class ConsoleLogger {
    debug(message, meta) {
        console.log(`[DEBUG] ${message}`, meta || '');
    }
    info(message, meta) {
        console.log(`[INFO] ${message}`, meta || '');
    }
    warn(message, meta) {
        console.warn(`[WARN] ${message}`, meta || '');
    }
    error(message, meta) {
        console.error(`[ERROR] ${message}`, meta || '');
    }
}
exports.ConsoleLogger = ConsoleLogger;
/**
 * Creates default logger based on environment.
 */
function createDefaultLogger() {
    const useStructured = process.env.LOG_FORMAT === 'json' || process.env.NODE_ENV === 'production';
    const minLevel = process.env.LOG_LEVEL || 'info';
    if (useStructured) {
        return new StructuredLogger(minLevel);
    }
    return new ConsoleLogger();
}
//# sourceMappingURL=logger.js.map