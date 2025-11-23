import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export default function StatsOverview({ stats }) {
  if (!stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-slate-500">Loading stats...</p>
      </div>
    );
  }

  const { metrics, cache, memory } = stats;

  const cards = [
    {
      title: 'Total Requests',
      value: metrics.totalRequests.toLocaleString(),
      icon: '📥',
      subtitle: `${((metrics.botRequests / metrics.totalRequests) * 100 || 0).toFixed(1)}% bots`,
    },
    {
      title: 'Bot Requests',
      value: metrics.botRequests.toLocaleString(),
      icon: '🤖',
      subtitle: `${metrics.humanRequests?.toLocaleString() || 0} humans`,
    },
    {
      title: 'SSR Rendered',
      value: metrics.ssrRendered.toLocaleString(),
      icon: '🎨',
      subtitle: 'Pages rendered',
    },
    {
      title: 'Cache Hit Rate',
      value: `${cache.hitRate}%`,
      icon: '✅',
      subtitle: `${cache.hits} hits / ${cache.misses} misses`,
    },
    {
      title: 'Cached Pages',
      value: cache.keys.toLocaleString(),
      icon: '💾',
      subtitle: 'In memory',
    },
    {
      title: 'Memory Used',
      value: `${memory.heapUsed} MB`,
      icon: '🧠',
      subtitle: `${memory.heapTotal} MB total`,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {cards.map((card, i) => (
        <Card key={i} className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">{card.title}</CardTitle>
            <span className="text-2xl">{card.icon}</span>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-slate-900">{card.value}</div>
            {card.subtitle && <p className="text-xs text-slate-500 mt-1">{card.subtitle}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
