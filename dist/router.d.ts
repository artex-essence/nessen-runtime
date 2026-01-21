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
export interface Route {
    readonly method: string;
    readonly pattern: string;
    readonly handler: string;
    readonly isParam: boolean;
    readonly regex?: RegExp;
}
export interface RouteMatch {
    readonly handler: string;
    readonly params: Record<string, string>;
}
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
export declare class Router {
    private exactRoutes;
    private paramRoutes;
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
    register(method: string, pattern: string, handler: string): void;
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
    match(method: string, path: string): RouteMatch | null;
}
//# sourceMappingURL=router.d.ts.map