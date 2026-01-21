"use strict";
/**
 * router.ts
 *
 * High-performance URL router with O(1) exact matching and O(n) parameter routing.
 * Static routes only (no dynamic patterns). Routes are registered during runtime
 * initialization and used for the lifetime of the process.
 *
 * Routing precedence:
 * 1. Exact path match (O(1) hash lookup)
 * 2. Parameter patterns like /badge/:label/:value.svg (O(n) regex, n = pattern count)
 * 3. 404 not found
 *
 * @module router
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Router = void 0;
/**
 * Fast router supporting exact and parameter-based routes.
 *
 * Uses two mechanisms:
 * - Exact routes stored in Map for O(1) lookup (GET /health)
 * - Parameter routes in array with regex matching (GET /badge/:label/:value.svg)
 *
 * Thread-safe if registration is complete before routing begins.
 * Routing is deterministic: exact matches win over parameter patterns.
 */
class Router {
    exactRoutes = new Map();
    paramRoutes = [];
    /**
     * Registers a new route during initialization.
     *
     * Must be called before routing requests. Parameter routes (with :param)
     * are compiled to regex at registration time to avoid runtime compilation overhead.
     *
     * @param method - HTTP method (GET, POST, etc.), normalized to uppercase
     * @param pattern - URL pattern (e.g., "/" or "/badge/:label/:value.svg")
     * @param handler - Name of handler function to call (dispatched in runtime)
     *
     * @example
     * router.register('GET', '/', 'home');
     * router.register('GET', '/badge/:label/:value.svg', 'badge');
     */
    register(method, pattern, handler) {
        const normalized = method.toUpperCase();
        const isParam = pattern.includes(':');
        if (isParam) {
            // Parameter route: compile pattern to regex for matching
            const regex = patternToRegex(pattern);
            this.paramRoutes.push({
                method: normalized,
                pattern,
                handler,
                isParam: true,
                regex,
            });
        }
        else {
            // Exact route: store in hash map for O(1) lookup
            const key = `${normalized}:${pattern}`;
            this.exactRoutes.set(key, {
                method: normalized,
                pattern,
                handler,
                isParam: false,
            });
        }
    }
    /**
     * Matches a request to a registered route.
     *
     * First tries exact path match (O(1)), then parameter patterns (O(n)).
     * Returns handler name and extracted parameters, or null if no route matches.
     *
     * @param method - HTTP method (GET, POST, etc.)
     * @param path - Request path to match
     * @returns RouteMatch with handler name and params, or null if not found
     *
     * @example
     * const match = router.match('GET', '/badge/status/ok.svg');
     * // { handler: 'badge', params: { label: 'status', value: 'ok' } }
     */
    match(method, path) {
        const normalized = method.toUpperCase();
        // Try exact match first (O(1) hash lookup)
        const exactKey = `${normalized}:${path}`;
        const exact = this.exactRoutes.get(exactKey);
        if (exact) {
            return { handler: exact.handler, params: {} };
        }
        // Try parameter routes (O(n) but n is small, typically 3-5 routes)
        for (const route of this.paramRoutes) {
            if (route.method !== normalized)
                continue;
            if (!route.regex)
                continue;
            const match = route.regex.exec(path);
            if (match && match.groups) {
                // Regex named groups become route parameters
                return { handler: route.handler, params: match.groups };
            }
        }
        // No route matched
        return null;
    }
}
exports.Router = Router;
/**
 * Converts a route pattern to a compiled regex for matching.
 *
 * Converts pattern syntax like "/badge/:label/:value.svg" to a regex that:
 * - Captures named groups for each :param
 * - Handles literal path segments and file extensions
 * - Matches exactly (anchored with ^ and $)
 *
 * @param pattern - Route pattern with :param placeholders
 * @returns Compiled RegExp with named capture groups
 *
 * @example
 * patternToRegex('/badge/:label/:value.svg')
 * // Matches: /badge/status/ok.svg
 * // Returns: { label: 'status', value: 'ok' }
 */
function patternToRegex(pattern) {
    // Escape special regex chars (except : which we handle next)
    let regexStr = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    // Replace :paramName with named capture groups
    // Each parameter captures one path segment (no slashes)
    regexStr = regexStr.replace(/:(\w+)/g, (_, name) => `(?<${name}>[^/]+)`);
    // Anchor to match entire path exactly (not just a prefix)
    regexStr = `^${regexStr}$`;
    return new RegExp(regexStr);
}
//# sourceMappingURL=router.js.map