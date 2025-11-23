import { Badge } from './ui/badge';
import { Button } from './ui/button';

export default function Header({ isConnected, onLogout }) {
  return (
    <header className="border-b border-slate-200 bg-white shadow-sm">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="text-3xl">🛡️</div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">SEO Shield Proxy</h1>
              <p className="text-sm text-slate-500">Real-time Admin Dashboard</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Badge variant={isConnected ? 'success' : 'destructive'}>
              {isConnected ? '● Connected' : '● Disconnected'}
            </Badge>
            {onLogout && (
              <Button variant="outline" size="sm" onClick={onLogout}>
                Logout
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
