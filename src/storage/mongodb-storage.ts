import { Db, Document } from 'mongodb';
import { Logger } from '../utils/logger';

const logger = new Logger('MongoStorage');

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
      const collection = this.db.collection('traffic_metrics');
      await collection.insertOne(metric);
    } catch (error) {
      logger.error('Failed to store traffic metric:', error);
    }
  }

  async getTrafficMetrics(
    limit: number = 100,
    options: {
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
    } = {}
  ): Promise<TrafficMetric[]> {
    try {
      const collection = this.db.collection('traffic_metrics');
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

      return (await cursor.toArray()) as unknown as TrafficMetric[];
    } catch (error) {
      logger.error('Failed to get traffic metrics:', error);
      return [];
    }
  }

  async logAudit(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
    try {
      const collection = this.db.collection('audit_logs');
      const auditLog: AuditLog = {
        id: new Date().toISOString(),
        timestamp: new Date(),
        ...log,
      };

      await collection.insertOne(auditLog);
    } catch (error) {
      logger.error('Failed to log audit:', error);
    }
  }

  async getAuditLogs(
    limit: number = 100,
    options: {
      offset?: number;
      category?: string;
      userId?: string;
      startTime?: Date;
      endTime?: Date;
      level?: string;
      action?: string;
    } = {}
  ): Promise<AuditLog[]> {
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

      return (await cursor.toArray()) as unknown as AuditLog[];
    } catch (error) {
      logger.error('Failed to get audit logs:', error);
      return [];
    }
  }

  async logError(error: Omit<ErrorLog, 'id' | 'timestamp'>): Promise<string> {
    try {
      const collection = this.db.collection('error_logs');
      const errorLog: ErrorLog = {
        id: new Date().toISOString(),
        timestamp: new Date(),
        ...error,
        resolved: error.resolved ?? false,
      };

      await collection.insertOne(errorLog);
      return errorLog.id;
    } catch (mongoError) {
      logger.error('Failed to log error:', mongoError);
      return '';
    }
  }

  async getErrorLogs(
    limit: number = 100,
    options: {
      offset?: number;
      severity?: string;
      category?: string;
      url?: string;
      startTime?: Date;
      endTime?: Date;
      resolved?: boolean;
    } = {}
  ): Promise<ErrorLog[]> {
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

      return (await cursor.toArray()) as unknown as ErrorLog[];
    } catch (error) {
      logger.error('Failed to get error logs:', error);
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
      logger.error('Failed to get config:', error);
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
            userId: userId || 'system',
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
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
        description,
      });

      logger.info(`Configuration saved as version: ${version}`);
      return version;
    } catch (error) {
      logger.error('Failed to save config:', error);
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
        totalSize: dbStats.storageSize,
      };

      for (const collection of collections) {
        const coll = this.db.collection(collection.name);
        const count = await coll.countDocuments();
        stats.collections.push({
          name: collection.name,
          count: count,
          size: 0,
        });
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get database stats:', error);
      return {};
    }
  }
}
