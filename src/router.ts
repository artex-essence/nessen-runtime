/**
 * router.ts
 * Fast O(1) routing with exact match and parameter routes.
 * Static routes only in v0.1. Deterministic precedence: exact > param > 404.
 */

export interface Route {
  readonly method: string;
  readonly pattern: string;
  readonly handler: string; // handler function name
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
export class Router {
  private exactRoutes: Map<string, Route> = new Map();
  private paramRoutes: Route[] = [];

  /**
   * Register a route. Call during initialization only.
   */
  register(method: string, pattern: string, handler: string): void {
    const normalized = method.toUpperCase();
    const isParam = pattern.includes(':');

    if (isParam) {
      // Parameter route: convert to regex
      const regex = patternToRegex(pattern);
      this.paramRoutes.push({
        method: normalized,
        pattern,
        handler,
        isParam: true,
        regex,
      });
    } else {
      // Exact route
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
   * Match request to route. Returns handler name + params, or null if no match.
   */
  match(method: string, path: string): RouteMatch | null {
    const normalized = method.toUpperCase();

    // Try exact match first (O(1))
    const exactKey = `${normalized}:${path}`;
    const exact = this.exactRoutes.get(exactKey);
    if (exact) {
      return { handler: exact.handler, params: {} };
    }

    // Try parameter routes (O(n) but n is small)
    for (const route of this.paramRoutes) {
      if (route.method !== normalized) continue;
      if (!route.regex) continue;

      const match = route.regex.exec(path);
      if (match && match.groups) {
        return { handler: route.handler, params: match.groups };
      }
    }

    return null;
  }
}

/**
 * Convert route pattern like "/badge/:label/:value.svg" to regex.
 * Captures named groups for parameters.
 */
function patternToRegex(pattern: string): RegExp {
  // Escape special regex chars except ':'
  let regexStr = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');

  // Replace :param with named capture group
  regexStr = regexStr.replace(/:(\w+)/g, (_, name) => `(?<${name}>[^/]+)`);

  // Anchor to start and end
  regexStr = `^${regexStr}$`;

  return new RegExp(regexStr);
}
