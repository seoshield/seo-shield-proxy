# Bot Detection

## Overview

SEO Shield Proxy uses a multi-layered bot detection system to identify search engine crawlers and other bots. When a bot is detected, the request is routed through the SSR (Server-Side Rendering) pipeline to serve fully rendered HTML.

## Detection Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    Request Arrives                           │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: isbot Library                                      │
│  • 600+ known bot patterns                                   │
│  • Maintained by npm community                               │
│  • High accuracy for major crawlers                          │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Advanced Bot Detector                              │
│  • Custom user agent patterns                                │
│  • IP-based detection                                        │
│  • Behavior analysis                                         │
│  • Configurable rules                                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Admin-Defined Rules                                │
│  • Custom bot patterns                                       │
│  • Whitelist/blacklist                                       │
│  • Runtime configuration                                     │
└─────────────────────────────────────────────────────────────┘
```

## Layer 1: isbot Library

The primary detection uses the [isbot](https://www.npmjs.com/package/isbot) library:

```typescript
import { isbot } from 'isbot';

const userAgent = req.headers['user-agent'];
const isBot = isbot(userAgent);
```

**Detected bot types:**

| Category | Examples |
|----------|----------|
| Search Engines | Googlebot, Bingbot, Yandex, Baidu, DuckDuckBot |
| Social Media | Facebook, Twitter, LinkedIn, Pinterest |
| SEO Tools | Ahrefs, SEMrush, Moz, Screaming Frog |
| Monitoring | Pingdom, UptimeRobot, StatusCake |
| Other | curl, wget, Python requests, headless browsers |

## Layer 2: Advanced Bot Detector

The `AdvancedBotDetector` class provides additional detection capabilities:

```typescript
// src/bot-detection/advanced-bot-detector.ts

class AdvancedBotDetector {
  // Custom pattern matching
  private customPatterns: BotPattern[];

  // IP-based detection
  private knownBotIPs: Set<string>;

  // Behavior analysis
  private requestPatterns: Map<string, RequestHistory>;
}
```

### Features

#### Custom User Agent Patterns

```typescript
const patterns = [
  { pattern: /Googlebot/i, name: 'Google', category: 'search' },
  { pattern: /Bingbot/i, name: 'Bing', category: 'search' },
  { pattern: /facebookexternalhit/i, name: 'Facebook', category: 'social' },
  { pattern: /Twitterbot/i, name: 'Twitter', category: 'social' },
  { pattern: /LinkedInBot/i, name: 'LinkedIn', category: 'social' },
  { pattern: /AhrefsBot/i, name: 'Ahrefs', category: 'seo' },
  { pattern: /SemrushBot/i, name: 'SEMrush', category: 'seo' },
];
```

#### Bot Classification

```typescript
interface BotInfo {
  isBot: boolean;
  name: string;
  category: 'search' | 'social' | 'seo' | 'monitoring' | 'other';
  confidence: number;  // 0-100
  verified: boolean;   // DNS verification passed
}
```

#### DNS Verification (Optional)

For critical bots like Googlebot, DNS verification confirms authenticity:

```typescript
// Verify Googlebot is actually from Google
async verifyGooglebot(ip: string): Promise<boolean> {
  const hostname = await reverseDNS(ip);
  // Must end with .googlebot.com or .google.com
  return hostname.endsWith('.googlebot.com') ||
         hostname.endsWith('.google.com');
}
```

## Layer 3: Admin-Defined Rules

Custom rules can be added through the Admin API:

### Add Custom Bot Rule

```bash
POST /shieldapi/bot-rules
{
  "name": "Custom Crawler",
  "pattern": "MyCrawler/*",
  "action": "allow",
  "isActive": true
}
```

### Rule Actions

| Action | Description |
|--------|-------------|
| `allow` | Treat as bot, serve SSR content |
| `deny` | Block the request |
| `bypass` | Treat as human, proxy normally |
| `detect` | Use default detection |

### Rule Priority

```
1. Admin blacklist rules (highest)
2. Admin whitelist rules
3. Advanced Bot Detector
4. isbot library (lowest)
```

## Configuration

### Environment Variables

```bash
# Enable/disable bot detection
BOT_DETECTION_ENABLED=true

# Enable DNS verification for major bots
BOT_DNS_VERIFICATION=false

# Custom bot patterns (JSON)
CUSTOM_BOT_PATTERNS='[{"pattern":"MyCrawler","action":"allow"}]'
```

### Runtime Configuration

```bash
# Get current bot rules
curl http://localhost:3190/shieldapi/bot-rules \
  -H "Authorization: Bearer TOKEN"

# Add new rule
curl -X POST http://localhost:3190/shieldapi/bot-rules \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Partner Crawler",
    "pattern": "PartnerBot/*",
    "action": "allow",
    "isActive": true
  }'
```

## Bot Categories

### Search Engine Crawlers

```
Googlebot, Googlebot-Image, Googlebot-Video, Googlebot-News
Bingbot, BingPreview
YandexBot, YandexImages
Baiduspider
DuckDuckBot
```

**Behavior:** Full SSR rendering, aggressive caching

### Social Media Crawlers

```
facebookexternalhit
Twitterbot
LinkedInBot
Pinterest
Slackbot
WhatsApp
Telegram
```

**Behavior:** SSR for preview generation, moderate caching

### SEO Tools

```
AhrefsBot
SemrushBot
MJ12bot (Majestic)
DotBot (Moz)
Screaming Frog
```

**Behavior:** SSR rendering, may be rate-limited

### Monitoring Services

```
Pingdom
UptimeRobot
StatusCake
Site24x7
```

**Behavior:** SSR for accurate monitoring, no caching

## Response Headers

Bot requests include identifying headers:

```http
X-Bot-Detected: true
X-Bot-Name: Googlebot
X-Bot-Category: search
X-Rendered-By: SEO-Shield-Proxy
X-Cache-Status: HIT
```

## Logging

Bot detection events are logged:

```bash
# Bot detected
🤖 Bot detected: Googlebot (search) from 66.249.66.1
   URL: /products/smartphone
   Action: SSR render

# Unknown bot
⚠️  Unknown bot pattern: CustomBot/1.0
   URL: /about
   Action: SSR render (default)

# Verification failed
❌ Bot verification failed: Fake-Googlebot from 192.168.1.1
   Action: Blocked
```

## Analytics

### Bot Traffic Dashboard

The admin dashboard shows bot analytics:

```
┌─────────────────────────────────────────────────────────────┐
│ Bot Traffic (Last 24 Hours)                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Total Bot Requests: 8,542                                   │
│                                                              │
│  By Category:                                                │
│  ├── Search Engines: 5,234 (61.3%)                          │
│  ├── Social Media: 1,876 (22.0%)                            │
│  ├── SEO Tools: 987 (11.5%)                                 │
│  └── Other: 445 (5.2%)                                      │
│                                                              │
│  Top Bots:                                                   │
│  1. Googlebot: 3,456 requests                               │
│  2. Bingbot: 1,234 requests                                 │
│  3. facebookexternalhit: 876 requests                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Traffic Metrics API

```bash
GET /shieldapi/traffic/metrics?isBot=true&limit=100
```

```json
{
  "data": [
    {
      "timestamp": "2025-11-25T10:30:00Z",
      "path": "/product/123",
      "userAgent": "Googlebot/2.1",
      "isBot": true,
      "botName": "Googlebot",
      "botCategory": "search",
      "action": "ssr",
      "cacheStatus": "HIT",
      "responseTime": 45
    }
  ]
}
```

## Best Practices

### 1. Monitor Unknown Bots

Review logs for unrecognized bot patterns:

```bash
grep "Unknown bot pattern" logs/app.log | sort | uniq -c | sort -rn
```

Add rules for legitimate bots you discover.

### 2. Handle Rate Limiting

Some bots (especially SEO tools) may send many requests:

```typescript
// Rate limit by bot category
const rateLimits = {
  search: 1000,    // No limit for search engines
  social: 100,     // 100 req/min for social
  seo: 50,         // 50 req/min for SEO tools
  other: 30        // 30 req/min for others
};
```

### 3. Cache Appropriately

Different bot types need different caching strategies:

| Bot Type | Cache Strategy |
|----------|----------------|
| Search Engines | Long TTL (1-4 hours), SWR enabled |
| Social Media | Medium TTL (30 min - 1 hour) |
| SEO Tools | Short TTL (15-30 min) |
| Monitoring | No caching |

### 4. Verify Critical Bots

Enable DNS verification for important bots:

```bash
BOT_DNS_VERIFICATION=true
```

This prevents fake Googlebots from accessing your SSR content.

## Troubleshooting

### Bot Not Detected

**Symptoms:** Bot receiving client-side rendered content

**Solutions:**

1. Check user agent is being sent
2. Add custom rule for the bot pattern
3. Verify isbot library is up to date

```bash
# Check user agent
curl -H "User-Agent: MyBot/1.0" http://localhost:8080/ -I
# Look for X-Bot-Detected header
```

### Legitimate Traffic Blocked

**Symptoms:** Real users being treated as bots

**Solutions:**

1. Review custom bot rules
2. Check for overly broad patterns
3. Add bypass rules for affected user agents

```bash
# Add bypass rule
POST /shieldapi/bot-rules
{
  "pattern": "Chrome/1*",
  "action": "bypass"
}
```

### High Bot Traffic

**Symptoms:** Server overloaded with bot requests

**Solutions:**

1. Enable rate limiting per bot category
2. Increase `MAX_CONCURRENT_RENDERS`
3. Use aggressive caching
4. Add blocking rules for abusive bots

## Related Documentation

- [Architecture](architecture.md) - How bot detection fits in the system
- [Concurrency Control](concurrency-control.md) - Managing render queue
- [API Reference](api-reference.md) - Bot rules API endpoints
- [Configuration](configuration.md) - Bot detection settings
