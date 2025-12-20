# Nessen Runtime

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3%2B-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)](package.json)

**Production-grade minimal Node.js HTTP runtime with zero dependencies.**

Built for **peak performance**, **energy efficiency**, and **multi-layer security**. Every line of code is engineered for production readiness - no toy code, no tutorials, no compromises.

## Table of Contents

- [Why This Exists](#why-this-exists)
- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Security](#security)
- [Performance](#performance)
- [Observability](#observability)
- [Production Deployment](#production-deployment)
- [Development](#development)
- [Testing](#testing)
- [Design Decisions](#design-decisions)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## Why This Exists

Nessen Runtime demonstrates that you don't need heavyweight frameworks to build production-ready HTTP servers. By using Node.js built-ins exclusively and following strict architectural principles (SOLID/KISS/DRY/YAGNI), we achieve:

- **Predictable performance** through O(1) routing and minimal allocations
- **Energy efficiency** by doing less work per request
- **Security by design** with multiple protection layers
- **Operational excellence** via graceful shutdown and health monitoring
- **Code clarity** with transport-neutral architecture

## Features

### Core Capabilities
✅ **Zero Runtime Dependencies** - Pure Node.js v20+ built-ins only  
✅ **Transport-Neutral Architecture** - Decoupled from HTTP for flexibility  
✅ **O(1) Routing** - Hash map for exact routes, efficient parameter matching  
✅ **State Machine** - Predictable operational states (STARTING → READY → DRAINING → STOPPING)  
✅ **Graceful Shutdown** - 30-second drain timeout, proper connection handling  
✅ **Request Tracing** - Crypto-secure request IDs in all logs and responses  

### Security
✅ **Multi-Layer Input Validation** - URL length (8KB), body size (1MB), path safety  
✅ **Comprehensive Timeout Protection** - Idle (60s), headers (10s), per-request (30s)  
✅ **XSS Prevention** - Complete HTML escaping including forward slash  
✅ **Path Traversal Protection** - Blocks all encoding variants (`../`, `%2e%2e`, `%5c`, etc.)  
✅ **Security Headers** - X-Content-Type-Options, X-Frame-Options, CSP, Referrer-Policy  
✅ **DoS Protection** - Badge parameter limits (50 chars), body size limits  
✅ **No Dynamic Code** - No `eval()`, no `Function()`, no template injection  
✅ **Crypto-Secure IDs** - Uses `crypto.randomBytes()` for unpredictable request IDs  

### Performance
✅ **Minimal Allocations** - Single envelope per request, immutable contexts  
✅ **ETag Caching** - LRU cache (100 entries) prevents redundant SHA-256 computation  
✅ **Atomic Snapshots** - Lock-free telemetry with atomic reference replacement  
✅ **Pre-Compiled Regex** - Router patterns compiled once at startup  
✅ **Memory Leak Prevention** - Timeout cancellation, unref'd intervals  
✅ **Response Size Tracking** - Efficient monitoring without overhead  

### Observability
✅ **Request Metrics** - P50/P95/P99 latency percentiles  
✅ **System Metrics** - Memory usage, CPU percentage, event-loop lag  
✅ **Request Tracing** - X-Request-ID header on all responses  
✅ **Detailed Health Checks** - `/api/health` with full telemetry snapshot  
✅ **Kubernetes-Ready Probes** - `/health` (liveness), `/ready` (readiness)  

## Architecture

```
HTTP Request → server.ts (HTTP ingress)
                    ↓
              envelope.ts (transport-neutral wrapper)
                    ↓
              classify.ts (intent + path parsing)
                    ↓
              runtime.ts (state gating + routing)
                    ↓
              handlers.ts (business logic)
                    ↓
              response.ts (safe response building)
                    ↓
HTTP Response ← server.ts (send to client)
```

### Key Components

- **`server.ts`**: HTTP-specific layer. Only file that touches Node's `http` module.
- **`runtime.ts`**: Core request handler. Operates on transport-neutral envelopes.
- **`state.ts`**: State machine (STARTING → READY → DEGRADED/DRAINING → STOPPING).
- **`envelope.ts`**: Transport-neutral request/response shapes.
- **`classify.ts`**: Request intent classification and base path handling.
- **`context.ts`**: Immutable request context for handlers.
- **`router.ts`**: O(1) exact match + parameter route support.
- **`response.ts`**: Safe response builders with security headers and ETags.
- **`handlers.ts`**: Demo handlers (home page, badge generator).
- **`telemetry.ts`**: Lightweight metrics (timers, memory, CPU, event-loop lag).
- **`health.ts`**: Health and readiness endpoints.
- **`shutdown.ts`**: Graceful shutdown with draining and signal handling.

### State Machine

```
STARTING → READY ⇄ DEGRADED
              ↓         ↓
          DRAINING → STOPPING
```

- **STARTING**: Initialization phase. Not ready, but alive.
- **READY**: Normal operation. Accepts requests.
- **DEGRADED**: Operational but under stress. Still accepts requests with conservative policies.
- **DRAINING**: Graceful shutdown in progress. Rejects new requests with 503.
- **STOPPING**: Final shutdown. Process will exit soon.

## Quick Start

### Prerequisites

- **Node.js** v20.0.0 or higher
- **TypeScript** 5.3+ (dev dependency only)
- **npm** or equivalent package manager

### Installation

```bash
# Clone repository
git clone https://github.com/artex-essence/nessen-runtime.git
cd nessen-runtime

# Install dependencies
npm install

# Build
npm run build

# Start server
npm start
```

The server will start on `http://0.0.0.0:3000` by default.

### Verify Installation

```bash
# Check health
curl http://localhost:3000/api/health

# Expected response:
# {"ok":true,"state":"READY","uptimeMs":1234,...}

# Test home page
curl http://localhost:3000/

# Generate a badge
curl http://localhost:3000/badge/status/operational.svg
```

## Configuration

### Environment Variables

| Variable | Default | Type | Description |
|----------|---------|------|-------------|
| `PORT` | `3000` | number | HTTP server port |
| `HOST` | `0.0.0.0` | string | Bind address (use `127.0.0.1` for localhost only) |
| `BASE_PATH` | `/` | string | URL prefix for all routes (e.g., `/api`, `/v1`) |
| `DEV_MODE` | `0` | boolean | Set to `1` to expose stack traces in error responses |
| `MAX_BODY_SIZE` | `1048576` | number | Maximum request body size in bytes (1MB default) |

### Configuration Examples

**Basic Configuration**

```bash
BASE_PATH=/node PORT=8080 npm start
```

Now all routes are prefixed: `http://localhost:8080/node/`

## Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Home page with request diagnostics |
| `GET` | `/health` | Liveness check (200 if alive, 503 if stopping) |
| `GET` | `/ready` | Readiness check (200 only when READY) |
| `GET` | `/api/health` | Detailed health metrics (JSON) |
| `GET` | `/badge/:label/:value.svg` | SVG badge generator |

### Examples

```bash
# Home page
curl http://localhost:3000/

# Detailed health (JSON)
curl http://localhost:3000/api/health

# Generate badge
curl http://localhost:3000/badge/status/operational.svg

# Readiness probe
curl http://localhost:3000/ready
```

## Security Posture

### Input Protection

- **URL length limit**: 8KB maximum
- **Body size limit**: 1MB default (configurable via `MAX_BODY_SIZE`)
- **Path validation**: Rejects null bytes, path traversal sequences (`../`), encoded attacks
- **Header size protection**: Node's built-in `headersTimeout` prevents slowloris attacks

### Timeout Enforcement

- **Idle timeout**: 60 seconds (no activity on connection)
- **Headers timeout**: 10 seconds (malicious slow headers)
- **Per-request timeout**: 30 seconds (soft abort with 503)

### Response Security

HTML responses include security headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; style-src 'unsafe-inline'; script-src 'none'
```

### Error Handling

- Stack traces **never** exposed in production (unless `DEV_MODE=1`)
- Errors logged server-side with context
- Clean error messages returned to clients
- Uncaught exceptions trigger graceful shutdown

### No Dynamic Code

- No `eval()`, `Function()`, or template injection vectors
- All routes registered statically at startup
- Parameter extraction via regex capture groups only

## Performance Characteristics

### Routing

- **O(1) exact match**: Hash map lookup for static routes
- **O(n) parameter routes**: Linear scan of parameter patterns (n is small)
- **Deterministic precedence**: Exact routes checked before parameter routes

### Allocations

- Envelope created once per request
- Context is immutable; no deep cloning
- Router regex compiled at startup, reused
- Telemetry uses atomic snapshot replacement (no per-request allocation)

### Caching

- **SVG badges**: Include `ETag` (SHA-256 hash of content) and `Cache-Control: public, max-age=3600, immutable`
- **Static content**: Can add similar caching for future asset routes

### Telemetry

- **Event-loop lag**: Measured via 100ms interval check
- **CPU usage**: Calculated from `process.cpuUsage()` deltas
- **Memory**: Heap usage snapshots
- **Request metrics**: Total, active, P50/P95/P99 latency

Telemetry overhead is minimal. Snapshots are built on-demand (e.g., for `/api/health`), not per-request.

## Graceful Shutdown

On receiving `SIGTERM` or `SIGINT`:

1. Transition to `DRAINING` state
2. Stop accepting new connections (`server.close()`)
3. Reject new requests with 503
4. Wait up to 30 seconds for active requests to complete
5. Transition to `STOPPING` and exit

Uncaught exceptions and unhandled rejections also trigger graceful shutdown (with shorter 5s timeout).

## Development Commands

```bash
# Type check without building
npm run typecheck

# Clean build artifacts
npm run clean

# Full rebuild
npm run clean && npm run build

# Watch mode (manual)
# Terminal 1:
npx tsc --watch

# Terminal 2:
node dist/server.js
```

## Monitoring

Health endpoint `/api/health` returns:

```json
{
  "ok": true,
  "state": "READY",
  "uptimeMs": 123456,
  "mem": 45,
  "cpu": 12,
  "eventLoopLagMs": 2,
  "requests": {
    "total": 1523,
    "active": 3,
    "p50Ms": 5,
    "p95Ms": 18,
    "p99Ms": 42
  }
}
```

Use this for:

- Kubernetes readiness/liveness probes
- Prometheus metrics (parse and export)
- Dashboard monitoring
- Alerting on degraded state or high latency

## Testing

```bash
# Quick smoke test
curl http://localhost:3000/
curl http://localhost:3000/api/health
curl http://localhost:3000/badge/test/value.svg

# Load test (requires Apache Bench)
ab -n 10000 -c 100 http://localhost:3000/

# Graceful shutdown test
npm start &
PID=$!
sleep 2
kill -SIGTERM $PID
# Should see "Draining..." messages before exit
```

## Design Decisions

### Why No Frameworks?

Frameworks add:

- Dependency weight (security surface, maintenance burden)
- Abstraction overhead (performance cost)
- Learning curve (framework-specific patterns)

For many production use cases, Node built-ins are sufficient and more predictable.

### Why Transport-Neutral Core?

Decoupling the runtime from HTTP allows:

- Testing without network sockets
- Future support for WebSockets, gRPC, IPC without rewriting logic
- Clearer separation of concerns

### Why State Machine?

Explicit states make operational behavior predictable:

- Clear semantics for health checks
- Deterministic shutdown behavior
- Safe degradation under load (future enhancement)

### Why Atomic Snapshots for Telemetry?

Mutating shared state across modules creates race conditions. Atomic replacement (new object reference) is safe without locks.

## Future Enhancements (Not in v0.1)

- Middleware system for extensibility
- WebSocket support
- Static file serving with sendfile()
- Response compression (gzip/brotli)
- Rate limiting per IP
- Structured logging with levels
- Prometheus metrics export
- OpenTelemetry tracing

## License

MIT

---

**Built with zero dependencies. Runs on pure Node.js v20+.**
