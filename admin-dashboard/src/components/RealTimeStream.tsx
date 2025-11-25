import { useState, useEffect, useRef } from 'react';

interface LogEntry {
  id: number;
  timestamp: string;
  type: 'connection' | 'metrics' | 'cache' | 'traffic' | 'ssr' | 'error' | 'info';
  message: string;
  data: any;
  level: 'info' | 'success' | 'warning' | 'error';
}

export default function RealTimeStream() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [filterLevel, setFilterLevel] = useState<'all' | 'info' | 'success' | 'warning' | 'error'>('all');
  const logContainerRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const logIdRef = useRef<number>(0);

  useEffect(() => {
    connectToStream();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const addLog = (type: LogEntry['type'], message: string, data: any, level: LogEntry['level'] = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const id = ++logIdRef.current;

    const newLog: LogEntry = { id, timestamp, type, message, data, level };

    setLogs(prev => {
      const filtered = filterLevel === 'all' ? prev : prev.filter(log => log.level === filterLevel);
      return [...filtered.slice(-99), newLog];
    });
  };

  const connectToStream = () => {
    try {
      const eventSource = new EventSource('/api/stream');
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        addLog('connection', '📡 Connected to real-time stream', { type: 'connection' }, 'success');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'connection') {
            addLog('connection', data.message || 'Connected', data, 'success');
          } else if (data.type === 'metrics') {
            const { metrics, cache } = data;

            // Add interesting metrics events
            if (metrics.totalRequests > 0 && metrics.totalRequests % 10 === 0) {
              addLog('metrics', `📈 ${metrics.totalRequests} total requests`, {
                requests: metrics.totalRequests,
                hitRate: metrics.cacheHitRate,
                bots: metrics.botRequests,
                humans: metrics.humanRequests
              }, 'info');
            }

            if (cache.hits > 0 && cache.hits % 5 === 0) {
              addLog('cache', `💾 ${cache.hits} cache hits`, {
                hits: cache.hits,
                keys: cache.keys,
                hitRate: metrics.cacheHitRate
              }, 'success');
            }

            // Add bot detection events
            if (metrics.botRequests > 0) {
              addLog('traffic', `🤖 Bot detected: ${metrics.botRequests} bot requests`, {
                botRequests: metrics.botRequests,
                ssrRendered: metrics.ssrRendered,
                proxiedDirect: metrics.proxiedDirect
              }, 'info');
            }

            // Add SSR events
            if (metrics.ssrRendered > 0) {
              addLog('ssr', `🎭 ${metrics.ssrRendered} pages SSR rendered`, {
                ssrRendered: metrics.ssrRendered,
                errors: metrics.errors
              }, 'success');
            }

            // Add error events
            if (metrics.errors > 0) {
              addLog('error', `⚠️ ${metrics.errors} errors detected`, {
                errors: metrics.errors,
                totalRequests: metrics.totalRequests
              }, 'error');
            }

          } else {
            addLog('info', '📄 Unknown event type', data, 'info');
          }
        } catch (error) {
          addLog('error', '💥 Failed to parse event data', {
            error: error instanceof Error ? error.toString() : 'Unknown error',
            raw: event.data
          }, 'error');
        }
      };

      eventSource.onerror = (error) => {
        setIsConnected(false);
        addLog('error', '❌ Connection Error', {
          error: error?.toString() || 'Unknown error',
          reconnecting: true
        }, 'error');

        // Attempt to reconnect after 3 seconds
        setTimeout(connectToStream, 3000);
      };

    } catch (error) {
      setIsConnected(false);
      addLog('error', '💥 Failed to connect', {
        error: error instanceof Error ? error.toString() : 'Unknown error'
      }, 'error');
    }
  };

  const clearLogs = () => {
    setLogs([]);
    logIdRef.current = 0;
  };

  const exportLogs = () => {
    const logsText = logs.map(log =>
      `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}\n${JSON.stringify(log.data, null, 2)}`
    ).join('\n\n');

    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seo-shield-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'success': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      default: return 'text-blue-400';
    }
  };

  const getBorderColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'connection': return 'border-green-500';
      case 'metrics': return 'border-blue-500';
      case 'cache': return 'border-purple-500';
      case 'traffic': return 'border-cyan-500';
      case 'ssr': return 'border-orange-500';
      case 'error': return 'border-red-500';
      default: return 'border-gray-500';
    }
  };

  const filteredLogs = logs.filter(log =>
    filterLevel === 'all' || log.level === filterLevel
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Real-Time Stream</h2>
            <p className="text-slate-600 mt-1">Live server events and statistics</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
              isConnected
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`} />
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              autoScroll
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            Auto-Scroll: {autoScroll ? 'On' : 'Off'}
          </button>

          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value as any)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>

          <button
            onClick={clearLogs}
            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300 transition-colors"
          >
            Clear Logs
          </button>
          <button
            onClick={exportLogs}
            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
          >
            Export Logs
          </button>
        </div>

        <div
          ref={logContainerRef}
          className="bg-slate-900 text-slate-100 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm space-y-2"
        >
          {filteredLogs.length === 0 ? (
            <div className="text-slate-500 text-center py-8">
              {isConnected ? 'Waiting for events...' : 'Connecting to stream...'}
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className={`border-l-2 ${getBorderColor(log.type)} pl-3 py-1`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-slate-500">[{log.timestamp}]</span>
                  <span className={getLevelColor(log.level)}>{log.message}</span>
                </div>
                <pre className="text-slate-300 text-xs overflow-x-auto">
                  {JSON.stringify(log.data, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h3 className="font-medium text-blue-900 mb-2">📊 Event Types</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Connection:</strong> Stream status updates</li>
              <li>• <strong>Metrics:</strong> Request milestones</li>
              <li>• <strong>Cache:</strong> Hit/miss events</li>
              <li>• <strong>Traffic:</strong> Bot detection alerts</li>
            </ul>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <h3 className="font-medium text-green-900 mb-2">🎯 System Events</h3>
            <ul className="text-sm text-green-800 space-y-1">
              <li>• <strong>SSR:</strong> Rendering notifications</li>
              <li>• <strong>Errors:</strong> System warnings</li>
              <li>• <strong>Performance:</strong> Response time alerts</li>
              <li>• <strong>Health:</strong> Service status changes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}