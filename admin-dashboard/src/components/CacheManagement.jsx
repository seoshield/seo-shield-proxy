import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

export default function CacheManagement({ stats }) {
  const [cacheList, setCacheList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCacheList();
  }, []);

  const fetchCacheList = async () => {
    try {
      const res = await fetch('/admin/api/cache');
      const data = await res.json();
      if (data.success) {
        setCacheList(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch cache list:', error);
    }
  };

  const clearAllCache = async () => {
    if (!confirm('Are you sure you want to clear ALL cached pages?')) return;

    setLoading(true);
    try {
      const res = await fetch('/admin/api/cache/clear', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('Cache cleared successfully!');
        fetchCacheList();
      }
    } catch (error) {
      alert('Failed to clear cache: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const clearCacheEntry = async (url) => {
    setLoading(true);
    try {
      const res = await fetch('/admin/api/cache/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.success) {
        fetchCacheList();
      }
    } catch (error) {
      alert('Failed to clear cache entry: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <span>💾</span> Cache Management
          </CardTitle>
          <Button
            variant="destructive"
            size="sm"
            onClick={clearAllCache}
            disabled={loading}
          >
            🗑️ Clear All Cache
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Total Cached Pages</p>
              <p className="text-2xl font-bold text-slate-900">{stats.cache?.keys || 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Cache Hits</p>
              <p className="text-2xl font-bold text-green-600">{stats.cache?.hits || 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Cache Misses</p>
              <p className="text-2xl font-bold text-orange-600">{stats.cache?.misses || 0}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Hit Rate</p>
              <p className="text-2xl font-bold text-blue-600">{stats.cache?.hitRate || '0.00'}%</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Cached URLs</h3>
            <Badge variant="secondary">{cacheList.length} entries</Badge>
          </div>
          {cacheList.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              No cached pages
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">URL</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Size</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">TTL</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cacheList.map((entry, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-900 font-mono max-w-md truncate">
                          {entry.url}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {(entry.size / 1024).toFixed(2)} KB
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {entry.ttl}s
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => clearCacheEntry(entry.url)}
                            disabled={loading}
                          >
                            🗑️
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
