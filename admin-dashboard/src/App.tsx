import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import LoginPage from './components/LoginPage';
import Header from './components/Header';
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
import type { TabButtonProps } from './types';

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
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header isConnected={isConnected} onLogout={handleLogout} />

      <nav className="bg-white border-b border-slate-200 px-6 overflow-x-auto">
        <div className="max-w-7xl mx-auto">
          <div className="flex space-x-1">
            <TabButton
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
              icon="📊"
              label="Overview"
            />
            <TabButton
              active={activeTab === 'traffic'}
              onClick={() => setActiveTab('traffic')}
              icon="🚦"
              label="Traffic"
            />
            <TabButton
              active={activeTab === 'cache'}
              onClick={() => setActiveTab('cache')}
              icon="💾"
              label="Cache"
            />
            <TabButton
              active={activeTab === 'warmer'}
              onClick={() => setActiveTab('warmer')}
              icon="🔥"
              label="Cache Warmer"
            />
            <TabButton
              active={activeTab === 'snapshots'}
              onClick={() => setActiveTab('snapshots')}
              icon="📸"
              label="Visual Diff"
            />
            <TabButton
              active={activeTab === 'seo-protocols'}
              onClick={() => setActiveTab('seo-protocols')}
              icon="⚡"
              label="SEO Protocols"
            />
            <TabButton
              active={activeTab === 'forensics'}
              onClick={() => setActiveTab('forensics')}
              icon="🔍"
              label="Forensics"
            />
            <TabButton
              active={activeTab === 'blocking'}
              onClick={() => setActiveTab('blocking')}
              icon="🚫"
              label="Blocking"
            />
            <TabButton
              active={activeTab === 'hotfix'}
              onClick={() => setActiveTab('hotfix')}
              icon="🔧"
              label="Hotfix"
            />
            <TabButton
              active={activeTab === 'simulation'}
              onClick={() => setActiveTab('simulation')}
              icon="🤖"
              label="UA Sim"
            />
            <TabButton
              active={activeTab === 'config'}
              onClick={() => setActiveTab('config')}
              icon="⚙️"
              label="Config"
            />
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
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

        {activeTab === 'snapshots' && <SnapshotDiff />}

        {activeTab === 'seo-protocols' && <SEOProtocolsPanel />}

        {activeTab === 'forensics' && <ForensicsPanel />}

        {activeTab === 'blocking' && <BlockingPanel />}

        {activeTab === 'hotfix' && <HotfixPanel />}

        {activeTab === 'simulation' && <SimulationConsole />}

        {activeTab === 'config' && <ConfigPanel />}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-3 font-medium text-sm transition-all
        ${
          active
            ? 'text-blue-600 border-b-2 border-blue-600'
            : 'text-slate-600 hover:text-slate-900 border-b-2 border-transparent hover:border-slate-300'
        }
      `}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export default App;