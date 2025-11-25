import { Db } from 'mongodb';

/**
 * Initial database migration - creates collections and indexes
 */
export async function up(db: Db): Promise<void> {
  console.log('Running migration: 001-initial-setup');

  // Create collections if they don't exist
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(c => c.name);

  // Traffic metrics collection
  if (!collectionNames.includes('traffic')) {
    await db.createCollection('traffic');
    console.log('  Created collection: traffic');
  }

  // Config versions collection
  if (!collectionNames.includes('config_versions')) {
    await db.createCollection('config_versions');
    console.log('  Created collection: config_versions');
  }

  // Audit logs collection
  if (!collectionNames.includes('audit_logs')) {
    await db.createCollection('audit_logs');
    console.log('  Created collection: audit_logs');
  }

  // Error logs collection
  if (!collectionNames.includes('error_logs')) {
    await db.createCollection('error_logs');
    console.log('  Created collection: error_logs');
  }

  // Bot rules collection
  if (!collectionNames.includes('bot_rules')) {
    await db.createCollection('bot_rules');
    console.log('  Created collection: bot_rules');
  }

  // Create indexes
  console.log('  Creating indexes...');

  // Traffic indexes
  const traffic = db.collection('traffic');
  await traffic.createIndex({ timestamp: -1 });
  await traffic.createIndex({ path: 1 });
  await traffic.createIndex({ isBot: 1 });
  await traffic.createIndex({ botType: 1 });
  await traffic.createIndex({ action: 1 });
  await traffic.createIndex({ timestamp: -1, isBot: 1 });

  // Config versions indexes
  const configVersions = db.collection('config_versions');
  await configVersions.createIndex({ version: -1 });
  await configVersions.createIndex({ createdAt: -1 });

  // Audit logs indexes
  const auditLogs = db.collection('audit_logs');
  await auditLogs.createIndex({ timestamp: -1 });
  await auditLogs.createIndex({ category: 1 });
  await auditLogs.createIndex({ level: 1 });
  await auditLogs.createIndex({ action: 1 });

  // Error logs indexes
  const errorLogs = db.collection('error_logs');
  await errorLogs.createIndex({ timestamp: -1 });
  await errorLogs.createIndex({ resolved: 1 });

  // Bot rules indexes
  const botRules = db.collection('bot_rules');
  await botRules.createIndex({ enabled: 1 });
  await botRules.createIndex({ type: 1 });
  await botRules.createIndex({ priority: -1 });

  console.log('Migration 001-initial-setup completed successfully');
}

export async function down(db: Db): Promise<void> {
  console.log('Rolling back migration: 001-initial-setup');

  // Drop all collections (use with caution!)
  await db.collection('traffic').drop().catch(() => {});
  await db.collection('config_versions').drop().catch(() => {});
  await db.collection('audit_logs').drop().catch(() => {});
  await db.collection('error_logs').drop().catch(() => {});
  await db.collection('bot_rules').drop().catch(() => {});

  console.log('Rollback 001-initial-setup completed');
}
