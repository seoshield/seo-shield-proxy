# Configuration Reference

## Overview

SEO Shield Proxy is configured through environment variables. All settings can be defined in a `.env` file in the project root or passed directly as environment variables.

## Quick Start

Copy the example configuration:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```bash
# Required
TARGET_URL=https://your-spa.com

# Optional (defaults shown)
PORT=8080
API_PORT=3190
CACHE_TYPE=memory
CACHE_TTL=3600
```

## Environment Variables

### Server Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PORT` | number | `8080` | Main proxy server port |
| `API_PORT` | number | `3190` | Admin API server port |
| `NODE_ENV` | string | `production` | Environment mode (`development`, `production`, `test`) |

**Example:**

```bash
PORT=8080
API_PORT=3190
NODE_ENV=production
```

### Target Application

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `TARGET_URL` | string | **Required** | URL of your SPA to proxy |

**Example:**

```bash
TARGET_URL=https://your-spa.com
TARGET_URL=http://localhost:3000
```

### Cache Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `CACHE_TYPE` | string | `memory` | Cache backend (`memory` or `redis`) |
| `CACHE_TTL` | number | `3600` | Cache time-to-live in seconds |
| `REDIS_URL` | string | `redis://localhost:6379` | Redis connection URL |

**Example:**

```bash
# Development (memory cache)
CACHE_TYPE=memory
CACHE_TTL=3600

# Production (Redis cache)
CACHE_TYPE=redis
REDIS_URL=redis://redis:6379
CACHE_TTL=7200
```

### Cache Patterns

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `NO_CACHE_PATTERNS` | string | (empty) | Comma-separated URL patterns to never cache |
| `CACHE_PATTERNS` | string | (empty) | Comma-separated URL patterns to always cache |
| `CACHE_BY_DEFAULT` | boolean | `true` | Cache all URLs by default |
| `CACHE_META_TAG` | string | `x-seo-shield-cache` | Meta tag name for cache control |

**Example:**

```bash
# Never cache these patterns
NO_CACHE_PATTERNS=/checkout,/cart,/admin/*,/api/*

# Always cache these patterns (if CACHE_BY_DEFAULT=false)
CACHE_PATTERNS=/products/*,/blog/*,/pages/*

# Default behavior
CACHE_BY_DEFAULT=true

# Custom meta tag name
CACHE_META_TAG=x-seo-shield-cache
```

**Pattern matching:**

- `*` matches any characters
- Patterns are matched against URL path
- `NO_CACHE_PATTERNS` takes precedence over `CACHE_PATTERNS`

### Database Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MONGODB_URL` | string | `mongodb://localhost:27017` | MongoDB connection URL |
| `MONGODB_DB_NAME` | string | `seo_shield_proxy` | Database name |

**Example:**

```bash
# Local development
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=seo_shield_proxy

# Production with authentication
MONGODB_URL=mongodb://user:pass@mongo-cluster:27017
MONGODB_DB_NAME=seo_shield_prod
```

### Authentication

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `ADMIN_PASSWORD` | string | `admin123` | Admin dashboard password |
| `JWT_SECRET` | string | (default) | Secret for JWT token signing |

**Example:**

```bash
ADMIN_PASSWORD=your-secure-password-here
JWT_SECRET=your-very-long-random-secret-key-for-production
```

**Security Note:** Always change these values in production!

### Puppeteer Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PUPPETEER_TIMEOUT` | number | `30000` | Render timeout in milliseconds |
| `MAX_CONCURRENT_RENDERS` | number | `5` | Maximum simultaneous renders |
| `USER_AGENT` | string | (default) | User agent for SSR requests |

**Example:**

```bash
PUPPETEER_TIMEOUT=30000
MAX_CONCURRENT_RENDERS=5
USER_AGENT=Mozilla/5.0 (compatible; SEOShieldProxy/1.0)
```

**Concurrency guidelines:**

| Server RAM | Recommended `MAX_CONCURRENT_RENDERS` |
|------------|-------------------------------------|
| 2 GB | 2-3 |
| 4 GB | 5 (default) |
| 8 GB | 8-10 |
| 16 GB | 15-20 |

## Configuration by Environment

### Development

```bash
# .env (development)
PORT=8080
API_PORT=3190
TARGET_URL=http://localhost:3000
NODE_ENV=development

# Use memory cache for simplicity
CACHE_TYPE=memory
CACHE_TTL=300

# Local MongoDB
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=seo_shield_dev

# Default credentials (OK for development)
ADMIN_PASSWORD=admin123

# Lower concurrency for development machines
MAX_CONCURRENT_RENDERS=3
PUPPETEER_TIMEOUT=30000
```

### Production

```bash
# .env (production)
PORT=8080
API_PORT=3190
TARGET_URL=https://your-production-spa.com
NODE_ENV=production

# Use Redis for persistence and scalability
CACHE_TYPE=redis
REDIS_URL=redis://redis-service:6379
CACHE_TTL=3600

# Production MongoDB
MONGODB_URL=mongodb://mongo-user:secure-pass@mongo-cluster:27017
MONGODB_DB_NAME=seo_shield_prod

# Secure credentials (CHANGE THESE!)
ADMIN_PASSWORD=super-secure-admin-password-123!
JWT_SECRET=your-256-bit-random-secret-key-here

# Higher concurrency for production
MAX_CONCURRENT_RENDERS=10
PUPPETEER_TIMEOUT=30000

# Cache patterns
NO_CACHE_PATTERNS=/checkout,/cart,/api/*,/admin/*
CACHE_BY_DEFAULT=true
```

### Docker

```bash
# .env.docker
PORT=8080
API_PORT=3190
TARGET_URL=http://demo-spa:3000
NODE_ENV=production

CACHE_TYPE=redis
REDIS_URL=redis://redis:6379
CACHE_TTL=3600

MONGODB_URL=mongodb://mongodb:27017
MONGODB_DB_NAME=seo_shield_proxy

ADMIN_PASSWORD=admin123
JWT_SECRET=seo-shield-jwt-secret-change-in-production

MAX_CONCURRENT_RENDERS=5
PUPPETEER_TIMEOUT=30000
```

## Meta Tag Configuration

### Cache Control via Meta Tags

You can control caching behavior for individual pages using meta tags:

```html
<!-- Force cache this page -->
<meta name="x-seo-shield-cache" content="true">

<!-- Never cache this page -->
<meta name="x-seo-shield-cache" content="false">

<!-- Custom TTL (seconds) -->
<meta name="x-seo-shield-cache" content="7200">
```

### HTTP Status Code via Meta Tags

```html
<!-- Set 404 status for this page -->
<meta name="prerender-status-code" content="404">

<!-- Set 410 Gone status -->
<meta name="prerender-status-code" content="410">
```

## Runtime Configuration

Some settings can be changed at runtime through the Admin API:

```bash
# Update cache TTL
curl -X PUT http://localhost:3190/shieldapi/config \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cacheTTL": 7200}'
```

Runtime-configurable options:

- Cache TTL
- Cache patterns
- Bot detection rules
- Hotfix rules
- Blocking rules

## Validation

The server validates configuration at startup:

```bash
# Required validation
❌ ERROR: TARGET_URL environment variable is required

# URL format validation
❌ ERROR: TARGET_URL must be a valid URL (e.g., https://example.com)
```

Configuration is logged at startup:

```bash
⚙️  Configuration loaded:
   PORT: 8080
   TARGET_URL: https://your-spa.com
   CACHE_TYPE: redis
   REDIS_URL: redis://localhost:6379
   MONGODB_URL: mongodb://localhost:27017
   MONGODB_DB_NAME: seo_shield_proxy
   CACHE_TTL: 3600s
   PUPPETEER_TIMEOUT: 30000ms
   MAX_CONCURRENT_RENDERS: 5
   NODE_ENV: production
   CACHE_BY_DEFAULT: true
```

## Troubleshooting

### Common Issues

**1. TARGET_URL not set**

```bash
❌ ERROR: TARGET_URL environment variable is required
```

Solution: Set `TARGET_URL` in your `.env` file

**2. Invalid URL format**

```bash
❌ ERROR: TARGET_URL must be a valid URL
```

Solution: Use full URL with protocol (e.g., `https://example.com`)

**3. Redis connection failed**

```bash
❌ Redis connection error: ECONNREFUSED
🔄 Falling back to memory cache
```

Solution: Check Redis is running or use `CACHE_TYPE=memory`

**4. MongoDB connection failed**

```bash
❌ MongoDB connection failed: connect ECONNREFUSED
```

Solution: Check MongoDB is running and URL is correct

### Best Practices

1. **Security**: Always change `ADMIN_PASSWORD` and `JWT_SECRET` in production
2. **Caching**: Use Redis in production for persistence
3. **Concurrency**: Set `MAX_CONCURRENT_RENDERS` based on available RAM
4. **Patterns**: Define `NO_CACHE_PATTERNS` for dynamic content
5. **Timeout**: Adjust `PUPPETEER_TIMEOUT` based on your SPA complexity

## Related Documentation

- [Architecture](architecture.md) - System design overview
- [Redis Cache](redis-cache.md) - Redis configuration details
- [Concurrency Control](concurrency-control.md) - Render queue management
- [API Reference](api-reference.md) - Runtime configuration API
