/**
 * runtime.ts
 *
 * Core request handling runtime implementing the state machine, routing, and telemetry.
 * Operates on transport-neutral RequestEnvelope/RuntimeResponse types, enabling use
 * with any HTTP framework or protocol. Enforces request timeouts, state gating, and
 * security validations.
 *
 * @module runtime
 */

import type { RequestEnvelope, RuntimeResponse } from './envelope.js';
import { StateManager } from './state.js';
import { Telemetry } from './telemetry.js';
import { Router } from './router.js';
import { classifyRequest } from './classify.js';
import { createContext } from './context.js';
import { handleHome, handleBadge } from './handlers.js';
import { handleLiveness, handleReadiness, handleHealthApi } from './health.js';
import { errorResponse, serviceUnavailableResponse, notFoundResponse } from './response.js';
import { isPathSafe } from './utils.js';
import { MiddlewarePipeline, type MiddlewareHandler, type RequestHandler } from './middleware.js';
import { createLoggingMiddleware } from './middleware/logging.js';
import { createRateLimitMiddleware } from './middleware/rateLimit.js';
import { createCompressionMiddleware } from './middleware/compression.js';
import { createConfig, type RuntimeConfig } from './config.js';
import type { Logger } from './logger.js';

/**
 * Core runtime engine. Single instance created by server.ts.
 */
export class Runtime {
  private readonly state: StateManager;
  private readonly telemetry: Telemetry;
  private readonly router: Router;
  private readonly pipeline: MiddlewarePipeline;
  private readonly config: RuntimeConfig;
  private readonly logger: Logger;

  constructor(config: RuntimeConfig = createConfig(), logger: Logger = console) {
    this.state = new StateManager();
    this.telemetry = new Telemetry();
    this.router = new Router();
    this.config = config;
    this.logger = logger;
    this.pipeline = new MiddlewarePipeline()
      .use(createLoggingMiddleware({ logger }))
      .use(
        createRateLimitMiddleware({
          maxRequests: this.config.rateLimitMaxRequests,
          windowMs: this.config.rateLimitWindowMs,
          maxKeys: this.config.rateLimitMaxKeys,
          cleanupIntervalMs: this.config.rateLimitCleanupMs,
          keyGenerator: this.config.rateLimitKeyExtractor,
        })
      )
      .use(createCompressionMiddleware());

    // Register routes
    this.setupRoutes();

    // Transition to READY immediately (initialization is synchronous)
    if (this.state.transition('READY')) {
      this.logger.info('[runtime] State: READY');
    }
  }

  /**
   * Setup routes during initialization.
   */
  private setupRoutes(): void {
    this.router.register('GET', '/', 'home');
    this.router.register('GET', '/health', 'liveness');
    this.router.register('GET', '/ready', 'readiness');
    this.router.register('GET', '/api/health', 'healthApi');
    this.router.register('GET', '/badge/:label/:value.svg', 'badge');
  }

  /**
   * Handle request envelope. Main entry point.
   */
  async handle(envelope: RequestEnvelope): Promise<RuntimeResponse> {
    // State gating: reject if draining or stopping
    if (!this.state.canAcceptRequests()) {
      return serviceUnavailableResponse(`Runtime state: ${this.state.current}`, envelope.id);
    }

    // Record request start
    this.telemetry.requestStart();

    // Create AbortController for request cancellation
    const abortController = new AbortController();
    let timeoutHandle: NodeJS.Timeout | undefined;

    let responseSize = 0;
    try {
      const timeout = new Promise<RuntimeResponse>((resolve) => {
        timeoutHandle = setTimeout(() => {
          abortController.abort('Request timeout');
          resolve(errorResponse('Request timeout', 504, false, undefined, envelope.id));
        }, this.config.requestTimeoutMs);
        timeoutHandle.unref?.();
      });

      const response = await Promise.race([
        this.handleInternal(envelope, abortController.signal),
        timeout,
      ]);

      // Calculate response size for telemetry
      responseSize = Buffer.isBuffer(response.body)
        ? response.body.length
        : Buffer.byteLength(response.body, 'utf8');

      // Enforce response size limits
      if (responseSize > this.config.maxResponseSize) {
        return errorResponse('Response too large', 413, false, undefined, envelope.id);
      }

      return response;
    } catch (error) {
      this.logger.error(`[runtime] [${envelope.id}] Error handling request:`, { error });
      const err = error instanceof Error ? error : new Error(String(error));
      const errorResp = errorResponse('Internal server error', 500, false, err, envelope.id);
      responseSize = Buffer.byteLength(errorResp.body.toString(), 'utf8');
      return errorResp;
    } finally {
      // Clear timeout timer
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      // Record request end with response size
      this.telemetry.requestEnd(envelope.startTime, responseSize);
    }
  }

  /**
   * Internal request handling (after state gating).
   */
  private async handleInternal(envelope: RequestEnvelope, abortSignal: AbortSignal): Promise<RuntimeResponse> {
    // Classify request
    const classification = classifyRequest(envelope);

    // Security: validate path
    if (!isPathSafe(classification.pathInfo)) {
      return errorResponse('Invalid path', 400, classification.expects === 'json', undefined, envelope.id);
    }

    // Route matching
    const match = this.router.match(envelope.method, classification.pathInfo);

    if (!match) {
      return notFoundResponse(classification.pathInfo, classification.expects === 'json', envelope.id);
    }

    // Build context with abort signal
    const ctx = createContext(envelope, classification, match.params, abortSignal);

    // Dispatch through middleware pipeline and handler
    const finalHandler: RequestHandler = (context) => this.dispatch(match.handler, context);
    return this.pipeline.handle(ctx, finalHandler);
  }

  /**
   * Dispatch to named handler.
   */
  private dispatch(handler: string, ctx: import('./context.js').RequestContext): RuntimeResponse | Promise<RuntimeResponse> {
    switch (handler) {
      case 'home':
        return handleHome(ctx, this.state.current);

      case 'liveness':
        return handleLiveness(this.state);

      case 'readiness':
        // Note: handleReadiness returns Promise<RuntimeResponse>
        return handleReadiness(this.state);

      case 'healthApi':
        return handleHealthApi(this.state, this.telemetry);

      case 'badge':
        return handleBadge(ctx);

      default:
        return notFoundResponse(ctx.pathInfo, ctx.expects === 'json', ctx.id);
    }
  }

  /**
   * Get state manager (for server.ts shutdown).
   */
  getState(): StateManager {
    return this.state;
  }

  /**
   * Get telemetry (for monitoring).
   */
  getTelemetry(): Telemetry {
    return this.telemetry;
  }

  /**
   * Allow callers to extend the middleware pipeline with custom middleware.
   */
  extendPipeline(handler: MiddlewareHandler): this {
    this.pipeline.use(handler);
    return this;
  }

  /**
   * Alias for extendPipeline() - express-like API for adding middleware.
   * @param handler - Middleware handler to add to the pipeline
   * @returns - Returns this for chaining
   */
  use(handler: MiddlewareHandler): this {
    return this.extendPipeline(handler);
  }
}

// Re-export RequestContext for handlers
export type { RequestContext } from './context.js';
