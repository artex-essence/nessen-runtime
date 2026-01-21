"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContext = createContext;
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
function createContext(envelope, classification, params = {}) {
    return {
        id: envelope.id,
        method: envelope.method,
        url: envelope.url,
        pathInfo: classification.pathInfo,
        basePath: classification.basePath,
        intent: classification.intent,
        expects: classification.expects,
        isAjax: classification.isAjax,
        headers: envelope.headers,
        remoteAddress: envelope.remoteAddress,
        startTime: envelope.startTime,
        body: envelope.body,
        params: Object.freeze({ ...params }),
    };
}
//# sourceMappingURL=context.js.map