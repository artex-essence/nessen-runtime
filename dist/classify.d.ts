/**
 * classify.ts
 * Request classification: intent, expected response type, base path handling, path info.
 * HTTP-driven but produces transport-neutral metadata.
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
 * Classify request based on URL, method, and headers.
 */
export declare function classifyRequest(envelope: RequestEnvelope): RequestClassification;
/**
 * Validate path for security issues.
 * Rejects null bytes, path traversal attempts, etc.
 */
export declare function isPathSafe(path: string): boolean;
//# sourceMappingURL=classify.d.ts.map