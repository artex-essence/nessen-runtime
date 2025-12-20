/**
 * response.ts
 * Response builders with safe header handling, ETags, and appropriate Content-Type.
 * Security headers for HTML responses. Minimal allocations.
 */
import type { RuntimeResponse } from './envelope.js';
/**
 * Build HTML response with security headers.
 */
export declare function htmlResponse(body: string, statusCode?: number, extraHeaders?: Record<string, string>, requestId?: string): RuntimeResponse;
/**
 * Build JSON response.
 */
export declare function jsonResponse(data: unknown, statusCode?: number, extraHeaders?: Record<string, string>, requestId?: string): RuntimeResponse;
/**
 * Build SVG response with ETag and caching headers.
 */
export declare function svgResponse(svg: string, extraHeaders?: Record<string, string>, requestId?: string): RuntimeResponse;
/**
 * Build text response.
 */
export declare function textResponse(body: string, statusCode?: number, extraHeaders?: Record<string, string>, requestId?: string): RuntimeResponse;
/**
 * Build error response (text or JSON based on accept header).
 */
export declare function errorResponse(message: string, statusCode?: number, expectsJson?: boolean, error?: Error, requestId?: string): RuntimeResponse;
/**
 * Build 503 Service Unavailable response (for draining/stopping).
 */
export declare function serviceUnavailableResponse(reason?: string, requestId?: string): RuntimeResponse;
/**
 * Build 404 Not Found response.
 */
export declare function notFoundResponse(path: string, expectsJson?: boolean, requestId?: string): RuntimeResponse;
//# sourceMappingURL=response.d.ts.map