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
export class StructuredLogger implements Logger {
  private minLevel: LogLevel;

  constructor(minLevel: LogLevel = 'info') {
    this.minLevel = minLevel;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    };

    const output = JSON.stringify(entry);

    // Route to stderr for warn/error, stdout otherwise
    if (level === 'error' || level === 'warn') {
      console.error(output);
    } else {
      console.log(output);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentIndex = levels.indexOf(level);
    const minIndex = levels.indexOf(this.minLevel);
    return currentIndex >= minIndex;
  }
}

/**
 * Console logger adapter (for development/backwards compat).
 */
export class ConsoleLogger implements Logger {
  debug(message: string, meta?: Record<string, unknown>): void {
    console.log(`[DEBUG] ${message}`, meta || '');
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.log(`[INFO] ${message}`, meta || '');
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(`[WARN] ${message}`, meta || '');
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(`[ERROR] ${message}`, meta || '');
  }
}

/**
 * Silent logger (no-op, for tests and minimal environments).
 */
export class SilentLogger implements Logger {
  debug(): void {
    // no-op
  }

  info(): void {
    // no-op
  }

  warn(): void {
    // no-op
  }

  error(): void {
    // no-op
  }
}

/**
 * Creates default logger based on environment.
 */
export function createDefaultLogger(): Logger {
  const useStructured = process.env.LOG_FORMAT === 'json' || process.env.NODE_ENV === 'production';
  const minLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

  if (useStructured) {
    return new StructuredLogger(minLevel);
  }

  return new ConsoleLogger();
}
