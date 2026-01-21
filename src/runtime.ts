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

const REQUEST_TIMEOUT_MS = 30000; // 30 seconds per-request timeout

/**
 * Core runtime engine. Single instance created by server.ts.
 */
export class Runtime {
  private readonly state: StateManager;
  private readonly telemetry: Telemetry;
  private readonly router: Router;

  constructor() {
    this.state = new StateManager();
    this.telemetry = new Telemetry();
    this.router = new Router();

    // Register routes
    this.setupRoutes();

    // Transition to READY after initialization
    setTimeout(() => {
      if (this.state.transition('READY')) {
        console.log('[runtime] State: READY');
      }
    }, 100);
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

    let responseSize = 0;
    try {
      // Enforce timeout with cancellable timer
      const timeoutController = { cancelled: false };
      const response = await Promise.race([
        this.handleInternal(envelope),
        this.timeoutHandler(REQUEST_TIMEOUT_MS, timeoutController, envelope.id),
      ]);
      
      // Cancel timeout to prevent memory leak
      timeoutController.cancelled = true;

      // Calculate response size for telemetry
      responseSize = Buffer.isBuffer(response.body) 
        ? response.body.length 
        : Buffer.byteLength(response.body, 'utf8');

      return response;
    } catch (error) {
      console.error(`[runtime] [${envelope.id}] Error handling request:`, error);
      const err = error instanceof Error ? error : new Error(String(error));
      const errorResp = errorResponse('Internal server error', 500, false, err, envelope.id);
      responseSize = Buffer.byteLength(errorResp.body.toString(), 'utf8');
      return errorResp;
    } finally {
      // Record request end with response size
      this.telemetry.requestEnd(envelope.startTime, responseSize);
    }
  }

  /**
   * Internal request handling (after state gating).
   */
  private async handleInternal(envelope: RequestEnvelope): Promise<RuntimeResponse> {
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

    // Build context
    const ctx = createContext(envelope, classification, match.params);

    // Dispatch to handler
    return this.dispatch(match.handler, ctx);
  }

  /**
   * Dispatch to named handler.
   */
  private dispatch(handler: string, ctx: import('./context.js').RequestContext): RuntimeResponse {
    switch (handler) {
      case 'home':
        return handleHome(ctx, this.state.current);

      case 'liveness':
        return handleLiveness(this.state);

      case 'readiness':
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
   * Timeout handler returns 503 after timeout (with cancellation support).
   */
  private async timeoutHandler(ms: number, controller: { cancelled: boolean }, requestId: string): Promise<RuntimeResponse> {
    await new Promise<void>(resolve => {
      const timer = setTimeout(() => {
        if (!controller.cancelled) {
          resolve();
        }
      }, ms);
      // Check periodically for cancellation to clean up early
      const checkInterval = setInterval(() => {
        if (controller.cancelled) {
          clearTimeout(timer);
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    });
    return controller.cancelled 
      ? errorResponse('Request completed', 200, false, undefined, requestId) // Never returned
      : errorResponse('Request timeout', 503, false, undefined, requestId);
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
}

// Re-export RequestContext for handlers
export type { RequestContext } from './context.js';
