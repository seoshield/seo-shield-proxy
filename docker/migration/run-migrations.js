#!/usr/bin/env node

/**
 * Database Migration Runner for SEO Shield Proxy
 * Runs MongoDB migrations and seeds initial data
 */

const { MongoClient } = require('mongodb');

// Load configuration
require('dotenv').config();

// Use localhost for local development, mongodb for Docker
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://admin:admin123@localhost:27017/seo_shield_proxy?authSource=admin';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'seo_shield_proxy';

async function runMigrations() {
  console.log('🔄 Starting database migrations...');

  const client = new MongoClient(MONGODB_URL);

  try {
    // Connect to MongoDB
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(MONGODB_DB_NAME);

    // Run migrations
    console.log('📊 Running database migrations...');

    // Create collections with validation and indexes
    await createCollections(db);

    // Seed initial data
    await seedInitialData(db);

    console.log('✅ Database migrations completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('🔌 MongoDB connection closed');
  }
}

async function createCollections(db) {
  // Helper function to safely create collection
  async function safeCreateCollection(name, options) {
    try {
      await db.createCollection(name, options);
      console.log(`✅ ${name} collection created`);
    } catch (error) {
      if (error.code === 48) {
        // Collection already exists
        console.log(`⏭️  ${name} collection already exists, skipping creation`);
      } else {
        throw error;
      }
    }
  }

  // Traffic metrics collection
  await safeCreateCollection('traffic_metrics', {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["timestamp", "method", "path", "ip", "userAgent", "isBot"],
        properties: {
          timestamp: { bsonType: "long" },
          method: { bsonType: "string" },
          path: { bsonType: "string" },
          ip: { bsonType: "string" },
          userAgent: { bsonType: "string" },
          referer: { bsonType: "string" },
          isBot: { bsonType: "bool" },
          botType: { bsonType: "string" },
          botConfidence: { bsonType: "double" },
          botRulesMatched: { bsonType: "array" },
          statusCode: { bsonType: "int" },
          responseTime: { bsonType: "long" },
          responseSize: { bsonType: "long" }
        }
      }
    }
  });

  // Create indexes for traffic metrics (safe to run even if they exist)
  try {
    await db.collection('traffic_metrics').createIndex({ "timestamp": -1 });
    await db.collection('traffic_metrics').createIndex({ "path": 1, "timestamp": -1 });
    await db.collection('traffic_metrics').createIndex({ "ip": 1, "timestamp": -1 });
    await db.collection('traffic_metrics').createIndex({ "isBot": 1, "timestamp": -1 });
    await db.collection('traffic_metrics').createIndex(
      { "timestamp": 1 },
      { expireAfterSeconds: 2592000 }
    );
    console.log('  ✅ Traffic metrics indexes created');
  } catch (e) {
    console.log('  ⏭️  Traffic metrics indexes already exist');
  }

  // Configurations collection
  await safeCreateCollection('configurations', {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["key", "value", "createdAt"],
        properties: {
          key: { bsonType: "string" },
          value: { bsonType: "object" },
          description: { bsonType: "string" },
          isActive: { bsonType: "bool" },
          version: { bsonType: "int" },
          createdAt: { bsonType: "date" },
          updatedAt: { bsonType: "date" },
          userId: { bsonType: "string" }
        }
      }
    }
  });

  try {
    await db.collection('configurations').createIndex({ "key": 1 }, { unique: true });
    await db.collection('configurations').createIndex({ "createdAt": -1 });
    console.log('  ✅ Configurations indexes created');
  } catch (e) {
    console.log('  ⏭️  Configurations indexes already exist');
  }

  // Audit logs collection
  await safeCreateCollection('audit_logs', {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["action", "timestamp", "category", "severity", "userId"],
        properties: {
          action: { bsonType: "string" },
          details: { bsonType: "string" },
          category: { bsonType: "string" },
          severity: { bsonType: "string" },
          userId: { bsonType: "string" },
          ipAddress: { bsonType: "string" },
          userAgent: { bsonType: "string" },
          sessionId: { bsonType: "string" },
          timestamp: { bsonType: "date" }
        }
      }
    }
  });

  try {
    await db.collection('audit_logs').createIndex({ "timestamp": -1 });
    await db.collection('audit_logs').createIndex({ "action": 1, "timestamp": -1 });
    await db.collection('audit_logs').createIndex({ "userId": 1, "timestamp": -1 });
    await db.collection('audit_logs').createIndex(
      { "timestamp": 1 },
      { expireAfterSeconds: 7776000 }
    );
    console.log('  ✅ Audit logs indexes created');
  } catch (e) {
    console.log('  ⏭️  Audit logs indexes already exist');
  }

  // Error logs collection
  await safeCreateCollection('error_logs', {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["message", "timestamp", "category", "severity"],
        properties: {
          message: { bsonType: "string" },
          stack: { bsonType: "string" },
          category: { bsonType: "string" },
          severity: { bsonType: "string" },
          url: { bsonType: "string" },
          userAgent: { bsonType: "string" },
          ipAddress: { bsonType: "string" },
          context: { bsonType: "object" },
          timestamp: { bsonType: "date" }
        }
      }
    }
  });

  try {
    await db.collection('error_logs').createIndex({ "timestamp": -1 });
    await db.collection('error_logs').createIndex({ "severity": 1, "timestamp": -1 });
    await db.collection('error_logs').createIndex({ "category": 1, "timestamp": -1 });
    await db.collection('error_logs').createIndex(
      { "timestamp": 1 },
      { expireAfterSeconds: 2592000 }
    );
    console.log('  ✅ Error logs indexes created');
  } catch (e) {
    console.log('  ⏭️  Error logs indexes already exist');
  }

  // Bot rules collection
  await safeCreateCollection('bot_rules', {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["id", "name", "enabled", "pattern", "type", "action", "priority", "createdAt"],
        properties: {
          id: { bsonType: "string" },
          name: { bsonType: "string" },
          enabled: { bsonType: "bool" },
          pattern: { bsonType: "string" },
          type: { bsonType: "string" },
          action: { bsonType: "string" },
          priority: { bsonType: "int" },
          botType: { bsonType: "string" },
          description: { bsonType: "string" },
          tags: { bsonType: "array" },
          createdAt: { bsonType: "date" },
          updatedAt: { bsonType: "date" },
          createdUser: { bsonType: "string" }
        }
      }
    }
  });

  try {
    await db.collection('bot_rules').createIndex({ "id": 1 }, { unique: true });
    await db.collection('bot_rules').createIndex({ "enabled": 1, "priority": -1 });
    console.log('  ✅ Bot rules indexes created');
  } catch (e) {
    console.log('  ⏭️  Bot rules indexes already exist');
  }

  // IP reputation collection
  await safeCreateCollection('ip_reputation', {
    validator: {
      $jsonSchema: {
        bsonType: "object",
        required: ["ip", "reputation", "category", "lastSeen", "requestCount", "blockedCount"],
        properties: {
          ip: { bsonType: "string" },
          reputation: { bsonType: "string" },
          category: { bsonType: "string" },
          lastSeen: { bsonType: "date" },
          requestCount: { bsonType: "long" },
          blockedCount: { bsonType: "long" },
          source: { bsonType: "string" },
          metadata: { bsonType: "object" }
        }
      }
    }
  });

  try {
    await db.collection('ip_reputation').createIndex({ "ip": 1 }, { unique: true });
    await db.collection('ip_reputation').createIndex({ "reputation": 1, "lastSeen": -1 });
    await db.collection('ip_reputation').createIndex(
      { "lastSeen": 1 },
      { expireAfterSeconds: 604800 }
    );
    console.log('  ✅ IP reputation indexes created');
  } catch (e) {
    console.log('  ⏭️  IP reputation indexes already exist');
  }

  console.log('✅ All collections and indexes configured');
}

async function seedInitialData(db) {
  console.log('📝 Seeding initial data...');

  // Insert default configuration
  await db.collection('configurations').updateOne(
    { key: "runtime_config" },
    {
      $set: {
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
              waitAfterScroll: 500,
              scrollSelectors: ["main", ".content", "#app"],
              infiniteScrollSelectors: [".load-more", ".infinite-scroll"],
              lazyImageSelectors: ["img[data-src]", "img[loading='lazy']"],
              triggerIntersectionObserver: true,
              maxScrollTime: 30000,
              scrollSettleTime: 2000
            },
            etagStrategy: {
              enabled: true,
              hashAlgorithm: "md5",
              enable304Responses: true,
              checkContentChanges: true,
              ignoredElements: ["script", "style"],
              significantChanges: true
            },
            clusterMode: {
              enabled: false,
              useRedisQueue: true,
              maxWorkers: 4,
              jobTimeout: 60000,
              retryAttempts: 3,
              retryDelay: 5000,
              browser: {
                headless: true,
                args: ["--no-sandbox", "--disable-setuid-sandbox"]
              }
            },
            shadowDom: {
              enabled: false,
              deepSerialization: true,
              includeShadowContent: true,
              flattenShadowTrees: false,
              customElements: [],
              preserveShadowBoundaries: true,
              extractCSSVariables: true,
              extractComputedStyles: false
            },
            circuitBreaker: {
              enabled: true,
              errorThreshold: 5,
              resetTimeout: 30000,
              monitoringPeriod: 60000,
              fallbackToStale: true,
              halfOpenMaxCalls: 3,
              failureThreshold: 5,
              successThreshold: 2,
              timeoutThreshold: 30000
            }
          },
          cacheWarmer: {
            sitemapUrl: "",
            warmupSchedule: "0 2 * * *",
            maxConcurrentWarmups: 3
          },
          snapshotService: {
            diffThreshold: 0.1
          },
          userAgent: "Mozilla/5.0 (compatible; SEOShieldProxy/1.0; +https://github.com/seoshield/seo-shield-proxy)"
        },
        description: "Default runtime configuration for SEO Shield Proxy",
        isActive: true,
        version: 1,
        updatedAt: new Date(),
        userId: "system"
      }
    },
    { upsert: true }
  );

  // Insert default bot detection rules
  const defaultBotRules = [
    {
      id: "googlebot-search",
      name: "Googlebot Search",
      enabled: true,
      pattern: "googlebot",
      type: "userAgent",
      action: "render",
      priority: 100,
      botType: "search_engine",
      description: "Google search engine crawler",
      tags: ["google", "search", "crawler"],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdUser: "system"
    },
    {
      id: "bingbot-search",
      name: "Bingbot",
      enabled: true,
      pattern: "bingbot",
      type: "userAgent",
      action: "render",
      priority: 100,
      botType: "search_engine",
      description: "Microsoft Bing search engine crawler",
      tags: ["bing", "search", "crawler"],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdUser: "system"
    },
    {
      id: "facebook-external",
      name: "Facebook External Hit",
      enabled: true,
      pattern: "facebookexternalhit",
      type: "userAgent",
      action: "render",
      priority: 90,
      botType: "social",
      description: "Facebook crawler for link previews",
      tags: ["facebook", "social", "preview"],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdUser: "system"
    },
    {
      id: "twitter-bot",
      name: "Twitter Bot",
      enabled: true,
      pattern: "twitterbot",
      type: "userAgent",
      action: "render",
      priority: 90,
      botType: "social",
      description: "Twitter crawler for link previews",
      tags: ["twitter", "social", "preview"],
      createdAt: new Date(),
      updatedAt: new Date(),
      createdUser: "system"
    }
  ];

  for (const rule of defaultBotRules) {
    await db.collection('bot_rules').updateOne(
      { id: rule.id },
      { $set: rule },
      { upsert: true }
    );
  }

  console.log('✅ Initial data seeded successfully');
}

// Run migrations if this script is executed directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };