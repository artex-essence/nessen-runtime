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
import { isPathSafe, isValidHost } from './utils.js';

export type RequestIntent = 'page' | 'api' | 'asset' | 'health' | 'unknown';
export type ResponseExpectation = 'html' | 'json' | 'svg' | 'text' | 'stream';

export interface RequestClassification {
  readonly intent: RequestIntent;
  readonly expects: ResponseExpectation;
  readonly basePath: string;
  readonly pathInfo: string;
  readonly isAjax: boolean;
}

const BASE_PATH = process.env.BASE_PATH || '/';
const VALID_HOSTS = (process.env.VALID_HOSTS || 'localhost').split(',').map(h => h.trim());
const normalizedBasePath = BASE_PATH.endsWith('/') ? BASE_PATH.slice(0, -1) : BASE_PATH;

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
export function classifyRequest(envelope: RequestEnvelope): RequestClassification {
  // Validate Host header against whitelist
  const host = envelope.headers['host'] as string | undefined;
  if (host && !isValidHost(host, VALID_HOSTS)) {
    return {
      intent: 'unknown',
      expects: 'text',
      basePath: normalizedBasePath,
      pathInfo: '/',
      isAjax: false,
    };
  }

  // Optimize: Extract pathname without creating URL object
  // Fast path: find first ? or # without full URL parsing
  const pathname = extractPathname(envelope.url);

  // Validate path safety
  if (!isPathSafe(pathname)) {
    return {
      intent: 'unknown',
      expects: 'text',
      basePath: normalizedBasePath,
      pathInfo: pathname,
      isAjax: false,
    };
  }

  // Check base path
  if (!pathname.startsWith(normalizedBasePath)) {
    return {
      intent: 'unknown',
      expects: 'text',
      basePath: normalizedBasePath,
      pathInfo: pathname,
      isAjax: false,
    };
  }

  // Strip base path to get pathInfo
  const pathInfo = pathname === normalizedBasePath
    ? '/'
    : pathname.slice(normalizedBasePath.length) || '/';

  const isAjax = isAjaxRequest(envelope);

  // Classify intent and expectations
  let intent: RequestIntent = 'unknown';
  let expects: ResponseExpectation = 'text';

  if (pathInfo === '/health' || pathInfo === '/ready') {
    intent = 'health';
    expects = 'text';
  } else if (pathInfo.startsWith('/api/')) {
    intent = 'api';
    expects = 'json';
  } else if (pathInfo.endsWith('.svg')) {
    intent = 'asset';
    expects = 'svg';
  } else if (pathInfo === '/') {
    intent = 'page';
    expects = 'html';
  } else {
    // Default
    intent = 'page';
    expects = isAjax ? 'json' : 'html';
  }

  return {
    intent,
    expects,
    basePath: normalizedBasePath,
    pathInfo,
    isAjax,
  };
}

/**
 * Extracts pathname from URL without creating URL object.
 *
 * Fast path for pathname extraction: finds the first ? or # and returns
 * everything before it. Avoids expensive URL parsing for the common case
 * where we only care about the path, not query parameters.
 *
 * @param url - Full URL with optional query string or fragment
 * @returns Pathname (path without query or fragment)
 *
 * @example
 * extractPathname('/foo?bar=1')  // '/foo'
 * extractPathname('/foo#hash')   // '/foo'
 * extractPathname('/foo')        // '/foo'
 */
function extractPathname(url: string): string {
  const queryIndex = url.indexOf('?');
  const hashIndex = url.indexOf('#');

  // Find first occurrence of ? or #
  let endIndex = url.length;
  if (queryIndex >= 0) endIndex = Math.min(endIndex, queryIndex);
  if (hashIndex >= 0) endIndex = Math.min(endIndex, hashIndex);

  return url.slice(0, endIndex) || '/';
}

/**
 * Detects AJAX and API client requests via HTTP headers.
 *
 * Modern clients use explicit Content-Type and Accept headers to signal
 * that they expect JSON responses. This helps us serve appropriate format
 * without requiring file extensions in the URL.
 *
 * Checks for:
 * - X-Requested-With: XMLHttpRequest (jQuery, older frameworks)
 * - Accept: *application/json* (modern APIs, fetch, axios)
 *
 * @param envelope - Request envelope with HTTP headers
 * @returns true if request appears to come from API/AJAX client
 */
function isAjaxRequest(envelope: RequestEnvelope): boolean {
  const accept = envelope.headers['accept'];
  const xRequestedWith = envelope.headers['x-requested-with'];

  if (xRequestedWith === 'XMLHttpRequest') return true;
  if (typeof accept === 'string' && accept.includes('application/json')) return true;

  return false;
}
