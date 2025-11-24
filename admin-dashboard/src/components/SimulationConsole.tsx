import { useState, useEffect } from 'react';

import { apiCall } from '../config/api';

interface UserAgent {
  name: string;
  userAgent: string;
  type: 'googlebot' | 'bingbot' | 'facebook' | 'twitter' | 'custom';
  lastUsed: string;
  successCount: number;
  errorCount: number;
}

interface SimulationResult {
  id: string;
  url: string;
  userAgent: string;
  statusCode: number;
  responseTime: number;
  timestamp: string;
  success: boolean;
  error?: string;
  cached: boolean;
  size: number;
}

export default function SimulationConsole() {
  const [userAgents, setUserAgents] = useState<UserAgent[]>([]);
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUA, setSelectedUA] = useState('');
  const [testUrl, setTestUrl] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [customUA, setCustomUA] = useState('');
  const [selectedType, setSelectedType] = useState('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [uaResponse, resultsResponse] = await Promise.all([
        apiCall('/simulate/user-agents'),
        apiCall('/simulate/history?limit=50')
      ]);

      if (uaResponse.ok && resultsResponse.ok) {
        const [uaData, resultsData] = await Promise.all([
          uaResponse.json(),
          resultsResponse.json()
        ]);
        setUserAgents(uaData.agents || []);
        setResults(resultsData.results || []);
      }
    } catch (error) {
      console.error('Failed to fetch simulation data:', error);
    }
  };

  const runSimulation = async () => {
    if (!testUrl) {
      alert('Please enter a URL to test');
      return;
    }

    setLoading(true);
    try {
      const endpoint = batchMode ? '/ua-simulator/batch' : '/ua-simulator/simulate';
      const body = batchMode
        ? { url: testUrl, types: selectedType === 'all' ? ['googlebot', 'bingbot', 'facebook', 'twitter'] : [selectedType] }
        : { url: testUrl, userAgent: selectedUA || customUA };

      const response = await apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.results)) {
          setResults(prev => [...data.results, ...prev]);
        } else {
          setResults(prev => [data.result, ...prev]);
        }
      }
    } catch (error) {
      console.error('Simulation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'googlebot': return '🔍';
      case 'bingbot': return '🔎';
      case 'facebook': return '📘';
      case 'twitter': return '🐦';
      case 'custom': return '⚙️';
      default: return '🤖';
    }
  };

  const getStatusColor = (statusCode: number) => {
    if (statusCode >= 200 && statusCode < 300) return 'text-green-600';
    if (statusCode >= 300 && statusCode < 400) return 'text-yellow-600';
    if (statusCode >= 400 && statusCode < 500) return 'text-orange-600';
    return 'text-red-600';
  };

  const filteredUserAgents = selectedType === 'all'
    ? userAgents
    : userAgents.filter(ua => ua.type === selectedType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">User-Agent Simulator</h2>
        <div className="flex gap-3">
          <button
            onClick={clearResults}
            className="px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors"
          >
            🗑️ Clear Results
          </button>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Simulation Controls */}
      <div className="bg-white p-6 rounded-xl border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Run Simulation</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Target URL</label>
            <input
              type="url"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://example.com/page"
            />
          </div>

          <div className="flex items-center gap-4">
            <input
              type="checkbox"
              id="batchMode"
              checked={batchMode}
              onChange={(e) => setBatchMode(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="batchMode" className="text-sm font-medium text-slate-700">
              Batch Mode (test multiple user agents)
            </label>
          </div>

          {!batchMode ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">User Agent Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Types</option>
                  <option value="googlebot">Googlebot</option>
                  <option value="bingbot">Bingbot</option>
                  <option value="facebook">Facebook</option>
                  <option value="twitter">Twitter</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {filteredUserAgents.length > 0 && selectedType !== 'custom' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Specific Agent</label>
                  <select
                    value={selectedUA}
                    onChange={(e) => setSelectedUA(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select agent...</option>
                    {filteredUserAgents.map((ua) => (
                      <option key={ua.name} value={ua.userAgent}>
                        {ua.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : selectedType === 'custom' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Custom User Agent</label>
                  <input
                    type="text"
                    value={customUA}
                    onChange={(e) => setCustomUA(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Mozilla/5.0 (compatible; CustomBot/1.0)"
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Test Types</label>
              <div className="flex flex-wrap gap-2">
                {['all', 'googlebot', 'bingbot', 'facebook', 'twitter'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      selectedType === type
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={runSimulation}
            disabled={loading || !testUrl}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Running Simulation...
              </span>
            ) : (
              `🚀 Run ${batchMode ? 'Batch' : 'Single'} Simulation`
            )}
          </button>
        </div>
      </div>

      {/* User Agent Stats */}
      {userAgents.length > 0 && (
        <div className="bg-white p-6 rounded-xl border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">User Agent Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {userAgents.map((ua) => (
              <div key={ua.name} className="p-4 border border-slate-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getTypeIcon(ua.type)}</span>
                    <span className="font-medium text-slate-900">{ua.name}</span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    ua.type === 'custom' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {ua.type}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Success:</span>
                    <span className="text-green-600 font-medium">{ua.successCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Errors:</span>
                    <span className="text-red-600 font-medium">{ua.errorCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Rate:</span>
                    <span className={`font-medium ${
                      (ua.successCount / (ua.successCount + ua.errorCount) * 100) >= 90 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {ua.successCount + ua.errorCount > 0
                        ? `${((ua.successCount / (ua.successCount + ua.errorCount)) * 100).toFixed(1)}%`
                        : 'N/A'}
                    </span>
                  </div>
                  {ua.lastUsed && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Last used:</span>
                      <span className="text-slate-900">{new Date(ua.lastUsed).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-semibold text-slate-900">Recent Simulation Results</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">URL</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User Agent</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Size</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Cached</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {results.slice(0, 20).map((result) => (
                  <tr key={result.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {new Date(result.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      <div className="max-w-xs truncate" title={result.url}>
                        {result.url}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      <div className="max-w-xs truncate" title={result.userAgent}>
                        {result.userAgent.length > 30 ? result.userAgent.substring(0, 30) + '...' : result.userAgent}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`font-medium ${getStatusColor(result.statusCode)}`}>
                        {result.statusCode}
                      </span>
                      {result.error && (
                        <div className="text-xs text-red-600 mt-1 truncate" title={result.error}>
                          {result.error}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {result.responseTime}ms
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                      {(result.size / 1024).toFixed(1)}KB
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        result.cached
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {result.cached ? 'Yes' : 'No'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {results.length > 20 && (
            <div className="p-4 text-center text-sm text-slate-600">
              Showing 20 of {results.length} results
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {results.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🤖</div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Simulation Results</h3>
          <p className="text-slate-600">Run your first user-agent simulation to see results here.</p>
        </div>
      )}
    </div>
  );
}