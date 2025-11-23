# SEO Shield Proxy

A production-ready Node.js reverse proxy that solves SEO problems for Single Page Applications (SPAs) without modifying client-side code. It detects bots, renders pages server-side using Puppeteer, and serves static HTML to crawlers while transparently proxying human users to your SPA.

## Features

- **Bot Detection**: Automatically detects search engine crawlers and social media bots using `isbot`
- **Server-Side Rendering**: Renders SPA pages with Puppeteer for bot traffic
- **Transparent Proxying**: Human users are proxied directly to your SPA without any delay
- **Flexible Cache Rules**: Pattern-based caching with URL regex support and SPA meta tag control
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
      # Cache rules (optional)
      - NO_CACHE_PATTERNS=/checkout,/cart,/admin/*,/api/*
      - CACHE_BY_DEFAULT=true
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

### Basic Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TARGET_URL` | ✅ Yes | - | URL of your SPA (e.g., `https://my-app.com`) |
| `PORT` | No | `8080` | Port the proxy server listens on |
| `CACHE_TTL` | No | `3600` | Cache time-to-live in seconds (1 hour) |
| `PUPPETEER_TIMEOUT` | No | `30000` | Maximum rendering time in milliseconds |
| `NODE_ENV` | No | `production` | Environment mode |

### Cache Rules Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NO_CACHE_PATTERNS` | No | `''` | Comma-separated URL patterns to NEVER cache (see below) |
| `CACHE_PATTERNS` | No | `''` | Comma-separated URL patterns to cache (whitelist mode) |
| `CACHE_BY_DEFAULT` | No | `true` | Cache everything by default when no pattern matches |
| `CACHE_META_TAG` | No | `x-seo-shield-cache` | Meta tag name for dynamic cache control |

## Cache Rules

The proxy supports flexible caching strategies to handle different types of pages. You can control caching through:

### 1. URL Pattern Matching

#### NO_CACHE_PATTERNS
URLs matching these patterns will **NEVER** be cached or rendered. They will be proxied directly to your SPA, even for bots. Perfect for:
- Checkout/payment pages: `/checkout`, `/cart`, `/payment/*`
- Admin panels: `/admin/*`, `/dashboard/*`
- API endpoints: `/api/*`
- User-specific pages: `/user/*/settings`, `/profile/edit`

**Examples:**
```bash
# Literal paths
NO_CACHE_PATTERNS=/checkout,/cart,/login

# Wildcards (*)
NO_CACHE_PATTERNS=/admin/*,/api/*,/user/*/settings

# Regex (wrap in /.../)
NO_CACHE_PATTERNS=/\/blog\/[0-9]+\/edit/,/\/admin\/.*/
```

#### CACHE_PATTERNS
If specified, **ONLY** these URL patterns will be cached (whitelist mode). Useful for:
- Blog posts: `/blog/*`, `/posts/*`
- Product pages: `/products/*`, `/category/*`
- Static pages: `/about`, `/contact`, `/help`

**Examples:**
```bash
# Cache only blog and product pages
CACHE_PATTERNS=/blog/*,/products/*,/category/*

# Cache specific static pages
CACHE_PATTERNS=/about,/contact,/privacy,/terms
```

#### CACHE_BY_DEFAULT
Controls behavior when URL doesn't match any pattern:
- `true` (default): Cache everything except NO_CACHE_PATTERNS
- `false`: Cache nothing except CACHE_PATTERNS

**Use cases:**
```bash
# Content site - cache everything except admin
CACHE_BY_DEFAULT=true
NO_CACHE_PATTERNS=/admin/*,/api/*

# E-commerce - cache only product pages
CACHE_BY_DEFAULT=false
CACHE_PATTERNS=/products/*,/category/*
NO_CACHE_PATTERNS=/checkout,/cart
```

### 2. Meta Tag Control (Dynamic)

Your SPA can dynamically control caching by adding a meta tag:

```html
<!-- Prevent caching for this specific page -->
<meta name="x-seo-shield-cache" content="false">

<!-- Explicitly allow caching (default behavior) -->
<meta name="x-seo-shield-cache" content="true">
```

**Perfect for:**
- User-specific content that varies by session
- Pages with real-time data
- A/B testing scenarios
- Personalized recommendations

**React Example:**
```jsx
function UserDashboard() {
  return (
    <Helmet>
      <meta name="x-seo-shield-cache" content="false" />
    </Helmet>
  );
}
```

**Vue Example:**
```vue
<template>
  <div>
    <vue-meta>
      <meta name="x-seo-shield-cache" content="false" />
    </vue-meta>
  </div>
</template>
```

### 3. Priority Order

The cache decision follows this priority:

1. **NO_CACHE_PATTERNS** (highest priority)
   - If URL matches → Proxy directly, no SSR
2. **Meta Tag Check** (after rendering)
   - If `<meta name="x-seo-shield-cache" content="false">` → Don't cache
3. **CACHE_PATTERNS** (if defined)
   - If URL matches → Cache
   - If URL doesn't match → Use CACHE_BY_DEFAULT
4. **CACHE_BY_DEFAULT** (lowest priority)
   - If true → Cache
   - If false → Don't cache

### 4. Real-World Examples

#### E-commerce Site
```bash
TARGET_URL=https://myshop.com
NO_CACHE_PATTERNS=/checkout,/cart,/payment/*,/account/*,/api/*
CACHE_PATTERNS=/products/*,/category/*,/blog/*
CACHE_BY_DEFAULT=false
```

#### Blog/Content Site
```bash
TARGET_URL=https://myblog.com
NO_CACHE_PATTERNS=/admin/*,/wp-admin/*,/api/*
CACHE_BY_DEFAULT=true
```

#### SaaS Application
```bash
TARGET_URL=https://myapp.com
NO_CACHE_PATTERNS=/app/*,/dashboard/*,/api/*,/auth/*
CACHE_PATTERNS=/,/pricing,/features,/about,/blog/*
CACHE_BY_DEFAULT=false
```

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
│   ├── cache-rules.js # Flexible URL pattern matching
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
3. **cache-rules.js**: Implements flexible caching logic with URL patterns and meta tag detection
4. **browser.js**: Singleton Puppeteer browser manager with resource blocking
5. **server.js**: Express application with bot detection and routing logic

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
