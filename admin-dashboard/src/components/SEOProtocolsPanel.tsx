import { useState, useEffect } from 'react';

import { apiCall } from '../config/api';

interface SEOProtocol {
  name: string;
  enabled: boolean;
  status: 'active' | 'inactive' | 'error';
  lastRun: string;
  successRate: number;
  metrics: Record<string, any>;
}

interface SEOProtocolsResponse {
  protocols: SEOProtocol[] | Record<string, any>;
  globalStats: {
    totalOptimizations: number;
    successRate: number;
    lastUpdate: string;
  };
}

export default function SEOProtocolsPanel() {
  const [protocols, setProtocols] = useState<SEOProtocol[]>([]);
  const [globalStats, setGlobalStats] = useState<SEOProtocolsResponse['globalStats'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null);

  useEffect(() => {
    fetchProtocols();
    const interval = setInterval(fetchProtocols, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchProtocols = async () => {
    try {
      setLoading(true);
      const response = await apiCall('/api/seo-protocols/status');
      const data: SEOProtocolsResponse = await response.json();

      // Convert protocols object to array if needed
      let protocolsArray: SEOProtocol[] = [];
      if (Array.isArray(data.protocols)) {
        protocolsArray = data.protocols;
      } else if (typeof data.protocols === 'object' && data.protocols !== null) {
        // Convert object to array
        protocolsArray = Object.entries(data.protocols).map(([name, protocol]: [string, any]) => ({
          name,
          enabled: protocol.enabled || false,
          status: protocol.status || 'inactive',
          lastRun: protocol.lastRun || new Date().toISOString(),
          successRate: protocol.successRate || 0,
          metrics: protocol.metrics || {}
        }));
      }

      setProtocols(protocolsArray);

      // Ensure globalStats exists
      setGlobalStats(data.globalStats || {
        totalOptimizations: 0,
        successRate: 0,
        lastUpdate: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to fetch SEO protocols status:', error);
      // Set fallback values on error
      setProtocols([]);
      setGlobalStats({
        totalOptimizations: 0,
        successRate: 0,
        lastUpdate: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleProtocol = async (protocolName: string) => {
    try {
      const response = await apiCall(`/seo-protocols/${protocolName}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        fetchProtocols();
      }
    } catch (error) {
      console.error('Failed to toggle protocol:', error);
    }
  };

  const runProtocol = async (protocolName: string) => {
    try {
      const response = await apiCall(`/seo-protocols/${protocolName}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        fetchProtocols();
      }
    } catch (error) {
      console.error('Failed to run protocol:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600';
    if (rate >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading && protocols.length === 0) {
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
        <h2 className="text-2xl font-bold text-slate-900">SEO Protocols Manager</h2>
        <div className="flex gap-3">
          <button
            onClick={fetchProtocols}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Global Stats */}
      {globalStats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Optimizations</p>
                <p className="text-2xl font-bold text-slate-900">{(globalStats.totalOptimizations || 0).toLocaleString()}</p>
              </div>
              <div className="text-3xl">⚡</div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Global Success Rate</p>
                <p className={`text-2xl font-bold ${getSuccessRateColor(globalStats.successRate || 0)}`}>
                  {(globalStats.successRate || 0).toFixed(1)}%
                </p>
              </div>
              <div className="text-3xl">📊</div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Last Update</p>
                <p className="text-lg font-semibold text-slate-900">
                  {globalStats.lastUpdate ? new Date(globalStats.lastUpdate).toLocaleTimeString() : 'Never'}
                </p>
              </div>
              <div className="text-3xl">🕐</div>
            </div>
          </div>
        </div>
      )}

      {/* Protocol Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {protocols.map((protocol) => (
          <div
            key={protocol.name}
            className={`bg-white p-6 rounded-xl border transition-all cursor-pointer ${
              selectedProtocol === protocol.name
                ? 'border-blue-500 shadow-lg'
                : 'border-slate-200 hover:border-slate-300'
            }`}
            onClick={() => setSelectedProtocol(selectedProtocol === protocol.name ? null : protocol.name)}
          >
            {/* Protocol Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="text-2xl">
                  {protocol.name.includes('Health') && '🏥'}
                  {protocol.name.includes('Virtual') && '📜'}
                  {protocol.name.includes('ETag') && '🏷️'}
                  {protocol.name.includes('Cluster') && '🔗'}
                  {protocol.name.includes('Shadow') && '🌗'}
                  {protocol.name.includes('Circuit') && '⚡'}
                  {!protocol.name.includes('Health') &&
                   !protocol.name.includes('Virtual') &&
                   !protocol.name.includes('ETag') &&
                   !protocol.name.includes('Cluster') &&
                   !protocol.name.includes('Shadow') &&
                   !protocol.name.includes('Circuit') && '⚙️'}
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900">{protocol.name}</h3>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(protocol.status)}`}>
                    {protocol.status}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleProtocol(protocol.name);
                  }}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    protocol.enabled
                      ? 'bg-green-100 text-green-800 hover:bg-green-200'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  {protocol.enabled ? 'Enabled' : 'Disabled'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    runProtocol(protocol.name);
                  }}
                  className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
                >
                  Run
                </button>
              </div>
            </div>

            {/* Protocol Metrics */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Success Rate</span>
                <span className={`font-semibold ${getSuccessRateColor(protocol.successRate || 0)}`}>
                  {(protocol.successRate || 0).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Last Run</span>
                <span className="text-sm text-slate-900">
                  {protocol.lastRun ? new Date(protocol.lastRun).toLocaleString() : 'Never'}
                </span>
              </div>

              {/* Detailed Metrics (expandable) */}
              {selectedProtocol === protocol.name && protocol.metrics && (
                <div className="mt-4 pt-4 border-t border-slate-200 space-y-2">
                  <h4 className="font-medium text-slate-900">Detailed Metrics</h4>
                  {Object.entries(protocol.metrics).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="text-slate-900">
                        {typeof value === 'number' ? value.toLocaleString() : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {protocols.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔧</div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No SEO Protocols Found</h3>
          <p className="text-slate-600">SEO protocols will appear here once the system is initialized.</p>
        </div>
      )}
    </div>
  );
}