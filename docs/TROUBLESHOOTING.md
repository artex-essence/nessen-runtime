# Troubleshooting Guide

Solutions to common issues and how to debug them.

## Server Won't Start

### Error: `EADDRINUSE: address already in use :::3000`

**Problem:** Another process is listening on port 3000.

**Solutions:**

Find what's using the port:
```bash
# macOS/Linux
lsof -i :3000

# Windows
netstat -ano | findstr :3000
```

Kill the process:
```bash
# macOS/Linux
kill -9 <PID>

# Windows
taskkill /PID <PID> /F
```

Or use a different port:
```typescript
await runtime.listen(3001);
```

### Error: `EACCES: permission denied :::80`

**Problem:** You're trying to bind to port 80 (or other low-numbered ports) without root/admin privileges.

**Solutions:**

Use a higher port:
```typescript
await runtime.listen(3000);  // Not 80
```

Or run with elevated privileges:
```bash
sudo node server.js  # NOT RECOMMENDED for production
```

For production on port 80/443, use a reverse proxy (Nginx, HAProxy):
```bash
Client → Nginx (port 80/443) → Your app (port 3000)
```

### Error: `Cannot find module 'nessen-runtime'`

**Problem:** Package not installed.

**Solution:**
```bash
npm install nessen-runtime
```

Make sure `package.json` includes it:
```json
{
  "dependencies": {
    "nessen-runtime": "^1.1.0"
  }
}
```

## Requests Timing Out

### Problem: All requests take 30+ seconds

**Likely cause:** Handler is slow or stuck.

**Debug:**

Add logging to see where time is spent:
```typescript
runtime.route.get('/slow', async (ctx) => {
  console.log('Handler started');
  
  const start = Date.now();
  const data = await slowOperation();
  const duration = Date.now() - start;
  
  console.log(`Slow operation took ${duration}ms`);
  
  return {
    status: 200,
    body: JSON.stringify(data)
  };
});
```

**Solution:**

Optimize the slow operation. If legitimately slow:
```typescript
// Increase timeout (max 30s for now, use load balancer timeout for more)
runtime.route.get('/slow', async (ctx) => {
  // Optimize: parallel operations instead of sequential
  const [data1, data2] = await Promise.all([
    operation1(),
    operation2()
  ]);
  
  return { status: 200, body: JSON.stringify({ data1, data2 }) };
});
```

### Problem: Some requests timeout, others are fast

**Likely causes:**
- Dependent service (database) is slow sometimes
- Rate limiting is too strict
- Event loop is blocked

**Debug:**

Check `/api/health` metrics:
```bash
curl http://localhost:3000/api/health
```

Look for:
- `eventLoopLagMs` > 100: Event loop is blocking
- `p95Ms` much higher than `p50Ms`: Tail latency problem
- `activeRequests` > 100: Too many concurrent requests

**Solutions:**

If database is slow:
```typescript
// Add connection pooling
const pool = new Pool({ max: 10 }); // Limit concurrent connections

runtime.route.get('/data', async (ctx) => {
  const data = await pool.query('SELECT ...');
  return { status: 200, body: JSON.stringify(data) };
});
```

If rate limit is too strict:
```typescript
import { createRateLimitMiddleware } from 'nessen-runtime/middleware/rateLimit';

runtime.use(createRateLimitMiddleware({
  maxRequests: 10000,  // Increase from 1000
  windowMs: 60000      // Per minute
}));
```

If event loop is blocked:
```typescript
// Move heavy computation to worker thread
import { Worker } from 'worker_threads';

const worker = new Worker('./heavy-computation.js');

runtime.route.post('/compute', async (ctx) => {
  const result = await runInWorker(JSON.parse(ctx.body));
  return { status: 200, body: JSON.stringify(result) };
});
```

## High Memory Usage

### Problem: Memory grows over time

**Likely causes:**
- Memory leak in your handler
- Unbounded middleware metadata
- Too many concurrent requests

**Debug:**

Monitor memory:
```bash
node --trace-gc server.js  # Show GC events
node --inspect server.js   # Use Chrome DevTools
```

Check runtime metrics:
```bash
curl http://localhost:3000/api/health
# Look at "mem" and "activeRequests"
```

**Solutions:**

Find memory leaks in your code:
```typescript
// BAD: Array grows unbounded
const cache = [];

runtime.route.get('/data', async (ctx) => {
  const result = await expensiveOperation();
  cache.push(result);  // ← Memory leak!
  return { status: 200, body: JSON.stringify(result) };
});

// GOOD: Use bounded cache
import LRU from 'lru-cache';
const cache = new LRU({ max: 1000 });

runtime.route.get('/data', async (ctx) => {
  if (cache.has('data')) {
    return { status: 200, body: cache.get('data') };
  }
  const result = await expensiveOperation();
  cache.set('data', JSON.stringify(result));
  return { status: 200, body: cache.get('data') };
});
```

Limit concurrent requests:
```typescript
let activeCount = 0;
const MAX_ACTIVE = 100;

const concurrencyMiddleware = () => async (ctx, next) => {
  if (activeCount >= MAX_ACTIVE) {
    return {
      status: 503,
      body: JSON.stringify({ error: 'Too many requests' })
    };
  }
  
  activeCount++;
  try {
    return await next();
  } finally {
    activeCount--;
  }
};

runtime.use(concurrencyMiddleware());
```

### Problem: Memory doesn't decrease after load stops

**Cause:** Node.js doesn't always free memory back to OS (normal behavior).

**Not a problem** if:
- Memory stabilizes (isn't growing anymore)
- Requests are still fast
- `/api/health` looks healthy

This is normal. Node.js keeps freed memory in its pool for reuse.

## High CPU Usage

### Problem: Server using 100% CPU

**Likely causes:**
- Busy-wait loop (never yields to event loop)
- Synchronous heavy computation
- Infinite loop

**Debug:**

See what's running:
```bash
# macOS: press Ctrl+C after a few seconds to see stack trace
node --abort-on-uncaught-exception server.js

# Linux: use perf
perf record -p <PID> -F 99 -g -- sleep 10
perf script
```

**Solutions:**

Move computation to workers:
```typescript
import { Worker } from 'worker_threads';

runtime.route.post('/compute', async (ctx) => {
  // Run in separate thread so main thread isn't blocked
  const result = await new Promise((resolve, reject) => {
    const worker = new Worker('./compute.js');
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.postMessage(JSON.parse(ctx.body));
  });
  
  return { status: 200, body: JSON.stringify(result) };
});
```

Use async operations instead of sync:
```typescript
// BAD: Blocks event loop
const data = fs.readFileSync('./file.txt');

// GOOD: Non-blocking
const data = await fs.promises.readFile('./file.txt');
```

## Routes Not Working

### Problem: `404 Not Found` for routes that should exist

**Debug:**

List registered routes:
```typescript
runtime.route.get('/debug', async (ctx) => {
  // Log all requests to see what paths are coming in
  return { status: 200, body: `Path: ${ctx.path}` };
});
```

Check request path matches route:
```typescript
// Route registered as:
runtime.route.get('/users', handler);

// But request is:
GET /users/ (with trailing slash)  ← Different path!

// Fix: Handle both
runtime.route.get('/users', handler);
runtime.route.get('/users/', handler);

// Or trim trailing slashes
const loggingMiddleware = () => async (ctx, next) => {
  if (ctx.path.endsWith('/') && ctx.path.length > 1) {
    ctx.path = ctx.path.slice(0, -1);  // Remove trailing slash
  }
  return next();
};

runtime.use(loggingMiddleware());
```

### Problem: Parameter routes not matching

**Debug:**

Make sure parameter syntax is correct:
```typescript
// GOOD
runtime.route.get('/users/:id', handler);

// BAD (no colon)
runtime.route.get('/users/id', handler);

// BAD (spaces)
runtime.route.get('/users/: id', handler);
```

Check parameter extraction:
```typescript
runtime.route.get('/users/:id', async (ctx) => {
  console.log('Path:', ctx.path);
  console.log('Params:', ctx.params);
  
  return {
    status: 200,
    body: JSON.stringify({
      path: ctx.path,
      params: ctx.params
    })
  };
});
```

## Middleware Not Running

### Problem: Middleware not being called

**Common mistake:** Registering middleware after routes.

```typescript
// WRONG
runtime.route.get('/', handler);
runtime.use(loggingMiddleware());  // ← Too late!

// CORRECT
runtime.use(loggingMiddleware());
runtime.route.get('/', handler);
```

**Fix:** Always register middleware first.

### Problem: Middleware isn't calling `next()`

```typescript
// WRONG: Never calls next(), so handler never runs
const badMiddleware = () => async (ctx, next) => {
  console.log('Request received');
  return { status: 200, body: 'Intercepted' };  // ← Forgot next()
};

// CORRECT
const goodMiddleware = () => async (ctx, next) => {
  console.log('Request received');
  const response = await next();  // ← Call next()
  console.log('Response status:', response.status);
  return response;
};
```

## Responses Not Being Sent

### Problem: Client receives no response, connection closes

**Likely causes:**
- Handler throws uncaught error
- Handler never returns
- Response validation fails

**Debug:**

Add try-catch and logging:
```typescript
runtime.route.get('/', async (ctx) => {
  try {
    console.log('Handler starting');
    const result = await someAsyncWork();
    console.log('Handler finishing');
    
    return {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Handler error:', error);
    return {
      status: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
});
```

**Solutions:**

Make sure handlers always return:
```typescript
// WRONG: Some paths don't return
runtime.route.get('/data', async (ctx) => {
  if (ctx.query.id) {
    return { status: 200, body: 'Found' };
  }
  // ← Missing return!
});

// CORRECT
runtime.route.get('/data', async (ctx) => {
  if (ctx.query.id) {
    return { status: 200, body: 'Found' };
  }
  return { status: 400, body: 'Missing ID' };
});
```

## JSON Parsing Errors

### Problem: `JSON.parse()` throws on invalid body

**Cause:** Client sent invalid JSON.

**Solution:**

Always validate before parsing:
```typescript
runtime.route.post('/data', async (ctx) => {
  try {
    const data = JSON.parse(ctx.body);
    return { status: 200, body: JSON.stringify({ ok: true }) };
  } catch (error) {
    return {
      status: 400,
      body: JSON.stringify({ error: 'Invalid JSON' })
    };
  }
});
```

## Performance Issues in Production

### Problem: Fast in development, slow in production

**Common causes:**
- Different network latency
- External service (database) is slow
- Not enough resources (CPU/memory)
- Unoptimized queries

**Solutions:**

1. Monitor real metrics:
```bash
curl https://production-server.com/api/health
```

2. Compare p95/p99 between environments
3. Add detailed logging to find bottlenecks
4. Use APM tool (DataDog, New Relic, etc.)

## Getting Help

### Collect This Information

When reporting issues:

1. **Minimal reproduction:**
```typescript
const runtime = new Runtime();
runtime.route.get('/', async (ctx) => ({ status: 200 }));
await runtime.listen(3000);
```

2. **Full error message and stack trace:**
```
Error: ENOENT: no such file or directory, open '/app/file.txt'
    at Object.openSync (fs.js:...)
    at Function.readFileSync (fs.js:...)
    at handler (server.ts:45:20)
```

3. **System information:**
```bash
node --version  # v20.10.0
npm --version   # 10.5.0
uname -a        # Operating system
```

4. **Steps to reproduce**
5. **Expected vs actual behavior**

## Server Health Checklist

Regular monitoring checklist:

```bash
# 1. Is server responsive?
curl http://localhost:3000/health

# 2. Is it ready?
curl http://localhost:3000/ready

# 3. What are the metrics?
curl http://localhost:3000/api/health | jq .

# 4. Are there errors in logs?
tail -f /var/log/app.log

# 5. Is memory growing?
# Compare mem values from metrics endpoint over time

# 6. Is CPU reasonable?
# top or htop to view CPU usage

# 7. Do requests timeout?
time curl http://localhost:3000/api/slow
```

Use these checks as part of your monitoring and alerting setup.
