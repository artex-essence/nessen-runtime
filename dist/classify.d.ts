/**
 * classify.ts
 *
 * Request classification system that determines routing intent and response format.
 * Analyzes URL, method, and headers to classify requests and produce transport-neutral
 * metadata. Validates host headers to prevent cache poisoning attacks.
 *
 * @module classify
 */
import type { RequestEnvelope } from './envelope.js';
export type RequestIntent = 'page' | 'api' | 'asset' | 'health' | 'unknown';
export type ResponseExpectation = 'html' | 'json' | 'svg' | 'text' | 'stream';
export interface RequestClassification {
    readonly intent: RequestIntent;
    readonly expects: ResponseExpectation;
    readonly basePath: string;
    readonly pathInfo: string;
    readonly isAjax: boolean;
}
/**
 * Classifies a request to determine intent, expected response format, and routing.
 *
 * Performs the following checks:
 * 1. Validates Host header against whitelist (prevents cache poisoning)
 * 2. Validates path for traversal attempts
 * 3. Analyzes URL and headers to determine intent
 * 4. Determines expected response format based on path and Accept headers
 *
 * Optimized to avoid URL object allocation (fast path for query strings).
 *
 * @param envelope - Request envelope with HTTP metadata
 * @returns Classification metadata for routing and response formatting
 *
 * @example
 * const classified = classifyRequest(envelope);
 * // { intent: 'api', expects: 'json', pathInfo: '/users', ... }
 */
export declare function classifyRequest(envelope: RequestEnvelope): RequestClassification;
//# sourceMappingURL=classify.d.ts.map