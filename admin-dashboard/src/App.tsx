import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { NotificationProvider } from './contexts/NotificationContext';
import LoginPage from './components/LoginPage';
import StatsOverview from './components/StatsOverview';
import TrafficChart from './components/TrafficChart';
import BotStats from './components/BotStats';
import CacheManagement from './components/CacheManagement';
import RecentTraffic from './components/RecentTraffic';
import ConfigPanel from './components/ConfigPanel';
import CacheWarmer from './components/CacheWarmer';
import SnapshotDiff from './components/SnapshotDiff';
import HotfixPanel from './components/HotfixPanel';
import ForensicsPanel from './components/ForensicsPanel';
import BlockingPanel from './components/BlockingPanel';
import SimulationConsole from './components/SimulationConsole';
import SEOProtocolsPanel from './components/SEOProtocolsPanel';
import RealTimeStream from './components/RealTimeStream';
import SSRMonitor from './components/SSRMonitor';
import Sidebar from './components/Sidebar';
import Notifications from './components/Notifications';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const { stats, traffic, isConnected } = useWebSocket();

  useEffect(() => {
    // Check if user is already authenticated
    const authStatus = localStorage.getItem('adminAuth');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = (): void => {
    setIsAuthenticated(true);
  };

  const handleLogout = (): void => {
    localStorage.removeItem('adminAuth');
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <NotificationProvider>
        <LoginPage onLogin={handleLogin} />
        <Notifications />
      </NotificationProvider>
    );
  }

  return (
    <NotificationProvider>
      <div className="min-h-screen bg-slate-50 flex">
        <Notifications />
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isConnected={isConnected}
          onLogout={handleLogout}
        />
        <div className="flex-1 overflow-auto">
          <main className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <StatsOverview stats={stats} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <TrafficChart data={traffic} />
              <BotStats stats={stats} />
            </div>
          </div>
        )}

        {activeTab === 'traffic' && (
          <div className="space-y-6">
            <TrafficChart data={traffic} fullWidth />
            <RecentTraffic />
          </div>
        )}

        {activeTab === 'cache' && <CacheManagement stats={stats} />}

        {activeTab === 'warmer' && <CacheWarmer />}

        {activeTab === 'snapshot' && <SnapshotDiff />}

        {activeTab === 'seo' && <SEOProtocolsPanel />}

        {activeTab === 'forensics' && <ForensicsPanel />}

        {activeTab === 'blocking' && <BlockingPanel />}

        {activeTab === 'hotfix' && <HotfixPanel />}

        {activeTab === 'simulation' && <SimulationConsole />}

        {activeTab === 'realtime' && <RealTimeStream />}

        {activeTab === 'ssr' && <SSRMonitor />}

        {activeTab === 'config' && <ConfigPanel />}
          </main>
        </div>
      </div>
    </NotificationProvider>
  );
}

export default App;