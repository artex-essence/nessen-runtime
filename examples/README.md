# Examples

Example applications demonstrating nessen-runtime usage patterns.

## Basic Server

**File:** [basic-server.ts](./basic-server.ts)

Shows how to embed the runtime in your application with proper signal handling.

```bash
# Compile and run
npm run build
node examples/basic-server.js
```

Features:
- ✅ Proper signal handling (SIGTERM, SIGINT)
- ✅ Graceful shutdown
- ✅ Request/response translation
- ✅ Error handling

## Custom Middleware

**File:** [custom-middleware.ts](./custom-middleware.ts)

Demonstrates creating custom middleware for:
- Authentication (API key validation)
- Request ID verification
- IP allowlist filtering

```typescript
runtime.extendPipeline(authMiddleware);
runtime.extendPipeline(requestIdMiddleware);
runtime.extendPipeline(ipFilterMiddleware(['127.0.0.1']));
```

## Running Examples

### 1. Build the project

```bash
npm run build
```

### 2. Run an example

```bash
# Basic server
node dist/examples/basic-server.js

# Custom middleware
node dist/examples/custom-middleware.js
```

### 3. Test the server

```bash
# Health check
curl http://localhost:3000/health

# API endpoint
curl http://localhost:3000/api/health

# Home page
curl http://localhost:3000/
```

## Patterns

### Library vs App

**Library usage** (embedded):
```typescript
import { Runtime } from 'nessen-runtime';

const runtime = new Runtime();
// Don't call process.exit() - let caller decide
```

**App usage** (standalone):
```typescript
import { startServer } from 'nessen-runtime';

startServer(); // Handles signals and exits
```

### Custom Routes

```typescript
runtime.route.get('/api/users/:id', async (ctx) => {
  const userId = ctx.params.id;
  
  // Check cancellation
  if (ctx.abortSignal?.aborted) {
    return { statusCode: 499, body: 'Cancelled' };
  }
  
  const user = await fetchUser(userId);
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(user),
  };
});
```

### Configuration

```typescript
import { createConfig, validateConfig } from 'nessen-runtime';

const config = createConfig({
  port: 8080,
  maxBodySize: 5 * 1024 * 1024, // 5MB
  trustProxy: true,
});

validateConfig(config);
```

## Next Steps

- Read [Architecture](../docs/ARCHITECTURE_DETAILED.md) for internals
- See [API Documentation](../docs/API.md) for full reference
- Check [BENCHMARKS.md](../BENCHMARKS.md) for performance

