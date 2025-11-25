// MongoDB Initialization Script for SEO Shield Proxy
// This script runs when MongoDB starts for the first time
// Made idempotent to handle restarts gracefully

print("Starting MongoDB initialization...");

// Switch to the SEO Shield database
db = db.getSiblingDB('seo_shield_proxy');

// Helper function to safely create collection
function safeCreateCollection(name, options) {
  try {
    db.createCollection(name, options);
    print("  Created collection: " + name);
  } catch (e) {
    if (e.code === 48) {
      print("  Collection already exists: " + name);
    } else {
      print("  Warning creating " + name + ": " + e.message);
    }
  }
}

// Helper function to safely create index
function safeCreateIndex(collection, keys, options) {
  try {
    db[collection].createIndex(keys, options || {});
  } catch (e) {
    // Index might already exist, that's fine
  }
}

print("Creating collections...");

// Create collections (safely)
safeCreateCollection('traffic_metrics');
safeCreateCollection('configurations');
safeCreateCollection('audit_logs');
safeCreateCollection('error_logs');
safeCreateCollection('bot_rules');
safeCreateCollection('ip_reputation');

print("Creating indexes...");

// Traffic metrics indexes
safeCreateIndex('traffic_metrics', { "timestamp": -1 });
safeCreateIndex('traffic_metrics', { "path": 1, "timestamp": -1 });
safeCreateIndex('traffic_metrics', { "ip": 1, "timestamp": -1 });
safeCreateIndex('traffic_metrics', { "isBot": 1, "timestamp": -1 });
safeCreateIndex('traffic_metrics', { "botType": 1, "timestamp": -1 });
safeCreateIndex('traffic_metrics', { "timestamp": 1 }, { expireAfterSeconds: 2592000 });

// Configurations indexes
safeCreateIndex('configurations', { "key": 1 }, { unique: true });
safeCreateIndex('configurations', { "createdAt": -1 });
safeCreateIndex('configurations', { "isActive": 1, "updatedAt": -1 });

// Audit logs indexes
safeCreateIndex('audit_logs', { "timestamp": -1 });
safeCreateIndex('audit_logs', { "action": 1, "timestamp": -1 });
safeCreateIndex('audit_logs', { "userId": 1, "timestamp": -1 });
safeCreateIndex('audit_logs', { "category": 1, "timestamp": -1 });
safeCreateIndex('audit_logs', { "timestamp": 1 }, { expireAfterSeconds: 7776000 });

// Error logs indexes
safeCreateIndex('error_logs', { "timestamp": -1 });
safeCreateIndex('error_logs', { "severity": 1, "timestamp": -1 });
safeCreateIndex('error_logs', { "category": 1, "timestamp": -1 });
safeCreateIndex('error_logs', { "url": 1, "timestamp": -1 });
safeCreateIndex('error_logs', { "timestamp": 1 }, { expireAfterSeconds: 2592000 });

// Bot rules indexes
safeCreateIndex('bot_rules', { "id": 1 }, { unique: true });
safeCreateIndex('bot_rules', { "enabled": 1, "priority": -1 });
safeCreateIndex('bot_rules', { "type": 1, "enabled": 1 });

// IP reputation indexes
safeCreateIndex('ip_reputation', { "ip": 1 }, { unique: true });
safeCreateIndex('ip_reputation', { "reputation": 1, "lastSeen": -1 });
safeCreateIndex('ip_reputation', { "category": 1, "lastSeen": -1 });
safeCreateIndex('ip_reputation', { "lastSeen": 1 }, { expireAfterSeconds: 604800 });

print("Seeding default data...");

// Insert default configuration (upsert)
db.configurations.updateOne(
  { key: "runtime_config" },
  {
    $setOnInsert: {
      key: "runtime_config",
      value: {
        seoProtocols: {
          contentHealthCheck: {
            enabled: true,
            criticalSelectors: [
              { selector: "title", required: true, description: "Page title is required" },
              { selector: "meta[name='description']", required: true, description: "Meta description is required" },
              { selector: "h1", required: true, description: "H1 tag is required" },
              { selector: "body", required: false, description: "Body content should exist" }
            ],
            minBodyLength: 100,
            minTitleLength: 30,
            metaDescriptionRequired: true,
            h1Required: true,
            failOnMissingCritical: false
          },
          virtualScroll: {
            enabled: true,
            scrollSteps: 10,
            scrollInterval: 1000,
            maxScrollHeight: 10000,
            waitAfterScroll: 500
          },
          etagStrategy: {
            enabled: true,
            hashAlgorithm: "md5",
            enable304Responses: true
          },
          circuitBreaker: {
            enabled: true,
            errorThreshold: 5,
            resetTimeout: 30000
          }
        },
        cacheWarmer: {
          sitemapUrl: "",
          warmupSchedule: "0 2 * * *",
          maxConcurrentWarmups: 3
        }
      },
      description: "Default runtime configuration for SEO Shield Proxy",
      isActive: true,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: "system"
    }
  },
  { upsert: true }
);

// Insert default bot detection rules (upsert each)
const defaultBotRules = [
  { id: "googlebot-search", name: "Googlebot Search", enabled: true, pattern: "googlebot", type: "userAgent", action: "render", priority: 100, botType: "search_engine", description: "Google search engine crawler", tags: ["google", "search", "crawler"] },
  { id: "bingbot-search", name: "Bingbot", enabled: true, pattern: "bingbot", type: "userAgent", action: "render", priority: 100, botType: "search_engine", description: "Microsoft Bing search engine crawler", tags: ["bing", "search", "crawler"] },
  { id: "facebook-external", name: "Facebook External Hit", enabled: true, pattern: "facebookexternalhit", type: "userAgent", action: "render", priority: 90, botType: "social", description: "Facebook crawler for link previews", tags: ["facebook", "social", "preview"] },
  { id: "twitter-bot", name: "Twitter Bot", enabled: true, pattern: "twitterbot", type: "userAgent", action: "render", priority: 90, botType: "social", description: "Twitter crawler for link previews", tags: ["twitter", "social", "preview"] }
];

defaultBotRules.forEach(function(rule) {
  db.bot_rules.updateOne(
    { id: rule.id },
    {
      $setOnInsert: {
        id: rule.id,
        name: rule.name,
        enabled: rule.enabled,
        pattern: rule.pattern,
        type: rule.type,
        action: rule.action,
        priority: rule.priority,
        botType: rule.botType,
        description: rule.description,
        tags: rule.tags,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdUser: "system"
      }
    },
    { upsert: true }
  );
});

// Create application user (safely)
print("Setting up users...");
try {
  db.createUser({
    user: "seo_shield_user",
    pwd: "seo_shield_password",
    roles: [{ role: "readWrite", db: "seo_shield_proxy" }]
  });
  print("  Created user: seo_shield_user");
} catch (e) {
  if (e.code === 51003) {
    print("  User already exists: seo_shield_user");
  } else {
    print("  Warning creating user: " + e.message);
  }
}

print("MongoDB initialization completed successfully!");
