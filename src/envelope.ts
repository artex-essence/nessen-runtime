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

import type { IncomingHttpHeaders } from 'http';
import { randomBytes } from 'crypto';

/**
 * Transport-neutral request envelope containing all request data.
 *
 * Created by the HTTP ingress layer but used throughout the runtime.
 * Immutable to prevent accidental mutations during request processing.
 *
 * Properties:
 * - id: Cryptographically secure request identifier for tracing
 * - method: HTTP method (GET, POST, etc.)
 * - url: Full request URL including query string
 * - headers: HTTP headers (lowercase keys per Node.js convention)
 * - remoteAddress: Client IP address
 * - startTime: Milliseconds since epoch when request started
 * - body: Optional request body (Buffer, only for POST/PUT/PATCH)
 */
export interface RequestEnvelope {
  readonly id: string;
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<IncomingHttpHeaders>;
  readonly remoteAddress: string | undefined;
  readonly startTime: number;
  readonly body?: Buffer;
}

/**
 * Transport-neutral response shape for all responses.
 *
 * Used by all handlers to return responses. HTTP layer converts this
 * to actual HTTP response. Can be extended for other transports.
 *
 * Properties:
 * - statusCode: HTTP status code (200, 404, 500, etc.)
 * - headers: Response headers (will be sent as-is)
 * - body: Response body (string or Buffer)
 */
export interface RuntimeResponse {
  readonly statusCode: number;
  readonly headers: Record<string, string | string[]>;
  readonly body: string | Buffer;
}

/**
 * Generate cryptographically secure request ID.
 * Format: req-{16-char-hex}-{timestamp}
 */
export function generateRequestId(): string {
  const random = randomBytes(8).toString('hex');
  return `req-${random}-${Date.now()}`;
}

/**
 * Create request envelope from minimal input.
 * Does not include body; body is added separately after streaming/parsing.
 */
export function createEnvelope(
  method: string,
  url: string,
  headers: IncomingHttpHeaders,
  remoteAddress: string | undefined
): RequestEnvelope {
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
export function withBody(envelope: RequestEnvelope, body: Buffer): RequestEnvelope {
  return { ...envelope, body };
}
