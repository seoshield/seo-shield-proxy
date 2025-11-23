export default function StatsOverview({ stats }) {
  if (!stats) {
    return <div className="loading">Loading stats...</div>;
  }

  const { metrics, cache, memory } = stats;

  const cards = [
    {
      title: 'Total Requests',
      value: metrics.totalRequests.toLocaleString(),
      icon: '📥',
      color: '#3b82f6',
    },
    {
      title: 'Bot Requests',
      value: metrics.botRequests.toLocaleString(),
      icon: '🤖',
      color: '#8b5cf6',
      subtitle: `${((metrics.botRequests / metrics.totalRequests) * 100 || 0).toFixed(1)}%`,
    },
    {
      title: 'SSR Rendered',
      value: metrics.ssrRendered.toLocaleString(),
      icon: '🎨',
      color: '#10b981',
    },
    {
      title: 'Cache Hit Rate',
      value: `${cache.hitRate}%`,
      icon: '✅',
      color: '#f59e0b',
      subtitle: `${cache.hits}/${cache.hits + cache.misses}`,
    },
    {
      title: 'Cached Pages',
      value: cache.keys.toLocaleString(),
      icon: '💾',
      color: '#06b6d4',
    },
    {
      title: 'Memory Used',
      value: `${memory.heapUsed} MB`,
      icon: '🧠',
      color: '#ef4444',
      subtitle: `/ ${memory.heapTotal} MB`,
    },
  ];

  return (
    <div className="stats-grid">
      {cards.map((card, i) => (
        <div key={i} className="stat-card" style={{ borderLeft: `4px solid ${card.color}` }}>
          <div className="stat-icon">{card.icon}</div>
          <div className="stat-content">
            <div className="stat-title">{card.title}</div>
            <div className="stat-value">{card.value}</div>
            {card.subtitle && <div className="stat-subtitle">{card.subtitle}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
