# API Documentation

Complete API reference for Nessen Runtime.

## Table of Contents

- [Runtime Class](#runtime-class)
- [Router API](#router-api)
- [Middleware System](#middleware-system)
- [Request Context](#request-context)
- [Response Format](#response-format)
- [State Management](#state-management)
- [Telemetry](#telemetry)

## Runtime Class

The core runtime engine that handles request processing.

### Constructor

```typescript
import { createDefaultLogger } from './logger.js';
import { createConfig } from './config.js';

const logger = createDefaultLogger();
const config = createConfig();
const runtime = new Runtime(config, logger);
```

Creates a new runtime instance. Initializes:
- State machine (immediately transitions to READY, no timer delay)
- Telemetry collection with pluggable export sinks
- Router with O(1) exact matching and efficient parameter patterns
- Built-in routes (/health, /ready, /api/health) with async readiness hooks
- Middleware pipeline (logging, rate limiting, compression, security headers)

**Parameters:**
- `config` - RuntimeConfig instance (optional, defaults to createConfig())
  - Includes validation for all limits (body size, URL length, headers, timeouts, rate limits)
  - Environment variable support with NaN validation
  - See `docs/config.md` for complete reference
- `logger` - Logger instance (required for structured logging)
  - Use `createDefaultLogger()` for production (respects LOG_FORMAT, LOG_LEVEL, NODE_ENV)
  - Use `ConsoleLogger` for development
  - Use `StructuredLogger` for custom JSON output

**Logging Options:**
- **Production:** Use `createDefaultLogger()` which respects LOG_FORMAT, LOG_LEVEL, NODE_ENV
- **Development:** Pass `new ConsoleLogger()` or `console` for simple output
- **Structured:** Use `new StructuredLogger('info')` for JSON output (stderr for errors, stdout for info)
- **Custom:** Implement Logger interface for custom logging backends

**Security:** All inputs validated, bounded collections, event listeners properly cleaned up

### Methods

#### `listen(port: number): Promise<void>`

Starts the HTTP server on the specified port.

```typescript
await runtime.listen(3000);
```

**Parameters:**
- `port` - Port number to bind to (1-65535)

**Returns:** Promise that resolves when server is listening

**Throws:** Error if port is invalid or already in use

#### `use(middleware: MiddlewareHandler): void`

Adds middleware to the request processing pipeline.

```typescript
runtime.use(loggingMiddleware);
runtime.use(rateLimitMiddleware);
```

**Parameters:**
- `middleware` - Middleware function following MiddlewareHandler signature

**Order:** Middleware execute in the order they are added

#### `route.get(path: string, handler: RequestHandler): void`

Registers a GET route.

```typescript
runtime.route.get('/users/:id', async (ctx) => ({
  status: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ id: ctx.params.id })
}));
```

**Parameters:**
- `path` - URL path with optional parameters (`:param`)
- `handler` - Async function that returns RuntimeResponse

#### `route.post(path: string, handler: RequestHandler): void`

Registers a POST route.

```typescript
runtime.route.post('/api/data', async (ctx) => {
  const data = JSON.parse(ctx.body);
  // Process data
  return { status: 201, body: JSON.stringify(result) };
});
```

**Parameters:**
- `path` - URL path with optional parameters
- `handler` - Async function that returns RuntimeResponse

#### `route.put(path: string, handler: RequestHandler): void`

Registers a PUT route.

```typescript
runtime.route.put('/api/users/:id', async (ctx) => ({
  status: 200,
  body: JSON.stringify({ updated: true })
}));
```

#### `route.delete(path: string, handler: RequestHandler): void`

Registers a DELETE route.

```typescript
runtime.route.delete('/api/users/:id', async (ctx) => ({
  status: 204
}));
```

#### `route.patch(path: string, handler: RequestHandler): void`

Registers a PATCH route.

```typescript
runtime.route.patch('/api/users/:id', async (ctx) => ({
  status: 200,
  body: JSON.stringify({ patched: true })
}));
```

## Router API

O(1) routing with exact match and parameter support.

### Route Parameters

Extract path parameters using `:param` syntax:

```typescript
// Route definition
runtime.route.get('/users/:userId/posts/:postId', async (ctx) => {
  const { userId, postId } = ctx.params;
  return {
    status: 200,
    body: JSON.stringify({ userId, postId })
  };
});

// GET /users/123/posts/456
// ctx.params = { userId: '123', postId: '456' }
```

### Query Parameters

Access query strings via `ctx.query`:

```typescript
// GET /search?q=test&limit=10
runtime.route.get('/search', async (ctx) => {
  const { q, limit } = ctx.query;
  return {
    status: 200,
    body: JSON.stringify({ query: q, limit: parseInt(limit || '10') })
  };
});
```

### Routing Order

1. Exact match routes checked first
2. Parameterized routes checked if no exact match
3. 404 returned if no match found

## Middleware System

Composable request processing pipeline.

### MiddlewareHandler Signature

```typescript
type MiddlewareHandler = (
  ctx: MiddlewareContext,
  next: () => Promise<RuntimeResponse>
) => Promise<RuntimeResponse>;
```

### Creating Custom Middleware

```typescript
function customMiddleware(): MiddlewareHandler {
  return async (ctx, next) => {
    // Pre-processing
    console.log(`Request: ${ctx.method} ${ctx.path}`);
    ctx.metadata.startTime = Date.now();

    // Call next middleware/handler
    const response = await next();

    // Post-processing
    const duration = Date.now() - (ctx.metadata.startTime as number);
    console.log(`Response: ${response.status} (${duration}ms)`);

    return response;
  };
}

runtime.use(customMiddleware());
```

### Middleware Context

Extended context with metadata bag:

```typescript
interface MiddlewareContext extends RequestContext {
  metadata: Record<string, unknown>;
}
```

**Common metadata keys:**
- `startTime` - Request start timestamp (logging middleware)
- `userId` - Authenticated user ID (auth middleware)
- `rateLimitRemaining` - Rate limit tokens remaining
- `compressed` - Whether response was compressed

### Short-Circuit Middleware

Return early without calling `next()`:

```typescript
function authMiddleware(): MiddlewareHandler {
  return async (ctx, next) => {
    const token = ctx.headers.authorization;
    
    if (!token) {
      return {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    // Validate token and continue
    ctx.metadata.userId = validateToken(token);
    return next();
  };
}
```

## Request Context

Immutable request context passed to handlers.

### RequestContext Interface

```typescript
interface RequestContext {
  id: string;                          // Unique request ID (crypto-secure)
  method: string;                      // HTTP method (GET, POST, etc.)
  path: string;                        // URL path (/api/users)
  url: string;                         // Full URL (http://localhost:3000/api/users?q=test)
  headers: Record<string, string>;     // Request headers (lowercase keys)
  query: Record<string, string>;       // Query parameters
  params: Record<string, string>;      // Route parameters
  body: string | Buffer;               // Request body
}
```

### Field Details

#### `id: string`

Unique request identifier generated using `crypto.randomUUID()`.

**Format:** UUID v4 (e.g., `550e8400-e29b-41d4-a716-446655440000`)

**Use cases:**
- Distributed tracing
- Log correlation
- Request deduplication

#### `method: string`

HTTP method in uppercase.

**Values:** `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`, `OPTIONS`

#### `path: string`

URL path without query string.

**Examples:**
- `/api/users`
- `/users/123/posts`
- `/`

#### `url: string`

Full request URL including protocol, host, port, path, and query.

**Example:** `http://localhost:3000/api/users?limit=10`

#### `headers: Record<string, string>`

Request headers with lowercase keys.

**Example:**
```typescript
{
  'content-type': 'application/json',
  'authorization': 'Bearer token123',
  'user-agent': 'Mozilla/5.0...'
}
```

**Security:** Headers are validated per RFC 7230 to prevent injection attacks.

#### `query: Record<string, string>`

Parsed query string parameters.

**Example:**
```typescript
// URL: /search?q=test&limit=10&sort=asc
{
  q: 'test',
  limit: '10',
  sort: 'asc'
}
```

**Note:** All values are strings. Parse numbers manually.

#### `params: Record<string, string>`

Route parameters extracted from URL path.

**Example:**
```typescript
// Route: /users/:userId/posts/:postId
// URL: /users/123/posts/456
{
  userId: '123',
  postId: '456'
}
```

#### `body: string | Buffer`

Raw request body.

**Parsing JSON:**
```typescript
const data = JSON.parse(ctx.body);
```

**Binary data:**
```typescript
if (Buffer.isBuffer(ctx.body)) {
  // Handle binary data
}
```

## Response Format

Handler return value structure.

### RuntimeResponse Interface

```typescript
interface RuntimeResponse {
  status: number;
  headers?: Record<string, string>;
  body?: string | Buffer;
}
```

### Status Codes

**Success:**
- `200 OK` - Successful GET/PUT/PATCH
- `201 Created` - Successful POST with resource creation
- `204 No Content` - Successful DELETE or operation with no response body

**Client Errors:**
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing/invalid authentication
- `403 Forbidden` - Valid auth but insufficient permissions
- `404 Not Found` - Resource doesn't exist
- `429 Too Many Requests` - Rate limit exceeded

**Server Errors:**
- `500 Internal Server Error` - Unhandled exception
- `503 Service Unavailable` - Runtime not READY

### Response Examples

#### JSON Response

```typescript
return {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Success', data: [...] })
};
```

#### HTML Response

```typescript
return {
  status: 200,
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
  body: '<html><body>Hello World</body></html>'
};
```

#### No Content

```typescript
return {
  status: 204
};
```

#### Error Response

```typescript
return {
  status: 400,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ error: 'Invalid input', field: 'email' })
};
```

## State Management

Five-state lifecycle management.

### States

1. **STARTING** - Initial state during initialization
2. **READY** - Accepting requests (normal operation)
3. **DEGRADED** - Operational but suboptimal (e.g., database slow)
4. **DRAINING** - Shutting down, finishing existing requests
5. **STOPPING** - Final shutdown, rejecting new requests

### State Transitions

Valid transitions:
```
STARTING → READY
READY ↔ DEGRADED
READY → DRAINING
DEGRADED → DRAINING
DRAINING → STOPPING
```

### State Behavior

**STARTING:**
- Returns 503 Service Unavailable
- Lasts ~100ms during initialization

**READY:**
- Normal request processing
- All features enabled

**DEGRADED:**
- Still processing requests
- May log warnings
- Can recover to READY

**DRAINING:**
- Rejects new requests (503)
- Allows in-flight requests to complete
- 30-second timeout before STOPPING

**STOPPING:**
- Rejects all requests
- Server shutdown imminent

## Telemetry

Performance metrics collection with pluggable export for monitoring systems.

### TelemetrySink Interface

```typescript
export interface TelemetrySink {
  incrementCounter(name: string, value: number, tags?: Record<string, string>): void;
  recordTiming(name: string, durationMs: number, tags?: Record<string, string>): void;
  recordGauge(name: string, value: number, tags?: Record<string, string>): void;
}
```

### Emitted Metrics

**Counters:**
- `requests.total` - Total requests processed (tags: method, status)

**Gauges:**
- `requests.active` - Currently active requests
- `response.size` - Response body size in bytes

**Timings:**
- `request.duration` - Request processing time in milliseconds

### Default Telemetry (No Export)

```typescript
import { Telemetry } from './telemetry';

const telemetry = new Telemetry();  // Uses NoOpTelemetrySink
```

### Prometheus Integration

```typescript
import { Telemetry } from './telemetry';
import { register, Counter, Gauge, Histogram } from 'prom-client';

class PrometheusSink implements TelemetrySink {
  private counters = new Map<string, Counter>();
  private gauges = new Map<string, Gauge>();
  private histograms = new Map<string, Histogram>();

  incrementCounter(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.counters.has(name)) {
      this.counters.set(name, new Counter({ name, help: name, labelNames: Object.keys(tags || {}) }));
    }
    this.counters.get(name)!.inc(tags, value);
  }

  recordTiming(name: string, durationMs: number, tags?: Record<string, string>): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, new Histogram({ name, help: name, labelNames: Object.keys(tags || {}) }));
    }
    this.histograms.get(name)!.observe(tags, durationMs / 1000);
  }

  recordGauge(name: string, value: number, tags?: Record<string, string>): void {
    if (!this.gauges.has(name)) {
      this.gauges.set(name, new Gauge({ name, help: name, labelNames: Object.keys(tags || {}) }));
    }
    this.gauges.get(name)!.set(tags, value);
  }
}

const telemetry = new Telemetry(new PrometheusSink());
```

### StatsD Integration

```typescript
import { StatsD } from 'node-statsd';

class StatsDSink implements TelemetrySink {
  private client: StatsD;

  constructor(host: string, port: number) {
    this.client = new StatsD({ host, port });
  }

  incrementCounter(name: string, value: number, tags?: Record<string, string>): void {
    this.client.increment(name, value, tags);
  }

  recordTiming(name: string, durationMs: number, tags?: Record<string, string>): void {
    this.client.timing(name, durationMs, tags);
  }

  recordGauge(name: string, value: number, tags?: Record<string, string>): void {
    this.client.gauge(name, value, tags);
  }
}

const telemetry = new Telemetry(new StatsDSink('localhost', 8125));
```

### OpenTelemetry Integration

```typescript
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';

class OTelSink implements TelemetrySink {
  private meter;

  constructor() {
    const provider = new MeterProvider({ resource: new Resource({ 'service.name': 'nessen-runtime' }) });
    this.meter = provider.getMeter('nessen-runtime');
  }

  incrementCounter(name: string, value: number, tags?: Record<string, string>): void {
    const counter = this.meter.createCounter(name);
    counter.add(value, tags);
  }

  recordTiming(name: string, durationMs: number, tags?: Record<string, string>): void {
    const histogram = this.meter.createHistogram(name);
    histogram.record(durationMs, tags);
  }

  recordGauge(name: string, value: number, tags?: Record<string, string>): void {
    const gauge = this.meter.createObservableGauge(name);
    gauge.addCallback((result) => result.observe(value, tags));
  }
}

const telemetry = new Telemetry(new OTelSink());
```

### Snapshot Access

Internal snapshot API for health endpoints:

```typescript
const snapshot = telemetry.getSnapshot();
console.log({
  totalRequests: snapshot.requestsTotal,
  activeRequests: snapshot.requestsActive,
  p50: snapshot.requestDurationP50Ms,
  p95: snapshot.requestDurationP95Ms,
  p99: snapshot.requestDurationP99Ms,
});
```

Response:
```json
{
  "totalRequests": 5000,
  "activeRequests": 3,
  "p50": 2.1,
  "p95": 4.8,
  "p99": 8.2
}
```

## Security Features

### Header Validation

All headers validated per RFC 7230:
- No control characters
- No line breaks (CRLF injection prevention)
- Proper header name format

### XSS Prevention

All HTML output sanitized via `escapeHtml()`:
```typescript
<script> → &lt;script&gt;
" → &quot;
& → &amp;
```

### Path Traversal Protection

Paths validated to prevent directory traversal:
```typescript
/../../etc/passwd → Blocked
/api/../../../etc/passwd → Blocked
```

### Request Size Limits

- Max body size: 1MB (configurable)
- Max URL length: 8192 bytes
- Max header size: 16KB

### Timeout Protection

- Per-request timeout: 30 seconds
- Prevents resource exhaustion from slow clients

## Error Handling

### Automatic Error Responses

Unhandled exceptions converted to 500 responses:

```typescript
runtime.route.get('/error', async (ctx) => {
  throw new Error('Something went wrong');
});

// Returns:
// Status: 500
// Body: {"error":"Internal server error"}
```

**Production mode:** Stack traces not included in response

### Custom Error Handling

Catch and return custom errors:

```typescript
runtime.route.post('/api/data', async (ctx) => {
  try {
    const data = JSON.parse(ctx.body);
    if (!data.email) {
      return {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Email required' })
      };
    }
    // Process data
  } catch (e) {
    return {
      status: 400,
      body: JSON.stringify({ error: 'Invalid JSON' })
    };
  }
});
```

## Best Practices

### Handler Design

**Keep handlers focused:**
```typescript
// Good: Single responsibility
runtime.route.get('/users/:id', getUserHandler);

// Avoid: Multiple concerns in one handler
runtime.route.get('/users/:id', async (ctx) => {
  // Auth logic
  // Validation
  // Database query
  // Response formatting
  // ...too much in one place
});
```

**Use middleware for cross-cutting concerns:**
```typescript
runtime.use(authMiddleware());
runtime.use(validationMiddleware());
runtime.route.get('/users/:id', getUserHandler);
```

### Error Handling

Always handle expected errors:
```typescript
runtime.route.get('/api/data', async (ctx) => {
  try {
    const data = await fetchData();
    return { status: 200, body: JSON.stringify(data) };
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return { status: 404, body: JSON.stringify({ error: 'Not found' }) };
    }
    // Let runtime handle unexpected errors
    throw error;
  }
});
```

### Type Safety

Leverage TypeScript types:
```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

runtime.route.get('/users/:id', async (ctx): Promise<RuntimeResponse> => {
  const user: User = await getUser(ctx.params.id);
  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user)
  };
});
```

### Performance

**Avoid blocking operations:**
```typescript
// Bad: Blocks event loop
const data = fs.readFileSync('/large/file');

// Good: Async I/O
const data = await fs.promises.readFile('/large/file');
```

**Cache expensive operations:**
```typescript
const cache = new Map<string, CachedData>();

runtime.route.get('/expensive', async (ctx) => {
  const cached = cache.get(ctx.query.key);
  if (cached && Date.now() - cached.timestamp < 60000) {
    return { status: 200, body: cached.data };
  }
  
  const data = await expensiveOperation();
  cache.set(ctx.query.key, { data, timestamp: Date.now() });
  return { status: 200, body: data };
});
```
