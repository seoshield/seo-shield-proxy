import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#06b6d4', '#ef4444', '#ec4899', '#f97316'];

export default function BotStats({ stats }) {
  if (!stats || !stats.bots) {
    return (
      <div className="chart-card">
        <h2>🤖 Bot Breakdown</h2>
        <div className="no-data">No bot data yet...</div>
      </div>
    );
  }

  const botData = Object.entries(stats.bots)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  if (botData.length === 0) {
    return (
      <div className="chart-card">
        <h2>🤖 Bot Breakdown</h2>
        <div className="no-data">No bot traffic yet...</div>
      </div>
    );
  }

  return (
    <div className="chart-card">
      <h2>🤖 Bot Breakdown</h2>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={botData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="count"
          >
            {botData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
