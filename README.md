# 🛡️ SEO Shield Proxy

A production-ready Node.js reverse proxy that solves SEO problems for Single Page Applications (SPAs) without modifying client-side code. It detects bots, renders pages server-side using Puppeteer, and serves static HTML to crawlers while transparently proxying human users to your SPA.

### 🎉 Complete System with Admin Dashboard & Demo

- ✅ **React Admin Dashboard** with real-time WebSocket monitoring
- ✅ **Demo SPA** with 8+ example pages showcasing SEO features
- ✅ **Docker Compose** for one-command deployment
- ✅ **Quick Start Scripts** for easy local development
- ✅ **100% Code Quality** improvements and production-ready enhancements

## 🚀 Quick Start

### Option 1: Automated Script (Easiest)

```bash
./start-all.sh
```

This automatically installs dependencies and starts all 3 services!

### Option 2: Docker (Production)

```bash
./start-docker.sh
# or
docker-compose up -d
```

### Option 3: Manual

See [START.md](START.md) for detailed manual setup.

## 📊 Access Points

- **Demo SPA:** http://localhost:3000
- **SEO Proxy:** http://localhost:8080
- **Admin Dashboard:** http://localhost:8080/admin or http://localhost:3001

## 🎯 Key Features

### 🔧 Core Proxy
- Bot detection via `isbot`
- SSR with Puppeteer for bots
- Transparent proxy for humans
- Smart caching with TTL
- Pattern-based cache rules
- Meta tag cache control
- **Debug mode** - Preview bot-rendered HTML with `?_render=debug`

### 📊 Admin Dashboard
- Real-time WebSocket updates
- Traffic analytics & charts
- Bot type breakdown (pie chart)
- Cache management UI
- Memory monitoring
- Configuration viewer

### 🎨 Demo SPA
- 8 pages with proper SEO
- Blog with dynamic routes
- Products catalog
- No-cache demo page
- Contact forms
- 404 handling

## 🧪 Quick Test

```bash
# Bot request (gets SSR)
curl -A "Googlebot" http://localhost:8080/

# Human request (gets proxied)
curl http://localhost:8080/

# Debug mode (preview bot HTML as human)
curl http://localhost:8080/?_render=debug

# View in browser
open http://localhost:8080/admin
```

## 📁 Project Structure

```
seo-shield-proxy/
├── src/                    # Main proxy server
├── admin-dashboard/        # React admin UI
├── demo-spa/              # Demo application
├── docker-compose.yml     # Docker setup
├── start-all.sh          # Quick start
└── START.md              # Detailed guide
```

## ⚙️ Configuration

Via `.env` file:

```bash
TARGET_URL=http://localhost:3000
CACHE_TTL=3600
NO_CACHE_PATTERNS=/checkout,/cart,/admin/*
CACHE_BY_DEFAULT=true
```

See [.env.example](.env.example) for all options.

## 📚 Documentation

- [START.md](START.md) - Complete setup guide
- [.env.example](.env.example) - Configuration reference
- [docs/debug-mode.md](docs/debug-mode.md) - Debug mode & render preview guide
- [docs/concurrency-control.md](docs/concurrency-control.md) - Queue management & performance
- [docs/redis-cache.md](docs/redis-cache.md) - Redis cache integration

## 📝 License

MIT License

---

Built with ❤️ for better SEO
