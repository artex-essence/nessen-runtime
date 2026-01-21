# Security Best Practices

How to build secure applications with Nessen Runtime.

## What's Built-in (You Get For Free)

The runtime includes several security protections automatically:

### Request Size Limits

All incoming requests are validated:
- **URL length:** Max 8,192 bytes
- **Body size:** Max 1 MB (configurable)
- **Header size:** Max 16 KB

Requests exceeding these limits are rejected with 413 Payload Too Large.

**Why:** Prevents denial-of-service attacks that consume memory.

### Header Validation

All HTTP headers are validated per RFC 7230:
- No control characters (ASCII 0-31, 127)
- No line breaks (CRLF injection prevention)
- Valid characters only

Invalid headers are rejected with 400 Bad Request.

**Why:** Prevents HTTP response splitting and header injection attacks.

### CRLF Injection Prevention

The runtime rejects headers containing `\r` or `\n`:

```typescript
// This would be rejected
curl -H "X-Custom: value\r\nSet-Cookie: admin=true" http://localhost:3000

// Runtime returns 400
```

**Why:** Prevents attackers from injecting additional HTTP headers into responses.

### Path Validation

Route parameters are validated to prevent directory traversal:

```typescript
// Your route
runtime.route.get('/files/:filename', async (ctx) => {
  // ctx.params.filename is already validated
  const file = await fs.promises.readFile(`/uploads/${ctx.params.filename}`);
  return { status: 200, body: file };
});

// Safe: ../../etc/passwd is URL decoded but doesn't traverse
// Safe: ..%2F..%2Fetc%2Fpasswd (encoded) is also safe
```

**Why:** Prevents attackers from accessing files outside intended directory.

### XSS Prevention for Error Pages

If the runtime generates error pages (e.g., 404), HTML is escaped:

```typescript
// If path is: /search?q=<script>alert('xss')</script>
// Error page will show:
// &lt;script&gt;alert('xss')&lt;/script&gt;
// (Not executable)
```

**Why:** Prevents cross-site scripting attacks in error messages.

## What You Must Do

The runtime provides the foundation, but you're responsible for application security.

### 1. Validate All Input

Always validate data from clients:

```typescript
// BAD: Trusting input directly
runtime.route.post('/users', async (ctx) => {
  const user = JSON.parse(ctx.body);
  await db.query('INSERT INTO users (name, email) VALUES (?, ?)', [user.name, user.email]);
  return { status: 201 };
});

// GOOD: Validate before using
runtime.route.post('/users', async (ctx) => {
  const user = JSON.parse(ctx.body);
  
  // Validate required fields exist
  if (!user.name || !user.email) {
    return { status: 400, body: JSON.stringify({ error: 'Missing fields' }) };
  }
  
  // Validate types
  if (typeof user.name !== 'string' || typeof user.email !== 'string') {
    return { status: 400, body: JSON.stringify({ error: 'Invalid types' }) };
  }
  
  // Validate format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
    return { status: 400, body: JSON.stringify({ error: 'Invalid email' }) };
  }
  
  // Validate length
  if (user.name.length > 100) {
    return { status: 400, body: JSON.stringify({ error: 'Name too long' }) };
  }
  
  await db.query('INSERT INTO users (name, email) VALUES (?, ?)', [user.name, user.email]);
  return { status: 201 };
});
```

**Use validation libraries:**

```typescript
import * as yup from 'yup';

const userSchema = yup.object({
  name: yup.string().required().max(100),
  email: yup.string().required().email()
});

runtime.route.post('/users', async (ctx) => {
  try {
    const user = await userSchema.validate(JSON.parse(ctx.body));
    // user is now validated
  } catch (error) {
    return { status: 400, body: JSON.stringify({ error: error.message }) };
  }
});
```

### 2. Prevent SQL Injection

Never concatenate strings into SQL queries:

```typescript
// BAD: SQL injection vulnerability
const userId = ctx.params.id;
const user = await db.query(`SELECT * FROM users WHERE id = ${userId}`);
// If userId = "1 OR 1=1", returns all users!

// GOOD: Use parameterized queries
const userId = ctx.params.id;
const user = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
```

**All major database drivers support parameterized queries:**

```typescript
// PostgreSQL (pg)
await client.query('SELECT * FROM users WHERE id = $1', [id]);

// MySQL (mysql2)
await connection.query('SELECT * FROM users WHERE id = ?', [id]);

// MongoDB (parameterized via filters)
await collection.findOne({ _id: ObjectId(id) });

// SQLite
await db.get('SELECT * FROM users WHERE id = ?', [id]);
```

### 3. Authenticate Requests

Verify user identity before processing requests:

```typescript
import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET;

const authMiddleware = () => async (ctx, next) => {
  const token = ctx.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return {
      status: 401,
      body: JSON.stringify({ error: 'Missing token' })
    };
  }
  
  try {
    const payload = jwt.verify(token, secret);
    ctx.metadata.userId = payload.userId;  // Store for handler
    return await next();
  } catch (error) {
    return {
      status: 401,
      body: JSON.stringify({ error: 'Invalid token' })
    };
  }
};

runtime.use(authMiddleware());

runtime.route.get('/profile', async (ctx) => {
  const userId = ctx.metadata.userId;  // From auth middleware
  const user = await getUser(userId);
  return { status: 200, body: JSON.stringify(user) };
});
```

### 4. Authorize Requests

Verify user has permission for the operation:

```typescript
const authMiddleware = () => async (ctx, next) => {
  // Verify token and get user
  const userId = verifyToken(ctx.headers.authorization);
  ctx.metadata.userId = userId;
  return await next();
};

const authzMiddleware = () => async (ctx, next) => {
  // Check if user is admin
  if (ctx.path.startsWith('/admin/')) {
    const isAdmin = await checkAdminStatus(ctx.metadata.userId);
    if (!isAdmin) {
      return {
        status: 403,
        body: JSON.stringify({ error: 'Admin access required' })
      };
    }
  }
  return await next();
};

runtime.use(authMiddleware());
runtime.use(authzMiddleware());

// Only admins can access this
runtime.route.get('/admin/users', async (ctx) => {
  const users = await getAllUsers();
  return { status: 200, body: JSON.stringify(users) };
});
```

### 5. Don't Log Sensitive Data

Passwords, tokens, and secrets shouldn't appear in logs:

```typescript
// BAD: Password in logs
const loggingMiddleware = () => async (ctx, next) => {
  console.log('Body:', ctx.body);  // ← Logs passwords!
  return await next();
};

// GOOD: Sanitize before logging
const loggingMiddleware = () => async (ctx, next) => {
  const body = JSON.parse(ctx.body);
  delete body.password;  // Remove sensitive field
  console.log('Body:', body);
  return await next();
};
```

**Use structured logging:**

```typescript
import pino from 'pino';

const logger = pino({
  redact: {
    paths: ['body.password', 'body.token', 'headers.authorization'],
    remove: true  // Remove instead of redact
  }
});

const loggingMiddleware = () => async (ctx, next) => {
  logger.info({
    method: ctx.method,
    path: ctx.path,
    body: JSON.parse(ctx.body)
  });
  return await next();
};
```

### 6. Use HTTPS in Production

Always use HTTPS (TLS) in production:

**Behind a load balancer:**
```
Client → HTTPS → Nginx → HTTP → Your App
```

The load balancer handles HTTPS, your app uses HTTP.

**Standalone (if needed):**
```typescript
import https from 'https';
import fs from 'fs';

const cert = fs.readFileSync('/etc/ssl/certs/cert.pem');
const key = fs.readFileSync('/etc/ssl/private/key.pem');

const server = https.createServer({ cert, key }, handler);
server.listen(443);
```

**Never disable HTTPS headers:**
```typescript
runtime.route.get('/', async (ctx) => {
  return {
    status: 200,
    headers: {
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    },
    body: 'Secure'
  };
});
```

### 7. Rate Limiting

Limit requests per user to prevent abuse:

```typescript
import { createRateLimitMiddleware } from 'nessen-runtime/middleware/rateLimit';

runtime.use(createRateLimitMiddleware({
  maxRequests: 100,    // 100 requests
  windowMs: 900000     // per 15 minutes
}));

// Optional: Per-user limiting (store in cache/Redis)
const userRateLimits = new Map();

const userRateLimitMiddleware = () => async (ctx, next) => {
  const userId = ctx.metadata.userId;  // From auth middleware
  
  if (!userId) {
    return await next();  // Skip if not authenticated
  }
  
  const key = `limit:${userId}`;
  const current = userRateLimits.get(key) || 0;
  const limit = 1000;  // 1000 requests per user
  
  if (current >= limit) {
    return {
      status: 429,
      body: JSON.stringify({ error: 'Rate limit exceeded' })
    };
  }
  
  userRateLimits.set(key, current + 1);
  return await next();
};

runtime.use(userRateLimitMiddleware());
```

### 8. Protect Against CSRF

For form submissions, use CSRF tokens:

```typescript
import crypto from 'crypto';

const csrfTokens = new Map();

// Issue token
runtime.route.get('/form', async (ctx) => {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.set(token, Date.now());  // Store with timestamp
  
  return {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
    body: `<form action="/submit" method="POST">
      <input type="hidden" name="csrf" value="${token}">
      <input type="text" name="data">
      <button>Submit</button>
    </form>`
  };
});

// Verify token
runtime.route.post('/submit', async (ctx) => {
  const { csrf, data } = JSON.parse(ctx.body);
  
  if (!csrfTokens.has(csrf)) {
    return { status: 403, body: JSON.stringify({ error: 'CSRF token invalid' }) };
  }
  
  // Token is valid, process request
  csrfTokens.delete(csrf);
  
  return { status: 200, body: JSON.stringify({ ok: true }) };
});
```

### 9. Set Security Headers

Include security headers in all responses:

```typescript
const securityHeadersMiddleware = () => async (ctx, next) => {
  const response = await next();
  
  return {
    ...response,
    headers: {
      ...response.headers,
      // Prevent MIME type sniffing
      'X-Content-Type-Options': 'nosniff',
      // Prevent clickjacking
      'X-Frame-Options': 'DENY',
      // Prevent XSS (older browsers)
      'X-XSS-Protection': '1; mode=block',
      // Referrer policy
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      // Permissions policy
      'Permissions-Policy': 'geolocation=(), camera=(), microphone=()'
    }
  };
};

runtime.use(securityHeadersMiddleware());
```

### 10. Error Handling

Don't leak information in error responses:

```typescript
// BAD: Leaks database schema
runtime.route.get('/user/:id', async (ctx) => {
  try {
    return await db.query('SELECT * FROM users WHERE id = ?', [ctx.params.id]);
  } catch (error) {
    return {
      status: 500,
      body: JSON.stringify({ error: error.message })  // ← Leaks info!
    };
  }
});

// GOOD: Generic error message
runtime.route.get('/user/:id', async (ctx) => {
  try {
    return await db.query('SELECT * FROM users WHERE id = ?', [ctx.params.id]);
  } catch (error) {
    console.error('Database error:', error);  // Log internally
    return {
      status: 500,
      body: JSON.stringify({ error: 'Internal server error' })  // Generic
    };
  }
});
```

## Environment Variables

Store secrets in environment variables, never in code:

```typescript
// BAD: Secret in source code
const secret = 'my-secret-key-12345';

// GOOD: From environment
const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error('JWT_SECRET environment variable is required');
}
```

**Set in production:**
```bash
# Docker
ENV JWT_SECRET=production-secret-xyz

# Kubernetes
kubectl set env deployment/app JWT_SECRET=production-secret-xyz

# Systemd service
Environment="JWT_SECRET=production-secret-xyz"

# .env file (development only)
JWT_SECRET=development-secret
```

## Dependencies

Regularly update dependencies for security patches:

```bash
# Check for vulnerabilities
npm audit

# Update packages
npm update

# Update major versions (if security-critical)
npm install package@latest
```

## Secrets Management

For production, use a secrets manager:

- **AWS:** Secrets Manager or Parameter Store
- **GCP:** Secret Manager
- **Azure:** Key Vault
- **Kubernetes:** Secrets
- **HashiCorp:** Vault

```typescript
// Example: AWS Secrets Manager
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManager();
const secret = await client.getSecretValue({ SecretId: 'jwt-secret' });
const jwtSecret = JSON.parse(secret.SecretString).value;
```

## Regular Audits

Schedule regular security reviews:

1. **Monthly:** Run `npm audit` and fix vulnerabilities
2. **Quarterly:** Review access logs for suspicious activity
3. **Annually:** Full security audit (code review, penetration testing)

## Reporting Security Issues

If you find a vulnerability in Nessen Runtime:

1. **Don't** open a public issue
2. Email security details privately
3. Allow time for fix and release
4. Responsible disclosure

Look for SECURITY.md in the repository for contact information.

## Checklist

Use this checklist when deploying:

- [ ] All input is validated
- [ ] SQL injection is prevented (parameterized queries)
- [ ] CSRF protection is in place
- [ ] Authentication middleware is enabled
- [ ] Authorization checks are in place
- [ ] No sensitive data in logs
- [ ] HTTPS is enabled
- [ ] Security headers are set
- [ ] Rate limiting is configured
- [ ] Error messages are generic
- [ ] Secrets are in environment variables
- [ ] Dependencies are up-to-date
- [ ] Monitoring/alerting is configured
- [ ] Database backups exist
- [ ] Incident response plan is documented
