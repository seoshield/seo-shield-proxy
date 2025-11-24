import { useState, useEffect } from 'react';
import { useNotifications } from '../contexts/NotificationContext';
import { useConfirm } from './ConfirmModal';

import { apiCall } from '../config/api';

interface BlockingRule {
  id: string;
  name: string;
  enabled: boolean;
  pattern: string;
  type: 'ip' | 'userAgent' | 'path' | 'header';
  action: 'block' | 'throttle' | 'allow';
  count: number;
  lastTriggered: string;
  description: string;
}

interface BlockingStats {
  totalBlocked: number;
  totalAllowed: number;
  blockedToday: number;
  mostBlockedPattern: string;
  activeRules: number;
}

export default function BlockingPanel() {
  const [rules, setRules] = useState<BlockingRule[]>([]);
  const [stats, setStats] = useState<BlockingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    pattern: '',
    type: 'ip' as BlockingRule['type'],
    action: 'block' as BlockingRule['action'],
  });

  const { addNotification } = useNotifications();
  const { confirm, ConfirmComponent } = useConfirm();

  useEffect(() => {
    fetchBlockingData();
    const interval = setInterval(fetchBlockingData, 15000); // Update every 15 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchBlockingData = async () => {
    try {
      setLoading(true);
      const [rulesResponse, statsResponse] = await Promise.all([
        apiCall('/api/blocking/rules'),
        apiCall('/api/blocking/stats')
      ]);

      if (rulesResponse.ok && statsResponse.ok) {
        const [rulesData, statsData] = await Promise.all([
          rulesResponse.json(),
          statsResponse.json()
        ]);
        setRules(rulesData.rules || []);
        setStats(statsData);
      }
    } catch (error) {
      console.error('Failed to fetch blocking data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleRule = async (ruleId: string) => {
    try {
      const response = await apiCall(`/blocking/rules/${ruleId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        fetchBlockingData();
      }
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const deleteRule = async (ruleId: string) => {
    const shouldDelete = await confirm(
      'Delete Blocking Rule',
      'Are you sure you want to delete this rule?',
      async () => {},
      { type: 'warning', confirmText: 'Delete', cancelText: 'Cancel' }
    );

    if (!shouldDelete) return;

    try {
      const response = await apiCall(`/blocking/rules/${ruleId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchBlockingData();
      }
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const addRule = async () => {
    if (!newRule.name || !newRule.pattern) {
      addNotification('Name and pattern are required', 'error');
      return;
    }

    try {
      const response = await apiCall('/api/blocking/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule),
      });
      if (response.ok) {
        setShowAddModal(false);
        setNewRule({
          name: '',
          pattern: '',
          type: 'ip',
          action: 'block',
        });
        fetchBlockingData();
      }
    } catch (error) {
      console.error('Failed to add rule:', error);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'ip': return '🌐';
      case 'userAgent': return '🤖';
      case 'path': return '📂';
      case 'header': return '📋';
      default: return '❓';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'block': return 'bg-red-100 text-red-800';
      case 'throttle': return 'bg-yellow-100 text-yellow-800';
      case 'allow': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <ConfirmComponent />
      <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Request Blocking Manager</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            ➕ Add Rule
          </button>
          <button
            onClick={fetchBlockingData}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Blocked</p>
                <p className="text-2xl font-bold text-red-600">{stats.totalBlocked.toLocaleString()}</p>
              </div>
              <div className="text-3xl">🚫</div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Allowed</p>
                <p className="text-2xl font-bold text-green-600">{stats.totalAllowed.toLocaleString()}</p>
              </div>
              <div className="text-3xl">✅</div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Blocked Today</p>
                <p className="text-2xl font-bold text-slate-900">{stats.blockedToday.toLocaleString()}</p>
              </div>
              <div className="text-3xl">📅</div>
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Active Rules</p>
                <p className="text-2xl font-bold text-blue-600">{stats.activeRules}</p>
              </div>
              <div className="text-3xl">📋</div>
            </div>
          </div>
        </div>
      )}

      {/* Rules List */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Blocking Rules</h3>
        </div>
        <div className="divide-y divide-slate-200">
          {rules.map((rule) => (
            <div key={rule.id} className="p-6 hover:bg-slate-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-2xl">{getTypeIcon(rule.type)}</div>
                  <div>
                    <h4 className="font-semibold text-slate-900">{rule.name}</h4>
                    <p className="text-sm text-slate-600">{rule.description}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <code className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-sm">
                        {rule.pattern}
                      </code>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(rule.action)}`}>
                        {rule.action}
                      </span>
                      <span className="text-xs text-slate-500">
                        Blocked {rule.count} times
                      </span>
                      {rule.lastTriggered && (
                        <span className="text-xs text-slate-500">
                          Last: {new Date(rule.lastTriggered).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      rule.enabled
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                    }`}
                  >
                    {rule.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="px-3 py-1 bg-red-100 text-red-800 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {rules.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🛡️</div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Blocking Rules</h3>
          <p className="text-slate-600 mb-4">Create your first blocking rule to protect your application.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create First Rule
          </button>
        </div>
      )}

      {/* Add Rule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Blocking Rule</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Block Malicious IPs"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pattern</label>
                <input
                  type="text"
                  value={newRule.pattern}
                  onChange={(e) => setNewRule({ ...newRule, pattern: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 192.168.1.1, curl/*"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                <select
                  value={newRule.type}
                  onChange={(e) => setNewRule({ ...newRule, type: e.target.value as BlockingRule['type'] })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ip">IP Address</option>
                  <option value="userAgent">User Agent</option>
                  <option value="path">Path</option>
                  <option value="header">Header</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Action</label>
                <select
                  value={newRule.action}
                  onChange={(e) => setNewRule({ ...newRule, action: e.target.value as BlockingRule['action'] })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="block">Block</option>
                  <option value="throttle">Throttle</option>
                  <option value="allow">Allow</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addRule}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
}