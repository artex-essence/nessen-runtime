/**
 * logger.ts
 *
 * Production-grade structured logging with JSON output.
 * Provides consistent log formatting for machine parsing and log aggregation.
 *
 * @module logger
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    message: string;
    [key: string]: unknown;
}
export interface Logger {
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
}
/**
 * Creates a production logger that outputs structured JSON.
 */
export declare class StructuredLogger implements Logger {
    private minLevel;
    constructor(minLevel?: LogLevel);
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
    private log;
    private shouldLog;
}
/**
 * Console logger adapter (for development/backwards compat).
 */
export declare class ConsoleLogger implements Logger {
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
}
/**
 * Silent logger (no-op, for tests and minimal environments).
 */
export declare class SilentLogger implements Logger {
    debug(): void;
    info(): void;
    warn(): void;
    error(): void;
}
/**
 * Creates default logger based on environment.
 */
export declare function createDefaultLogger(): Logger;
//# sourceMappingURL=logger.d.ts.map