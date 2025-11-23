import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export default function TrafficChart({ data, fullWidth }) {
  if (!data || data.length === 0) {
    return (
      <Card className={fullWidth ? 'col-span-full' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>📈</span> Traffic Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-slate-500">
            No traffic data yet...
          </div>
        </CardContent>
      </Card>
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
    <Card className={fullWidth ? 'col-span-full' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>📈</span> Traffic Timeline (Real-time)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="time" stroke="#64748b" style={{ fontSize: '12px' }} />
            <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
              labelStyle={{ color: '#0f172a', fontWeight: 600 }}
            />
            <Legend wrapperStyle={{ fontSize: '12px' }} />
            <Line type="monotone" dataKey="total" stroke="#3b82f6" name="Total" strokeWidth={2} />
            <Line type="monotone" dataKey="bots" stroke="#8b5cf6" name="Bots" strokeWidth={2} />
            <Line type="monotone" dataKey="humans" stroke="#10b981" name="Humans" strokeWidth={2} />
            <Line type="monotone" dataKey="ssr" stroke="#f59e0b" name="SSR" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
