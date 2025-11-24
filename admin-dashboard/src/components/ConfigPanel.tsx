import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';

import { apiCall } from '../config/api';

interface ConfigData {
  targetUrl: string;
  cacheTtl: number;
  puppeteerTimeout: number;
  nodeEnv: string;
  maxConcurrentRenders: number;
  debugMode: boolean;
  cacheType: string;
  redisUrl?: string;
}

export default function ConfigPanel() {
  const [config, setConfig] = useState<ConfigData | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async (): Promise<void> => {
    try {
      const res = await apiCall('/api/config');
      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    }
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat().format(num);
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-500">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>⚙️</span> System Configuration
          </CardTitle>
          <CardDescription>
            Current runtime configuration and system status
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Core Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-slate-900 mb-3">Core Settings</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium">Target URL</span>
                  <code className="text-xs bg-slate-200 px-2 py-1 rounded">
                    {config.targetUrl}
                  </code>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium">Environment</span>
                  <Badge variant={config.nodeEnv === 'production' ? 'success' : 'warning'}>
                    {config.nodeEnv}
                  </Badge>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium">Debug Mode</span>
                  <Badge variant={config.debugMode ? 'info' : 'secondary'}>
                    {config.debugMode ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-slate-900 mb-3">Performance Settings</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium">Cache TTL</span>
                  <span className="text-sm font-mono">
                    {formatNumber(config.cacheTtl / 1000)}s
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium">SSR Timeout</span>
                  <span className="text-sm font-mono">
                    {formatNumber(config.puppeteerTimeout / 1000)}s
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium">Max Renders</span>
                  <span className="text-sm font-mono">
                    {config.maxConcurrentRenders}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Cache Configuration */}
          <div>
            <h3 className="text-sm font-medium text-slate-900 mb-3">Cache Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <span className="text-sm font-medium">Cache Type</span>
                <Badge variant={config.cacheType === 'redis' ? 'success' : 'info'}>
                  {(config.cacheType || 'memory').toUpperCase()}
                </Badge>
              </div>
              {config.redisUrl && (
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-sm font-medium">Redis URL</span>
                  <code className="text-xs bg-slate-200 px-2 py-1 rounded">
                    {config.redisUrl.replace(/\/\/.*@/, '//***@')}
                  </code>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cache Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>📋</span> Cache Rules Status
          </CardTitle>
          <CardDescription>
            Active caching rules and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-2xl font-bold text-green-600">12</div>
              <div className="text-sm text-green-700">Active Rules</div>
            </div>
            <div className="text-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">8</div>
              <div className="text-sm text-blue-700">Path Patterns</div>
            </div>
            <div className="text-center p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">4</div>
              <div className="text-sm text-purple-700">Bot Rules</div>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-sm">Static assets (CSS, JS, images)</span>
              <Badge variant="success">Cached 1h</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-sm">API endpoints (/api/*)</span>
              <Badge variant="warning">No Cache</Badge>
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <span className="text-sm">Admin panel (/admin/*)</span>
              <Badge variant="secondary">5m TTL</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rate Limiting Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🚦</span> Rate Limiting Status
          </CardTitle>
          <CardDescription>
            Active rate limiting rules and current status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm font-medium text-green-800 mb-2">General Requests</div>
                <div className="text-xs text-green-600">
                  1000 req/15min per IP
                </div>
              </div>
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm font-medium text-blue-800 mb-2">SSR Rendering</div>
                <div className="text-xs text-blue-600">
                  10 req/1min per bot
                </div>
              </div>
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="text-sm font-medium text-purple-800 mb-2">Admin Panel</div>
                <div className="text-xs text-purple-600">
                  30 req/15min
                </div>
              </div>
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="text-sm font-medium text-orange-800 mb-2">Cache Operations</div>
                <div className="text-xs text-orange-600">
                  20 ops/5min
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}