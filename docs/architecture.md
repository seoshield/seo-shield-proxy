# System Architecture

## Overview

SEO Shield Proxy uses a **port-based microservice separation** architecture that cleanly separates concerns between different services. This design ensures the main proxy remains lightweight and focused on its core purpose.

## Service Architecture

```
                                    ┌─────────────────────────────────┐
                                    │      Load Balancer / CDN        │
                                    └─────────────────┬───────────────┘
                                                      │
                    ┌─────────────────────────────────┼─────────────────────────────────┐
                    │                                 │                                 │
                    ▼                                 ▼                                 ▼
        ┌───────────────────┐           ┌───────────────────┐           ┌───────────────────┐
        │   Main Proxy      │           │    API Server     │           │  Admin Dashboard  │
        │    Port 8080      │           │    Port 3190      │           │    Port 3001      │
        ├───────────────────┤           ├───────────────────┤           ├───────────────────┤
        │ • Bot Detection   │           │ • /shieldapi/*    │           │ • React UI        │
        │ • SSR Rendering   │           │ • Authentication  │           │ • Real-time Stats │
        │ • Smart Caching   │           │ • WebSocket       │           │ • Configuration   │
        │ • Transparent     │           │ • Rate Limiting   │           │ • Cache Mgmt      │
        │   Proxying        │           │ • Analytics API   │           │                   │
        └─────────┬─────────┘           └─────────┬─────────┘           └───────────────────┘
                  │                               │
                  │                               │
                  ▼                               ▼
        ┌───────────────────┐           ┌───────────────────┐
        │   Target SPA      │           │     MongoDB       │
        │  (Your App)       │           │   Port 27017      │
        └───────────────────┘           ├───────────────────┤
                                        │ • Traffic Metrics │
                                        │ • Audit Logs      │
                                        │ • Error Logs      │
                                        │ • Configurations  │
                                        └───────────────────┘
                                                  │
                                        ┌─────────┴─────────┐
                                        │                   │
                                        ▼                   ▼
                                ┌───────────────┐   ┌───────────────┐
                                │    Redis      │   │   Puppeteer   │
                                │  Port 6379    │   │   Cluster     │
                                ├───────────────┤   ├───────────────┤
                                │ • Page Cache  │   │ • SSR Engine  │
                                │ • Sessions    │   │ • Concurrency │
                                │ • Job Queue   │   │   Control     │
                                └───────────────┘   └───────────────┘
```

## Port Assignments

| Port | Service | Purpose | Access |
|------|---------|---------|--------|
| **8080** | Main Proxy | Pure reverse proxy with SSR | Public |
| **3190** | API Server | Admin APIs, WebSocket | Internal/Admin |
| **3001** | Dashboard | React admin interface | Admin only |
| **6379** | Redis | Cache storage (production) | Internal |
| **27017** | MongoDB | Analytics and persistence | Internal |

## Design Principles

### 1. Port 8080 is Pure Proxy

The main proxy server on port 8080 is designed to be **minimal and focused**:

- **Only one endpoint**: `/shieldhealth` (for load balancer health checks)
- **All other routes**: Transparently proxied to target SPA
- **No business logic**: No admin routes, no configuration endpoints
- **Bot handling**: Automatic SSR for detected bots

```typescript
// Port 8080 handles only:
// 1. Health check: GET /shieldhealth
// 2. Everything else: Proxy to TARGET_URL (with SSR for bots)
```

### 2. API Server Separation

All administrative functionality lives on port 3190:

```typescript
// Port 3190 handles:
// - /shieldapi/auth/*      - Authentication
// - /shieldapi/stats       - Traffic statistics
// - /shieldapi/cache/*     - Cache management
// - /shieldapi/config/*    - Configuration
// - /shieldapi/logs/*      - Audit and error logs
// - WebSocket connections  - Real-time updates
```

### 3. Graceful Fallback

The system is designed to **never block users**:

```
┌─────────────────────────────────────────────────────────────┐
│                    Request Flow                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Request → Bot Detection → [Is Bot?]                        │
│                              │                               │
│                    ┌────────┴────────┐                      │
│                    │                 │                       │
│                    ▼                 ▼                       │
│               [Yes: Bot]       [No: Human]                  │
│                    │                 │                       │
│                    ▼                 ▼                       │
│            Check Cache        Transparent                   │
│                    │            Proxy                        │
│         ┌─────────┼─────────┐     │                         │
│         │         │         │     │                         │
│         ▼         ▼         ▼     ▼                         │
│       [HIT]    [STALE]   [MISS]  Target                     │
│         │         │         │     SPA                        │
│         │         │         ▼                                │
│         │         │    SSR Render                           │
│         │         │    (Puppeteer)                          │
│         │         │         │                                │
│         │         │         ▼                                │
│         │         │    [Success?]                           │
│         │         │    ┌────┴────┐                          │
│         │         │    │         │                           │
│         │         │   Yes       No                          │
│         │         │    │         │                           │
│         │         │    ▼         ▼                           │
│         ▼         ▼   Cache    Fallback                     │
│      Serve HTML    &  to Proxy                              │
│                   Serve                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Request Flow Details

### Bot Request Flow

```
1. Request arrives at port 8080
2. Bot detection (isbot library + custom rules)
3. If bot detected:
   a. Check cache for URL
   b. If cache HIT → Serve cached HTML
   c. If cache STALE → Serve stale, revalidate in background (SWR)
   d. If cache MISS → Queue for Puppeteer render
   e. Puppeteer renders page with JavaScript
   f. Cache result with TTL
   g. Return rendered HTML
4. Response includes X-Cache-Status header
```

### Human Request Flow

```
1. Request arrives at port 8080
2. Bot detection (not a bot)
3. Transparent proxy to TARGET_URL
4. No SSR, no caching
5. Headers preserved (except hop-by-hop)
6. Response returned as-is
```

## Component Interactions

### Main Proxy (`src/server.ts`)

```typescript
// Core responsibilities:
- Express server on PORT (8080)
- Bot detection using isbot library
- Request routing (bot vs human)
- Cache lookup and storage
- Puppeteer render queue management
- Health endpoint (/shieldhealth)
```

### API Server (`src/api-server.ts`)

```typescript
// Core responsibilities:
- Express server on API_PORT (3190)
- JWT authentication
- Admin API routes (/shieldapi/*)
- WebSocket server for real-time updates
- Rate limiting
- Database operations
```

### Browser Manager (`src/browser.ts`)

```typescript
// Core responsibilities:
- Puppeteer cluster initialization
- Concurrency control (MAX_CONCURRENT_RENDERS)
- Page rendering with timeout
- Resource blocking (images, fonts)
- Error handling and retries
```

### Cache Layer (`src/cache.ts`)

```typescript
// Core responsibilities:
- Cache interface abstraction
- Memory cache (development)
- Redis cache (production)
- TTL management
- SWR (Stale-While-Revalidate) support
```

### Database Manager (`src/database/database-manager.ts`)

```typescript
// Core responsibilities:
- MongoDB connection management
- Singleton pattern
- Index initialization
- Health checks
- MongoStorage access
```

## Scaling Considerations

### Horizontal Scaling

```
                    ┌─────────────────────────┐
                    │     Load Balancer       │
                    └───────────┬─────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
    ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
    │   Proxy #1    │   │   Proxy #2    │   │   Proxy #3    │
    │   Port 8080   │   │   Port 8080   │   │   Port 8080   │
    └───────┬───────┘   └───────┬───────┘   └───────┬───────┘
            │                   │                   │
            └───────────────────┼───────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
            ┌───────────────┐       ┌───────────────┐
            │     Redis     │       │    MongoDB    │
            │   (Shared)    │       │   (Shared)    │
            └───────────────┘       └───────────────┘
```

**Key points for scaling:**

1. **Stateless proxies**: Use Redis for cache (not memory)
2. **Shared database**: MongoDB for analytics
3. **Session affinity**: Not required (stateless)
4. **Resource limits**: Set `MAX_CONCURRENT_RENDERS` per instance

### Resource Requirements

| Component | CPU | RAM | Disk |
|-----------|-----|-----|------|
| Proxy (per instance) | 1-2 cores | 2-4 GB | Minimal |
| API Server | 0.5-1 core | 512 MB - 1 GB | Minimal |
| Redis | 0.5 core | 256 MB - 1 GB | 1-5 GB |
| MongoDB | 1-2 cores | 1-2 GB | 5-20 GB |
| Puppeteer (per render) | 0.5 core | 300-500 MB | N/A |

## Security Architecture

### Network Security

```
┌─────────────────────────────────────────────────────────────┐
│                      Public Internet                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
            ┌─────────────────────────┐
            │   Firewall / WAF        │
            │   • Rate limiting       │
            │   • DDoS protection     │
            └─────────────┬───────────┘
                          │
                          ▼
            ┌─────────────────────────┐
            │   Port 8080 (Public)    │
            │   Main Proxy Server     │
            └─────────────────────────┘
                          │
    ┌─────────────────────┼─────────────────────┐
    │                     │                     │
    │   Internal Network Only                   │
    │   ┌─────────────────┴─────────────────┐   │
    │   │                                   │   │
    │   ▼                                   ▼   │
    │ ┌───────────────┐           ┌───────────────┐
    │ │ Port 3190     │           │ Port 3001     │
    │ │ API Server    │           │ Dashboard     │
    │ │ (Admin only)  │           │ (Admin only)  │
    │ └───────────────┘           └───────────────┘
    │                                             │
    └─────────────────────────────────────────────┘
```

### Authentication Flow

```
1. Admin visits dashboard (port 3001)
2. Dashboard requests /shieldapi/auth/login (port 3190)
3. API validates credentials against ADMIN_PASSWORD
4. JWT token issued (signed with JWT_SECRET)
5. Dashboard stores token
6. Subsequent API calls include Authorization header
7. API validates JWT on each request
```

## File Structure

```
seo-shield-proxy/
├── src/
│   ├── server.ts              # Main proxy (8080)
│   ├── api-server.ts          # API server (3190)
│   ├── config.ts              # Configuration management
│   ├── browser.ts             # Puppeteer browser pool
│   ├── cache.ts               # Cache abstraction layer
│   ├── admin/
│   │   ├── admin-routes.ts    # All admin API endpoints
│   │   ├── metrics-collector.ts
│   │   ├── cache-warmer.ts
│   │   ├── hotfix-engine.ts
│   │   ├── blocking-manager.ts
│   │   ├── websocket.ts
│   │   └── ...
│   ├── bot-detection/
│   │   └── advanced-bot-detector.ts
│   ├── storage/
│   │   └── mongodb-storage.ts
│   └── database/
│       └── database-manager.ts
├── admin-dashboard/           # React admin UI
├── docker/                    # Docker configurations
└── docs/                      # Documentation
```

## Environment-Based Configuration

The system adapts based on environment:

| Setting | Development | Production |
|---------|-------------|------------|
| `CACHE_TYPE` | `memory` | `redis` |
| `NODE_ENV` | `development` | `production` |
| `MONGODB_URL` | `localhost:27017` | Cluster URL |
| `MAX_CONCURRENT_RENDERS` | `3` | `5-10` |

## Related Documentation

- [Configuration Reference](configuration.md) - All environment variables
- [API Reference](api-reference.md) - Admin API endpoints
- [Redis Cache](redis-cache.md) - Cache configuration
- [Concurrency Control](concurrency-control.md) - Render queue management
