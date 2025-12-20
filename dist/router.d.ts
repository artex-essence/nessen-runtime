/**
 * router.ts
 * Fast O(1) routing with exact match and parameter routes.
 * Static routes only in v0.1. Deterministic precedence: exact > param > 404.
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
 * Router with O(1) exact match and parameter route support.
 */
export declare class Router {
    private exactRoutes;
    private paramRoutes;
    /**
     * Register a route. Call during initialization only.
     */
    register(method: string, pattern: string, handler: string): void;
    /**
     * Match request to route. Returns handler name + params, or null if no match.
     */
    match(method: string, path: string): RouteMatch | null;
}
//# sourceMappingURL=router.d.ts.map