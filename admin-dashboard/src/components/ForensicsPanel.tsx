import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

import { apiCall } from '../config/api';

interface ConsoleLog {
  timestamp: number;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  text: string;
  url?: string;
  line?: number;
  column?: number;
}

interface NetworkRequest {
  timestamp: number;
  url: string;
  method: string;
  status: number;
  statusText: string;
  resourceType: string;
  size: number;
  time: number;
  failure?: {
    errorText: string;
    errorType: string;
  };
}

interface RenderError {
  id: string;
  url: string;
  timestamp: string;
  error: {
    message: string;
    type: 'timeout' | 'crash' | 'javascript' | 'network' | 'unknown';
    stack?: string;
  };
  context: {
    userAgent: string;
    viewport: {
      width: number;
      height: number;
    };
    proxyHeaders: Record<string, string>;
    waitStrategy: string;
    timeout: number;
  };
  console: ConsoleLog[];
  network: NetworkRequest[];
  screenshot?: string;
  html?: string;
  renderTime: number;
  memoryUsage?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

interface ForensicsStats {
  totalErrors: number;
  todayErrors: number;
  errorsByType: Record<string, number>;
  topErrorUrls: Array<{ url: string; count: number }>;
  detectedPatterns: Array<{
    id: string;
    name: string;
    frequency: number;
    lastSeen: string;
    description?: string;
  }>;
}

const ForensicsPanel = () => {
  const [errors, setErrors] = useState<RenderError[]>([]);
  const [stats, setStats] = useState<ForensicsStats>({
    totalErrors: 0,
    todayErrors: 0,
    errorsByType: {},
    topErrorUrls: [],
    detectedPatterns: [],
  });
  const [selectedError, setSelectedError] = useState<RenderError | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCleanupModal, setShowCleanupModal] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchErrors();
  }, [page]);

  const fetchStats = async () => {
    try {
      const response = await apiCall('/api/forensics/stats');
      const result = await response.json();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch forensics stats:', error);
    }
  };

  const fetchErrors = async () => {
    try {
      const response = await apiCall(`/forensics/errors?page=${page}&limit=20`);
      const result = await response.json();
      if (result.success) {
        setErrors(result.data.errors);
        setTotalPages(result.data.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch forensics errors:', error);
    }
  };

  const fetchErrorDetails = async (id: string) => {
    try {
      const response = await apiCall(`/forensics/errors/${id}`);
      const result = await response.json();
      if (result.success) {
        setSelectedError(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch error details:', error);
    }
  };

  const handleDeleteError = async (id: string) => {
    if (!confirm('Are you sure you want to delete this error record?')) return;

    try {
      const response = await apiCall(`/forensics/errors/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchErrors();
        fetchStats();
        if (selectedError?.id === id) {
          setSelectedError(null);
        }
      }
    } catch (error) {
      alert('Failed to delete error');
    }
  };

  const handleCleanup = async (daysToKeep: number) => {
    setLoading(true);
    try {
      const response = await apiCall('/forensics/cleanup', {
        method: 'POST',
        body: JSON.stringify({ daysToKeep }),
      });

      const result = await response.json();
      if (result.success) {
        setShowCleanupModal(false);
        fetchErrors();
        fetchStats();
        alert(`Cleared ${result.data.deleted} old errors`);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      alert('Failed to cleanup errors');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getErrorTypeColor = (type: string) => {
    switch (type) {
      case 'timeout': return 'text-yellow-600';
      case 'crash': return 'text-red-600';
      case 'javascript': return 'text-orange-600';
      case 'network': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getErrorTypeBadge = (type: string) => {
    switch (type) {
      case 'timeout': return 'secondary';
      case 'crash': return 'destructive';
      case 'javascript': return 'outline';
      case 'network': return 'default';
      default: return 'secondary';
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Render Error Forensics</h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowCleanupModal(true)}
          >
            Cleanup Old Errors
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <h3 className="text-sm font-medium text-slate-600">Total Errors</h3>
            <p className="text-2xl font-bold text-slate-900">{stats.totalErrors}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <h3 className="text-sm font-medium text-slate-600">Today's Errors</h3>
            <p className="text-2xl font-bold text-red-600">{stats.todayErrors}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <h3 className="text-sm font-medium text-slate-600">Error Types</h3>
            <div className="text-sm text-slate-600">
              {Object.entries(stats.errorsByType).map(([type, count]) => (
                <div key={type} className="flex justify-between">
                  <span className="capitalize">{type}:</span>
                  <span className={getErrorTypeColor(type)}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <h3 className="text-sm font-medium text-slate-600">Detected Patterns</h3>
            <p className="text-2xl font-bold text-blue-600">{stats.detectedPatterns.length}</p>
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Error List */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Errors</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {errors.map((error) => (
                <div
                  key={error.id}
                  className={`border rounded p-3 cursor-pointer transition-colors ${
                    selectedError?.id === error.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => fetchErrorDetails(error.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant={getErrorTypeBadge(error.error.type)}>
                      {error.error.type}
                    </Badge>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteError(error.id);
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="text-sm font-medium truncate" title={error.url}>
                    {error.url}
                  </p>
                  <p className="text-xs text-slate-600 truncate" title={error.error.message}>
                    {error.error.message}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatDate(error.timestamp)} • {formatTime(error.renderTime)}
                  </p>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span className="py-1 px-2 text-sm">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Error Details */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">
              Error Details {selectedError && `- ${selectedError.error.type}`}
            </h3>
            {selectedError ? (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {/* Basic Info */}
                <div>
                  <h4 className="font-medium text-sm mb-2">Information</h4>
                  <div className="bg-slate-50 p-3 rounded text-sm">
                    <div><strong>URL:</strong> {selectedError.url}</div>
                    <div><strong>Time:</strong> {formatDate(selectedError.timestamp)}</div>
                    <div><strong>Render Time:</strong> {formatTime(selectedError.renderTime)}</div>
                    <div><strong>Error Type:</strong> <span className={getErrorTypeColor(selectedError.error.type)}>{selectedError.error.type}</span></div>
                  </div>
                </div>

                {/* Error Message */}
                <div>
                  <h4 className="font-medium text-sm mb-2">Error Message</h4>
                  <div className="bg-red-50 border border-red-200 p-3 rounded text-sm text-red-800">
                    {selectedError.error.message}
                  </div>
                  {selectedError.error.stack && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-medium">Stack Trace</summary>
                      <pre className="mt-2 bg-slate-100 p-2 rounded text-xs overflow-x-auto">
                        {selectedError.error.stack}
                      </pre>
                    </details>
                  )}
                </div>

                {/* Screenshot */}
                {selectedError.screenshot && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Error Screenshot</h4>
                    <img
                      src={selectedError.screenshot}
                      alt="Error screenshot"
                      className="w-full border rounded"
                    />
                  </div>
                )}

                {/* Console Logs */}
                {selectedError.console.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Console Logs ({selectedError.console.length})</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {selectedError.console.map((log, index) => (
                        <div
                          key={index}
                          className={`text-xs p-2 rounded ${
                            log.level === 'error' ? 'bg-red-100 text-red-800' :
                            log.level === 'warn' ? 'bg-yellow-100 text-yellow-800' :
                            log.level === 'info' ? 'bg-blue-100 text-blue-800' :
                            'bg-slate-100'
                          }`}
                        >
                          <span className="font-medium">[{log.level.toUpperCase()}]</span> {log.text}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Network Errors */}
                {selectedError.network.filter(req => req.failure).length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Failed Network Requests</h4>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {selectedError.network
                        .filter(req => req.failure)
                        .map((req, index) => (
                          <div key={index} className="text-xs bg-red-50 p-2 rounded">
                            <div className="font-medium">{req.url}</div>
                            <div className="text-red-600">{req.failure?.errorText}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Context Info */}
                <div>
                  <h4 className="font-medium text-sm mb-2">Render Context</h4>
                  <div className="bg-slate-50 p-3 rounded text-xs">
                    <div><strong>User Agent:</strong> {selectedError.context.userAgent}</div>
                    <div><strong>Viewport:</strong> {selectedError.context.viewport.width}x{selectedError.context.viewport.height}</div>
                    <div><strong>Wait Strategy:</strong> {selectedError.context.waitStrategy}</div>
                    <div><strong>Timeout:</strong> {selectedError.context.timeout}ms</div>
                    {selectedError.memoryUsage && (
                      <div><strong>Memory Usage:</strong> {formatBytes(selectedError.memoryUsage.usedJSHeapSize)} / {formatBytes(selectedError.memoryUsage.totalJSHeapSize)}</div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <div className="text-4xl mb-2">🔍</div>
                <p>Select an error to view details</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Top Error URLs */}
      {stats.topErrorUrls.length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Top Error URLs</h3>
            <div className="space-y-2">
              {stats.topErrorUrls.map((item, index) => (
                <div key={index} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                  <span className="text-sm font-mono truncate flex-1">{item.url}</span>
                  <Badge variant="destructive">{item.count} errors</Badge>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Cleanup Modal */}
      {showCleanupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Cleanup Old Errors</h3>
            <p className="text-sm text-slate-600 mb-4">
              Select how many days of error history to keep:
            </p>
            <div className="space-y-2 mb-4">
              <button
                onClick={() => handleCleanup(7)}
                className="w-full text-left p-2 border rounded hover:bg-slate-50"
                disabled={loading}
              >
                <div className="font-medium">Keep 7 days</div>
                <div className="text-xs text-slate-500">More aggressive cleanup</div>
              </button>
              <button
                onClick={() => handleCleanup(30)}
                className="w-full text-left p-2 border rounded hover:bg-slate-50"
                disabled={loading}
              >
                <div className="font-medium">Keep 30 days (Recommended)</div>
                <div className="text-xs text-slate-500">Balanced approach</div>
              </button>
              <button
                onClick={() => handleCleanup(90)}
                className="w-full text-left p-2 border rounded hover:bg-slate-50"
                disabled={loading}
              >
                <div className="font-medium">Keep 90 days</div>
                <div className="text-xs text-slate-500">Conservative cleanup</div>
              </button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowCleanupModal(false)}
                disabled={loading}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {errors.length === 0 && (
        <Card>
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">🎉</div>
            <h3 className="text-lg font-semibold mb-2">No Render Errors</h3>
            <p className="text-slate-600">Your renders are running smoothly!</p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ForensicsPanel;