# API Reference

## Overview

The Admin API runs on port **3190** and provides endpoints for managing the SEO Shield Proxy. All admin endpoints are prefixed with `/shieldapi/`.

## Base URL

```
http://localhost:3190/shieldapi
```

## Authentication

Most endpoints require JWT authentication. Obtain a token via the login endpoint.

### Login

```http
POST /shieldapi/auth/login
Content-Type: application/json

{
  "password": "your-admin-password"
}
```

**Response:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h"
}
```

### Using the Token

Include the token in the Authorization header:

```http
GET /shieldapi/stats
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Endpoints

### Health & Status

#### Health Check

```http
GET /shieldhealth
```

**Response:**

```json
{
  "status": "healthy",
  "uptime": 3600,
  "version": "1.0.0",
  "services": {
    "proxy": "running",
    "cache": "connected",
    "database": "connected"
  }
}
```

#### Statistics

```http
GET /shieldapi/stats
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "traffic": {
      "total": 15234,
      "bots": 8542,
      "humans": 6692
    },
    "cache": {
      "hits": 12456,
      "misses": 2778,
      "hitRate": 81.8
    },
    "render": {
      "queued": 3,
      "processing": 5,
      "completed": 8542,
      "errors": 23
    },
    "uptime": 86400
  }
}
```

### Cache Management

#### Get Cache Stats

```http
GET /shieldapi/cache/stats
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "type": "redis",
    "keys": 542,
    "hitRate": 94.2,
    "memoryUsage": "127 MB",
    "entries": [
      {
        "url": "/product/123",
        "size": 45678,
        "ttl": 2847,
        "hits": 156
      }
    ]
  }
}
```

#### Clear Cache

```http
POST /shieldapi/cache/clear
Authorization: Bearer <token>
Content-Type: application/json

{
  "pattern": "/products/*"  // Optional: clear only matching URLs
}
```

**Response:**

```json
{
  "success": true,
  "message": "Cache cleared",
  "clearedKeys": 45
}
```

#### Clear Single URL

```http
DELETE /shieldapi/cache/url
Authorization: Bearer <token>
Content-Type: application/json

{
  "url": "/product/123"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Cache entry removed",
  "url": "/product/123"
}
```

#### Warm Cache

```http
POST /shieldapi/cache/warm
Authorization: Bearer <token>
Content-Type: application/json

{
  "urls": ["/product/1", "/product/2", "/about"],
  "priority": "high"
}
```

**Response:**

```json
{
  "success": true,
  "message": "Cache warming started",
  "queued": 3
}
```

### Traffic Analytics

#### Get Traffic Metrics

```http
GET /shieldapi/traffic/metrics?limit=100&offset=0
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 100 | Number of records |
| `offset` | number | 0 | Pagination offset |
| `startTime` | ISO date | - | Filter start time |
| `endTime` | ISO date | - | Filter end time |
| `path` | string | - | Filter by URL path |
| `isBot` | boolean | - | Filter by bot/human |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2025-11-25T10:30:00Z",
      "path": "/product/123",
      "userAgent": "Googlebot/2.1",
      "isBot": true,
      "action": "ssr",
      "responseTime": 245,
      "cacheStatus": "HIT"
    }
  ],
  "meta": {
    "limit": 100,
    "offset": 0,
    "total": 15234
  }
}
```

#### Get Traffic Summary

```http
GET /shieldapi/traffic/summary?period=24h
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "period": "24h",
    "totalRequests": 5432,
    "botRequests": 3245,
    "humanRequests": 2187,
    "ssrRenders": 1456,
    "cacheHits": 2789,
    "averageResponseTime": 125,
    "topPaths": [
      { "path": "/", "count": 1234 },
      { "path": "/products", "count": 567 }
    ],
    "topBots": [
      { "name": "Googlebot", "count": 1567 },
      { "name": "Bingbot", "count": 432 }
    ]
  }
}
```

### Configuration

#### Get Configuration

```http
GET /shieldapi/config
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "cacheTTL": 3600,
    "cacheType": "redis",
    "maxConcurrentRenders": 5,
    "puppeteerTimeout": 30000,
    "noCachePatterns": ["/checkout", "/cart", "/api/*"],
    "cachePatterns": [],
    "cacheByDefault": true
  }
}
```

#### Update Configuration

```http
PUT /shieldapi/config
Authorization: Bearer <token>
Content-Type: application/json

{
  "cacheTTL": 7200,
  "noCachePatterns": ["/checkout", "/cart", "/api/*", "/admin/*"]
}
```

**Response:**

```json
{
  "success": true,
  "message": "Configuration updated",
  "data": {
    "cacheTTL": 7200,
    "noCachePatterns": ["/checkout", "/cart", "/api/*", "/admin/*"]
  }
}
```

### Bot Detection

#### Get Bot Rules

```http
GET /shieldapi/bot-rules
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": {
    "rules": [
      {
        "id": "rule-1",
        "name": "Custom Crawler",
        "pattern": "MyCrawler/*",
        "action": "allow",
        "isActive": true
      }
    ],
    "defaultAction": "detect"
  }
}
```

#### Add Bot Rule

```http
POST /shieldapi/bot-rules
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Custom Crawler",
  "pattern": "MyCrawler/*",
  "action": "allow",
  "isActive": true
}
```

#### Delete Bot Rule

```http
DELETE /shieldapi/bot-rules/:id
Authorization: Bearer <token>
```

### Blocking Rules

#### Get Blocking Rules

```http
GET /shieldapi/blocking-rules
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "block-1",
      "name": "Bad Bot",
      "pattern": "BadBot/*",
      "blockType": "userAgent",
      "isActive": true,
      "hitCount": 156
    }
  ]
}
```

#### Add Blocking Rule

```http
POST /shieldapi/blocking-rules
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Bad Bot",
  "pattern": "BadBot/*",
  "blockType": "userAgent",
  "reason": "Malicious crawler",
  "isActive": true
}
```

**Block types:** `domain`, `url`, `userAgent`, `ip`, `header`

### Hotfix Rules

#### Get Hotfix Rules

```http
GET /shieldapi/hotfixes
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "fix-1",
      "name": "Add canonical tag",
      "urlPattern": "/products/*",
      "injectionType": "meta",
      "content": "<link rel=\"canonical\" href=\"...\">",
      "position": "head",
      "isActive": true
    }
  ]
}
```

#### Add Hotfix Rule

```http
POST /shieldapi/hotfixes
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Add canonical tag",
  "urlPattern": "/products/*",
  "injectionType": "meta",
  "content": "<link rel=\"canonical\" href=\"https://example.com{path}\">",
  "position": "head",
  "isActive": true
}
```

**Injection types:** `meta`, `script`, `style`, `custom`

**Positions:** `head`, `body_start`, `body_end`

### Logs

#### Get Audit Logs

```http
GET /shieldapi/audit-logs?limit=100
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Number of records |
| `offset` | number | Pagination offset |
| `category` | string | Filter by category |
| `userId` | string | Filter by user |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "log-123",
      "timestamp": "2025-11-25T10:30:00Z",
      "action": "cache_clear",
      "category": "cache",
      "level": "info",
      "message": "Cache cleared for pattern /products/*",
      "userId": "admin"
    }
  ]
}
```

#### Create Audit Log

```http
POST /shieldapi/audit-logs
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "config_update",
  "category": "config",
  "severity": "info",
  "details": "Updated cache TTL to 7200"
}
```

#### Get Error Logs

```http
GET /shieldapi/error-logs?limit=100
Authorization: Bearer <token>
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "err-456",
      "timestamp": "2025-11-25T10:30:00Z",
      "error": "Render timeout exceeded",
      "path": "/product/123",
      "stack": "Error: Timeout...",
      "resolved": false
    }
  ]
}
```

### Real-time Updates (WebSocket)

#### Connect to WebSocket

```javascript
const ws = new WebSocket('ws://localhost:3190/shieldapi/ws');

ws.onopen = () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your-jwt-token'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data.type, data.payload);
};
```

#### Event Types

| Event | Description |
|-------|-------------|
| `traffic` | New traffic metric |
| `cache_hit` | Cache hit event |
| `cache_miss` | Cache miss event |
| `render_start` | SSR render started |
| `render_complete` | SSR render completed |
| `render_error` | SSR render failed |
| `stats_update` | Statistics update |

**Example event:**

```json
{
  "type": "traffic",
  "payload": {
    "timestamp": "2025-11-25T10:30:00Z",
    "path": "/product/123",
    "isBot": true,
    "action": "ssr",
    "responseTime": 245
  }
}
```

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limiting

The API implements rate limiting:

- **Default:** 100 requests per minute per IP
- **Authenticated:** 1000 requests per minute per token

Rate limit headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1700916600
```

## Pagination

List endpoints support pagination:

```http
GET /shieldapi/traffic/metrics?limit=50&offset=100
```

Response includes pagination metadata:

```json
{
  "data": [...],
  "meta": {
    "limit": 50,
    "offset": 100,
    "total": 15234,
    "hasMore": true
  }
}
```

## Examples

### cURL Examples

```bash
# Login
curl -X POST http://localhost:3190/shieldapi/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password": "admin123"}'

# Get stats (with token)
curl http://localhost:3190/shieldapi/stats \
  -H "Authorization: Bearer YOUR_TOKEN"

# Clear cache
curl -X POST http://localhost:3190/shieldapi/cache/clear \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pattern": "/products/*"}'

# Get traffic metrics
curl "http://localhost:3190/shieldapi/traffic/metrics?limit=10&isBot=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### JavaScript Examples

```javascript
// Login and get token
async function login(password) {
  const response = await fetch('http://localhost:3190/shieldapi/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  const data = await response.json();
  return data.token;
}

// Get stats
async function getStats(token) {
  const response = await fetch('http://localhost:3190/shieldapi/stats', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
}

// Clear cache
async function clearCache(token, pattern) {
  const response = await fetch('http://localhost:3190/shieldapi/cache/clear', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ pattern })
  });
  return response.json();
}
```

## Related Documentation

- [Architecture](architecture.md) - API server design
- [Admin Dashboard](admin-dashboard.md) - Dashboard using these APIs
- [Configuration](configuration.md) - API authentication settings
