/**
 * context.ts
 * Immutable request context combining envelope + classification + timing.
 * Passed to handlers as a complete, read-only view of the request.
 */
import type { RequestEnvelope } from './envelope.js';
import type { RequestClassification } from './classify.js';
/**
 * Immutable request context for handlers.
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
 * Build request context from envelope, classification, and optional params.
 */
export declare function createContext(envelope: RequestEnvelope, classification: RequestClassification, params?: Record<string, string>): RequestContext;
//# sourceMappingURL=context.d.ts.map