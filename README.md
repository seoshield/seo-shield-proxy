# SEO Shield Proxy

Production-ready reverse proxy that transforms Single Page Applications (SPAs) into SEO-optimized websites. Provides intelligent bot detection, server-side rendering via Puppeteer, smart caching, and a comprehensive admin dashboard.

## Features

- **Intelligent Bot Detection** - Automatic detection of search engine crawlers and social media bots
- **Server-Side Rendering** - Puppeteer-based SSR for bot traffic only
- **Smart Caching** - Redis/Memory cache with Stale-While-Revalidate support
- **Zero Code Changes** - Works with any SPA without modifications
- **Admin Dashboard** - Real-time monitoring, analytics, and configuration
- **Advanced SEO Protocols** - Content health checks, virtual scroll handling, Shadow DOM extraction

## Architecture

```text
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Main Proxy    │     │   API Server    │     │    Dashboard    │
│   Port 8080     │     │   Port 3190     │     │   Port 3001     │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ • Bot Detection │     │ • Admin APIs    │     │ • React UI      │
│ • SSR Rendering │     │ • WebSocket     │     │ • Real-time     │
│ • Caching       │     │ • Auth          │     │   Monitoring    │
└────────┬────────┘     └────────┬────────┘     └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│   Target SPA    │     │    MongoDB      │
└─────────────────┘     └─────────────────┘
```

## Quick Start

### Option 1: Docker (Recommended)

```bash
docker-compose up -d
```

### Option 2: Manual Setup

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your TARGET_URL

# Start all services
npm run dev          # Main proxy (8080)
npm run dev:api      # API server (3190)
cd admin-dashboard && npm run dev  # Dashboard (3001)
```

### Option 3: Automated Script

```bash
./scripts/start-all.sh
```

## Configuration

Create a `.env` file in the project root:

```bash
# Required
TARGET_URL=https://your-spa.com

# Server
PORT=8080
API_PORT=3190

# Cache
CACHE_TYPE=memory          # memory or redis
CACHE_TTL=3600             # seconds
REDIS_URL=redis://localhost:6379

# Database
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=seo_shield_proxy

# Security
ADMIN_PASSWORD=admin123
JWT_SECRET=your-secret-key

# Performance
MAX_CONCURRENT_RENDERS=5
PUPPETEER_TIMEOUT=30000

# Cache Patterns
NO_CACHE_PATTERNS=/checkout,/cart,/api/*
CACHE_BY_DEFAULT=true
```

For advanced runtime configuration, copy the template:

```bash
cp runtime-config.example.json runtime-config.json
```

## Usage

### Access Points

| Service | URL | Purpose |
|---------|-----|---------|
| Main Proxy | `http://localhost:8080` | Reverse proxy with SSR |
| API Server | `http://localhost:3190` | Admin APIs |
| Dashboard | `http://localhost:3001` | Admin interface |

### Testing

```bash
# Bot request (receives SSR HTML)
curl -A "Googlebot" http://localhost:8080/

# Human request (transparent proxy)
curl http://localhost:8080/

# Health check
curl http://localhost:8080/shieldhealth

# Debug mode
curl "http://localhost:8080/?_render=debug"
```

### Admin Dashboard

1. Navigate to `http://localhost:3001`
2. Login with password: `admin123` (or your `ADMIN_PASSWORD`)
3. Access real-time traffic, cache management, and configuration

## How It Works

```text
Request → Bot Detection → [Bot?] → Yes → Cache Check → [Hit?] → Yes → Serve Cached
                            │                            │
                            │                            └── No → Puppeteer SSR → Cache → Serve
                            │
                            └── No → Transparent Proxy to Target SPA
```

**For Bots:**

1. Request arrives at proxy
2. Bot detected via User-Agent analysis
3. Check cache for pre-rendered HTML
4. If miss: Render page with Puppeteer
5. Cache result and serve

**For Humans:**

1. Request arrives at proxy
2. Not a bot - transparent proxy
3. Forward directly to target SPA

## Project Structure

```text
seo-shield-proxy/
├── src/                       # Source code
│   ├── server.ts              # Main proxy server (port 8080)
│   ├── api-server.ts          # Admin API server (port 3190)
│   ├── config.ts              # Configuration management
│   ├── browser.ts             # Puppeteer SSR engine
│   ├── cache.ts               # Cache abstraction layer
│   ├── admin/                 # Admin features & metrics
│   ├── bot-detection/         # Bot detection engine
│   ├── cache/                 # Cache implementations
│   ├── storage/               # MongoDB storage
│   └── database/              # Database management
├── admin-dashboard/           # React admin UI (port 3001)
├── docs/                      # Documentation
├── scripts/                   # Utility scripts
├── docker/                    # Docker configurations
├── tests/                     # Test suite
├── .env.example               # Environment template
└── runtime-config.example.json # Runtime config template
```

## Documentation

### Getting Started

- [Configuration Reference](docs/configuration.md)
- [Architecture Overview](docs/architecture.md)
- [Docker Deployment](docs/docker.md)

### Core Features

- [Bot Detection](docs/bot-detection.md)
- [Admin Dashboard](docs/admin-dashboard.md)
- [API Reference](docs/api-reference.md)

### Caching

- [Redis Cache](docs/redis-cache.md)
- [Stale-While-Revalidate](docs/stale-while-revalidate.md)
- [Concurrency Control](docs/concurrency-control.md)

### Advanced

- [SEO Protocols](docs/seo-protocols.md)
- [Performance Optimization](docs/performance-optimization.md)
- [Debug Mode](docs/debug-mode.md)
- [Status Code Detection](docs/status-code-detection.md)
- [MongoDB Integration](docs/mongodb.md)

### Reference

- [Deployment Checklist](docs/deployment-checklist.md)
- [Architecture Analysis](docs/architecture-analysis.md)
- [Project Overview](docs/project-overview.md)

## Commands

```bash
# Development
npm run dev              # Start proxy server
npm run dev:api          # Start API server

# Build
npm run build            # Build proxy
npm run build:api        # Build API server

# Testing
npm run test             # Run tests
npm run test:coverage    # Coverage report

# Code Quality
npm run lint             # ESLint
npm run format           # Prettier
npm run type-check       # TypeScript check

# Docker
docker-compose up -d     # Start all services
docker-compose down      # Stop services
docker-compose logs -f   # View logs
```

## Requirements

- Node.js 18+
- MongoDB (optional, for analytics)
- Redis (optional, for production caching)
- Chrome/Chromium (for Puppeteer)

## License

MIT
