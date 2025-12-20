/**
 * envelope.ts
 * Transport-neutral request envelope. Decouples HTTP from core runtime logic.
 * Contains all necessary request data in a safe, immutable shape.
 */

import type { IncomingHttpHeaders } from 'http';
import { randomBytes } from 'crypto';

/**
 * Transport-neutral request envelope.
 * Created from HTTP but can be used by any transport layer.
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
 * Transport-neutral response shape.
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
