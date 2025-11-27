# SEO Shield Proxy - Docker Deployment Guide

This guide covers complete Docker deployment of the SEO Shield Proxy system with Redis, MongoDB, and all supporting services.

## 🐳 Docker Architecture

The system consists of 5 main services:

- **seo-proxy**: Main proxy server (port 8080) - Handles SSR and caching
- **seo-api**: API server (port 3190) - Admin endpoints and WebSocket
- **admin-dashboard**: React admin interface (port 3001)
- **redis**: Cache storage (port 6379) - Persistent caching
- **mongodb**: Database (port 27017) - Analytics, logs, configuration

Optional services:
- **nginx**: Reverse proxy (ports 80/443) - Production load balancing
- **db-migration**: Database initialization (one-time execution)

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose
- 4GB+ RAM available
- Node.js 18+ (for local development)

### 1. Environment Setup

Copy the example environment files:

```bash
# Copy environment configuration
cp .env.example .env

# Edit configuration as needed
nano .env
```

**Key settings in `.env`:**
- `TARGET_URL`: Your SPA URL to proxy
- `CACHE_TYPE`: Set to `redis` for persistent caching
- `MONGODB_URL`: MongoDB connection string
- `ADMIN_PASSWORD`: Admin dashboard password

### 2. Development Deployment

Start with databases and core services:

```bash
# Build and start with Redis and MongoDB only
npm run docker:dev

# Wait for databases to be ready, then start full system
npm run docker:up
```

### 3. Production Deployment

```bash
# Build all services
npm run docker:build

# Start with Nginx reverse proxy
npm run docker:prod
```

## 📋 Available Docker Commands

### Service Management

```bash
npm run docker:up          # Start all services
npm run docker:down        # Stop all services
npm run docker:logs         # View logs
npm run docker:clean       # Remove all containers and volumes
```

### Database Operations

```bash
npm run docker:migrate    # Run database migrations
npm run docker:dev         # Start only databases
npm run docker:prod        # Start with Nginx
```

### Building Images

```bash
docker-compose build seo-proxy    # Build proxy server image
docker-compose build seo-api       # Build API server image
docker-compose build admin-dashboard # Build admin dashboard
docker-compose build              # Build all images
```

## 🔧 Configuration

### Environment Variables

Key variables for Docker deployment:

```bash
# Application
NODE_ENV=production
TARGET_URL=https://your-spa-app.com

# Ports (default values)
PROXY_PORT=8080
API_PORT=3190
ADMIN_PORT=3001

# Database
CACHE_TYPE=redis
REDIS_URL=redis://redis:6379
MONGODB_URL=mongodb://admin:admin123@mongodb:27017/seo_shield_proxy?authSource=admin
MONGODB_DB_NAME=seo_shield_proxy

# Security
ADMIN_PASSWORD=your-secure-password
```

### Volume Persistence

The system uses Docker volumes for data persistence:

- `redis-data`: Redis cache data
- `mongodb-data`: MongoDB data files
- `mongodb-config`: MongoDB configuration
- `puppeteer-cache`: Puppeteer browser cache
- `nginx-logs`: Nginx access logs

## 📊 Monitoring & Health Checks

### Service Health Status

All services include built-in health checks:

```bash
# Check service status
docker-compose ps

# View detailed health status
curl http://localhost/shieldhealth

# Database health check
curl http://localhost:3190/shieldhealth
```

### Health Check Endpoints

- **Proxy Server**: `http://localhost:8080/shieldhealth`
- **API Server**: `http://localhost:3190/shieldhealth`
- **Admin Dashboard**: `http://localhost:3001`
- **Nginx**: `http://localhost/shieldhealth`

### Monitoring Logs

```bash
# View all logs
npm run docker:logs

# View specific service logs
docker-compose logs -f seo-proxy
docker-compose logs -f seo-api
docker-compose logs -f admin-dashboard
docker-compose logs -f mongodb
docker-compose logs -f redis
```

## 🗄️ Database Management

### Automatic Initialization

MongoDB automatically initializes on first start with:

- **Collections**: traffic_metrics, configurations, audit_logs, error_logs, bot_rules, ip_reputation
- **Indexes**: Optimized indexes for queries and TTL
- **Default Data**: Bot detection rules and system configuration
- **User Accounts**: Application user with read/write permissions

### Manual Migrations

Run migrations manually if needed:

```bash
# Run migrations and seeding
npm run docker:migrate
```

### Database Access

Connect to MongoDB for debugging:

```bash
# Connect to MongoDB
docker-compose exec mongodb mongosh --username admin --password admin123

# Switch to application database
use seo_shield_proxy

# View collections
show collections
```

## 🔒 Security Configuration

### Network Isolation

- Services communicate via Docker network `seo-shield-network`
- Subnet: `172.20.0.0/16`
- Only required ports exposed to host

### Authentication

1. **MongoDB**: Auth enabled with admin user
2. **Admin Dashboard**: Password protected (default: `admin123`)
3. **API Endpoints**: Can be rate-limited via Nginx

### Security Headers

Nginx adds security headers automatically:

- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

## 🔧 Production Optimizations

### Resource Limits

Service resource allocations:

```yaml
services:
  redis:
    mem_limit: 256m
  mongodb:
    mem_limit: 1g
  seo-proxy:
    mem_limit: 512m
  seo-api:
    mem_limit: 256m
  admin-dashboard:
    mem_limit: 128m
```

### Performance Tuning

1. **Redis**: Memory management, LRU eviction
2. **MongoDB**: WiredTiger engine, compression
3. **Nginx**: Gzip compression, connection pooling
4. **Caching**: Redis-backed with TTL policies

### Scaling

**Horizontal Scaling:**

```bash
# Scale proxy servers
docker-compose up -d --scale seo-proxy=3

# Scale API servers
docker-compose up -d --scale seo-api=2
```

**Load Balancing:**

- Nginx provides round-robin load balancing
- Health checks prevent routing to failed instances
- Connection pooling maintains performance

## 🛠️ Troubleshooting

### Common Issues

#### Services Won't Start

```bash
# Check Docker Compose configuration
docker-compose config

# Check for port conflicts
docker-compose ps
```

#### Database Connection Errors

```bash
# Check MongoDB logs
docker-compose logs mongodb

# Verify MongoDB is ready
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"
```

#### Redis Connection Errors

```bash
# Check Redis logs
docker-compose logs redis

# Verify Redis is responding
docker-compose exec redis redis-cli ping
```

#### Performance Issues

```bash
# Check resource usage
docker stats

# Monitor memory usage
docker-compose exec seo-proxy node -e "console.log(process.memoryUsage())"
```

### Debug Mode

Enable debug logging:

```bash
# Set debug environment variables
echo "LOG_LEVEL=debug" >> .env

# Restart services
npm run docker:down && npm run docker:up
```

### Clean Reinstall

Remove all containers and volumes:

```bash
npm run docker:clean

# Rebuild from scratch
npm run docker:build && npm run docker:up
```

## 📚 Service URLs

After deployment, services are available at:

- **Main Proxy**: `http://localhost:8080`
- **API Server**: `http://localhost:3190/shieldapi/*`
- **Admin Dashboard**: `http://localhost:3001`
- **With Nginx**: `http://localhost/` (production)

### Service-Specific Endpoints

- **Proxy Health**: `http://localhost:8080/shieldhealth`
- **API Health**: `http://localhost:3190/shieldhealth`
- **Admin Panel**: `http://localhost:3001/admin/`

## 🚀 Production Deployment Tips

### Pre-Deployment Checklist

- [ ] Set strong `ADMIN_PASSWORD`
- [ ] Configure SSL certificates for production
- [ ] Set appropriate `TARGET_URL`
- [ ] Configure external MongoDB if needed
- [ ] Set resource limits based on server capacity
- [ ] Configure monitoring and alerting

### SSL Configuration

For HTTPS with Nginx:

1. Place SSL certificates in `docker/ssl/`
2. Update `docker/nginx/conf.d/default.conf` for SSL
3. Use port 443 in production

### External Database

To use external databases:

```bash
# Update .env with external URLs
REDIS_URL=redis://your-redis-host:6379
MONGODB_URL=mongodb://user:pass@your-mongo-host:27017/db
```

### Backup Strategy

Regular backups recommended:

1. **MongoDB Data**: `mongodb-data` volume
2. **Redis Cache**: Can be rebuilt as needed
3. **Configuration**: Store in version control
4. **SSL Certificates**: Backup to secure location

## 🆘 Support

For Docker-specific issues:

1. Check logs: `npm run docker:logs`
2. Verify configuration: `docker-compose config`
3. Check health: `curl http://localhost/shieldhealth`
4. Review this documentation

For general issues, see the main README.md.