/**
 * handlers.ts
 *
 * Request handlers for demo endpoints: home page, health API, and badge generation.
 * Demonstrates response builders, context usage, and security best practices.
 *
 * @module handlers
 */
import type { RequestContext } from './context.js';
import type { RuntimeResponse } from './envelope.js';
/**
 * Handle GET / - Home page with request info.
 */
export declare function handleHome(ctx: RequestContext, runtimeState: string): RuntimeResponse;
/**
 * Handle GET /badge/:label/:value.svg - Generate SVG badge.
 */
export declare function handleBadge(ctx: RequestContext): RuntimeResponse;
//# sourceMappingURL=handlers.d.ts.map