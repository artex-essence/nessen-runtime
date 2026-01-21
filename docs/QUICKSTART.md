# Quick Start Guide

Get a running server in 5 minutes.

## Installation

```bash
npm install nessen-runtime
```

Requires Node.js 20+.

## Your First Server

Create `server.ts`:

```typescript
import { Runtime } from 'nessen-runtime';

const runtime = new Runtime();

// Define a route
runtime.route.get('/', async (ctx) => ({
  status: 200,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello, World!' })
}));

// Start listening
await runtime.listen(3000);
console.log('Server running at http://localhost:3000');
```

Build and run:

```bash
npx tsc server.ts
node server.js
```

Test it:

```bash
curl http://localhost:3000
# {"message":"Hello, World!"}
```

## Adding More Routes

```typescript
// GET all users
runtime.route.get('/users', async (ctx) => ({
  status: 200,
  body: JSON.stringify([
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ])
}));

// GET one user by ID
runtime.route.get('/users/:id', async (ctx) => ({
  status: 200,
  body: JSON.stringify({ id: ctx.params.id, name: 'User' })
}));

// CREATE a new user
runtime.route.post('/users', async (ctx) => {
  const user = JSON.parse(ctx.body);
  return {
    status: 201,
    body: JSON.stringify({ id: 3, ...user })
  };
});

// DELETE a user
runtime.route.delete('/users/:id', async (ctx) => ({
  status: 204
}));
```

Test creating a user:

```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Charlie"}'
```

## Health Checks

Built-in endpoints for monitoring:

```bash
# Is the server alive?
curl http://localhost:3000/health

# Is it ready for requests?
curl http://localhost:3000/ready

# Full metrics
curl http://localhost:3000/api/health
```

## Graceful Shutdown

Send SIGTERM to gracefully shut down:

```bash
# The server will:
# 1. Stop accepting new requests
# 2. Wait up to 30 seconds for existing requests to complete
# 3. Close and exit
kill -TERM <pid>
```

## Query and Path Parameters

```typescript
// Path parameters: /users/123
runtime.route.get('/users/:userId/posts/:postId', async (ctx) => {
  const { userId, postId } = ctx.params;
  return {
    status: 200,
    body: JSON.stringify({ userId, postId })
  };
});

// Query parameters: /search?q=test&limit=10
runtime.route.get('/search', async (ctx) => {
  const query = ctx.query.q;
  const limit = parseInt(ctx.query.limit || '10');
  return {
    status: 200,
    body: JSON.stringify({ query, limit })
  };
});
```

## Error Handling

```typescript
runtime.route.get('/users/:id', async (ctx) => {
  if (!ctx.params.id.match(/^\d+$/)) {
    return {
      status: 400,
      body: JSON.stringify({ error: 'ID must be numeric' })
    };
  }

  const user = await getUser(ctx.params.id);
  if (!user) {
    return {
      status: 404,
      body: JSON.stringify({ error: 'User not found' })
    };
  }

  return {
    status: 200,
    body: JSON.stringify(user)
  };
});
```

## Adding Middleware

```typescript
import { createLoggingMiddleware } from 'nessen-runtime/middleware/logging';

const runtime = new Runtime();

// Add logging middleware
runtime.use(createLoggingMiddleware());

// Routes must be added AFTER middleware
runtime.route.get('/', handler);

await runtime.listen(3000);
```

## Next Steps

- Read [API Documentation](./API.md) for complete reference
- Review [Middleware Guide](./MIDDLEWARE.md) for built-in middleware
- See [Deployment Guide](./DEPLOYMENT.md) for production setup

## Common Questions

### Where do I put my database code?

```typescript
async function getUser(id: string) {
  // Call your database here
  const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
}

runtime.route.get('/users/:id', async (ctx) => {
  const user = await getUser(ctx.params.id);
  return {
    status: 200,
    body: JSON.stringify(user)
  };
});
```

### How do I send plain text?

```typescript
runtime.route.get('/text', async (ctx) => ({
  status: 200,
  headers: { 'Content-Type': 'text/plain' },
  body: 'Just plain text'
}));
```

### How do I send HTML?

```typescript
runtime.route.get('/page', async (ctx) => ({
  status: 200,
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
  body: '<html><body><h1>Hello</h1></body></html>'
}));
```

### How do I read the request body?

```typescript
runtime.route.post('/data', async (ctx) => {
  // For JSON
  const data = JSON.parse(ctx.body);

  // For plain text
  const text = ctx.body.toString();

  return { status: 200, body: 'OK' };
});
```

### How do I read headers?

```typescript
runtime.route.get('/', async (ctx) => {
  const auth = ctx.headers.authorization;
  const userAgent = ctx.headers['user-agent'];

  return { status: 200, body: 'OK' };
});
```

### How do I set response headers?

```typescript
runtime.route.get('/', async (ctx) => ({
  status: 200,
  headers: {
    'Content-Type': 'application/json',
    'X-Custom-Header': 'value',
    'Cache-Control': 'max-age=3600'
  },
  body: '{"ok":true}'
}));
```

### Can I have async operations in handlers?

Yes! Handlers are async:

```typescript
runtime.route.get('/data', async (ctx) => {
  const data = await fetchFromDatabase();
  const enhanced = await callExternalAPI(data);

  return {
    status: 200,
    body: JSON.stringify(enhanced)
  };
});
```

### What if my handler throws an error?

The runtime catches unhandled errors and returns 500:

```typescript
runtime.route.get('/', async (ctx) => {
  throw new Error('Something went wrong');
  // Runtime will return: { status: 500, body: '...' }
});
```

For expected errors, handle them and return appropriate status:

```typescript
try {
  const data = await risky();
  return { status: 200, body: JSON.stringify(data) };
} catch (error) {
  return { status: 400, body: JSON.stringify({ error: error.message }) };
}
```
