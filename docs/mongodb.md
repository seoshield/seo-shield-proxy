# MongoDB Integration

## Overview

SEO Shield Proxy uses MongoDB for persistent storage of analytics data, audit logs, error tracking, and configuration. While the proxy can operate without MongoDB (using in-memory fallbacks), MongoDB is recommended for production environments.

## Features

| Feature | Description |
|---------|-------------|
| **Traffic Metrics** | Store and analyze traffic patterns |
| **Audit Logs** | Track administrative actions |
| **Error Logs** | Persistent error tracking |
| **Configuration** | Store runtime configuration versions |

## Configuration

### Environment Variables

```bash
# MongoDB connection URL
MONGODB_URL=mongodb://localhost:27017

# Database name
MONGODB_DB_NAME=seo_shield_proxy
```

### Connection URL Formats

| Scenario | URL Format |
|----------|------------|
| Local | `mongodb://localhost:27017` |
| With Auth | `mongodb://user:pass@localhost:27017` |
| Replica Set | `mongodb://host1,host2,host3:27017/?replicaSet=rs0` |
| MongoDB Atlas | `mongodb+srv://user:pass@cluster.mongodb.net` |

## Collections

### traffic_metrics

Stores traffic data for analytics:

```javascript
{
  "_id": ObjectId("..."),
  "timestamp": ISODate("2025-11-25T10:30:00Z"),
  "path": "/product/123",
  "userAgent": "Googlebot/2.1",
  "isBot": true,
  "action": "ssr",          // ssr, proxy, static, bypass, error
  "responseTime": 245,
  "statusCode": 200,
  "renderTime": 3200,
  "botType": "Googlebot",
  "cacheStatus": "HIT",     // HIT, MISS, STALE
  "ip": "66.249.66.1",
  "referer": "https://google.com",
  "method": "GET",
  "responseSize": 45678
}
```

**Indexes:**

```javascript
// Created automatically by DatabaseManager
{ timestamp: -1 }                    // Time-based queries
{ path: 1, timestamp: -1 }           // Path-specific traffic
{ ip: 1, timestamp: -1 }             // IP-based analysis
{ isBot: 1, timestamp: -1 }          // Bot/human analysis
```

### audit_logs

Stores administrative actions:

```javascript
{
  "_id": ObjectId("..."),
  "id": "audit-123",
  "timestamp": ISODate("2025-11-25T10:30:00Z"),
  "action": "cache_clear",
  "category": "cache",        // system, security, cache, config, traffic
  "level": "info",            // info, warning, error, critical
  "message": "Cache cleared for pattern /products/*",
  "data": { "pattern": "/products/*", "clearedKeys": 45 },
  "userId": "admin",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0..."
}
```

**Indexes:**

```javascript
{ timestamp: -1 }                    // Recent logs
{ action: 1, timestamp: -1 }         // Action-specific logs
{ userId: 1, timestamp: -1 }         // User activity
{ category: 1, timestamp: -1 }       // Category filtering
```

### error_logs

Stores error tracking data:

```javascript
{
  "_id": ObjectId("..."),
  "id": "err-456",
  "timestamp": ISODate("2025-11-25T10:30:00Z"),
  "error": "Render timeout exceeded",
  "stack": "TimeoutError: Navigation timeout...",
  "context": { "url": "/product/123", "timeout": 30000 },
  "path": "/product/123",
  "method": "GET",
  "ip": "66.249.66.1",
  "userAgent": "Googlebot/2.1",
  "resolved": false,
  "resolvedAt": null
}
```

**Indexes:**

```javascript
{ timestamp: -1 }                    // Recent errors
{ severity: 1, timestamp: -1 }       // Severity filtering
{ category: 1, timestamp: -1 }       // Error categories
{ url: 1, timestamp: -1 }            // URL-specific errors
```

### configurations

Stores configuration versions:

```javascript
{
  "_id": ObjectId("..."),
  "key": "cache_settings",
  "config": {
    "cacheTTL": 3600,
    "cacheType": "redis",
    "noCachePatterns": ["/checkout", "/cart"]
  },
  "version": "1.0.3",
  "createdAt": ISODate("2025-11-25T10:00:00Z"),
  "updatedAt": ISODate("2025-11-25T10:30:00Z"),
  "createdBy": "admin",
  "description": "Updated cache TTL",
  "isActive": true
}
```

**Indexes:**

```javascript
{ key: 1 }, { unique: true }         // Config lookups
{ createdAt: -1 }                    // Versioning
{ isActive: 1, updatedAt: -1 }       // Active configs
```

## Connection Management

### Singleton Pattern

The `DatabaseManager` class uses singleton pattern:

```typescript
// src/database/database-manager.ts
export class DatabaseManager {
  private static instance: DatabaseManager;

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  async connect(): Promise<boolean> {
    // Connection logic
  }

  getMongoStorage(): MongoStorage | null {
    return this.mongoStorage;
  }
}

// Usage
const db = DatabaseManager.getInstance();
const storage = db.getMongoStorage();
```

### Connection Lifecycle

```
Application Start
       │
       ▼
┌─────────────────────┐
│   Connect to        │
│   MongoDB           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Initialize        │
│   Indexes           │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Application       │
│   Running           │
└──────────┬──────────┘
           │
           ▼ (on shutdown)
┌─────────────────────┐
│   Disconnect        │
│   Gracefully        │
└─────────────────────┘
```

### Graceful Degradation

If MongoDB is unavailable, the system falls back to:

```typescript
// Traffic metrics: Logged to console
console.log(`[TRAFFIC] ${path} - ${action} - ${responseTime}ms`);

// Audit logs: Logged to console
console.log(`[AUDIT] ${action} by ${userId}`);

// Error logs: Logged to console
console.error(`[ERROR] ${message}`);
```

## Storage Operations

### MongoStorage Class

```typescript
// src/storage/mongodb-storage.ts
export class MongoStorage {
  // Traffic metrics
  async storeTrafficMetric(metric: TrafficMetric): Promise<void>;
  async getTrafficMetrics(limit: number, options: FilterOptions): Promise<TrafficMetric[]>;

  // Audit logs
  async logAudit(log: AuditLog): Promise<void>;
  async getAuditLogs(limit: number, options: FilterOptions): Promise<AuditLog[]>;

  // Error logs
  async logError(error: ErrorLog): Promise<string>;
  async getErrorLogs(limit: number, options: FilterOptions): Promise<ErrorLog[]>;

  // Configuration
  async getConfig(key: string): Promise<any>;
  async saveConfig(config: any, description?: string): Promise<string>;
  async getStats(): Promise<any>;
}
```

### Query Examples

```typescript
// Get recent bot traffic
const botTraffic = await storage.getTrafficMetrics(100, {
  isBot: true,
  startTime: new Date(Date.now() - 24 * 60 * 60 * 1000)
});

// Get security audit logs
const securityLogs = await storage.getAuditLogs(50, {
  category: 'security'
});

// Get unresolved errors
const errors = await storage.getErrorLogs(100, {
  resolved: false
});
```

## Docker Setup

### Docker Compose

```yaml
# docker-compose.yml
services:
  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongodb-data:/data/db
    environment:
      - MONGO_INITDB_DATABASE=seo_shield_proxy
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  seo-proxy:
    environment:
      - MONGODB_URL=mongodb://mongodb:27017
      - MONGODB_DB_NAME=seo_shield_proxy
    depends_on:
      mongodb:
        condition: service_healthy

volumes:
  mongodb-data:
```

### Database Migrations

Migrations are in `docker/migration/`:

```javascript
// docker/migration/run-migrations.js
// Creates indexes and initial data

db.traffic_metrics.createIndexes([
  { key: { timestamp: -1 } },
  { key: { path: 1, timestamp: -1 } },
  { key: { ip: 1, timestamp: -1 } },
  { key: { isBot: 1, timestamp: -1 } }
]);

// ... more indexes
```

## Monitoring

### Health Check

```typescript
async healthCheck(): Promise<{ connected: boolean; stats?: any }> {
  if (!this.isConnected || !this.db) {
    return { connected: false };
  }

  const stats = await this.db.stats();
  return {
    connected: true,
    stats: {
      collections: stats.collections,
      dataSize: stats.dataSize,
      indexSize: stats.indexSize,
      storageSize: stats.storageSize
    }
  };
}
```

### Connection Status

```bash
# Check connection via API
curl http://localhost:3190/shieldhealth

{
  "status": "healthy",
  "services": {
    "database": "connected"
  }
}
```

### Logs

```bash
# Connection success
✅ MongoDB connected successfully: mongodb://localhost:27017/seo_shield_proxy
✅ MongoDB indexes initialized successfully

# Connection failure
❌ MongoDB connection failed: connect ECONNREFUSED
⚠️  Running without MongoDB - using fallback logging
```

## Performance

### Index Strategy

Indexes are designed for common query patterns:

| Query Type | Index Used |
|------------|------------|
| Recent traffic | `{ timestamp: -1 }` |
| Path analysis | `{ path: 1, timestamp: -1 }` |
| Bot detection | `{ isBot: 1, timestamp: -1 }` |
| IP tracking | `{ ip: 1, timestamp: -1 }` |

### Data Retention

Consider implementing TTL indexes for automatic cleanup:

```javascript
// Auto-delete traffic metrics older than 30 days
db.traffic_metrics.createIndex(
  { timestamp: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);
```

### Recommended Settings

```yaml
# MongoDB configuration
storage:
  wiredTiger:
    engineConfig:
      cacheSizeGB: 1  # Adjust based on available RAM

# For production
replication:
  replSetName: "rs0"
```

## Troubleshooting

### Connection Refused

```bash
❌ MongoDB connection failed: connect ECONNREFUSED
```

**Solutions:**

1. Check MongoDB is running: `mongosh`
2. Verify URL: `echo $MONGODB_URL`
3. Check firewall: `nc -zv localhost 27017`
4. For Docker: Ensure service is in same network

### Authentication Failed

```bash
❌ MongoDB connection failed: Authentication failed
```

**Solutions:**

1. Verify credentials in URL
2. Check user has correct database permissions
3. For Atlas: Whitelist your IP address

### Slow Queries

```bash
⚠️  MongoDB query took 5234ms
```

**Solutions:**

1. Check indexes exist: `db.collection.getIndexes()`
2. Analyze query: `db.collection.find().explain()`
3. Add missing indexes
4. Consider data archiving

### Out of Disk Space

```bash
❌ MongoDB error: disk full
```

**Solutions:**

1. Clean old data: Implement TTL indexes
2. Archive old metrics to cold storage
3. Increase disk space
4. Enable compression: `wiredTiger.collectionConfig.blockCompressor: snappy`

## Best Practices

1. **Use Replica Sets**: For production, use at least 3-node replica set
2. **Enable Authentication**: Always use auth in production
3. **Implement TTL**: Auto-delete old data to manage disk space
4. **Monitor Performance**: Use MongoDB Atlas monitoring or self-hosted tools
5. **Regular Backups**: Schedule automated backups
6. **Index Maintenance**: Review and optimize indexes regularly

## Related Documentation

- [Architecture](architecture.md) - Database in system design
- [Configuration](configuration.md) - MongoDB settings
- [API Reference](api-reference.md) - Data access APIs
