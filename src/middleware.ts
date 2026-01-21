/**
 * middleware.ts
 *
 * Middleware pipeline system for request processing.
 * Allows extensible request handling with composable middleware functions.
 * Middleware can modify context, headers, or terminate request processing.
 *
 * Middleware pattern:
 * - Each middleware is a function that receives context, handler, and next()
 * - Can inspect/modify context before handler
 * - Can modify response before returning
 * - Can short-circuit by not calling next()
 *
 * @module middleware
 */

import type { RequestContext } from './context.js';
import type { RuntimeResponse } from './envelope.js';

/**
 * Middleware context: extends RequestContext with additional metadata.
 * Used to pass data between middleware layers.
 */
export interface MiddlewareContext extends RequestContext {
  /**
   * Metadata bag for middleware to share data.
   * Common keys: startTime (for latency), userId (for auth), etc.
   */
  metadata: Record<string, unknown>;
}

/**
 * Middleware handler function signature.
 *
 * @param ctx - Request context (may be extended by previous middleware)
 * @param next - Calls next middleware in chain
 * @returns Response from handler or downstream middleware
 */
export type MiddlewareHandler = (
  ctx: MiddlewareContext,
  next: () => Promise<RuntimeResponse>
) => Promise<RuntimeResponse>;

/**
 * Request handler function (the final destination of middleware chain).
 * Can return RuntimeResponse synchronously or asynchronously.
 */
export type RequestHandler = (ctx: RequestContext) => RuntimeResponse | Promise<RuntimeResponse>;

/**
 * Middleware pipeline: chains middleware with a final handler.
 *
 * Composable pipeline pattern:
 * 1. Middleware execute in order
 * 2. Each middleware can inspect/modify context
 * 3. Each middleware calls next() to continue chain
 * 4. Final middleware calls the actual handler
 * 5. Response flows back through middleware for modification
 *
 * Example:
 * ```typescript
 * const pipeline = new MiddlewarePipeline()
 *   .use(loggingMiddleware)
 *   .use(rateLimitMiddleware)
 *   .use(authMiddleware);
 *
 * const response = await pipeline.handle(ctx, actualHandler);
 * ```
 */
export class MiddlewarePipeline {
  private middleware: MiddlewareHandler[] = [];

  /**
   * Adds middleware to the pipeline.
   *
   * Middleware execute in the order they are added.
   *
   * @param handler - Middleware function to add
   * @returns this (for chaining)
   */
  use(handler: MiddlewareHandler): this {
    this.middleware.push(handler);
    return this;
  }

  /**
   * Handles a request through the middleware pipeline.
   *
   * Creates the execution chain and processes the request through
   * all middleware before reaching the handler.
   *
   * @param ctx - Request context
   * @param handler - Final request handler
   * @returns Response from handler or middleware
   */
  async handle(context: RequestContext, handler: RequestHandler): Promise<RuntimeResponse> {
    // Extend context with middleware-specific metadata
    const middlewareCtx: MiddlewareContext = {
      ...context,
      metadata: {},
    };

    // Build execution chain
    let index = 0;
    const execute = async (): Promise<RuntimeResponse> => {
      if (index < this.middleware.length) {
        // Call next middleware
        return this.middleware[index++](middlewareCtx, execute);
      }
      // All middleware done: call handler
      return handler(middlewareCtx);
    };

    return execute();
  }
}

/**
 * Noop middleware: passes through without modification.
 *
 * Useful for testing or as a placeholder.
 *
 * @param ctx - Request context
 * @param next - Next middleware
 * @returns Result of next middleware
 */
export async function noopMiddleware(
  _ctx: MiddlewareContext,
  next: () => Promise<RuntimeResponse>
): Promise<RuntimeResponse> {
  return next();
}

/**
 * Creates a middleware factory for conditional middleware application.
 *
 * Useful for middleware that should only apply to certain requests.
 *
 * @param predicate - Function to determine if middleware should apply
 * @param middleware - Middleware function
 * @returns Conditional middleware
 *
 * @example
 * const onlyApi = createConditionalMiddleware(
 *   (ctx) => ctx.intent === 'api',
 *   rateLimitMiddleware
 * );
 */
export function createConditionalMiddleware(
  predicate: (ctx: MiddlewareContext) => boolean,
  middleware: MiddlewareHandler
): MiddlewareHandler {
  return async (ctx, next) => {
    if (predicate(ctx)) {
      return middleware(ctx, next);
    }
    return next();
  };
}

/**
 * Creates a middleware factory for executing multiple middleware in sequence.
 *
 * Useful for grouping related middleware.
 *
 * @param handlers - Array of middleware to execute
 * @returns Combined middleware
 */
export function composeMiddleware(...handlers: MiddlewareHandler[]): MiddlewareHandler {
  return async (ctx, next) => {
    let index = 0;
    const execute = async (): Promise<RuntimeResponse> => {
      if (index < handlers.length) {
        return handlers[index++](ctx, execute);
      }
      return next();
    };
    return execute();
  };
}
