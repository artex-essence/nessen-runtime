"use strict";
/**
 * context.ts
 * Immutable request context combining envelope + classification + timing.
 * Passed to handlers as a complete, read-only view of the request.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContext = createContext;
/**
 * Build request context from envelope, classification, and optional params.
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