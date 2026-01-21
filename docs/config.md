# Configuration

All configuration options for nessen-runtime.

## Environment Variables

The runtime reads configuration from environment variables:

```bash
PORT=3000                    # Server port (default: 3000)
  maxResponseSize: 10485760,   // 10MB
MAX_BODY_SIZE=1048576        # Max request body in bytes (default: 1MB)
TRUST_PROXY=true             # Trust X-Forwarded-For (default: false)
```

## Configuration Object

### Creating Config

```typescript
import { createConfig } from './src/config.js';

const config = createConfig({
  port: 8080,
  maxBodySize: 5 * 1024 * 1024, // 5MB
  trustProxy: true,
#### `maxResponseSize: number`
 - **Default:** `10485760` (10MB)
 - **Description:** Maximum response payload size; responses larger than this return 500

});
```

  port: 3000,
  host: '0.0.0.0',
  maxBodySize: 1048576,        // 1MB
  maxUrlLength: 8192,          // 8KB
  maxHeaderCount: 100,

### Rate Limiting

#### `rateLimitMaxRequests: number`
- **Default:** `100`
- **Description:** Maximum requests allowed per window per key (IP by default)

#### `rateLimitWindowMs: number`
- **Default:** `60000` (1 minute)
- **Description:** Window duration in milliseconds

#### `rateLimitMaxKeys: number`
- **Default:** `10000`
- **Description:** Maximum distinct keys tracked to bound memory usage

#### `rateLimitCleanupMs: number`
- **Default:** `60000` (1 minute)
- **Description:** Interval for cleaning stale rate-limit buckets

  idleTimeoutMs: 60000,        // 60 seconds
  headersTimeoutMs: 10000,     // 10 seconds
  shutdownTimeoutMs: 30000,    // 30 seconds
  rateLimitMaxRequests: 100,
  rateLimitWindowMs: 60000,

#### `requestIdHeader: string`
- **Default:** `'x-request-id'`
- **Description:** Header name used to read/write request IDs

#### `generateRequestId: boolean`
- **Default:** `true`
- **Description:** Generate a request ID if none is provided by the client
  rateLimitMaxKeys: 10000,
  rateLimitCleanupMs: 60000,
  trustProxy: false,
  requestIdHeader: 'x-request-id',
  generateRequestId: true,
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
}
```

## Options Reference

### Network

#### `port: number`
- **Default:** `3000`
- **Range:** `0 or 1-65535`
- **Description:** TCP port for HTTP server (`0` = ephemeral OS-assigned)
- **Example:** `port: 8080`

#### `host: string`
- **Default:** `'0.0.0.0'`
- **Description:** IP address to bind to
- **Examples:**
  - `'0.0.0.0'` - All interfaces
  - `'127.0.0.1'` - Localhost only
  - `'::0'` - IPv6 all interfaces

### Request Limits

#### `maxBodySize: number`
- **Default:** `1048576` (1MB)
- **Range:** `0-104857600` (100MB max)
- **Description:** Maximum request body size in bytes
- **Examples:**
  - `1024` - 1KB (very small APIs)
  - `1048576` - 1MB (default)
  - `10485760` - 10MB (file uploads)

#### `maxUrlLength: number`
- **Default:** `8192` (8KB)
- **Minimum:** `1024` (1KB)
- **Description:** Maximum URL length (prevents DoS)
- **Example:** `maxUrlLength: 4096`

#### `maxHeaderCount: number`
- **Default:** `100`
- **Minimum:** `10`
- **Description:** Maximum number of HTTP headers
- **Example:** `maxHeaderCount: 50`

#### `maxHeaderSize: number`
- **Default:** `16384` (16KB)
- **Description:** Maximum size of all headers combined
- **Example:** `maxHeaderSize: 8192`

### Timeouts

#### `requestTimeoutMs: number`
- **Default:** `30000` (30 seconds)
- **Minimum:** `1000` (1 second)
- **Description:** Per-request timeout
- **Examples:**
  - `5000` - 5s (fast APIs)
  - `30000` - 30s (default)
  - `60000` - 60s (slow operations)

#### `idleTimeoutMs: number`
- **Default:** `60000` (60 seconds)
- **Description:** Keep-alive timeout for idle connections
- **Example:** `idleTimeoutMs: 30000`

#### `headersTimeoutMs: number`
- **Default:** `10000` (10 seconds)
- **Description:** Timeout for receiving headers
- **Example:** `headersTimeoutMs: 5000`

#### `shutdownTimeoutMs: number`
- **Default:** `30000` (30 seconds)
- **Description:** Graceful shutdown drain timeout
- **Example:** `shutdownTimeoutMs: 60000`

### Security

#### `trustProxy: boolean`
- **Default:** `false`
- **Description:** Whether to trust X-Forwarded-For header
- **Warning:** Only enable behind trusted proxy
- **Example:** `trustProxy: true`

#### `allowedMethods: readonly string[]`
- **Default:** `['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']`
- **Description:** HTTP methods accepted by server
- **Example:** `allowedMethods: ['GET', 'POST']`

## Validation

Configuration is validated on creation:

```typescript
import { validateConfig } from './src/config.js';

try {
  validateConfig(config);
} catch (err) {
  console.error('Invalid config:', err.message);
}
```

### Validation Rules

1. **maxBodySize:**
   - Must be >= 0
   - Must be <= 100MB

2. **maxUrlLength:**
   - Must be >= 1KB

3. **maxHeaderCount:**
   - Must be >= 10

4. **requestTimeoutMs:**
   - Must be >= 1 second

5. **port:**
   - Must be 1-65535

## Usage Examples

### Development

```typescript
const devConfig = createConfig({
  port: 3000,
  host: 'localhost',
  maxBodySize: 10 * 1024 * 1024, // 10MB for testing
  trustProxy: false,
});
```

### Production

```typescript
const prodConfig = createConfig({
  port: parseInt(process.env.PORT || '8080'),
  host: '0.0.0.0',
  maxBodySize: 1048576, // 1MB
  requestTimeoutMs: 30000,
  trustProxy: true, // Behind load balancer
});

validateConfig(prodConfig); // Ensure valid before start
```

### Microservice

```typescript
const apiConfig = createConfig({
  port: 3001,
  maxBodySize: 102400, // 100KB (small JSON payloads)
  requestTimeoutMs: 5000, // 5s (fast responses)
  allowedMethods: ['GET', 'POST'], // API only
});
```

### File Upload Service

```typescript
const uploadConfig = createConfig({
  port: 3002,
  maxBodySize: 50 * 1024 * 1024, // 50MB uploads
  requestTimeoutMs: 120000, // 2 minutes
  idleTimeoutMs: 180000, // 3 minutes
});
```

## Best Practices

### 1. Always Validate
```typescript
const config = createConfig(overrides);
validateConfig(config); // Throws if invalid
```

### 2. Use Environment Variables
```typescript
const config = createConfig({
  port: parseInt(process.env.PORT || '3000'),
  trustProxy: process.env.TRUST_PROXY === 'true',
});
```

### 3. Document Custom Values
```typescript
const config = createConfig({
  maxBodySize: 5242880, // 5MB - file upload service
  requestTimeoutMs: 60000, // 60s - batch processing
});
```

### 4. Separate Dev/Prod
```typescript
const isDev = process.env.NODE_ENV !== 'production';
const config = createConfig({
  port: isDev ? 3000 : 8080,
  trustProxy: !isDev,
});
```

## Related

- [Architecture](./architecture.md) - System design
- [Security](../docs/DEPLOYMENT.md) - Security best practices

