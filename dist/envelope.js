"use strict";
/**
 * envelope.ts
 * Transport-neutral request envelope. Decouples HTTP from core runtime logic.
 * Contains all necessary request data in a safe, immutable shape.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRequestId = generateRequestId;
exports.createEnvelope = createEnvelope;
exports.withBody = withBody;
const crypto_1 = require("crypto");
/**
 * Generate cryptographically secure request ID.
 * Format: req-{16-char-hex}-{timestamp}
 */
function generateRequestId() {
    const random = (0, crypto_1.randomBytes)(8).toString('hex');
    return `req-${random}-${Date.now()}`;
}
/**
 * Create request envelope from minimal input.
 * Does not include body; body is added separately after streaming/parsing.
 */
function createEnvelope(method, url, headers, remoteAddress) {
    return {
        id: generateRequestId(),
        method: method.toUpperCase(),
        url,
        headers: Object.freeze({ ...headers }),
        remoteAddress,
        startTime: Date.now(),
    };
}
/**
 * Add body to envelope (returns new envelope).
 */
function withBody(envelope, body) {
    return { ...envelope, body };
}
//# sourceMappingURL=envelope.js.map