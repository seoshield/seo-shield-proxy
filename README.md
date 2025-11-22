# SEO Shield Proxy

A production-ready Node.js reverse proxy that solves SEO problems for Single Page Applications (SPAs) without modifying client-side code. It detects bots, renders pages server-side using Puppeteer, and serves static HTML to crawlers while transparently proxying human users to your SPA.

## Features

- **Bot Detection**: Automatically detects search engine crawlers and social media bots using `isbot`
- **Server-Side Rendering**: Renders SPA pages with Puppeteer for bot traffic
- **Transparent Proxying**: Human users are proxied directly to your SPA without any delay
- **Smart Caching**: In-memory caching with configurable TTL to minimize rendering overhead
- **Performance Optimized**: Blocks unnecessary resources (images, fonts, stylesheets) during rendering
- **Production Ready**: Includes health checks, graceful shutdown, and comprehensive error handling
- **Docker Support**: Official Puppeteer base image with all Chrome dependencies included

## How It Works

```
┌─────────────┐
│   Request   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Bot Detection  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌─────────┐
│  Bot  │ │  Human  │
└───┬───┘ └────┬────┘
    │          │
    ▼          ▼
┌─────────┐ ┌──────────┐
│  Cache  │ │  Proxy   │
│  Check  │ │ Direct   │
└────┬────┘ └──────────┘
     │
  ┌──┴──┐
  │     │
  ▼     ▼
┌───┐ ┌──────────┐
│Hit│ │Puppeteer │
│   │ │ Render   │
└───┘ └────┬─────┘
           │
           ▼
      ┌────────┐
      │ Cache  │
      │ & Send │
      └────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+ (for local development)
- Docker (for containerized deployment)

### Local Development

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo>
   cd seo-shield-proxy
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env and set TARGET_URL to your SPA URL
   ```

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Test the proxy:**
   ```bash
   # Human user (will be proxied)
   curl http://localhost:8080/

   # Bot user (will be rendered)
   curl -A "Googlebot" http://localhost:8080/
   ```

### Docker Deployment

1. **Build the image:**
   ```bash
   docker build -t seo-shield-proxy .
   ```

2. **Run the container:**
   ```bash
   docker run -d \
     -p 8080:8080 \
     -e TARGET_URL=https://your-spa-app.com \
     -e CACHE_TTL=3600 \
     --name seo-proxy \
     seo-shield-proxy
   ```

3. **Check health:**
   ```bash
   curl http://localhost:8080/health
   ```

### Docker Compose

Create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  seo-proxy:
    build: .
    ports:
      - "8080:8080"
    environment:
      - TARGET_URL=https://your-spa-app.com
      - CACHE_TTL=3600
      - PUPPETEER_TIMEOUT=30000
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

Then run:
```bash
docker-compose up -d
```

## Configuration

All configuration is done via environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TARGET_URL` | ✅ Yes | - | URL of your SPA (e.g., `https://my-app.com`) |
| `PORT` | No | `8080` | Port the proxy server listens on |
| `CACHE_TTL` | No | `3600` | Cache time-to-live in seconds (1 hour) |
| `PUPPETEER_TIMEOUT` | No | `30000` | Maximum rendering time in milliseconds |
| `NODE_ENV` | No | `production` | Environment mode |

## API Endpoints

### `GET /health`
Health check endpoint that returns server status and cache statistics.

**Response:**
```json
{
  "status": "ok",
  "uptime": 12345.67,
  "cache": {
    "keys": 42,
    "hits": 150,
    "misses": 10,
    "hitRate": 0.9375
  },
  "config": {
    "targetUrl": "https://your-spa-app.com",
    "cacheTtl": 3600,
    "puppeteerTimeout": 30000
  }
}
```

### `POST /cache/clear`
Clears all cached rendered pages.

**Response:**
```json
{
  "status": "ok",
  "message": "Cache cleared successfully"
}
```

## Architecture

### File Structure

```
seo-shield-proxy/
├── src/
│   ├── config.js      # Configuration management
│   ├── cache.js       # In-memory caching layer
│   ├── browser.js     # Puppeteer singleton manager
│   └── server.js      # Express server & middleware
├── Dockerfile         # Production container
├── .dockerignore      # Docker build exclusions
├── .env.example       # Environment template
├── package.json       # Dependencies
└── README.md          # This file
```

### Core Components

1. **config.js**: Loads and validates environment variables
2. **cache.js**: Manages in-memory cache with TTL using `node-cache`
3. **browser.js**: Singleton Puppeteer browser manager with resource blocking
4. **server.js**: Express application with bot detection and routing logic

## Performance Optimizations

1. **Resource Blocking**: Images, stylesheets, fonts, and media are blocked during rendering to speed up page load
2. **Browser Singleton**: Single Puppeteer browser instance is reused across all requests
3. **Network Idle Strategy**: Waits for `networkidle0` to ensure all API calls complete
4. **Smart Caching**: Frequently accessed pages are cached to avoid repeated rendering
5. **Direct Proxying**: Human traffic is proxied without any SSR overhead

## Error Handling & Resilience

- **Fallback to Proxy**: If Puppeteer rendering fails, the request is proxied to the origin
- **Page Cleanup**: Browser pages are always closed, even on errors, to prevent memory leaks
- **Graceful Shutdown**: SIGTERM/SIGINT handlers ensure clean browser closure
- **Timeout Protection**: Configurable timeout prevents hanging renders

## Monitoring & Debugging

### View Logs
```bash
# Docker
docker logs -f seo-proxy

# Local
npm start
```

### Log Format
- `📥` Incoming request
- `👤` Human user detected
- `🤖` Bot detected
- `✅` Cache hit
- `❌` Cache miss
- `🎨` Rendering with Puppeteer
- `🚀` Serving cached HTML
- `⚠️` Warning/Error

### Cache Statistics
```bash
curl http://localhost:8080/health | jq '.cache'
```

## Deployment Considerations

### Production Checklist

- [ ] Set `TARGET_URL` to your production SPA URL
- [ ] Configure appropriate `CACHE_TTL` based on content update frequency
- [ ] Set up monitoring for `/health` endpoint
- [ ] Configure load balancer timeout > `PUPPETEER_TIMEOUT`
- [ ] Allocate sufficient memory (recommend 1GB+ for Puppeteer)
- [ ] Set up automated cache clearing if content updates frequently

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: seo-shield-proxy
spec:
  replicas: 2
  selector:
    matchLabels:
      app: seo-proxy
  template:
    metadata:
      labels:
        app: seo-proxy
    spec:
      containers:
      - name: seo-proxy
        image: seo-shield-proxy:latest
        ports:
        - containerPort: 8080
        env:
        - name: TARGET_URL
          value: "https://your-spa-app.com"
        - name: CACHE_TTL
          value: "3600"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 40
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 5
```

### Cloud Platform Deployment

#### AWS Elastic Beanstalk
```bash
eb init -p docker seo-shield-proxy
eb create production-env
eb setenv TARGET_URL=https://your-spa-app.com
```

#### Google Cloud Run
```bash
gcloud builds submit --tag gcr.io/PROJECT-ID/seo-shield-proxy
gcloud run deploy seo-shield-proxy \
  --image gcr.io/PROJECT-ID/seo-shield-proxy \
  --platform managed \
  --set-env-vars TARGET_URL=https://your-spa-app.com
```

#### Azure Container Instances
```bash
az container create \
  --resource-group myResourceGroup \
  --name seo-shield-proxy \
  --image seo-shield-proxy:latest \
  --dns-name-label seo-proxy \
  --ports 8080 \
  --environment-variables TARGET_URL=https://your-spa-app.com
```

## Troubleshooting

### Issue: Puppeteer timeouts
**Solution**: Increase `PUPPETEER_TIMEOUT` or optimize your SPA's loading time

### Issue: High memory usage
**Solution**:
- Ensure pages are being closed properly (check logs)
- Reduce `CACHE_TTL` to cache fewer pages
- Scale horizontally instead of vertically

### Issue: Bot not detected
**Solution**: Check the user agent string. Update `isbot` library: `npm update isbot`

### Issue: Proxy not forwarding requests
**Solution**: Verify `TARGET_URL` is correct and reachable from the container

### Issue: Docker build fails
**Solution**: Ensure you're using the official Puppeteer base image which includes Chrome

## Testing

### Test Bot Detection
```bash
# Test with Googlebot
curl -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
  http://localhost:8080/

# Test with real user
curl -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0" \
  http://localhost:8080/
```

### Verify Caching
```bash
# First request (cache miss)
time curl -A "Googlebot" http://localhost:8080/ > /dev/null

# Second request (cache hit - should be faster)
time curl -A "Googlebot" http://localhost:8080/ > /dev/null
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - feel free to use this in your projects.

## Support

For issues and questions, please open an issue on GitHub.
