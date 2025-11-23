import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import Header from './components/Header';
import StatsOverview from './components/StatsOverview';
import TrafficChart from './components/TrafficChart';
import BotStats from './components/BotStats';
import CacheManagement from './components/CacheManagement';
import RecentTraffic from './components/RecentTraffic';
import ConfigPanel from './components/ConfigPanel';

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const { stats, traffic, isConnected } = useWebSocket();

  return (
    <div className="app">
      <Header isConnected={isConnected} />

      <nav className="tabs">
        <button
          className={activeTab === 'overview' ? 'active' : ''}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button
          className={activeTab === 'traffic' ? 'active' : ''}
          onClick={() => setActiveTab('traffic')}
        >
          🚦 Traffic
        </button>
        <button
          className={activeTab === 'cache' ? 'active' : ''}
          onClick={() => setActiveTab('cache')}
        >
          💾 Cache
        </button>
        <button
          className={activeTab === 'config' ? 'active' : ''}
          onClick={() => setActiveTab('config')}
        >
          ⚙️ Config
        </button>
      </nav>

      <main className="content">
        {activeTab === 'overview' && (
          <>
            <StatsOverview stats={stats} />
            <div className="grid-2">
              <TrafficChart data={traffic} />
              <BotStats stats={stats} />
            </div>
          </>
        )}

        {activeTab === 'traffic' && (
          <>
            <TrafficChart data={traffic} fullWidth />
            <RecentTraffic />
          </>
        )}

        {activeTab === 'cache' && <CacheManagement stats={stats} />}

        {activeTab === 'config' && <ConfigPanel />}
      </main>
    </div>
  );
}

export default App;
