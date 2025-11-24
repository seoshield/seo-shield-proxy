import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useNotifications } from '../contexts/NotificationContext';
import { useConfirm } from './ConfirmModal';
import type { StatsData } from '../types';

import { apiCall } from '../config/api';

interface CacheEntry {
  key: string;
  url: string;
  status: string;
  size: number;
  cached: string;
  lastAccessed: string;
  ttl?: number;
}

interface CacheManagementProps {
  stats: StatsData | null;
}

export default function CacheManagement({ stats }: CacheManagementProps) {
  const [cacheList, setCacheList] = useState<CacheEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const { addNotification } = useNotifications();
  const { confirm, ConfirmComponent } = useConfirm();

  useEffect(() => {
    fetchCacheList();
  }, []);

  const fetchCacheList = async (): Promise<void> => {
    try {
      const res = await apiCall('/api/cache');
      const data = await res.json();
      if (data.success) {
        setCacheList(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch cache list:', error);
    }
  };

  const clearAllCache = async (): Promise<void> => {
    const shouldClear = await confirm(
      'Clear All Cache',
      'Are you sure you want to clear ALL cached pages?',
      async () => {},
      { type: 'warning', confirmText: 'Clear All', cancelText: 'Cancel' }
    );

    if (!shouldClear) return;

    setLoading(true);
    try {
      const res = await apiCall('/api/cache/clear', { method: 'POST' });
      const data = await res.json();

      if (data.status === 'ok') {
        setCacheList([]);
        addNotification(`Cache cleared successfully! Removed ${data.cleared.keys} keys.`, 'success');
      } else {
        addNotification('Failed to clear cache: ' + data.error, 'error');
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
      addNotification('Failed to clear cache. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteCacheItem = async (key: string): Promise<void> => {
    const shouldDelete = await confirm(
      'Delete Cache Item',
      `Delete cached page: ${key}?`,
      async () => {},
      { type: 'warning', confirmText: 'Delete', cancelText: 'Cancel' }
    );

    if (!shouldDelete) return;

    try {
      const res = await apiCall(`/api/cache/${encodeURIComponent(key)}`, {
        method: 'DELETE'
      });
      const data = await res.json();

      if (data.success) {
        setCacheList(cacheList.filter(item => item.key !== key));
        addNotification('Cache item deleted successfully', 'success');
      } else {
        addNotification('Failed to delete cache item: ' + data.error, 'error');
      }
    } catch (error) {
      console.error('Failed to delete cache item:', error);
      addNotification('Failed to delete cache item. Please try again.', 'error');
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <ConfirmComponent />
      <div className="space-y-6">
        {/* Cache Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span>💾</span> Cache Statistics
            </span>
            <Button onClick={clearAllCache} disabled={loading} variant="destructive" size="sm">
              {loading ? 'Clearing...' : 'Clear All Cache'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-bold text-slate-900">
                {stats?.browserMetrics?.completed || 0}
              </div>
              <div className="text-sm text-slate-500">Total Cached</div>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {stats?.cacheHitRate?.toFixed(1) || 0}%
              </div>
              <div className="text-sm text-slate-500">Hit Rate</div>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {stats?.avgRenderTime?.toFixed(0) || 0}ms
              </div>
              <div className="text-sm text-slate-500">Avg Render</div>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {stats?.browserMetrics?.queued || 0}
              </div>
              <div className="text-sm text-slate-500">Queued</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cache List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span>📋</span> Cached Pages ({cacheList.length})
            </span>
            <Button onClick={fetchCacheList} variant="outline" size="sm">
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cacheList.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No cached pages yet...
            </div>
          ) : (
            <div className="space-y-2">
              {cacheList.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 truncate">
                      {item.url}
                    </div>
                    <div className="text-sm text-slate-500">
                      Cached: {new Date(item.cached).toLocaleString()} •
                      Size: {formatBytes(item.size)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="success" className="text-xs">
                      {item.status}
                    </Badge>
                    <Button
                      onClick={() => deleteCacheItem(item.key)}
                      variant="outline"
                      size="sm"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </>
  );
}