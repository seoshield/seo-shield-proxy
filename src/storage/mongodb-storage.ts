import { MongoClient, Db, Collection, Document } from 'mongodb';

export interface TrafficMetric {
  timestamp: Date;
  path: string;
  userAgent: string;
  isBot: boolean;
  action: 'ssr' | 'proxy' | 'static' | 'bypass' | 'error';
  responseTime?: number;
  statusCode?: number;
  renderTime?: number;
  botType?: string;
  cacheStatus?: 'HIT' | 'MISS' | 'STALE';
  ip?: string;
  referer?: string;
  method?: string;
  responseSize?: number;
}

export interface ConfigVersion {
  id: string;
  version: string;
  config: any;
  createdAt: Date;
  createdBy?: string;
  description?: string;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  action: string;
  category: 'system' | 'security' | 'cache' | 'config' | 'traffic';
  level: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  data?: any;
  userId?: string;
  ip?: string;
  userAgent?: string;
}

export interface ErrorLog {
  id: string;
  timestamp: Date;
  error: string;
  stack?: string;
  context?: any;
  path?: string;
  method?: string;
  ip?: string;
  userAgent?: string;
  resolved: boolean;
  resolvedAt?: Date;
}

export class MongoDBStorage {
  private client: MongoClient;
  private db: Db;
  private connected: boolean = false;

  constructor(connectionString: string, databaseName: string = 'seo-shield-proxy') {
    this.client = new MongoClient(connectionString, {
      maxPoolSize: 10,
      retryWrites: true,
      retryReads: true,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      serverSelectionTimeoutMS: 5000,
    });

    this.db = this.client.db(databaseName);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      console.log('🔄 MongoDB connecting...');
    });

    this.client.on('connected', () => {
      console.log('✅ MongoDB connected');
    });

    this.client.on('error', (error) => {
      console.error('❌ MongoDB error:', error);
      this.connected = false;
    });

    this.client.on('close', () => {
      console.log('⚠️ MongoDB connection closed');
      this.connected = false;
    });

    this.client.on('reconnect', () => {
      console.log('🔄 MongoDB reconnecting...');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.connected = true;
      await this.createIndexes();
      console.log(`✅ MongoDB storage initialized`);
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      await this.client.close();
      this.connected = false;
    }
  }

  isReady(): boolean {
    return this.connected;
  }

  private async createIndexes(): Promise<void> {
    // Traffic metrics indexes
    const traffic = this.db.collection('traffic');
    await traffic.createIndex({ timestamp: -1 });
    await traffic.createIndex({ path: 1 });
    await traffic.createIndex({ isBot: 1 });
    await traffic.createIndex({ botType: 1 });
    await traffic.createIndex({ action: 1 });

    // Config version indexes
    const configVersions = this.db.collection('config_versions');
    await configVersions.createIndex({ version: -1 });
    await configVersions.createIndex({ createdAt: -1 });

    // Audit logs indexes
    const auditLogs = this.db.collection('audit_logs');
    await auditLogs.createIndex({ timestamp: -1 });
    await auditLogs.createIndex({ category: 1 });
    await auditLogs.createIndex({ level: 1 });
    await auditLogs.createIndex({ action: 1 });

    // Error logs indexes
    const errorLogs = this.db.collection('error_logs');
    await errorLogs.createIndex({ timestamp: -1 });
    await errorLogs.createIndex({ resolved: 1 });
    await errorLogs.createIndex({ level: 1 });

    console.log('📊 MongoDB indexes created');
  }

  // Traffic Metrics Methods
  async storeTrafficMetric(metric: TrafficMetric): Promise<void> {
    if (!this.connected) {
      console.warn('⚠️ MongoDB not connected, skipping traffic metric storage');
      return;
    }

    try {
      const collection = this.db.collection('traffic');
      await collection.insertOne(metric);
    } catch (error) {
      console.error('❌ Failed to store traffic metric:', error);
    }
  }

  async getTrafficMetrics(options: {
    startTime?: Date;
    endTime?: Date;
    limit?: number;
    offset?: number;
    filters?: {
      isBot?: boolean;
      botType?: string;
      action?: string;
      path?: string;
    };
  } = {}): Promise<TrafficMetric[]> {
    if (!this.connected) {
      return [];
    }

    try {
      const collection = this.db.collection('traffic');
      const query: Document = {};

      if (options.startTime || options.endTime) {
        query.timestamp = {};
        if (options.startTime) {
          query.timestamp.$gte = options.startTime;
        }
        if (options.endTime) {
          query.timestamp.$lte = options.endTime;
        }
      }

      if (options.filters) {
        if (options.filters.isBot !== undefined) {
          query.isBot = options.filters.isBot;
        }
        if (options.filters.botType) {
          query.botType = options.filters.botType;
        }
        if (options.filters.action) {
          query.action = options.filters.action;
        }
        if (options.filters.path) {
          query.path = { $regex: options.filters.path, $options: 'i' };
        }
      }

      let cursor = collection.find(query).sort({ timestamp: -1 });

      if (options.limit) {
        cursor = cursor.limit(options.limit);
      }

      if (options.offset) {
        cursor = cursor.skip(options.offset);
      }

      return await cursor.toArray() as unknown as TrafficMetric[];
    } catch (error) {
      console.error('❌ Failed to get traffic metrics:', error);
      return [];
    }
  }

  async getTrafficAggregation(timeRange: 'hour' | 'day' | 'week' | 'month'): Promise<any> {
    if (!this.connected) {
      return {};
    }

    try {
      const collection = this.db.collection('traffic');
      const now = new Date();
      let startTime: Date;

      switch (timeRange) {
        case 'hour':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case 'day':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      const pipeline = [
        {
          $match: {
            timestamp: { $gte: startTime, $lte: now }
          }
        },
        {
          $group: {
            _id: {
              hour: { $hour: '$timestamp' },
              action: '$action',
              isBot: '$isBot'
            },
            count: { $sum: 1 },
            avgResponseTime: { $avg: '$responseTime' },
            avgRenderTime: { $avg: '$renderTime' }
          }
        },
        {
          $group: {
            _id: '$_id.hour',
            metrics: {
              $push: {
                action: '$_id.action',
                isBot: '$_id.isBot',
                count: '$count',
                avgResponseTime: '$avgResponseTime',
                avgRenderTime: '$avgRenderTime'
              }
            }
          }
        }
      ];

      return await collection.aggregate(pipeline).toArray();
    } catch (error) {
      console.error('❌ Failed to get traffic aggregation:', error);
      return {};
    }
  }

  // Configuration Management Methods
  async saveConfig(config: any, description?: string, userId?: string): Promise<string> {
    if (!this.connected) {
      throw new Error('MongoDB not connected');
    }

    try {
      const collection = this.db.collection('config_versions');
      const version = `v${Date.now()}`;

      const configVersion: ConfigVersion = {
        id: new Date().toISOString(),
        version,
        config,
        createdAt: new Date(),
        createdBy: userId,
        description
      };

      await collection.insertOne(configVersion);
      console.log(`💾 Configuration saved as version: ${version}`);
      return version;
    } catch (error) {
      console.error('❌ Failed to save config:', error);
      throw error;
    }
  }

  async loadConfig(version?: string): Promise<any | null> {
    if (!this.connected) {
      return null;
    }

    try {
      const collection = this.db.collection('config_versions');
      const query = version ? { version } : {};

      const result = await collection.findOne(query, { sort: { createdAt: -1 as const } });
      return result ? result.config : null;
    } catch (error) {
      console.error('❌ Failed to load config:', error);
      return null;
    }
  }

  async getConfigHistory(limit: number = 10): Promise<ConfigVersion[]> {
    if (!this.connected) {
      return [];
    }

    try {
      const collection = this.db.collection('config_versions');
      return await collection.find({}, { sort: { createdAt: -1 } }).limit(limit).toArray() as unknown as ConfigVersion[];
    } catch (error) {
      console.error('❌ Failed to get config history:', error);
      return [];
    }
  }

  async rollbackConfig(version: string): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      const collection = this.db.collection('config_versions');
      const configVersion = await collection.findOne({ version });

      if (!configVersion) {
        return false;
      }

      // Here you would trigger a configuration reload
      console.log(`🔄 Configuration rolled back to: ${version}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to rollback config:', error);
      return false;
    }
  }

  // Audit Logging Methods
  async logAudit(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    if (!this.connected) {
      console.warn('⚠️ MongoDB not connected, skipping audit log');
      return;
    }

    try {
      const collection = this.db.collection('audit_logs');
      const auditLog: AuditLog = {
        id: new Date().toISOString(),
        timestamp: new Date(),
        ...log
      };

      await collection.insertOne(auditLog);
    } catch (error) {
      console.error('❌ Failed to log audit:', error);
    }
  }

  async getAuditLogs(options: {
    startTime?: Date;
    endTime?: Date;
    category?: string;
    level?: string;
    action?: string;
    limit?: number;
  } = {}): Promise<AuditLog[]> {
    if (!this.connected) {
      return [];
    }

    try {
      const collection = this.db.collection('audit_logs');
      const query: Document = {};

      if (options.startTime || options.endTime) {
        query.timestamp = {};
        if (options.startTime) {
          query.timestamp.$gte = options.startTime;
        }
        if (options.endTime) {
          query.timestamp.$lte = options.endTime;
        }
      }

      if (options.category) {
        query.category = options.category;
      }
      if (options.level) {
        query.level = options.level;
      }
      if (options.action) {
        query.action = { $regex: options.action, $options: 'i' };
      }

      let cursor = collection.find(query).sort({ timestamp: -1 });

      if (options.limit) {
        cursor = cursor.limit(options.limit);
      }

      return await cursor.toArray() as unknown as AuditLog[];
    } catch (error) {
      console.error('❌ Failed to get audit logs:', error);
      return [];
    }
  }

  // Error Logging Methods
  async logError(error: Omit<ErrorLog, 'id' | 'timestamp'>): Promise<string> {
    if (!this.connected) {
      console.warn('⚠️ MongoDB not connected, skipping error log');
      return '';
    }

    try {
      const collection = this.db.collection('error_logs');
      const errorLog: ErrorLog = {
        id: new Date().toISOString(),
        timestamp: new Date(),
        resolved: false,
        ...error
      };

      await collection.insertOne(errorLog);
      return errorLog.id;
    } catch (mongoError) {
      console.error('❌ Failed to log error:', mongoError);
      return '';
    }
  }

  async resolveError(errorId: string): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      const collection = this.db.collection('error_logs');
      const result = await collection.updateOne(
        { id: errorId },
        { $set: { resolved: true, resolvedAt: new Date() } }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      console.error('❌ Failed to resolve error:', error);
      return false;
    }
  }

  async getErrorLogs(options: {
    startTime?: Date;
    endTime?: Date;
    resolved?: boolean;
    limit?: number;
  } = {}): Promise<ErrorLog[]> {
    if (!this.connected) {
      return [];
    }

    try {
      const collection = this.db.collection('error_logs');
      const query: Document = {};

      if (options.startTime || options.endTime) {
        query.timestamp = {};
        if (options.startTime) {
          query.timestamp.$gte = options.startTime;
        }
        if (options.endTime) {
          query.timestamp.$lte = options.endTime;
        }
      }

      if (options.resolved !== undefined) {
        query.resolved = options.resolved;
      }

      let cursor = collection.find(query).sort({ timestamp: -1 });

      if (options.limit) {
        cursor = cursor.limit(options.limit);
      }

      return await cursor.toArray() as unknown as ErrorLog[];
    } catch (error) {
      console.error('❌ Failed to get error logs:', error);
      return [];
    }
  }

  // Utility Methods
  async clearOldRecords(daysToKeep: number = 30): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

      // Clear old traffic metrics
      const traffic = this.db.collection('traffic');
      await traffic.deleteMany({ timestamp: { $lt: cutoffDate } });

      // Clear old audit logs
      const auditLogs = this.db.collection('audit_logs');
      await auditLogs.deleteMany({ timestamp: { $lt: cutoffDate } });

      // Clear resolved error logs older than retention period
      const errorLogs = this.db.collection('error_logs');
      await errorLogs.deleteMany({
        timestamp: { $lt: cutoffDate },
        resolved: true
      });

      console.log(`🗑️ Cleared records older than ${daysToKeep} days`);
    } catch (error) {
      console.error('❌ Failed to clear old records:', error);
    }
  }

  async getDatabaseStats(): Promise<any> {
    if (!this.connected) {
      return {};
    }

    try {
      const dbStats = await this.db.stats();
      const collections = await this.db.listCollections().toArray();

      const stats: any = {
        database: dbStats.db,
        collections: [],
        totalSize: dbStats.storageSize
      };

      for (const collection of collections) {
        const coll = this.db.collection(collection.name);
        const count = await coll.countDocuments();
        stats.collections.push({
          name: collection.name,
          count: count,
          size: 0 // Size not easily available in newer MongoDB drivers
        });
      }

      return stats;
    } catch (error) {
      console.error('❌ Failed to get database stats:', error);
      return {};
    }
  }
}

/**
 * MongoStorage - Wrapper that accepts an existing Db connection
 * Used by DatabaseManager which handles its own connection
 */
export class MongoStorage {
  private db: Db;
  private connected: boolean = true;

  constructor(db: Db) {
    this.db = db;
  }

  isReady(): boolean {
    return this.connected;
  }

  async storeTrafficMetric(metric: TrafficMetric): Promise<void> {
    try {
      const collection = this.db.collection('traffic');
      await collection.insertOne(metric);
    } catch (error) {
      console.error('❌ Failed to store traffic metric:', error);
    }
  }

  async getTrafficMetrics(limit: number = 100, options: {
    sortBy?: string;
    sortOrder?: number;
    startTime?: Date;
    endTime?: Date;
    offset?: number;
    filters?: {
      isBot?: boolean;
      botType?: string;
      action?: string;
      path?: string;
    };
  } = {}): Promise<TrafficMetric[]> {
    try {
      const collection = this.db.collection('traffic');
      const query: Document = {};

      if (options.startTime || options.endTime) {
        query.timestamp = {};
        if (options.startTime) {
          query.timestamp.$gte = options.startTime;
        }
        if (options.endTime) {
          query.timestamp.$lte = options.endTime;
        }
      }

      if (options.filters) {
        if (options.filters.isBot !== undefined) {
          query.isBot = options.filters.isBot;
        }
        if (options.filters.botType) {
          query.botType = options.filters.botType;
        }
        if (options.filters.action) {
          query.action = options.filters.action;
        }
        if (options.filters.path) {
          query.path = { $regex: options.filters.path, $options: 'i' };
        }
      }

      const sortField = options.sortBy || 'timestamp';
      const sortDir = options.sortOrder || -1;
      let cursor = collection.find(query).sort({ [sortField]: sortDir } as any);

      if (limit) {
        cursor = cursor.limit(limit);
      }

      if (options.offset) {
        cursor = cursor.skip(options.offset);
      }

      return await cursor.toArray() as unknown as TrafficMetric[];
    } catch (error) {
      console.error('❌ Failed to get traffic metrics:', error);
      return [];
    }
  }

  async logAudit(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    try {
      const collection = this.db.collection('audit_logs');
      const auditLog: AuditLog = {
        id: new Date().toISOString(),
        timestamp: new Date(),
        ...log
      };

      await collection.insertOne(auditLog);
    } catch (error) {
      console.error('❌ Failed to log audit:', error);
    }
  }

  async getAuditLogs(limit: number = 100, options: {
    offset?: number;
    category?: string;
    userId?: string;
    startTime?: Date;
    endTime?: Date;
    level?: string;
    action?: string;
  } = {}): Promise<AuditLog[]> {
    try {
      const collection = this.db.collection('audit_logs');
      const query: Document = {};

      if (options.startTime || options.endTime) {
        query.timestamp = {};
        if (options.startTime) {
          query.timestamp.$gte = options.startTime;
        }
        if (options.endTime) {
          query.timestamp.$lte = options.endTime;
        }
      }

      if (options.category) {
        query.category = options.category;
      }
      if (options.level) {
        query.level = options.level;
      }
      if (options.action) {
        query.action = { $regex: options.action, $options: 'i' };
      }
      if (options.userId) {
        query.userId = options.userId;
      }

      let cursor = collection.find(query).sort({ timestamp: -1 });

      if (limit) {
        cursor = cursor.limit(limit);
      }

      if (options.offset) {
        cursor = cursor.skip(options.offset);
      }

      return await cursor.toArray() as unknown as AuditLog[];
    } catch (error) {
      console.error('❌ Failed to get audit logs:', error);
      return [];
    }
  }

  async logError(error: Omit<ErrorLog, 'id' | 'timestamp'>): Promise<string> {
    try {
      const collection = this.db.collection('error_logs');
      const errorLog: ErrorLog = {
        id: new Date().toISOString(),
        timestamp: new Date(),
        resolved: false,
        ...error
      };

      await collection.insertOne(errorLog);
      return errorLog.id;
    } catch (mongoError) {
      console.error('❌ Failed to log error:', mongoError);
      return '';
    }
  }

  async getErrorLogs(limit: number = 100, options: {
    offset?: number;
    severity?: string;
    category?: string;
    url?: string;
    startTime?: Date;
    endTime?: Date;
    resolved?: boolean;
  } = {}): Promise<ErrorLog[]> {
    try {
      const collection = this.db.collection('error_logs');
      const query: Document = {};

      if (options.startTime || options.endTime) {
        query.timestamp = {};
        if (options.startTime) {
          query.timestamp.$gte = options.startTime;
        }
        if (options.endTime) {
          query.timestamp.$lte = options.endTime;
        }
      }

      if (options.resolved !== undefined) {
        query.resolved = options.resolved;
      }

      if (options.severity) {
        query.severity = options.severity;
      }

      if (options.category) {
        query.category = options.category;
      }

      if (options.url) {
        query.path = { $regex: options.url, $options: 'i' };
      }

      let cursor = collection.find(query).sort({ timestamp: -1 });

      if (limit) {
        cursor = cursor.limit(limit);
      }

      if (options.offset) {
        cursor = cursor.skip(options.offset);
      }

      return await cursor.toArray() as unknown as ErrorLog[];
    } catch (error) {
      console.error('❌ Failed to get error logs:', error);
      return [];
    }
  }

  // Config Management Methods
  async getConfig(key: string): Promise<any | null> {
    try {
      const collection = this.db.collection('configurations');
      const result = await collection.findOne({ key });
      return result ? result.value : null;
    } catch (error) {
      console.error('❌ Failed to get config:', error);
      return null;
    }
  }

  async saveConfig(config: any, description?: string, userId?: string): Promise<string> {
    try {
      const collection = this.db.collection('configurations');
      const version = `v${Date.now()}`;

      await collection.updateOne(
        { key: 'runtime_config' },
        {
          $set: {
            key: 'runtime_config',
            value: config,
            description: description || 'Configuration update',
            version,
            updatedAt: new Date(),
            userId: userId || 'system'
          },
          $setOnInsert: {
            createdAt: new Date()
          }
        },
        { upsert: true }
      );

      // Also save to version history
      const versionsCollection = this.db.collection('config_versions');
      await versionsCollection.insertOne({
        id: new Date().toISOString(),
        version,
        config,
        createdAt: new Date(),
        createdBy: userId,
        description
      });

      console.log(`💾 Configuration saved as version: ${version}`);
      return version;
    } catch (error) {
      console.error('❌ Failed to save config:', error);
      throw error;
    }
  }

  // Database Stats
  async getStats(): Promise<any> {
    try {
      const dbStats = await this.db.stats();
      const collections = await this.db.listCollections().toArray();

      const stats: any = {
        database: dbStats.db,
        collections: [],
        totalSize: dbStats.storageSize
      };

      for (const collection of collections) {
        const coll = this.db.collection(collection.name);
        const count = await coll.countDocuments();
        stats.collections.push({
          name: collection.name,
          count: count,
          size: 0
        });
      }

      return stats;
    } catch (error) {
      console.error('❌ Failed to get database stats:', error);
      return {};
    }
  }
}