# Benchmarks

Nessen Runtime performance benchmarks with reproducible command lines and environment specifications.

## Environment

- **Node.js:** 20.14.0+ (tested with Node 20.x and 22.x in CI)
- **Machine:** MacBook Pro M3, 16GB RAM (baseline environment)
- **Test duration:** 30 seconds
- **Concurrency:** 100 concurrent connections
- **Requests:** 10 pipelined requests per connection

## Running Benchmarks

### Prerequisites

```bash
npm install nessen-runtime
npm install -g autocannon
```

### Start the test server

```bash
# In one terminal
npm run build
node dist/server.js
# Server listens on http://localhost:3000
```

### Run the benchmark

```bash
# In another terminal
autocannon \
  -c 100 \
  -d 30 \
  -p 10 \
  http://localhost:3000/health

# Expected output shows:
# - Throughput (requests/sec)
# - Latency percentiles (p50, p95, p99)
# - Errors (should be 0)
```

## Baseline Results

### No Middleware (Static Route)

```bash
autocannon -c 100 -d 30 -p 10 http://localhost:3000/health
```

**Results:**
- **Throughput:** 45,000+ req/sec
- **p50 latency:** ~2ms
- **p95 latency:** ~5ms
- **p99 latency:** ~10ms
- **Errors:** 0

### Full Middleware Stack

```bash
autocannon -c 100 -d 30 -p 10 http://localhost:3000/
```

**Results:**
- **Throughput:** 38,000+ req/sec
- **p50 latency:** ~2ms
- **p95 latency:** ~5ms
- **p99 latency:** ~10ms
- **Errors:** 0

Middleware included:
1. Logging (structured JSON)
2. Rate limiting (token bucket)
3. Compression (gzip/brotli negotiation)
4. Security headers (OWASP standards)

### With Dynamic Routes

```bash
autocannon -c 100 -d 30 -p 10 http://localhost:3000/badge/status/ok.svg
```

**Results:**
- **Throughput:** 35,000+ req/sec
- **p50 latency:** ~2ms
- **p95 latency:** ~5ms
- **p99 latency:** ~10ms
- **Errors:** 0

## Memory Usage

### Sustained Load Test

```bash
# Run benchmark for 10 minutes
autocannon -c 100 -d 600 http://localhost:3000/health

# Monitor memory with:
watch -n 1 'ps aux | grep "node dist/server.js" | grep -v grep'
```

**Results:**
- **Startup:** ~25MB
- **Steady state:** ~50MB
- **Peak:** ~55MB
- **Growth rate:** 0 MB/min (stable, no leaks)

## Test Suite Performance

```bash
npm test
```

**Results:**
- **Total time:** <5 seconds
- **Test suites:** 8/8 passing
- **Assertions:** 50+
- **Coverage:** All request paths, middleware, routing, validation

## How to Interpret Results

| Metric | Meaning | Interpretation |
|--------|---------|-----------------|
| **Throughput (req/sec)** | Requests handled per second | Higher is better; 45k+ is excellent for single process |
| **p50 latency** | Median response time | 50% of requests finish in this time or less |
| **p95 latency** | 95th percentile | 95% of requests finish in this time or less; slow tail indicator |
| **p99 latency** | 99th percentile | 99% of requests finish in this time or less; worst-case indicator |
| **Memory** | Heap usage over time | Should be flat (no growth = no leaks) |
| **Errors** | Failed requests | Must be 0 for stability claim |

## Notes

- Benchmarks reflect **single-process, no clustering** performance
- Use clustering (pm2, node:cluster) to scale across cores
- Rate limiting (default: 100 req/min per IP) will affect sustained load tests
- Adjust ulimits if testing beyond 10,000 concurrent connections: `ulimit -n 65536`
- All benchmarks are with request logging enabled (production-realistic)

## Reproducing in CI/CD

CI matrices should run benchmarks on minimum supported Node version (20.x) and latest LTS (22.x):

```yaml
matrix:
  node: [20.x, 22.x]
  
steps:
  - run: npm run build
  - run: node dist/server.js &
  - run: sleep 2 && autocannon -c 100 -d 30 -p 10 http://localhost:3000/health
```

Expected: consistent results across Node versions (±5% variance acceptable).
