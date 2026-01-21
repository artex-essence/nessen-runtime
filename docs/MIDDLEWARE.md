# Middleware Guide

Comprehensive guide to using and creating middleware in Nessen Runtime.

## Table of Contents

- [Overview](#overview)
- [Built-in Middleware](#built-in-middleware)
- [Creating Custom Middleware](#creating-custom-middleware)
- [Middleware Patterns](#middleware-patterns)
- [Integration Pipelines](#integration-pipelines)
- [Best Practices](#best-practices)

## Overview

Middleware provides a composable way to add cross-cutting concerns to your application. Each middleware function can inspect, modify, or terminate request processing.

### Execution Flow

```
Request
  ↓
Middleware 1 (pre)
  ↓
Middleware 2 (pre)
  ↓
Middleware 3 (pre)
  ↓
Handler
  ↓
Middleware 3 (post)
  ↓
Middleware 2 (post)
  ↓
Middleware 1 (post)
  ↓
Response
```

### Middleware Signature

```typescript
type MiddlewareHandler = (
  ctx: MiddlewareContext,
  next: () => Promise<RuntimeResponse>
) => Promise<RuntimeResponse>;
```

## Built-in Middleware

### Logging Middleware

Structured JSON logging with request timing. Integrates with pluggable logger system.

#### Usage

```typescript
import { createLoggingMiddleware } from './src/middleware/logging';
import { createDefaultLogger, StructuredLogger, ConsoleLogger } from './src/logger';

// Production: Environment-driven structured logger
const logger = createDefaultLogger();  // Respects LOG_FORMAT, LOG_LEVEL, NODE_ENV
runtime.use(createLoggingMiddleware({ logger }));

// Development: Console logger
const consoleLogger = new ConsoleLogger();
runtime.use(createLoggingMiddleware({ logger: consoleLogger }));

// Custom: Structured JSON logger with specific level
const structuredLogger = new StructuredLogger('info');
runtime.use(createLoggingMiddleware({ logger: structuredLogger }));
```

**Configuration Options:**
```typescript
interface LoggingMiddlewareConfig {
  logger: Logger;              // Required: Logger instance
  minLevel?: LogLevel;         // Optional: Minimum log level (default: info)
  includeBody?: boolean;       // Optional: Include request/response bodies (default: false)
}
```

**Note:** Logger parameter is now **required** for all middleware. All internal console.log calls have been replaced with structured logging.

#### Output Format (StructuredLogger)

```json
{
  "timestamp": "2026-01-21T10:30:45.123Z",
  "level": "info",
  "message": "GET /api/users 200 12ms",
  "requestId": "req-550e8400e29b-1642768245123",
  "method": "GET",
  "path": "/api/users",
  "status": 200,
  "duration": 12
}
```

#### Logger Interface

```typescript
interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
```

#### Environment Variables

- `LOG_FORMAT=json` - Use structured JSON output (StructuredLogger)
- `LOG_FORMAT=console` - Use console output (ConsoleLogger)
- `LOG_LEVEL=debug|info|warn|error` - Minimum log level
- `NODE_ENV=production` - Automatically enables JSON logging

### Rate Limiting Middleware

Token bucket algorithm with configurable key extraction (IP, user ID, API key, etc.).

#### Usage

```typescript
import { createRateLimitMiddleware } from './src/middleware/rateLimit';

runtime.use(createRateLimitMiddleware({
  maxRequests: 1000,      // 1000 requests
  windowMs: 60000         // per 60 seconds
}));
```

#### Configuration Options

```typescript
interface RateLimitConfig {
  maxRequests?: number;          // Max requests per window (default: 100)
  windowMs?: number;             // Time window in milliseconds (default: 60000)
  keyGenerator?: (headers: Record<string, string | string[] | undefined>, remoteAddress: string | undefined) => string;
  maxKeys?: number;              // Max keys to track in memory (default: 10000)
  cleanupIntervalMs?: number;    // Cleanup interval (default: 60000)
}
```

#### Custom Key Generator

Rate limit by user ID from header:

```typescript
createRateLimitMiddleware({
  maxRequests: 100,
  windowMs: 60000,
  keyGenerator: (headers, remoteAddress) => {
    // Priority: X-User-ID header > X-Forwarded-For > remoteAddress
    const userId = headers['x-user-id'];
    if (userId && typeof userId === 'string') return userId;
    
    const forwardedFor = headers['x-forwarded-for'];
    if (forwardedFor && typeof forwardedFor === 'string') {
      return forwardedFor.split(',')[0].trim();
    }
    
    return remoteAddress || 'unknown';
  }
})
```

#### Rate limit by API key:

```typescript
createRateLimitMiddleware({
  maxRequests: 10000,
  windowMs: 3600000,  // 1 hour
  keyGenerator: (headers, remoteAddress) => {
    const apiKey = headers['x-api-key'];
    return typeof apiKey === 'string' ? apiKey : remoteAddress || 'anonymous';
  }
})
```

#### Response Headers

When rate limited:
```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

#### Cleanup

Buckets automatically cleaned up after 2x window duration to prevent memory growth.

### Compression Middleware

Automatic response compression with content negotiation.

#### Usage

```typescript
import { createCompressionMiddleware } from './src/middleware/compression';

runtime.use(createCompressionMiddleware());
```

#### Supported Encodings

- **Brotli** (br) - Best compression ratio, preferred
- **Gzip** (gzip) - Universal support, good ratio
- **Identity** (no compression) - Fallback

#### Content-Type Filtering

Only compresses text-based content types:
- `text/*` (text/html, text/plain, text/css)
- `application/json`
- `application/javascript`
- `application/xml`

Binary formats (images, video) not compressed.

#### Size Threshold

Only compresses responses ≥1KB to avoid overhead on small responses.

#### Configuration

```typescript
createCompressionMiddleware({
  threshold: 2048,                     // Min size in bytes (default: 1024)
  level: 6,                            // Compression level 1-9 (default: 6)
  filter: (ctx) => ctx.path !== '/raw' // Custom filter
})
```

#### Headers Added

```
Content-Encoding: br
Vary: Accept-Encoding
```

#### Performance Impact

- **Brotli:** 70-80% size reduction, ~3ms overhead
- **Gzip:** 65-75% size reduction, ~2ms overhead
- **CPU:** Minimal impact at default level (6)

### Security Headers Middleware

OWASP best practices for HTTP security headers.

#### Usage

```typescript
import { createSecurityHeadersMiddleware } from './src/middleware/securityHeaders';

runtime.use(createSecurityHeadersMiddleware());
```

#### Default Headers

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'
```

#### Configuration

```typescript
createSecurityHeadersMiddleware({
  contentTypeOptions: true,           // Enable X-Content-Type-Options
  frameOptions: 'SAMEORIGIN',         // or 'DENY', false to disable
  xssProtection: true,                // Enable X-XSS-Protection
  hstsMaxAge: 31536000,              // HSTS max-age (false to disable)
  hstsIncludeSubDomains: true,       // Include subdomains in HSTS
  referrerPolicy: 'no-referrer',     // Referrer policy
  permissionsPolicy: 'camera=(), microphone=()',  // Permissions policy
  contentSecurityPolicy: "default-src 'self'",    // CSP directives
})
```

#### Disable Specific Headers

```typescript
createSecurityHeadersMiddleware({
  hstsMaxAge: false,                  // Disable HSTS (dev/HTTP)
  contentSecurityPolicy: false,       // Disable CSP
  frameOptions: false,                // Disable X-Frame-Options
})
```

#### Custom CSP

```typescript
createSecurityHeadersMiddleware({
  contentSecurityPolicy: [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' cdn.example.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' api.example.com",
  ].join('; ')
})
```

## Creating Custom Middleware

### Basic Template

```typescript
import type { MiddlewareHandler, MiddlewareContext } from './src/middleware';
import type { RuntimeResponse } from './src/envelope';

export function createCustomMiddleware(): MiddlewareHandler {
  return async (ctx: MiddlewareContext, next: () => Promise<RuntimeResponse>) => {
    // Pre-processing: runs before handler
    console.log(`Request: ${ctx.method} ${ctx.path}`);

    // Call next middleware/handler
    const response = await next();

    // Post-processing: runs after handler
    console.log(`Response: ${response.status}`);

    return response;
  };
}
```

### Middleware with Configuration

```typescript
interface CustomOptions {
  prefix?: string;
  enabled?: boolean;
}

export function createCustomMiddleware(options: CustomOptions = {}): MiddlewareHandler {
  const { prefix = '[custom]', enabled = true } = options;

  return async (ctx, next) => {
    if (!enabled) {
      return next();
    }

    console.log(`${prefix} Processing ${ctx.path}`);
    return next();
  };
}
```

## Middleware Patterns

### Authentication

```typescript
export function createAuthMiddleware(): MiddlewareHandler {
  return async (ctx, next) => {
    const token = ctx.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    try {
      const userId = await validateToken(token);
      ctx.metadata.userId = userId;
      return next();
    } catch (error) {
      return {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid token' })
      };
    }
  };
}
```

### CORS

```typescript
export function createCorsMiddleware(allowedOrigins: string[]): MiddlewareHandler {
  return async (ctx, next) => {
    const origin = ctx.headers.origin || '';

    if (ctx.method === 'OPTIONS') {
      return {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : '',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400'
        }
      };
    }

    const response = await next();

    if (allowedOrigins.includes(origin)) {
      response.headers = {
        ...response.headers,
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true'
      };
    }

    return response;
  };
}
```

### Request Validation

```typescript
export function createValidationMiddleware(): MiddlewareHandler {
  return async (ctx, next) => {
    // Validate Content-Type for POST/PUT
    if (['POST', 'PUT', 'PATCH'].includes(ctx.method)) {
      const contentType = ctx.headers['content-type'] || '';
      
      if (!contentType.includes('application/json')) {
        return {
          status: 415,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Content-Type must be application/json' })
        };
      }

      // Validate JSON body
      try {
        JSON.parse(ctx.body.toString());
      } catch (error) {
        return {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Invalid JSON' })
        };
      }
    }

    return next();
  };
}
```

### Caching

```typescript
export function createCacheMiddleware(ttl: number = 60000): MiddlewareHandler {
  const cache = new Map<string, { data: RuntimeResponse; expires: number }>();

  return async (ctx, next) => {
    // Only cache GET requests
    if (ctx.method !== 'GET') {
      return next();
    }

    const cacheKey = `${ctx.method}:${ctx.path}:${JSON.stringify(ctx.query)}`;
    const cached = cache.get(cacheKey);

    if (cached && Date.now() < cached.expires) {
      return {
        ...cached.data,
        headers: {
          ...cached.data.headers,
          'X-Cache': 'HIT'
        }
      };
    }

    const response = await next();

    // Cache successful responses
    if (response.status === 200) {
      cache.set(cacheKey, {
        data: response,
        expires: Date.now() + ttl
      });

      response.headers = {
        ...response.headers,
        'X-Cache': 'MISS'
      };
    }

    return response;
  };
}
```

### Request ID Propagation

```typescript
export function createRequestIdMiddleware(): MiddlewareHandler {
  return async (ctx, next) => {
    // Use existing request ID from headers or context
    const requestId = ctx.headers['x-request-id'] || ctx.id;

    const response = await next();

    // Add request ID to response headers
    response.headers = {
      ...response.headers,
      'X-Request-ID': requestId
    };

    return response;
  };
}
```

### Error Handling

```typescript
export function createErrorMiddleware(): MiddlewareHandler {
  return async (ctx, next) => {
    try {
      return await next();
    } catch (error) {
      console.error('Request error:', error);

      return {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Internal server error',
          requestId: ctx.id
        })
      };
    }
  };
}
```

### Timing

```typescript
export function createTimingMiddleware(): MiddlewareHandler {
  return async (ctx, next) => {
    const start = performance.now();

    const response = await next();

    const duration = performance.now() - start;

    response.headers = {
      ...response.headers,
      'X-Response-Time': `${duration.toFixed(2)}ms`,
      'Server-Timing': `total;dur=${duration.toFixed(2)}`
    };

    return response;
  };
}
```

## Integration Pipelines

Pre-configured middleware combinations for common scenarios.

### Production Pipeline

```typescript
import { productionPipeline } from './src/middleware/integration';

const runtime = new Runtime();
runtime.use(productionPipeline);
```

**Includes:**
- Logging (structured JSON)
- Rate limiting (1000 req/min)
- Compression (gzip/brotli)

### High Performance Pipeline

```typescript
import { highPerformancePipeline } from './src/middleware/integration';

runtime.use(highPerformancePipeline);
```

**Includes:**
- Minimal logging (errors only)
- Aggressive rate limiting (10000 req/min)
- Compression disabled (reduced CPU usage)

### Development Pipeline

```typescript
import { developmentPipeline } from './src/middleware/integration';

runtime.use(developmentPipeline);
```

**Includes:**
- Verbose logging (includes headers/body)
- No rate limiting
- No compression

### Custom Pipeline

```typescript
import { MiddlewarePipeline } from './src/middleware';
import { createLoggingMiddleware } from './src/middleware/logging';
import { createAuthMiddleware } from './middleware/auth';
import { createCorsMiddleware } from './middleware/cors';

const customPipeline = new MiddlewarePipeline()
  .use(createLoggingMiddleware())
  .use(createCorsMiddleware(['https://example.com']))
  .use(createAuthMiddleware())
  .use(createValidationMiddleware());

runtime.use(customPipeline.handle.bind(customPipeline));
```

## Best Practices

### Order Matters

Middleware execute in order of registration:

```typescript
// Good: Error handling first, logging last
runtime.use(createErrorMiddleware());
runtime.use(createAuthMiddleware());
runtime.use(createValidationMiddleware());
runtime.use(createLoggingMiddleware());

// Bad: Logging won't catch auth errors
runtime.use(createLoggingMiddleware());
runtime.use(createAuthMiddleware());
```

### Recommended Order

1. Error handling
2. Request ID
3. CORS (if needed)
4. Authentication
5. Rate limiting
6. Validation
7. Compression
8. Logging (last to capture everything)

### Avoid Blocking Operations

```typescript
// Bad: Blocks event loop
export function createSlowMiddleware(): MiddlewareHandler {
  return async (ctx, next) => {
    const data = fs.readFileSync('/large/file');  // Blocks!
    return next();
  };
}

// Good: Async I/O
export function createAsyncMiddleware(): MiddlewareHandler {
  return async (ctx, next) => {
    const data = await fs.promises.readFile('/large/file');
    return next();
  };
}
```

### Memory Management

Clean up resources to prevent leaks:

```typescript
export function createCacheMiddleware(): MiddlewareHandler {
  const cache = new Map();
  
  // Clean up old entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
      if (now > value.expires) {
        cache.delete(key);
      }
    }
  }, 60000);

  return async (ctx, next) => {
    // Use cache...
  };
}
```

### Conditional Middleware

Apply middleware only to certain routes:

```typescript
export function createAuthMiddleware(publicPaths: string[] = []): MiddlewareHandler {
  return async (ctx, next) => {
    // Skip auth for public paths
    if (publicPaths.includes(ctx.path)) {
      return next();
    }

    // Perform authentication
    const token = ctx.headers.authorization;
    if (!token) {
      return { status: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    return next();
  };
}

// Usage
runtime.use(createAuthMiddleware(['/health', '/ready', '/public']));
```

### Type Safety

Leverage TypeScript for middleware state:

```typescript
interface AuthContext extends MiddlewareContext {
  metadata: {
    userId: string;
    roles: string[];
  };
}

export function createAuthMiddleware(): MiddlewareHandler {
  return async (ctx, next) => {
    const userId = await validateToken(ctx.headers.authorization);
    const roles = await fetchUserRoles(userId);

    // Type-safe metadata
    ctx.metadata.userId = userId;
    ctx.metadata.roles = roles;

    return next();
  };
}

// In handler, access with type safety
runtime.route.get('/profile', async (ctx) => {
  const userId = ctx.metadata.userId as string;
  return { status: 200, body: JSON.stringify({ userId }) };
});
```

### Testing

Test middleware in isolation:

```typescript
import { describe, it, expect } from 'vitest';
import { createAuthMiddleware } from './auth';

describe('AuthMiddleware', () => {
  it('rejects requests without token', async () => {
    const middleware = createAuthMiddleware();
    const ctx = {
      headers: {},
      metadata: {}
    } as MiddlewareContext;

    const response = await middleware(ctx, async () => ({
      status: 200,
      body: 'OK'
    }));

    expect(response.status).toBe(401);
  });

  it('allows requests with valid token', async () => {
    const middleware = createAuthMiddleware();
    const ctx = {
      headers: { authorization: 'Bearer valid-token' },
      metadata: {}
    } as MiddlewareContext;

    const response = await middleware(ctx, async () => ({
      status: 200,
      body: 'OK'
    }));

    expect(response.status).toBe(200);
    expect(ctx.metadata.userId).toBeDefined();
  });
});
```

### Performance Monitoring

Track middleware performance:

```typescript
export function createTimingMiddleware(): MiddlewareHandler {
  const timings = new Map<string, number[]>();

  return async (ctx, next) => {
    const start = performance.now();
    const response = await next();
    const duration = performance.now() - start;

    // Track per-path timings
    const path = ctx.path;
    if (!timings.has(path)) {
      timings.set(path, []);
    }
    timings.get(path)!.push(duration);

    // Log slow requests
    if (duration > 100) {
      console.warn(`Slow request: ${ctx.method} ${path} took ${duration.toFixed(2)}ms`);
    }

    return response;
  };
}
```

### Documentation

Document middleware behavior:

```typescript
/**
 * Authentication middleware using JWT tokens.
 *
 * Validates Bearer tokens in Authorization header and attaches
 * user ID to context metadata.
 *
 * @param options - Configuration options
 * @param options.publicPaths - Paths that don't require auth
 * @param options.secretKey - JWT secret key
 * @returns Middleware handler
 *
 * @example
 * ```typescript
 * runtime.use(createAuthMiddleware({
 *   publicPaths: ['/health', '/login'],
 *   secretKey: process.env.JWT_SECRET
 * }));
 * ```
 */
export function createAuthMiddleware(options: AuthOptions): MiddlewareHandler {
  // Implementation...
}
```
