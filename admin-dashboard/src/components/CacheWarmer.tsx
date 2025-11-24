import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

interface WarmStats {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  lastWarmed?: string;
  estimatedTime: number;
  queue: Array<{
    url: string;
    priority: 'high' | 'normal' | 'low';
    scheduledAt: string;
    retryCount: number;
  }>;
}

const CacheWarmer = () => {
  const [stats, setStats] = useState<WarmStats>({
    total: 0,
    completed: 0,
    failed: 0,
    inProgress: 0,
    estimatedTime: 0,
    queue: [],
  });
  const [loading, setLoading] = useState(false);
  const [sitemapUrl, setSitemapUrl] = useState('');
  const [manualUrls, setManualUrls] = useState('');
  const [priority, setPriority] = useState<'high' | 'normal' | 'low'>('normal');

  // Fetch stats periodically
  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 2000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/warmer/stats', {
        headers: {
          'Authorization': `Basic ${btoa(localStorage.getItem('adminCredentials') || '')}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch warmer stats:', error);
    }
  };

  const handleSitemapSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sitemapUrl.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/warmer/sitemap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(localStorage.getItem('adminCredentials') || '')}`,
        },
        body: JSON.stringify({ sitemapUrl, priority }),
      });

      const result = await response.json();
      if (result.success) {
        setSitemapUrl('');
        fetchStats();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      alert('Failed to process sitemap');
    } finally {
      setLoading(false);
    }
  };

  const handleManualUrlsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUrls.trim()) return;

    const urls = manualUrls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    setLoading(true);
    try {
      const response = await fetch('/api/warmer/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(localStorage.getItem('adminCredentials') || '')}`,
        },
        body: JSON.stringify({ urls, priority }),
      });

      const result = await response.json();
      if (result.success) {
        setManualUrls('');
        fetchStats();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      alert('Failed to add URLs');
    } finally {
      setLoading(false);
    }
  };

  const handleClearQueue = async () => {
    if (!confirm('Are you sure you want to clear the warm queue?')) return;

    try {
      const response = await fetch('/api/warmer/clear', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(localStorage.getItem('adminCredentials') || '')}`,
        },
      });

      if (response.ok) {
        fetchStats();
      }
    } catch (error) {
      alert('Failed to clear queue');
    }
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'normal':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <h3 className="text-sm font-medium text-slate-600">Total Jobs</h3>
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <h3 className="text-sm font-medium text-slate-600">Completed</h3>
            <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <h3 className="text-sm font-medium text-slate-600">Failed</h3>
            <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <h3 className="text-sm font-medium text-slate-600">In Progress</h3>
            <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
          </div>
        </Card>
      </div>

      {/* Progress and Time */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Progress</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Completion Rate</span>
                <span>
                  {stats.total > 0
                    ? Math.round((stats.completed / stats.total) * 100)
                    : 0}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%`
                  }}
                />
              </div>
              <div className="flex justify-between text-sm text-slate-600">
                <span>Last Warmed</span>
                <span>{formatDate(stats.lastWarmed)}</span>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Queue Status</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Queue Size</span>
                <Badge variant="outline">{stats.queue.length}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Est. Time Remaining</span>
                <Badge variant="outline">{formatTime(stats.estimatedTime)}</Badge>
              </div>
              <Button
                onClick={handleClearQueue}
                variant="outline"
                size="sm"
                className="w-full"
                disabled={stats.queue.length === 0}
              >
                Clear Queue
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* URL Input Forms */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Add URLs from Sitemap</h3>
            <form onSubmit={handleSitemapSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Sitemap URL
                </label>
                <input
                  type="url"
                  value={sitemapUrl}
                  onChange={(e) => setSitemapUrl(e.target.value)}
                  placeholder="https://example.com/sitemap.xml"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as 'high' | 'normal' | 'low')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Processing...' : 'Add from Sitemap'}
              </Button>
            </form>
          </div>
        </Card>

        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Add URLs Manually</h3>
            <form onSubmit={handleManualUrlsSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  URLs (one per line)
                </label>
                <textarea
                  value={manualUrls}
                  onChange={(e) => setManualUrls(e.target.value)}
                  placeholder="https://example.com/page1&#10;https://example.com/page2"
                  rows={6}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Processing...' : 'Add URLs'}
              </Button>
            </form>
          </div>
        </Card>
      </div>

      {/* Current Queue */}
      {stats.queue.length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Current Queue ({stats.queue.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">URL</th>
                    <th className="text-left py-2">Priority</th>
                    <th className="text-left py-2">Scheduled</th>
                    <th className="text-left py-2">Retries</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.queue.slice(0, 50).map((job, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-2 truncate max-w-md">
                        <span className="font-mono text-xs">{job.url}</span>
                      </td>
                      <td className="py-2">
                        <Badge variant={getPriorityBadgeVariant(job.priority)}>
                          {job.priority}
                        </Badge>
                      </td>
                      <td className="py-2 text-slate-600">
                        {formatDate(job.scheduledAt)}
                      </td>
                      <td className="py-2">
                        <Badge variant={job.retryCount > 0 ? 'destructive' : 'secondary'}>
                          {job.retryCount}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {stats.queue.length > 50 && (
                <div className="text-center py-2 text-slate-600">
                  ... and {stats.queue.length - 50} more URLs
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default CacheWarmer;