import { useState, useEffect } from 'react';

import { apiCall } from '../config/api';

interface TrafficEntry {
  timestamp: string;
  path: string;
  isBot: boolean;
  action: string;
  cacheStatus?: string;
  userAgent?: string;
}

export default function RecentTraffic() {
  const [traffic, setTraffic] = useState<TrafficEntry[]>([]);
  const [limit, setLimit] = useState<number>(50);

  useEffect(() => {
    fetchTraffic();
    const interval = setInterval(fetchTraffic, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [limit]);

  const fetchTraffic = async (): Promise<void> => {
    try {
      const res = await apiCall(`/traffic?limit=${limit}`);
      const data = await res.json();
      if (data.success) {
        setTraffic(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch traffic:', error);
    }
  };

  const getActionBadge = (action: string) => {
    const badges: Record<string, { text: string; color: string }> = {
      ssr: { text: 'SSR', color: '#10b981' },
      proxy: { text: 'Proxy', color: '#3b82f6' },
      static: { text: 'Static', color: '#6b7280' },
      bypass: { text: 'Bypass', color: '#f59e0b' },
      error: { text: 'Error', color: '#ef4444' },
    };
    const badge = badges[action] || { text: action, color: '#6b7280' };
    return (
      <span
        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white"
        style={{ backgroundColor: badge.color }}
      >
        {badge.text}
      </span>
    );
  };

  const getCacheStatus = (status?: string) => {
    if (!status) return null;
    const color = status === 'HIT' ? '#10b981' : '#f59e0b';
    return (
      <span
        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white"
        style={{ backgroundColor: color }}
      >
        {status}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      <div className="flex items-center justify-between p-6 border-b border-slate-200">
        <h2 className="text-xl font-semibold text-slate-900">🚦 Recent Traffic</h2>
        <select
          value={limit}
          onChange={(e) => setLimit(Number(e.target.value))}
          className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="25">Last 25</option>
          <option value="50">Last 50</option>
          <option value="100">Last 100</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        {traffic.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-slate-500">
            No traffic data available
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Path
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Bot
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Cache
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  User Agent
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {traffic.map((entry, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 max-w-xs truncate">
                    {entry.path}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {entry.isBot ? '🤖' : '👤'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {getActionBadge(entry.action)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {getCacheStatus(entry.cacheStatus)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 max-w-xs truncate">
                    {entry.userAgent?.substring(0, 50)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}