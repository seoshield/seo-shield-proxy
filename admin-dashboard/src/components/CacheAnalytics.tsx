import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

import { apiCall } from '../config/api';

interface CacheEntry {
  url: string;
  timestamp: number;
  size: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  renderTime?: number;
  statusCode: number;
  userAgent?: string;
  cacheKey: string;
  isStale?: boolean;
}

interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  avgTtl: number;
  avgSize: number;
  oldestEntry: number;
  newestEntry: number;
  entriesBySize: Array<{ size: number; count: number }>;
  entriesByTtl: Array<{ ttl: number; count: number }>;
}

export default function CacheAnalytics() {
  const [entries, setEntries] = useState<CacheEntry[]>([]);
  const [stats, setStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<CacheEntry | null>(null);
  const [sortBy, setSortBy] = useState<'timestamp' | 'size' | 'accessCount' | 'ttl'>('timestamp');
  const [filterStale, setFilterStale] = useState(false);

  useEffect(() => {
    fetchCacheData();
    const interval = setInterval(fetchCacheData, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchCacheData = async () => {
    try {
      const response = await apiCall('/cache/analytics');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
          setEntries(data.entries || []);
        }
      }
    } catch (error) {
      console.error('Failed to fetch cache analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearCacheEntry = async (cacheKey: string) => {
    try {
      const response = await apiCall('/cache/entry', {
        method: 'DELETE',
        body: JSON.stringify({ cacheKey }),
      });
      if (response.ok) {
        fetchCacheData();
        setSelectedEntry(null);
      }
    } catch (error) {
      console.error('Failed to clear cache entry:', error);
    }
  };

  const refreshCacheEntry = async (cacheKey: string) => {
    try {
      const response = await apiCall('/cache/refresh', {
        method: 'POST',
        body: JSON.stringify({ cacheKey }),
      });
      if (response.ok) {
        fetchCacheData();
      }
    } catch (error) {
      console.error('Failed to refresh cache entry:', error);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (ms: number) => {
    if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
    return `${Math.floor(ms / 3600000)}h`;
  };

  const getTtlStatus = (entry: CacheEntry) => {
    const age = Date.now() - entry.timestamp;
    const remaining = entry.ttl - age;

    if (remaining <= 0) return { status: 'stale', color: 'bg-red-100 text-red-800', text: 'Stale' };
    if (remaining < entry.ttl * 0.2) return { status: 'expiring', color: 'bg-yellow-100 text-yellow-800', text: 'Expiring' };
    return { status: 'fresh', color: 'bg-green-100 text-green-800', text: 'Fresh' };
  };

  const getStatusCodeColor = (code: number) => {
    if (code >= 200 && code < 300) return 'text-green-600';
    if (code >= 300 && code < 400) return 'text-yellow-600';
    if (code >= 400) return 'text-red-600';
    return 'text-gray-600';
  };

  const sortedAndFilteredEntries = [...entries]
    .filter(entry => !filterStale || Date.now() - entry.timestamp > entry.ttl)
    .sort((a, b) => {
      switch (sortBy) {
        case 'size': return b.size - a.size;
        case 'accessCount': return b.accessCount - a.accessCount;
        case 'ttl': return b.ttl - a.ttl;
        default: return b.timestamp - a.timestamp;
      }
    });

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Cache Analytics</h2>
        <div className="flex gap-3">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="timestamp">Sort by Time</option>
            <option value="size">Sort by Size</option>
            <option value="accessCount">Sort by Access</option>
            <option value="ttl">Sort by TTL</option>
          </select>
          <Button
            variant={filterStale ? "default" : "outline"}
            onClick={() => setFilterStale(!filterStale)}
          >
            {filterStale ? 'Show All' : 'Show Stale Only'}
          </Button>
          <Button onClick={fetchCacheData}>Refresh</Button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.totalEntries.toLocaleString()}</div>
              <p className="text-xs text-slate-500">Cached items</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Size</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{formatBytes(stats.totalSize)}</div>
              <p className="text-xs text-slate-500">Memory used</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Hit Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.hitRate.toFixed(1)}%</div>
              <p className="text-xs text-slate-500">{stats.totalHits} hits</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Avg TTL</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{formatDuration(stats.avgTtl)}</div>
              <p className="text-xs text-slate-500">Cache lifetime</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Avg Size</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-cyan-600">{formatBytes(stats.avgSize)}</div>
              <p className="text-xs text-slate-500">Per entry</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cache Entries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Entries List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>💾</span> Cache Entries ({sortedAndFilteredEntries.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {sortedAndFilteredEntries.map((entry) => {
                const ttlStatus = getTtlStatus(entry);
                return (
                  <div
                    key={entry.cacheKey}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors hover:bg-slate-50 ${
                      selectedEntry?.cacheKey === entry.cacheKey ? 'border-blue-500 bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedEntry(entry)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {entry.url}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {formatBytes(entry.size)}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Accessed {entry.accessCount}x
                          </Badge>
                          <Badge className={ttlStatus.color + ' text-xs'}>
                            {ttlStatus.text}
                          </Badge>
                        </div>
                      </div>
                      <span className={`text-xs font-mono ${getStatusCodeColor(entry.statusCode)}`}>
                        {entry.statusCode}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Cached {formatTime(entry.timestamp)}
                      {entry.renderTime && ` • ${entry.renderTime}ms render`}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Entry Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>📋</span> Entry Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedEntry ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-slate-600 mb-1">URL</h4>
                  <div className="text-sm text-slate-900 break-all">{selectedEntry.url}</div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-slate-600 mb-1">Size</h4>
                    <div className="text-sm font-medium">{formatBytes(selectedEntry.size)}</div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-600 mb-1">Status</h4>
                    <span className={`text-sm font-medium ${getStatusCodeColor(selectedEntry.statusCode)}`}>
                      {selectedEntry.statusCode}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-600 mb-1">Access Count</h4>
                    <div className="text-sm font-medium">{selectedEntry.accessCount}</div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-600 mb-1">TTL</h4>
                    <div className="text-sm font-medium">{formatDuration(selectedEntry.ttl)}</div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-slate-600 mb-1">Cache Status</h4>
                  <Badge className={getTtlStatus(selectedEntry).color}>
                    {getTtlStatus(selectedEntry).text}
                  </Badge>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-slate-600 mb-1">Timestamps</h4>
                  <div className="text-xs text-slate-600 space-y-1">
                    <div>Cached: {formatTime(selectedEntry.timestamp)}</div>
                    <div>Last Accessed: {formatTime(selectedEntry.lastAccessed)}</div>
                    {selectedEntry.renderTime && (
                      <div>Render Time: {selectedEntry.renderTime}ms</div>
                    )}
                  </div>
                </div>

                {selectedEntry.userAgent && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-600 mb-1">User Agent</h4>
                    <div className="text-xs text-slate-600 break-all">{selectedEntry.userAgent}</div>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    size="sm"
                    onClick={() => refreshCacheEntry(selectedEntry.cacheKey)}
                  >
                    🔄 Refresh
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => clearCacheEntry(selectedEntry.cacheKey)}
                  >
                    🗑️ Clear
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <div className="text-4xl mb-2">💾</div>
                <p>Select a cache entry to view details</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {entries.length === 0 && !loading && (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-4xl mb-4">📭</div>
            <h3 className="text-lg font-semibold mb-2">No Cache Entries</h3>
            <p className="text-slate-600">Cache is empty. Start making requests to populate it.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}