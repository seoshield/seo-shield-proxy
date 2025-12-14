import { MongoClient, Db } from 'mongodb';
import config from '../config';
import { MongoStorage } from '../storage/mongodb-storage';
import { Logger } from '../utils/logger';

const logger = new Logger('DatabaseManager');

/**
 * Database manager - Handles MongoDB connection and provides access to storage services
 */
export class DatabaseManager {
  private static instance: DatabaseManager;
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private mongoStorage: MongoStorage | null = null;
  private isConnected = false;

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  async connect(): Promise<boolean> {
    try {
      logger.info('Connecting to MongoDB...');
      this.client = new MongoClient(config.MONGODB_URL);

      await this.client.connect();
      this.db = this.client.db(config.MONGODB_DB_NAME);
      this.mongoStorage = new MongoStorage(this.db);

      // Test connection
      await this.db.admin().ping();

      this.isConnected = true;
      logger.info(
        `MongoDB connected successfully: ${config.MONGODB_URL}/${config.MONGODB_DB_NAME}`
      );

      // Initialize collections with indexes
      await this.initializeIndexes();

      return true;
    } catch (error) {
      logger.error('MongoDB connection failed:', (error as Error).message);
      this.isConnected = false;
      this.client = null;
      this.db = null;
      this.mongoStorage = null;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.mongoStorage = null;
      this.isConnected = false;
      logger.info('MongoDB disconnected');
    }
  }

  getMongoStorage(): MongoStorage | null {
    return this.mongoStorage;
  }

  getDb(): Db | null {
    return this.db;
  }

  isDbConnected(): boolean {
    return this.isConnected && this.db !== null;
  }

  private async initializeIndexes(): Promise<void> {
    if (!this.db) return;

    try {
      // NOTE: These indexes are also created by migrations (docker/migration/run-migrations.js)
      // This is a fallback for development environments without running migrations
      // MongoDB createIndexes is idempotent - existing indexes are skipped gracefully

      // Traffic metrics indexes for efficient queries
      await this.db.collection('traffic_metrics').createIndexes([
        { key: { timestamp: -1 } }, // For time-based queries
        { key: { path: 1, timestamp: -1 } }, // For path-specific traffic
        { key: { ip: 1, timestamp: -1 } }, // For IP-based analysis
        { key: { isBot: 1, timestamp: -1 } }, // For bot/human analysis
      ]);

      // Configurations indexes
      await this.db.collection('configurations').createIndexes([
        { key: { key: 1 }, unique: true }, // For config lookups
        { key: { createdAt: -1 } }, // For versioning
        { key: { isActive: 1, updatedAt: -1 } }, // For active configs
      ]);

      // Audit logs indexes
      await this.db.collection('audit_logs').createIndexes([
        { key: { timestamp: -1 } }, // For recent logs
        { key: { action: 1, timestamp: -1 } }, // For action-specific logs
        { key: { userId: 1, timestamp: -1 } }, // For user activity
        { key: { category: 1, timestamp: -1 } }, // For category filtering
      ]);

      // Error logs indexes
      await this.db.collection('error_logs').createIndexes([
        { key: { timestamp: -1 } }, // For recent errors
        { key: { severity: 1, timestamp: -1 } }, // For severity filtering
        { key: { category: 1, timestamp: -1 } }, // For error categories
        { key: { url: 1, timestamp: -1 } }, // For URL-specific errors
      ]);

      logger.info('MongoDB indexes initialized successfully');
    } catch (error) {
      logger.warn('Failed to initialize MongoDB indexes:', (error as Error).message);
    }
  }

  async healthCheck(): Promise<{ connected: boolean; stats?: any }> {
    if (!this.isConnected || !this.db) {
      return { connected: false };
    }

    try {
      const stats = await this.db.stats();
      return {
        connected: true,
        stats: {
          collections: stats.collections,
          dataSize: stats.dataSize,
          indexSize: stats.indexSize,
          storageSize: stats.storageSize,
        },
      };
    } catch (_error) {
      return { connected: false };
    }
  }
}

// Export singleton instance
export const databaseManager = DatabaseManager.getInstance();
