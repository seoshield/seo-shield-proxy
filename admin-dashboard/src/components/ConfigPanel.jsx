import { useState, useEffect } from 'react';

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
    return <div className="loading">Loading configuration...</div>;
  }

  return (
    <div className="config-panel">
      <h2>⚙️ Configuration</h2>

      <div className="config-section">
        <h3>Cache Rules</h3>
        <div className="config-item">
          <label>
            <input
              type="checkbox"
              checked={config.cacheRules.cacheByDefault}
              onChange={toggleCacheByDefault}
              disabled={loading}
            />
            Cache by default
          </label>
        </div>

        <div className="config-item">
          <label>Meta Tag Name:</label>
          <input
            type="text"
            value={config.cacheRules.metaTagName}
            disabled
            className="config-input"
          />
        </div>

        <div className="config-item">
          <label>No-Cache Patterns:</label>
          <div className="pattern-list">
            {config.cacheRules.noCachePatterns.length === 0 ? (
              <div className="no-data">No patterns defined</div>
            ) : (
              config.cacheRules.noCachePatterns.map((pattern, i) => (
                <div key={i} className="pattern-item">
                  <code>{pattern}</code>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="config-item">
          <label>Cache Patterns:</label>
          <div className="pattern-list">
            {config.cacheRules.cachePatterns.length === 0 ? (
              <div className="no-data">No patterns defined</div>
            ) : (
              config.cacheRules.cachePatterns.map((pattern, i) => (
                <div key={i} className="pattern-item">
                  <code>{pattern}</code>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="config-section">
        <h3>Bot Rules</h3>
        <div className="config-item">
          <label>
            <input
              type="checkbox"
              checked={config.botRules.renderAllBots}
              disabled
            />
            Render all bots
          </label>
        </div>

        <div className="config-item">
          <label>Allowed Bots:</label>
          <div className="bot-list">
            {config.botRules.allowedBots.map((bot, i) => (
              <span key={i} className="bot-badge">
                {bot}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="config-section">
        <h3>Server Settings</h3>
        <div className="config-item">
          <label>Cache TTL:</label>
          <span>{config.cacheTTL} seconds</span>
        </div>
        <div className="config-item">
          <label>Max Cache Size:</label>
          <span>{config.maxCacheSize} pages</span>
        </div>
      </div>
    </div>
  );
}
