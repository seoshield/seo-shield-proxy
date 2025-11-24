import React from 'react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isConnected: boolean;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, isConnected, onLogout }) => {
  const tabs: { id: string; icon: string; label: string; category: string }[] = [
    // Core
    { id: 'overview', icon: '📊', label: 'Overview', category: 'Core' },
    { id: 'traffic', icon: '🚦', label: 'Traffic', category: 'Core' },
    { id: 'cache', icon: '💾', label: 'Cache', category: 'Core' },

    // SSR & Performance
    { id: 'ssr', icon: '🔄', label: 'SSR Monitor', category: 'Performance' },
    { id: 'warmer', icon: '🔥', label: 'Cache Warmer', category: 'Performance' },
    { id: 'realtime', icon: '📡', label: 'Real-Time', category: 'Performance' },

    // SEO & Content
    { id: 'seo', icon: '🔍', label: 'SEO Protocols', category: 'SEO' },
    { id: 'snapshot', icon: '📸', label: 'Snapshot Diff', category: 'SEO' },

    // Security & Control
    { id: 'blocking', icon: '🚫', label: 'Blocking', category: 'Security' },
    { id: 'hotfix', icon: '🔧', label: 'Hotfix', category: 'Security' },
    { id: 'forensics', icon: '🕵️', label: 'Forensics', category: 'Security' },

    // Tools
    { id: 'simulation', icon: '🤖', label: 'UA Simulator', category: 'Tools' },
    { id: 'config', icon: '⚙️', label: 'Config', category: 'Tools' },
  ];

  const categories = Array.from(new Set(tabs.map(tab => tab.category)));

  const handleTabClick = (tabId: string) => {
    onTabChange(tabId);
  };

  return (
    <div className="w-64 bg-slate-900 text-white h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <h1 className="text-xl font-bold text-purple-400">SEO Shield</h1>
        <p className="text-xs text-slate-400 mt-1">Admin Dashboard</p>
        <div className="flex items-center gap-2 mt-2">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className="text-xs text-slate-300">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        {categories.map(category => (
          <div key={category} className="mb-6">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              {category}
            </h3>
            <div className="space-y-1">
              {tabs
                .filter(tab => tab.category === category)
                .map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabClick(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="text-lg">{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg text-red-400 hover:bg-red-900 hover:text-white transition-colors"
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;