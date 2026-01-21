"use strict";
/**
 * examples/custom-middleware.ts
 *
 * Example of middleware patterns and concepts.
 *
 * Note: This demonstrates middleware architecture.
 * To add custom middleware, extend MiddlewarePipeline in src/middleware.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
const runtime_js_1 = require("../src/runtime.js");
const config_js_1 = require("../src/config.js");
/**
 * Example: Authentication middleware
 */
const authMiddleware = async (ctx, next) => {
    const apiKey = ctx.headers['x-api-key'] || ctx.headers['X-Api-Key'];
    if (!apiKey) {
        return {
            statusCode: 401,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Missing API key' }),
        };
    }
    if (apiKey !== 'secret-key-123') {
        return {
            statusCode: 403,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Invalid API key' }),
        };
    }
    // Valid API key, continue
    return next();
};
/**
 * Example: Request ID middleware
 */
const requestIdMiddleware = async (ctx, next) => {
    // Verify request ID exists
    if (!ctx.id) {
        console.log('[middleware] Warning: Request missing ID');
    }
    return next();
};
/**
 * Example: IP filtering middleware
 */
const ipFilterMiddleware = (allowedIps) => {
    return async (ctx, next) => {
        if (ctx.remoteAddress && !allowedIps.includes(ctx.remoteAddress)) {
            return {
                statusCode: 403,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'IP not allowed' }),
            };
        }
        return next();
    };
};
/**
 * Example: Middleware chain composition
 */
async function main() {
    const runtime = new runtime_js_1.Runtime((0, config_js_1.createConfig)());
    runtime.extendPipeline(authMiddleware);
    runtime.extendPipeline(requestIdMiddleware);
    runtime.extendPipeline(ipFilterMiddleware(['127.0.0.1', '::1']));
    console.log('[example] Custom middleware registered on runtime pipeline');
    console.log('[example] Order: auth → requestId → ipFilter → built-ins');
}
main().catch((err) => {
    console.error('[example] Failed to configure middleware', err);
});
//# sourceMappingURL=custom-middleware.js.map