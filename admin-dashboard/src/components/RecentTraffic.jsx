import { useState, useEffect } from 'react';

export default function RecentTraffic() {
  const [traffic, setTraffic] = useState([]);
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    fetchTraffic();
    const interval = setInterval(fetchTraffic, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [limit]);

  const fetchTraffic = async () => {
    try {
      const res = await fetch(`/admin/api/traffic?limit=${limit}`);
      const data = await res.json();
      if (data.success) {
        setTraffic(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch traffic:', error);
    }
  };

  const getActionBadge = (action) => {
    const badges = {
      ssr: { text: 'SSR', color: '#10b981' },
      proxy: { text: 'Proxy', color: '#3b82f6' },
      static: { text: 'Static', color: '#6b7280' },
      bypass: { text: 'Bypass', color: '#f59e0b' },
      error: { text: 'Error', color: '#ef4444' },
    };
    const badge = badges[action] || { text: action, color: '#6b7280' };
    return (
      <span className="badge" style={{ backgroundColor: badge.color }}>
        {badge.text}
      </span>
    );
  };

  const getCacheStatus = (status) => {
    if (!status) return null;
    const color = status === 'HIT' ? '#10b981' : '#f59e0b';
    return (
      <span className="badge" style={{ backgroundColor: color }}>
        {status}
      </span>
    );
  };

  return (
    <div className="recent-traffic">
      <div className="traffic-header">
        <h2>🚦 Recent Traffic</h2>
        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
          <option value="25">Last 25</option>
          <option value="50">Last 50</option>
          <option value="100">Last 100</option>
        </select>
      </div>

      <div className="traffic-list">
        {traffic.length === 0 ? (
          <div className="no-data">No traffic data</div>
        ) : (
          <table className="traffic-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Path</th>
                <th>Bot</th>
                <th>Action</th>
                <th>Cache</th>
                <th>User Agent</th>
              </tr>
            </thead>
            <tbody>
              {traffic.map((entry, i) => (
                <tr key={i}>
                  <td className="time-cell">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="path-cell">{entry.path}</td>
                  <td>{entry.isBot ? '🤖' : '👤'}</td>
                  <td>{getActionBadge(entry.action)}</td>
                  <td>{getCacheStatus(entry.cacheStatus)}</td>
                  <td className="ua-cell">{entry.userAgent?.substring(0, 50)}...</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
