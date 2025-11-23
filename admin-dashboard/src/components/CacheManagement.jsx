import { useState, useEffect } from 'react';

export default function CacheManagement({ stats }) {
  const [cacheList, setCacheList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCacheList();
  }, []);

  const fetchCacheList = async () => {
    try {
      const res = await fetch('/admin/api/cache');
      const data = await res.json();
      if (data.success) {
        setCacheList(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch cache list:', error);
    }
  };

  const clearAllCache = async () => {
    if (!confirm('Are you sure you want to clear ALL cached pages?')) return;

    setLoading(true);
    try {
      const res = await fetch('/admin/api/cache/clear', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('Cache cleared successfully!');
        fetchCacheList();
      }
    } catch (error) {
      alert('Failed to clear cache: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const clearCacheEntry = async (url) => {
    setLoading(true);
    try {
      const res = await fetch('/admin/api/cache/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.success) {
        fetchCacheList();
      }
    } catch (error) {
      alert('Failed to clear cache entry: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cache-management">
      <div className="cache-header">
        <h2>💾 Cache Management</h2>
        <button onClick={clearAllCache} disabled={loading} className="btn-danger">
          🗑️ Clear All Cache
        </button>
      </div>

      {stats && (
        <div className="cache-stats">
          <div className="stat-item">
            <span>Total Cached Pages:</span>
            <strong>{stats.cache?.keys || 0}</strong>
          </div>
          <div className="stat-item">
            <span>Cache Hits:</span>
            <strong>{stats.cache?.hits || 0}</strong>
          </div>
          <div className="stat-item">
            <span>Cache Misses:</span>
            <strong>{stats.cache?.misses || 0}</strong>
          </div>
          <div className="stat-item">
            <span>Hit Rate:</span>
            <strong>{stats.cache?.hitRate || '0.00'}%</strong>
          </div>
        </div>
      )}

      <div className="cache-list">
        <h3>Cached URLs ({cacheList.length})</h3>
        {cacheList.length === 0 ? (
          <div className="no-data">No cached pages</div>
        ) : (
          <table className="cache-table">
            <thead>
              <tr>
                <th>URL</th>
                <th>Size</th>
                <th>TTL (seconds)</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {cacheList.map((entry, i) => (
                <tr key={i}>
                  <td className="url-cell">{entry.url}</td>
                  <td>{(entry.size / 1024).toFixed(2)} KB</td>
                  <td>{entry.ttl}</td>
                  <td>
                    <button
                      onClick={() => clearCacheEntry(entry.url)}
                      disabled={loading}
                      className="btn-sm btn-danger"
                    >
                      🗑️
                    </button>
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
