import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function TrafficChart({ data, fullWidth }) {
  if (!data || data.length === 0) {
    return (
      <div className={`chart-card ${fullWidth ? 'full-width' : ''}`}>
        <h2>📈 Traffic Timeline</h2>
        <div className="no-data">No traffic data yet...</div>
      </div>
    );
  }

  const chartData = data.map((point) => ({
    time: new Date(point.timestamp).toLocaleTimeString(),
    total: point.metrics?.totalRequests || 0,
    bots: point.metrics?.botRequests || 0,
    humans: point.metrics?.humanRequests || 0,
    ssr: point.metrics?.ssrRendered || 0,
  }));

  return (
    <div className={`chart-card ${fullWidth ? 'full-width' : ''}`}>
      <h2>📈 Traffic Timeline (Real-time)</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="time" stroke="#9ca3af" />
          <YAxis stroke="#9ca3af" />
          <Tooltip
            contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
            labelStyle={{ color: '#fff' }}
          />
          <Legend />
          <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total" strokeWidth={2} />
          <Line type="monotone" dataKey="bots" stroke="#8b5cf6" name="Bots" strokeWidth={2} />
          <Line type="monotone" dataKey="humans" stroke="#10b981" name="Humans" strokeWidth={2} />
          <Line type="monotone" dataKey="ssr" stroke="#f59e0b" name="SSR" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
