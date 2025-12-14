import { MongoClient, Db } from 'mongodb';
import * as migration001 from './001-initial-setup';

interface Migration {
  name: string;
  up: (db: Db) => Promise<void>;
  down: (db: Db) => Promise<void>;
}

const migrations: Migration[] = [{ name: '001-initial-setup', ...migration001 }];

async function runMigrations(): Promise<void> {
  const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017';
  const dbName = process.env.MONGODB_DB_NAME || 'seo_shield_proxy';

  console.log(`Connecting to MongoDB: ${mongoUrl}`);
  const client = new MongoClient(mongoUrl);

  try {
    await client.connect();
    const db = client.db(dbName);
    console.log(`Connected to database: ${dbName}`);

    // Create migrations tracking collection
    const migrationsCollection = db.collection('_migrations');

    for (const migration of migrations) {
      // Check if migration already ran
      const existing = await migrationsCollection.findOne({ name: migration.name });
      if (existing) {
        console.log(`Skipping migration ${migration.name} (already applied)`);
        continue;
      }

      // Run migration
      console.log(`Running migration: ${migration.name}`);
      await migration.up(db);

      // Record migration
      await migrationsCollection.insertOne({
        name: migration.name,
        appliedAt: new Date(),
      });
      console.log(`Migration ${migration.name} completed`);
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations();
}

export { runMigrations, migrations };
