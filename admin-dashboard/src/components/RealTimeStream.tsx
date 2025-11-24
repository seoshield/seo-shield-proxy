import { useState, useEffect, useRef } from 'react';

export default function RealTimeStream() {
  const [logs, setLogs] = useState<Array<{ timestamp: string; message: string; data: any; id: number }>>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
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

  const connectToStream = () => {
    try {
      const eventSource = new EventSource('/api/stream', {
        withCredentials: true
      });
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        addLog('📡 Connected to real-time stream', { type: 'connection' });
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addLog('📊 Stats Update', data);
        } catch (error) {
          addLog('📄 Raw Data', { raw: event.data });
        }
      };

      eventSource.onerror = (error) => {
        setIsConnected(false);
        addLog('❌ Connection Error', { error: error?.toString() || 'Unknown error' });

        // Attempt to reconnect after 3 seconds
        setTimeout(connectToStream, 3000);
      };

    } catch (error) {
      setIsConnected(false);
      addLog('💥 Failed to connect', { error: error instanceof Error ? error.toString() : 'Unknown error' });
    }
  };

  const addLog = (message: string, data: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const id = ++logIdRef.current;

    setLogs(prev => [...prev.slice(-99), { timestamp, message, data, id }]);
  };

  const clearLogs = () => {
    setLogs([]);
    logIdRef.current = 0;
  };

  const exportLogs = () => {
    const logsText = logs.map(log =>
      `[${log.timestamp}] ${log.message}\n${JSON.stringify(log.data, null, 2)}`
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

        <div className="flex items-center gap-4 mb-6">
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
          {logs.length === 0 ? (
            <div className="text-slate-500 text-center py-8">
              Waiting for events... Connection status: {isConnected ? 'Connected' : 'Connecting...'}
            </div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="border-l-2 border-blue-500 pl-3 py-1">
                <div className="flex items-center gap-2 text-blue-400 mb-1">
                  <span className="text-slate-500">[{log.timestamp}]</span>
                  <span>{log.message}</span>
                </div>
                <pre className="text-slate-300 text-xs overflow-x-auto">
                  {JSON.stringify(log.data, null, 2)}
                </pre>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-medium text-blue-900 mb-2">ℹ️ Real-Time Events</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Metrics:</strong> Traffic statistics, cache hit rates, bot detection</li>
            <li>• <strong>Performance:</strong> Response times, memory usage, queue metrics</li>
            <li>• <strong>Events:</strong> Cache operations, snapshot captures, rule changes</li>
            <li>• <strong>System:</strong> Health checks, configuration updates, errors</li>
          </ul>
        </div>
      </div>
    </div>
  );
}