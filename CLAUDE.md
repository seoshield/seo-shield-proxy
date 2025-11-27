# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SEO Shield Proxy is an enterprise-grade reverse proxy that provides server-side rendering (SSR) for search engine crawlers while maintaining transparent proxying for human users. It solves SEO challenges for Single Page Applications without modifying client-side code.

## Tech Stack

- **Runtime**: Node.js 18+, TypeScript 5.9
- **Backend**: Express.js, Puppeteer (browser automation), Puppeteer-Cluster
- **Frontend**: React with TypeScript (Vite) for admin dashboard
- **Cache**: Redis (production) / Node-Cache (development)
- **Database**: MongoDB for analytics and persistence
- **Real-time**: Socket.io for WebSocket communication
- **Testing**: Vitest, Jest, Supertest

## Key Commands

```bash
# Development
npm run dev              # Main proxy with ts-node
npm run dev:api          # API server
cd admin-dashboard && npm run dev  # Admin dashboard

# Build
npm run build            # Compile TypeScript to dist/
npm run build:api        # Build API server

# Testing
npm run test             # Run test suite
npm run test:watch       # Watch mode with Vitest
npm run test:coverage    # Coverage report
npm run test:unit        # Unit tests only
npm run test:ui          # Vitest UI dashboard

# Code Quality
npm run lint             # ESLint with auto-fix
npm run format           # Prettier formatting
npm run type-check       # TypeScript type check (no emit)

# Docker
npm run docker:up        # Start all services
npm run docker:down      # Stop services
npm run docker:dev       # Start only Redis & MongoDB
npm run docker:logs      # View logs
```

## Architecture

The system uses **port-based microservice separation**:

| Port | Service | Purpose |
|------|---------|---------|
| 8080 | Main Proxy | Pure reverse proxy with SSR for bots, only `/shieldhealth` endpoint |
| 3190 | API Server | All admin APIs under `/shieldapi/*`, WebSocket support |
| 3001 | Dashboard | React admin interface |
| 6379 | Redis | Cache storage (production) |
| 27017 | MongoDB | Analytics and persistence |

### Key Design Principles

1. **Port 8080 is pure proxy** - No business logic, no admin routes. Only handles proxying and SSR rendering.
2. **Bot detection** uses `isbot` library + custom `AdvancedBotDetector` for configurable rules.
3. **Graceful fallback** - If SSR fails, falls back to transparent proxy (never blocks users).
4. **Cache abstraction** - `CacheInterface` with `CacheFactory` pattern supports memory/Redis backends.

### Request Flow

```
Request → Bot Detection → [Bot? → SSR via Puppeteer → Cache] → Target SPA
                        → [Human? → Transparent Proxy] → Target SPA
```

### Core Source Files

- `src/server.ts` - Main proxy server (port 8080)
- `src/api-server.ts` - API server (port 3190)
- `src/config.ts` - Configuration management with env validation
- `src/browser.ts` - Puppeteer browser pool
- `src/cache.ts` - Cache abstraction layer
- `src/bot-detection/advanced-bot-detector.ts` - Custom bot detection engine
- `src/admin/admin-routes.ts` - All admin API endpoints

### Admin Features

Located in `src/admin/`:
- `metrics-collector.ts` - Real-time traffic metrics
- `cache-warmer.ts` - Sitemap-based cache prewarming
- `hotfix-engine.ts` - Emergency SEO content injection
- `blocking-manager.ts` - Request blocking rules
- `forensics-collector.ts` - Error tracking and analysis
- `websocket.ts` - Real-time WebSocket server

## Environment Configuration

Required in `.env`:
```
TARGET_URL=https://your-spa.com   # Required: Your SPA URL
PORT=8080                          # Proxy port
CACHE_TYPE=memory                  # memory or redis
REDIS_URL=redis://localhost:6379   # For production
MONGODB_URL=mongodb://localhost:27017
ADMIN_PASSWORD=your-secure-password
```

## TypeScript Configuration

The project uses relaxed type checking (`strict: false`, `noImplicitAny: false`) intentionally for flexibility. Run `npm run type-check` to validate types.

## Debug Mode

Append query params for debugging:
- `?_render=true` - Preview bot-rendered HTML
- `?_render=debug` - Detailed metrics and timing

## Development Notes

- All admin logic must go through port 3190, never add routes to port 8080
- New features should be configurable via `config.ts` with env variable support
- Use the cache abstraction (`CacheInterface`) for any caching needs
- Puppeteer resource usage is significant - monitor `MAX_CONCURRENT_RENDERS`
