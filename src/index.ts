/**
 * Nessen Runtime - Main entry point
 * Re-exports all public APIs for consumers
 */

// Main class
export { Runtime } from './runtime.js';

// Configuration
export { createConfig } from './config.js';
export type { RuntimeConfig } from './config.js';

// Logging
export { createDefaultLogger, StructuredLogger, ConsoleLogger } from './logger.js';
export type { Logger } from './logger.js';

// Middleware
export { createLoggingMiddleware } from './middleware/logging.js';
export { createRateLimitMiddleware } from './middleware/rateLimit.js';
export { createCompressionMiddleware } from './middleware/compression.js';

// Types & Interfaces
export type { RequestContext } from './context.js';
export type {
  RuntimeResponse,
  RequestEnvelope
} from './envelope.js';

export type { MiddlewareHandler, RequestHandler } from './middleware.js';

// Router
export { Router } from './router.js';

// Shutdown
export { setupSignalHandlers } from './shutdown.js';

// Telemetry
export { Telemetry } from './telemetry.js';
