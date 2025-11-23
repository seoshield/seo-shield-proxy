import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';

export default function ConfigPanel() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/admin/api/config');
      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    }
  };

  const updateConfig = async (updates) => {
    setLoading(true);
    try {
      const res = await fetch('/admin/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.data);
        alert('Configuration updated successfully!');
      }
    } catch (error) {
      alert('Failed to update config: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCacheByDefault = () => {
    updateConfig({
      cacheRules: {
        ...config.cacheRules,
        cacheByDefault: !config.cacheRules.cacheByDefault,
      },
    });
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-500">Loading configuration...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🔧</span> Cache Rules
          </CardTitle>
          <CardDescription>Configure caching behavior and patterns</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Cache by default</label>
            <input
              type="checkbox"
              checked={config.cacheRules.cacheByDefault}
              onChange={toggleCacheByDefault}
              disabled={loading}
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Meta Tag Name</label>
            <input
              type="text"
              value={config.cacheRules.metaTagName}
              disabled
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-md text-slate-900"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">No-Cache Patterns</label>
            {config.cacheRules.noCachePatterns.length === 0 ? (
              <p className="text-sm text-slate-500">No patterns defined</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {config.cacheRules.noCachePatterns.map((pattern, i) => (
                  <Badge key={i} variant="outline" className="font-mono text-xs">
                    {pattern}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Cache Patterns</label>
            {config.cacheRules.cachePatterns.length === 0 ? (
              <p className="text-sm text-slate-500">No patterns defined</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {config.cacheRules.cachePatterns.map((pattern, i) => (
                  <Badge key={i} variant="outline" className="font-mono text-xs">
                    {pattern}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🤖</span> Bot Rules
          </CardTitle>
          <CardDescription>Configure bot rendering settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">Render all bots</label>
            <input
              type="checkbox"
              checked={config.botRules.renderAllBots}
              disabled
              className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Allowed Bots</label>
            <div className="flex flex-wrap gap-2">
              {config.botRules.allowedBots.map((bot, i) => (
                <Badge key={i} variant="secondary">
                  {bot}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>⚙️</span> Server Settings
          </CardTitle>
          <CardDescription>View server configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Cache TTL</p>
              <p className="text-2xl font-bold text-slate-900">{config.cacheTTL}s</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-slate-500">Max Cache Size</p>
              <p className="text-2xl font-bold text-slate-900">{config.maxCacheSize}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
