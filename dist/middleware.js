"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiddlewarePipeline = void 0;
exports.noopMiddleware = noopMiddleware;
exports.createConditionalMiddleware = createConditionalMiddleware;
exports.composeMiddleware = composeMiddleware;
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
class MiddlewarePipeline {
    middleware = [];
    /**
     * Adds middleware to the pipeline.
     *
     * Middleware execute in the order they are added.
     *
     * @param handler - Middleware function to add
     * @returns this (for chaining)
     */
    use(handler) {
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
    async handle(context, handler) {
        // Extend context with middleware-specific metadata
        const middlewareCtx = {
            ...context,
            metadata: {},
        };
        // Build execution chain
        let index = 0;
        const execute = async () => {
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
exports.MiddlewarePipeline = MiddlewarePipeline;
/**
 * Noop middleware: passes through without modification.
 *
 * Useful for testing or as a placeholder.
 *
 * @param ctx - Request context
 * @param next - Next middleware
 * @returns Result of next middleware
 */
async function noopMiddleware(_ctx, next) {
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
function createConditionalMiddleware(predicate, middleware) {
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
function composeMiddleware(...handlers) {
    return async (ctx, next) => {
        let index = 0;
        const execute = async () => {
            if (index < handlers.length) {
                return handlers[index++](ctx, execute);
            }
            return next();
        };
        return execute();
    };
}
//# sourceMappingURL=middleware.js.map