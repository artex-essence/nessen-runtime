"use strict";
/**
 * envelope.ts
 *
 * Transport-neutral request and response envelope definitions.
 * Decouples HTTP specifics from core runtime logic by providing a protocol-agnostic
 * data model. Can be extended for gRPC, QUIC, or other transports without changing
 * routing, state management, or request handling logic.
 *
 * @module envelope
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRequestId = generateRequestId;
exports.isValidRequestId = isValidRequestId;
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
 * Validate request ID format.
 * Accepts: UUID format or hex format (with optional req- prefix)
 *
 * @param id - Request ID to validate
 * @returns true if valid format
 */
function isValidRequestId(id) {
    if (!id || typeof id !== 'string') {
        return false;
    }
    // UUID format: 8-4-4-4-12 hex digits
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(id)) {
        return true;
    }
    // Hex format: req-{hex}-{timestamp} or just hex string
    const hexPattern = /^(req-)?[0-9a-f]+(-\d+)?$/i;
    return hexPattern.test(id);
}
/**
 * Create request envelope from minimal input.
 * Does not include body; body is added separately after streaming/parsing.
 * Validates and regenerates request ID if invalid format.
 */
function createEnvelope(method, url, headers, remoteAddress, requestId) {
    // Validate request ID format, regenerate if invalid
    const validId = requestId && isValidRequestId(requestId) ? requestId : generateRequestId();
    return {
        id: validId,
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