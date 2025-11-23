# Redis Cache Integration

## Overview

The SEO Shield Proxy supports two cache backends:

| Cache Type | Persistence | Scalability | Use Case |
|------------|-------------|-------------|----------|
| **Memory** (default) | ❌ Volatile (lost on restart) | ❌ Single instance only | Development, testing |
| **Redis** (recommended) | ✅ Persistent (survives restarts) | ✅ Shared across pods | Production, Kubernetes |

## Why Redis?

### Problem with Memory Cache

```
┌─────────────────────────────────────────┐
│  Server Restart = Cache Lost            │
│  ❌ All pages need re-rendering          │
│  ❌ CPU spikes to 100%                   │
│  ❌ Slow response times (3-5s)           │
└─────────────────────────────────────────┘
```

### Kubernetes Scaling Problem

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Pod 1     │  │   Pod 2     │  │   Pod 3     │
│ Memory Cache│  │ Memory Cache│  │ Memory Cache│
└─────────────┘  └─────────────┘  └─────────────┘
      ↓                ↓                ↓
Same page rendered 3 times = Wasted CPU
```

### Redis Solution

```
     ┌─────────────────────────────────┐
     │       Redis (Shared Cache)      │
     │  ✅ Persistent                   │
     │  ✅ Shared across all pods       │
     │  ✅ Survives restarts            │
     └─────────────────────────────────┘
              ↑         ↑         ↑
     ┌────────┴──┐  ┌──┴────┐  ┌─┴────────┐
     │  Pod 1    │  │ Pod 2 │  │  Pod 3   │
     └───────────┘  └───────┘  └──────────┘

Same page rendered once = Efficient
```

## Configuration

### 1. Using Docker Compose (Recommended)

The `docker-compose.yml` already includes Redis:

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis-data:/data

  seo-proxy:
    environment:
      - CACHE_TYPE=redis
      - REDIS_URL=redis://redis:6379
```

**Start with Redis:**
```bash
docker-compose up -d
```

### 2. Using Environment Variables

**Option A: Redis Cache (Production)**
```bash
# .env
CACHE_TYPE=redis
REDIS_URL=redis://localhost:6379
```

**Option B: Memory Cache (Development)**
```bash
# .env
CACHE_TYPE=memory
# REDIS_URL not needed
```

### 3. Redis Connection URLs

| Scenario | URL Format | Example |
|----------|------------|---------|
| **Local Redis** | `redis://hostname:port` | `redis://localhost:6379` |
| **With Password** | `redis://:password@hostname:port` | `redis://:mypass@localhost:6379` |
| **With Username** | `redis://username:password@hostname:port` | `redis://admin:pass@localhost:6379` |
| **Select Database** | `redis://hostname:port/db` | `redis://localhost:6379/1` |
| **Redis Cloud** | `redis://user:pass@host:port` | `redis://default:xxx@redis-12345.cloud.redislabs.com:12345` |

## Installation

### Standalone Redis (Without Docker)

**macOS:**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis-server
```

**Windows:**
```bash
# Use WSL2 or Docker
wsl --install
# Then install Redis in WSL
```

**Verify Redis is running:**
```bash
redis-cli ping
# Should return: PONG
```

## Features

### Automatic Fallback

If Redis is unavailable, the proxy automatically falls back to memory cache:

```bash
🔄 Connecting to Redis: redis://localhost:6379
❌ Redis connection error: ECONNREFUSED
🔄 Falling back to memory cache
💾 Memory cache initialized
```

**Benefit**: Your application never crashes due to Redis issues.

### Persistence

Cache survives server restarts:

```bash
# Before restart
curl -H "User-Agent: Googlebot" https://example.com/product/123
# Response: 50ms (cache hit)

# Restart server
docker-compose restart seo-proxy

# After restart
curl -H "User-Agent: Googlebot" https://example.com/product/123
# Response: 50ms (cache still there!) ✅
```

**With memory cache**: After restart, first request takes 3-5 seconds (re-render).

### Shared Across Pods

Multiple proxy instances share the same cache:

```bash
# Pod 1 renders page
curl -H "Host: app.example.com" http://pod-1:8080/product/123
# Puppeteer renders (3-5s)

# Pod 2 gets cached result
curl -H "Host: app.example.com" http://pod-2:8080/product/123
# Redis cache hit (<10ms) ✅
```

## Kubernetes Deployment

### Helm Chart Example

```yaml
# values.yaml
replicaCount: 3

env:
  - name: CACHE_TYPE
    value: "redis"
  - name: REDIS_URL
    value: "redis://redis-service:6379"
  - name: TARGET_URL
    value: "http://spa-service:3000"

redis:
  enabled: true
  architecture: standalone
  auth:
    enabled: false
  master:
    persistence:
      enabled: true
      size: 1Gi
```

### Redis Cluster for High Availability

```yaml
# production.yaml
redis:
  enabled: true
  architecture: replication
  sentinel:
    enabled: true
  replica:
    replicaCount: 3
```

## Monitoring

### Check Cache Status

```bash
# Connect to Redis CLI
redis-cli

# Check number of cached pages
127.0.0.1:6379> DBSIZE
(integer) 542

# View all cache keys
127.0.0.1:6379> KEYS *
1) "/product/123"
2) "/product/456"
3) "/blog/post-1"

# Check a specific key
127.0.0.1:6379> GET "/product/123"
"<html>...</html>"

# Check TTL (Time To Live)
127.0.0.1:6379> TTL "/product/123"
(integer) 2847  # 2847 seconds remaining

# View memory usage
127.0.0.1:6379> INFO memory
```

### Redis Metrics

```bash
# Cache hit rate
127.0.0.1:6379> INFO stats
keyspace_hits:15234
keyspace_misses:892
# Hit rate = 94.4% (15234 / (15234 + 892))
```

### Admin Dashboard

The admin panel automatically detects Redis:

```
Visit: http://localhost:8080/admin

Cache Type: Redis ✅
Cache Keys: 542
Hit Rate: 94.4%
Memory Usage: 127 MB
```

## Performance Comparison

| Metric | Memory Cache | Redis Cache |
|--------|--------------|-------------|
| **Read Speed** | ~5ms | ~10ms |
| **Write Speed** | ~2ms | ~5ms |
| **Persistence** | ❌ None | ✅ Survives restarts |
| **Scalability** | ❌ Single instance | ✅ Shared across pods |
| **Memory Limit** | Node.js heap | Redis maxmemory |
| **Eviction Policy** | LRU (1000 keys) | Configurable (allkeys-lru) |

**Conclusion**: Redis is slightly slower (5ms overhead) but provides persistence and scalability.

## Troubleshooting

### Redis Connection Failed

**Error:**
```
❌ Redis connection error: ECONNREFUSED
🔄 Falling back to memory cache
```

**Solutions:**
```bash
# 1. Check if Redis is running
redis-cli ping

# 2. Check Redis URL
echo $REDIS_URL
# Should be: redis://localhost:6379

# 3. Check firewall
sudo ufw allow 6379

# 4. Check Redis logs
tail -f /var/log/redis/redis-server.log
```

### Redis Out of Memory

**Error:**
```
❌ Redis SET error: OOM command not allowed when used memory > 'maxmemory'
```

**Solutions:**
```bash
# 1. Increase maxmemory
redis-cli CONFIG SET maxmemory 512mb

# 2. Or use eviction policy (recommended)
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# 3. Make permanent in redis.conf
echo "maxmemory 512mb" >> /etc/redis/redis.conf
echo "maxmemory-policy allkeys-lru" >> /etc/redis/redis.conf
```

### Slow Redis Performance

**Symptoms:** Cache reads taking > 50ms

**Diagnoses:**
```bash
# 1. Check Redis latency
redis-cli --latency
# Should be < 1ms

# 2. Check slow queries
redis-cli SLOWLOG GET 10

# 3. Check network latency (if Redis is remote)
ping redis-host.com
```

**Solutions:**
- Use local Redis instead of remote
- Enable Redis persistence: RDB or AOF
- Upgrade Redis server resources

## Advanced Configuration

### Redis Persistence Options

**RDB (Snapshots)**: Periodic snapshots
```bash
# redis.conf
save 900 1      # Save if 1 key changed in 15 min
save 300 10     # Save if 10 keys changed in 5 min
save 60 10000   # Save if 10000 keys changed in 1 min
```

**AOF (Append-Only File)**: Every write logged
```bash
# redis.conf
appendonly yes
appendfsync everysec  # Sync every second
```

**Recommendation**: Use RDB for better performance, AOF for durability.

### Memory Optimization

```bash
# redis.conf
maxmemory 256mb
maxmemory-policy allkeys-lru  # Evict least recently used keys

# Disable RDB if using AOF
save ""
```

### Security

```bash
# Set password
redis-cli CONFIG SET requirepass "your-strong-password"

# Update REDIS_URL
REDIS_URL=redis://:your-strong-password@localhost:6379
```

## Migration Guide

### Switching from Memory to Redis

**Step 1**: Install Redis
```bash
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

**Step 2**: Update `.env`
```bash
CACHE_TYPE=redis
REDIS_URL=redis://localhost:6379
```

**Step 3**: Restart proxy
```bash
npm run build
npm start
```

**Step 4**: Verify
```bash
# Check logs for:
✅ Redis cache connected with TTL: 3600s, SWR enabled

# Test cache
curl -H "User-Agent: Googlebot" http://localhost:8080/
```

### Switching from Redis to Memory

Just change `.env`:
```bash
CACHE_TYPE=memory
# REDIS_URL=...  # Comment out
```

Restart, done!

## Best Practices

1. **Use Redis in production** for persistence and scalability
2. **Use memory cache in development** for simplicity
3. **Set appropriate maxmemory** (e.g., 25-50% of available RAM)
4. **Enable LRU eviction** to prevent OOM errors
5. **Monitor hit rate** (target: > 90%)
6. **Use Redis persistence** (RDB or AOF) for critical data
7. **Secure Redis** with password in production
8. **Use Redis Sentinel** for high availability

## FAQ

**Q: Does Redis slow down the proxy?**
A: Minimal impact (~5ms overhead vs memory cache). The benefits (persistence, scalability) outweigh the cost.

**Q: What happens if Redis goes down?**
A: The proxy automatically falls back to memory cache. No downtime.

**Q: Can I use Redis Cloud/AWS ElastiCache?**
A: Yes! Just set `REDIS_URL` to the cloud endpoint.

**Q: How much memory does Redis use?**
A: Approximately 1KB per cached URL + HTML size. 1000 pages ≈ 50-100 MB.

**Q: Does Redis work with SWR strategy?**
A: Yes! Redis supports TTL natively, perfect for Stale-While-Revalidate.

**Q: Can I clear Redis cache manually?**
A: Yes, via admin panel (`/admin`) or Redis CLI (`FLUSHDB`).

## Conclusion

Redis cache provides:
- ✅ **Persistence**: Survives restarts
- ✅ **Scalability**: Shared across pods
- ✅ **Performance**: ~10ms read latency
- ✅ **Reliability**: Automatic fallback to memory
- ✅ **SWR Compatible**: Native TTL support

**Recommendation**: Use Redis for production deployments, especially with Kubernetes/Docker.

For development and testing, memory cache is sufficient.
