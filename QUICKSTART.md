# Quick Start Guide

## Installation & Build

```bash
cd /Users/james/Development/Node/nessen/runtume

# Install dependencies (if needed)
npm install

# Build
npm run build

# Start server
npm start
```

## Test All Routes

Open a new terminal and run:

```bash
# Home page
curl http://localhost:3000/

# Health API (detailed metrics)
curl http://localhost:3000/api/health

# Readiness check
curl http://localhost:3000/ready

# Liveness check
curl http://localhost:3000/health

# Badge generator
curl http://localhost:3000/badge/status/operational.svg
curl http://localhost:3000/badge/node/v20.svg
curl http://localhost:3000/badge/build/passing.svg
```

## Run with Custom Settings

```bash
# Custom port
PORT=8080 npm start

# With base path
BASE_PATH=/api npm start

# Development mode (show stack traces)
DEV_MODE=1 npm start

# Combined
PORT=8080 BASE_PATH=/node DEV_MODE=1 npm start
```

## Test Graceful Shutdown

```bash
# Start server
npm start &
PID=$!

# Wait a moment
sleep 2

# Send shutdown signal
kill -SIGTERM $PID

# Watch the graceful drain process
# Should see: "Draining..." messages then "Shutdown complete"
```

## View Logs

```bash
# If running in background
tail -f /tmp/nessen-server.log
```

## Load Testing (Optional)

```bash
# Using Apache Bench (if installed)
ab -n 10000 -c 100 http://localhost:3000/

# Using curl in a loop
for i in {1..100}; do
  curl -s http://localhost:3000/api/health > /dev/null &
done
wait
```

## Verify Build

```bash
# Type check only (no compilation)
npm run typecheck

# Clean and rebuild
npm run clean
npm run build
```

## Environment Variables Reference

```bash
export PORT=3000              # Server port (default: 3000)
export HOST=0.0.0.0          # Bind address (default: 0.0.0.0)
export BASE_PATH=/           # URL prefix (default: /)
export DEV_MODE=0            # Debug mode (default: 0)
export MAX_BODY_SIZE=1048576 # Max body bytes (default: 1MB)
```

## Common Operations

### Stop Server
```bash
# Find process
ps aux | grep "node dist/server.js"

# Kill gracefully
kill -SIGTERM <PID>

# Force kill (not recommended)
kill -9 <PID>
```

### Check Server Status
```bash
# Quick health check
curl -f http://localhost:3000/ready && echo "✓ Ready" || echo "✗ Not ready"

# Detailed status
curl -s http://localhost:3000/api/health | python3 -m json.tool
```

### Monitor Performance
```bash
# Watch health endpoint every 2 seconds
watch -n 2 'curl -s http://localhost:3000/api/health | python3 -m json.tool'
```

## Troubleshooting

### Port Already in Use
```bash
# Find what's using port 3000
lsof -i :3000

# Kill it
kill -9 $(lsof -t -i :3000)

# Or use a different port
PORT=3001 npm start
```

### Build Errors
```bash
# Clean and rebuild
npm run clean
rm -rf node_modules
npm install
npm run build
```

### Server Won't Start
```bash
# Check TypeScript compilation
npm run typecheck

# Check for syntax errors
npm run build 2>&1 | grep error

# Verify Node.js version (needs v20+)
node --version
```

## Production Deployment

```bash
# Build for production
npm run build

# Run with production settings
NODE_ENV=production PORT=8080 node dist/server.js

# Or use process manager (pm2)
npm install -g pm2
pm2 start dist/server.js --name nessen-runtime

# View logs
pm2 logs nessen-runtime

# Restart
pm2 restart nessen-runtime

# Stop
pm2 stop nessen-runtime
```

## Docker (Optional)

Create a `Dockerfile`:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

Build and run:

```bash
docker build -t nessen-runtime .
docker run -p 3000:3000 nessen-runtime
```

## Kubernetes Readiness/Liveness Probes

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```
