# Architecture Guide

Understanding how Nessen Runtime works and why it's designed this way.

## Philosophy

Nessen is built on these core principles:

1. **Simplicity** — No magic, no hidden configuration, no opinion-laden defaults
2. **Predictability** — You know exactly what your code does, when it runs, and how resources are managed
3. **Clarity** — Every design decision has a reason, documented and understandable
4. **Efficiency** — Zero dependencies, minimal allocations, predictable performance

## High-Level Architecture

```
HTTP Client
    ↓
┌─────────────────────────┐
│   HTTP Server (Node.js) │
├─────────────────────────┤
│   Request Buffer        │  (Backpressure handling)
├─────────────────────────┤
│   Middleware Pipeline   │  (Logging, Rate Limiting, etc.)
├─────────────────────────┤
│   Router                │  (O(1) exact match, O(n) param match)
├─────────────────────────┤
│   Request Handler       │  (Your code)
├─────────────────────────┤
│   Response Builder      │  (Header validation, formatting)
├─────────────────────────┤
│   Telemetry & State     │  (Metrics, lifecycle management)
└─────────────────────────┘
    ↓
HTTP Response
```

Every request flows through these layers in order.

## Core Components

### 1. HTTP Server (server.ts)

**Purpose:** Accept raw HTTP connections from the network.

**Key features:**
- Built on Node.js `http` module only (no external frameworks)
- Backpressure handling to prevent memory exhaustion from slow clients
- Request size limits (URL: 8KB, body: 1MB, headers: 16KB)
- Proper listener cleanup to prevent memory leaks

**Why this layer?**
- Provides transport-agnostic abstraction
- Validates HTTP-level concerns (headers, body size)
- Prevents resource exhaustion from network-level attacks

### 2. Middleware Pipeline (middleware.ts)

**Purpose:** Run cross-cutting concerns before/after handlers.

**Design:**
- Express-like middleware chain
- Each middleware wraps the next one
- Early return short-circuits the chain
- Metadata object for passing data between layers

**Flow:**
```
middleware 1 → middleware 2 → handler → middleware 2 → middleware 1
 (before)      (before)       (body)     (after)       (after)
```

**Why this approach?**
- Familiar to developers (Express-like)
- Composable and testable
- Allows cross-cutting concerns (logging, auth, rate limiting)
- Easy to add custom middleware

### 3. Router (router.ts)

**Purpose:** Match incoming requests to handler functions.

**Routing strategy:**
1. Try exact match first (e.g., `/users/special`)
2. If no exact match, try parameter routes (e.g., `/users/:id`)
3. If no match, return 404

**Performance:**
- Exact matches: O(1) hash table lookup
- Parameter matches: O(n) where n = number of parameter routes (typically <10)
- Result: O(1) typical case, O(n) worst case but with small n

**Parameter extraction:**
- Regex pre-compiled at route registration time
- No runtime regex compilation
- Automatic parameter extraction into `ctx.params`

**Why this design?**
- Fast for common case (exact paths)
- Simple to understand (no priority, no specificity scoring)
- No performance cliff (predictable behavior)

### 4. Request Context (context.ts)

**Purpose:** Encapsulate all request information in an immutable structure.

**Structure:**
```typescript
interface RequestContext {
  id: string;                      // Unique request ID
  method: string;                  // HTTP method
  url: string;                     // Full URL
  path: string;                    // URL path only
  headers: Record<string, string>; // Request headers (lowercase)
  query: Record<string, string>;   // Query parameters
  params: Record<string, string>;  // Path parameters
  body: Buffer;                    // Raw body
}
```

**Why immutable?**
- Prevents accidental modifications
- Makes data flow explicit
- Easier to reason about
- Middleware can trust context consistency

### 5. Response Builder (response.ts)

**Purpose:** Build HTTP responses with validation.

**Responsibilities:**
- Validate response structure
- Validate headers (RFC 7230)
- Set security headers (X-Content-Type-Options, X-Frame-Options)
- Compress response if appropriate
- Handle ETag/cache headers

**Why separate?**
- Response formatting is complex
- Centralized validation prevents bugs
- Easier to add features (compression, caching, etc.)

### 6. Runtime State Machine (state.ts)

**Purpose:** Manage the server lifecycle.

**States:**
```
STARTING → READY ↔ DEGRADED → DRAINING → STOPPING
```

**Transitions:**
- STARTING: ~100ms during initialization
- READY: Normal operation (accepts requests)
- DEGRADED: Optional state for reduced capacity
- DRAINING: Graceful shutdown (rejects new requests)
- STOPPING: Final shutdown (closes all connections)

**Why a state machine?**
- Makes lifecycle explicit and predictable
- Prevents invalid operations (can't process requests while STOPPING)
- Enables graceful shutdown without losing requests
- Makes monitoring and debugging easier

### 7. Telemetry (telemetry.ts)

**Purpose:** Collect performance metrics for monitoring.

**Metrics collected:**
- Request count (total, active, errors)
- Latency percentiles (p50, p95, p99)
- Memory usage
- Event loop lag
- Response sizes

**Percentile calculation:**
- Uses quickselect algorithm (O(n) average case)
- Tracks last 1000 requests
- 100ms snapshot cache for efficiency

**Why not just averages?**
- Averages hide tail latencies
- p95 and p99 show real-world performance
- Quickselect is faster than sorting (O(n) vs O(n log n))

## Design Patterns

### 1. Single-Writer Concurrency

The runtime uses a single-writer pattern for state management:
- Only one "owner" thread can modify state
- Other threads can read safely
- Eliminates race conditions without complex locking

**Implementation:**
- Each request gets its own immutable context
- State mutations go through single event loop
- No shared mutable state between requests

**Why this matters:**
- Node.js is single-threaded (event loop)
- Prevents concurrency bugs
- Simpler to reason about than multi-threaded code

### 2. Immutable Data Structures

Most data passed through the runtime is immutable:
- RequestContext
- RuntimeResponse
- Middleware chain

**Benefits:**
- Prevents accidental modifications
- Makes data flow clear
- Middleware can safely pass context downstream

### 3. Bounded Collections

All collections have size limits:
- Request history: max 100
- Rate limit buckets: one per IP
- Telemetry window: last 1000 requests

**Why bounded?**
- Prevents memory exhaustion
- Predictable memory usage
- O(1) space complexity

### 4. Transport-Neutral Abstraction

The core runtime (everything except server.ts) doesn't know about HTTP:
- RequestContext is just data
- RuntimeResponse is just an object with status/headers/body
- Could be extended to WebSockets, gRPC, etc.

**Benefits:**
- Easier to test
- Reusable across protocols
- Clean separation of concerns

## Dataflow Example

Let's trace a request through the entire stack:

```typescript
// 1. HTTP Server receives raw request
incoming HTTP request
  ↓
// 2. Parse into RequestContext
RequestContext {
  method: 'GET',
  path: '/users/123',
  params: { id: '123' },
  ...
}
  ↓
// 3. Pass through middleware pipeline
middleware 1 (logging)
  → middleware 2 (rate limit)
    → handler
      ↓
// 4. Handler processes request
async (ctx) => {
  const user = await db.getUser(ctx.params.id);
  return {
    status: 200,
    body: JSON.stringify(user)
  };
}
      ↓
// 5. Response flows back through middleware
middleware 2 (rate limit)
  → middleware 1 (logging)
    ↓
// 6. Response builder validates and formats
Response {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
  body: '{"id":"123","name":"Alice"}'
}
    ↓
// 7. Telemetry recorded
metrics {
  totalRequests: 1001,
  latency: 2.5ms
}
    ↓
// 8. HTTP Server sends response
HTTP 200 OK
Content-Type: application/json
...
{"id":"123","name":"Alice"}
```

## Performance Characteristics

### Time Complexity

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| Route matching (exact) | O(1) | Hash table lookup |
| Route matching (param) | O(n) | n = number of param routes, typically <10 |
| Middleware chain | O(m) | m = number of middleware, typically <5 |
| Percentile calculation | O(k) | k = window size (1000), quickselect |
| Request handling | O(h) | h = handler complexity (your code) |

### Space Complexity

| Component | Space | Limit |
|-----------|-------|-------|
| Request history | O(1) | Max 100 requests |
| Telemetry window | O(1) | Max 1000 requests |
| Rate limit buckets | O(ips) | One per unique IP |
| Route table | O(routes) | User-defined |

### Allocations

The runtime minimizes allocations:
- RequestContext: 1 allocation per request
- Middleware context: 1 allocation per request
- Response: 1 allocation (usually)
- Metrics: Reused buffer, 100ms snapshot

**Result:** Predictable, low GC pressure.

## Error Handling Strategy

Three layers of error handling:

### 1. Handler-Level (Your Code)

```typescript
runtime.route.get('/', async (ctx) => {
  try {
    // Your code
  } catch (error) {
    return { status: 500, body: JSON.stringify({ error: error.message }) };
  }
});
```

### 2. Middleware-Level

```typescript
const errorMiddleware = () => async (ctx, next) => {
  try {
    return await next();
  } catch (error) {
    console.error('Middleware error:', error);
    return { status: 500, body: 'Server error' };
  }
};
```

### 3. Runtime-Level

If a handler throws an unhandled error, the runtime:
1. Catches the error
2. Logs it
3. Returns HTTP 500
4. Continues running (doesn't crash)

**Result:** Your application is resilient to handler errors.

## Graceful Shutdown Lifecycle

When SIGTERM or SIGINT is received:

1. **Transition to DRAINING**
   - Stop accepting new requests (return 503)
   - Log shutdown initiation

2. **Wait for Requests**
   - Give existing requests up to 30 seconds to complete
   - Continue processing already-accepted requests

3. **Timeout Protection**
   - If requests don't finish in 30 seconds, force close
   - Prevent hanging processes

4. **Cleanup**
   - Close HTTP server
   - Cleanup resources
   - Exit process

**Result:** Zero request loss during graceful shutdown (in most cases).

## Design Trade-offs

### Why No Advanced Features X?

**Why no async context locals?**
- Too complex for the benefit
- Use middleware metadata instead
- Easier to understand and debug

**Why no built-in request deduplication?**
- Different applications need different strategies
- Implement in your handler/middleware
- Simpler core runtime

**Why no automatic compression?**
- Users should choose compression strategy
- Opt-in via middleware, not implicit
- Transparent magic causes performance surprises

**Why no sessions/cookies library?**
- Session management is application-specific
- Parse headers and set cookies manually
- Keeps runtime focused

### What's Deliberately Included?

**Why rate limiting middleware?**
- Critical for protecting against abuse
- Hard to add correctly after the fact
- Better as part of core

**Why structured JSON logging?**
- Makes debugging production issues easier
- Structured format parseable by monitoring tools
- Better than ad-hoc logging

**Why health endpoints?**
- Essential for Kubernetes/orchestration
- Best practices to build in from start
- Hard to retrofit cleanly

## Testing Architecture

The modular architecture makes testing straightforward:

```typescript
// Test handler in isolation
const response = await handler(mockContext);
expect(response.status).toBe(200);

// Test middleware in isolation
const middleware = createMyMiddleware();
const response = await middleware(mockContext, () => ({ status: 200 }));

// Test routing
const runtime = new Runtime();
runtime.route.get('/test', handler);
// Runtime exposes internal router for testing
```

## Future Extensibility

The architecture is designed for future extensions:

- **Protocol support:** Add WebSocket, gRPC handlers (transport-neutral core)
- **Streaming:** Response streaming (already buffer-ready)
- **Request hooks:** Pre/post-processing hooks (extend middleware)
- **Plugin system:** Load middleware from modules
- **Tracing:** OpenTelemetry integration (telemetry hooks)

Each would be additive, not disruptive.

## Summary

Nessen's architecture prioritizes:

1. **Clarity** — Every layer has one responsibility
2. **Predictability** — O(1) routing, bounded memory, explicit state
3. **Efficiency** — No dependencies, minimal allocations, fast operations
4. **Resilience** — Error handling at multiple levels, graceful shutdown
5. **Extensibility** — Middleware system, immutable contracts, transport abstraction

The result is a runtime that's simple to understand, efficient to run, and easy to extend.
