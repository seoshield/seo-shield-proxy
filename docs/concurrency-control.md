# Concurrency Control & Queue Management

## Problem: RAM Explosion from Concurrent Renders

### Scenario Without Concurrency Control

```
50 Googlebot requests + 20 Facebook bot requests = 70 concurrent renders

Each render:
- Opens Chrome tab
- Loads full JavaScript application
- ~200-500MB RAM per tab

Total RAM: 70 × 300MB = 21GB RAM
Result: Out of Memory (OOM) → Server crash ❌
```

### Real-World Impact

| Bots | RAM Without Limit | RAM With Limit (5) | Result |
|------|-------------------|---------------------|--------|
| 10 concurrent | 3GB | 1.5GB | ✅ OK |
| 50 concurrent | 15GB | 1.5GB | ✅ OK (queued) |
| 100 concurrent | 30GB → **CRASH** | 1.5GB | ✅ OK (queued) |

## Solution: puppeteer-cluster

We use `puppeteer-cluster` to:
1. **Limit concurrent renders** (default: 5)
2. **Queue excess requests** (FIFO)
3. **Automatic retry** on failure
4. **Prevent OOM crashes**

### Architecture

```
┌─────────────────────────────────────────────┐
│         Request Queue (FIFO)                │
│  [Bot1] [Bot2] [Bot3] ... [Bot50]           │
└───────────────┬─────────────────────────────┘
                │
                ↓
┌─────────────────────────────────────────────┐
│    Concurrency Limiter (Max: 5)             │
│  ┌────────┐ ┌────────┐ ┌────────┐          │
│  │ Slot 1 │ │ Slot 2 │ │ Slot 3 │ ... (5)  │
│  │ Active │ │ Active │ │ Active │          │
│  └────────┘ └────────┘ └────────┘          │
└─────────────────────────────────────────────┘
                │
                ↓
         Chrome Processes
```

**Flow**:
1. Request comes in → Added to queue
2. If slot available → Process immediately
3. If all slots busy → Wait in queue (FIFO)
4. When slot free → Process next in queue

## Configuration

### Environment Variable

```bash
# .env
MAX_CONCURRENT_RENDERS=5
```

### Recommended Values

| Server RAM | Recommended Value | Max Throughput |
|------------|-------------------|----------------|
| 2GB | 2-3 | ~6-9 req/min |
| 4GB | 5 (default) | ~15 req/min |
| 8GB | 10 | ~30 req/min |
| 16GB | 15-20 | ~45-60 req/min |

**Formula**: `MAX_CONCURRENT_RENDERS = (Available RAM in GB) / 0.5`

**Example**: 8GB RAM → 8 / 0.5 = 16 concurrent renders

### Trade-offs

**Low value (e.g., 2)**:
- ✅ Low RAM usage
- ✅ Stable, no crashes
- ❌ Longer queue wait times
- ❌ Lower throughput

**High value (e.g., 20)**:
- ✅ High throughput
- ✅ Shorter queue times
- ❌ High RAM usage
- ❌ Risk of OOM if exceeded

## Queue Metrics

Monitor queue performance via admin API:

```bash
GET /admin/api/stats
```

**Response**:
```json
{
  "queue": {
    "queued": 12,           // Requests waiting in queue
    "processing": 5,        // Currently rendering
    "completed": 1542,      // Total completed renders
    "errors": 23,           // Total failed renders
    "maxConcurrency": 5     // Configured limit
  }
}
```

### Health Indicators

**Healthy Queue**:
```
queued: 0-5
processing: 1-5 (near maxConcurrency)
errors: < 1% of completed
```

**Overloaded Queue**:
```
queued: > 20        → ⚠️ High traffic, consider scaling
processing: 5       → ✅ At capacity
errors: > 5%        → ⚠️ Check timeout or target site issues
```

**Underutilized**:
```
queued: 0
processing: 0-1     → 💡 Can increase MAX_CONCURRENT_RENDERS
```

## Logging

Each render logs queue status:

```bash
📋 Queue: 3 queued, 5/5 processing
✅ Cache HIT: /product/123
📋 Queue: 2 queued, 5/5 processing
🔄 SWR: Serving stale content for: /blog/post-1
📋 Queue: 1 queued, 4/5 processing
```

**Interpret**:
- `3 queued` → 3 requests waiting
- `5/5 processing` → All slots occupied (at capacity)
- `4/5 processing` → 1 slot just freed up

## Performance Impact

### Before Concurrency Control

```
Scenario: 50 bots arrive simultaneously

Behavior:
- All 50 start rendering immediately
- RAM: 50 × 300MB = 15GB
- Result: OOM crash after 30-40 renders

Uptime: ❌ Crashes after 30-40 concurrent requests
```

### After Concurrency Control

```
Scenario: 50 bots arrive simultaneously

Behavior:
- 5 start rendering (slots 1-5)
- 45 wait in queue
- As each completes, next in queue starts
- RAM: 5 × 300MB = 1.5GB (stable)

Uptime: ✅ Stable, all 50 eventually processed
Queue wait: ~30-60 seconds for last bot (acceptable)
```

## Advanced Configuration

### Retry Logic

```typescript
// src/browser.ts
const cluster = await Cluster.launch({
  retryLimit: 1,          // Retry failed renders once
  retryDelay: 1000,       // Wait 1s before retry
  timeout: 30000,         // Max 30s per render
});
```

**When retries happen**:
- Network timeout
- Page crash
- JavaScript error

**When retries don't happen**:
- Meta tag returns 404 (expected behavior)
- Explicit abort

### Concurrency Modes

puppeteer-cluster supports 3 modes:

**1. CONCURRENCY_CONTEXT** (Default - Recommended)
```typescript
concurrency: Cluster.CONCURRENCY_CONTEXT
```
- ✅ Reuses browser, creates new contexts
- ✅ Fastest, lowest memory
- ✅ Shared browser process

**2. CONCURRENCY_PAGE**
```typescript
concurrency: Cluster.CONCURRENCY_PAGE
```
- ⚠️ Reuses browser, creates new pages
- ⚠️ Pages can interfere with each other
- ❌ Not recommended

**3. CONCURRENCY_BROWSER**
```typescript
concurrency: Cluster.CONCURRENCY_BROWSER
```
- ❌ Creates separate browser per task
- ❌ Highest memory usage
- ❌ Slowest startup
- ✅ Complete isolation

**Recommendation**: Stick with `CONCURRENCY_CONTEXT` (default)

## Monitoring & Alerts

### Dashboard Integration

The admin dashboard shows queue metrics:

```
┌─────────────────────────────────────────┐
│ Render Queue Status                     │
│                                          │
│ Queued:      12 requests                │
│ Processing:  5/5 slots occupied         │
│ Completed:   1,542 renders              │
│ Errors:      23 (1.5%)                  │
│ Max Limit:   5 concurrent               │
└─────────────────────────────────────────┘
```

### Alerting Thresholds

Set up alerts for:

**High Queue Length**:
```javascript
if (queue.queued > 20) {
  alert('Queue backlog > 20, consider scaling');
}
```

**High Error Rate**:
```javascript
const errorRate = queue.errors / queue.completed;
if (errorRate > 0.05) {  // 5%
  alert('Error rate > 5%, check logs');
}
```

**All Slots Idle**:
```javascript
if (queue.processing === 0 && queue.queued === 0) {
  // Normal if low traffic
  // Or consider reducing MAX_CONCURRENT_RENDERS
}
```

## Troubleshooting

### Queue is Always Full

**Symptoms**:
```
📋 Queue: 50 queued, 5/5 processing
📋 Queue: 48 queued, 5/5 processing
📋 Queue: 46 queued, 5/5 processing
```

**Causes**:
1. Traffic spike (legitimate)
2. DDoS attack
3. Renders taking too long (slow target site)

**Solutions**:
```bash
# 1. Increase concurrency (if RAM available)
MAX_CONCURRENT_RENDERS=10

# 2. Reduce timeout (fail faster)
PUPPETEER_TIMEOUT=20000

# 3. Enable rate limiting (future feature)
# 4. Scale horizontally (add more instances)
```

### Renders Timing Out

**Symptoms**:
```
❌ Rendering failed: Timeout of 30000ms exceeded
errors: 150 (10% error rate)
```

**Causes**:
- Target site is slow
- JavaScript takes too long to execute
- Network issues

**Solutions**:
```bash
# 1. Increase timeout
PUPPETEER_TIMEOUT=60000

# 2. Use SWR to serve stale content
CACHE_TYPE=redis

# 3. Check target site performance
curl -w "%{time_total}\n" https://your-spa.com
```

### Queue Not Processing

**Symptoms**:
```
📋 Queue: 10 queued, 0/5 processing
```

**Causes**:
- Cluster failed to initialize
- All workers crashed

**Solutions**:
```bash
# Check logs for errors
grep "Cluster" logs/app.log

# Restart server
npm start

# Check Chrome binary
which chromium
```

## Best Practices

1. **Start conservative** (5 concurrent), increase gradually
2. **Monitor RAM usage** with `htop` or similar
3. **Use Redis cache** to reduce render load
4. **Set appropriate timeout** (30s default)
5. **Enable SWR** for instant stale responses
6. **Monitor error rate** (should be < 2%)
7. **Scale horizontally** if single instance maxed out

## Kubernetes Scaling

### Horizontal Pod Autoscaler (HPA)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: seo-proxy-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: seo-proxy
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 70
  - type: Pods
    pods:
      metric:
        name: queue_length
      target:
        type: AverageValue
        averageValue: "10"
```

**Scaling logic**:
- Memory > 70% → Scale up
- Queue length > 10 avg → Scale up
- Both low → Scale down to 2 pods

### Resource Limits

```yaml
resources:
  requests:
    memory: "2Gi"
    cpu: "1000m"
  limits:
    memory: "4Gi"
    cpu: "2000m"

env:
  - name: MAX_CONCURRENT_RENDERS
    value: "5"  # 2GB baseline + 5 × 400MB = 4GB max
```

## Performance Benchmarks

### Single Instance (4GB RAM, 5 concurrent)

| Scenario | Queue Time | RAM Usage | Result |
|----------|------------|-----------|--------|
| 5 concurrent bots | 0s | 1.5GB | ✅ Instant |
| 10 concurrent bots | ~6s | 1.5GB | ✅ Half queued |
| 50 concurrent bots | ~60s | 1.5GB | ✅ All processed |
| 100 concurrent bots | ~120s | 1.5GB | ✅ All processed |

**Average render time**: 3-5 seconds per page

### Three Instances (Load Balanced)

| Scenario | Queue Time | Total RAM | Result |
|----------|------------|-----------|--------|
| 15 concurrent bots | 0s | 4.5GB | ✅ Instant (5 each) |
| 50 concurrent bots | ~10s | 4.5GB | ✅ Distributed |
| 150 concurrent bots | ~60s | 4.5GB | ✅ All processed |

**Throughput**: 15 concurrent renders = ~180 pages/min

## Conclusion

Concurrency control prevents OOM crashes by:
- ✅ Limiting simultaneous renders (default: 5)
- ✅ Queuing excess requests (FIFO)
- ✅ Automatic retry on failure
- ✅ Graceful handling of traffic spikes
- ✅ Predictable RAM usage

**Result**: Stable, reliable rendering even under heavy bot traffic.

**Recommendation**: Start with default (5 concurrent), monitor queue metrics, adjust based on RAM availability and traffic patterns.
