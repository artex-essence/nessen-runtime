/**
 * context.ts
 *
 * Immutable request context combining envelope data with classification metadata.
 * Provides handlers with a complete, read-only view of the request without exposing
 * internal routing or protocol details.
 *
 * All properties are readonly to prevent accidental mutation during request processing.
 *
 * @module context
 */
import type { RequestEnvelope } from './envelope.js';
import type { RequestClassification } from './classify.js';
/**
 * Immutable request context for handlers.
 *
 * Combines RequestEnvelope (HTTP data) with RequestClassification (intent/format)
 * plus path parameters. This is the primary interface handlers use to access
 * request data. All properties are readonly to enforce immutability.
 *
 * Properties:
 * - id: Unique request ID for tracing/logging
 * - method: HTTP method (GET, POST, etc.)
 * - pathInfo: Request path after base path stripped
 * - intent: Classified intent (page, api, asset, health, unknown)
 * - expects: Expected response format (html, json, svg, text, stream)
 * - params: Extracted path parameters (from /badge/:label/:value.svg)
 */
export interface RequestContext {
    readonly id: string;
    readonly method: string;
    readonly url: string;
    readonly pathInfo: string;
    readonly basePath: string;
    readonly intent: RequestClassification['intent'];
    readonly expects: RequestClassification['expects'];
    readonly isAjax: boolean;
    readonly headers: RequestEnvelope['headers'];
    readonly remoteAddress: string | undefined;
    readonly startTime: number;
    readonly body?: Buffer;
    readonly params: Record<string, string>;
}
/**
 * Creates an immutable request context from envelope and classification.
 *
 * Combines the transport-neutral envelope with classification metadata
 * to produce the complete request context passed to handlers.
 * Path parameters are frozen to prevent mutations.
 *
 * @param envelope - Request envelope with HTTP data
 * @param classification - Request classification with intent and format
 * @param params - Optional extracted path parameters
 * @returns Immutable request context
 */
export declare function createContext(envelope: RequestEnvelope, classification: RequestClassification, params?: Record<string, string>): RequestContext;
//# sourceMappingURL=context.d.ts.map