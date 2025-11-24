import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { useNotifications } from '../contexts/NotificationContext';
import { useConfirm } from './ConfirmModal';

import { apiCall } from '../config/api';

interface HotfixAction {
  type: 'replace' | 'prepend' | 'append' | 'remove' | 'attribute';
  selector: string;
  target?: string;
  value?: string;
  regex?: string;
  flags?: string;
}

interface HotfixRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  urlPattern: string;
  conditions: {
    userAgent?: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
  };
  actions: HotfixAction[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  expiresAt?: string;
}

interface HotfixTest {
  url: string;
  originalHtml: string;
  hotfixedHtml: string;
  result: {
    applied: boolean;
    matchedRules: Array<{
      ruleId: string;
      ruleName: string;
      actions: number;
    }>;
    processingTime: number;
  };
  timestamp: string;
}

interface HotfixStats {
  total: number;
  enabled: number;
  disabled: number;
  expired: number;
}

const HotfixPanel = () => {
  const [rules, setRules] = useState<HotfixRule[]>([]);
  const [stats, setStats] = useState<HotfixStats>({
    total: 0,
    enabled: 0,
    disabled: 0,
    expired: 0,
  });
  const [testHistory, setTestHistory] = useState<HotfixTest[]>([]);
  const [loading, setLoading] = useState(false);
  const [testUrl, setTestUrl] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRule, setEditingRule] = useState<HotfixRule | null>(null);
  const [activeTab, setActiveTab] = useState<'rules' | 'test'>('rules');

  const { addNotification } = useNotifications();
  const { confirm, ConfirmComponent } = useConfirm();

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    urlPattern: '',
    priority: 100,
    conditions: {
      userAgent: '',
      headers: [] as string[],
      query: [] as string[],
    },
    actions: [] as HotfixAction[],
    expiresAt: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [rulesRes, statsRes, historyRes] = await Promise.all([
        apiCall('/api/hotfix/rules', {
          headers: { 'Authorization': `Basic ${btoa(localStorage.getItem('adminCredentials') || '')}` },
        }),
        apiCall('/api/hotfix/stats', {
          headers: { 'Authorization': `Basic ${btoa(localStorage.getItem('adminCredentials') || '')}` },
        }),
        apiCall('/api/hotfix/tests?limit=10', {
          headers: { 'Authorization': `Basic ${btoa(localStorage.getItem('adminCredentials') || '')}` },
        }),
      ]);

      const rulesData = await rulesRes.json();
      const statsData = await statsRes.json();
      const historyData = await historyRes.json();

      if (rulesData.success) setRules(rulesData.data);
      if (statsData.success) setStats(statsData.data);
      if (historyData.success) setTestHistory(historyData.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const handleCreateRule = async () => {
    if (!formData.name || !formData.urlPattern) {
      addNotification('Name and URL pattern are required', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await apiCall('/api/hotfix/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(localStorage.getItem('adminCredentials') || '')}`,
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (result.success) {
        setShowCreateForm(false);
        resetForm();
        addNotification('Hotfix rule created successfully', 'success');
        fetchData();
      } else {
        addNotification(`Error: ${result.error}`, 'error');
      }
    } catch (error) {
      addNotification('Failed to create rule', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRule = async () => {
    if (!editingRule || !formData.name || !formData.urlPattern) {
      addNotification('Name and URL pattern are required', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await apiCall(`/hotfix/rules/${editingRule.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(localStorage.getItem('adminCredentials') || '')}`,
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();
      if (result.success) {
        setEditingRule(null);
        resetForm();
        fetchData();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      alert('Failed to update rule');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (id: string) => {
    const shouldDelete = await confirm(
      'Delete Hotfix Rule',
      'Are you sure you want to delete this hotfix rule?',
      async () => {},
      { type: 'danger', confirmText: 'Delete', cancelText: 'Cancel' }
    );

    if (!shouldDelete) return;

    try {
      const response = await apiCall(`/hotfix/rules/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${btoa(localStorage.getItem('adminCredentials') || '')}`,
        },
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      alert('Failed to delete rule');
    }
  };

  const handleToggleRule = async (id: string) => {
    try {
      const response = await apiCall(`/hotfix/rules/${id}/toggle`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(localStorage.getItem('adminCredentials') || '')}`,
        },
      });

      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      alert('Failed to toggle rule');
    }
  };

  const handleTestHotfix = async () => {
    if (!testUrl.trim()) return;

    setLoading(true);
    try {
      const response = await apiCall('/api/hotfix/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(localStorage.getItem('adminCredentials') || '')}`,
        },
        body: JSON.stringify({ url: testUrl }),
      });

      const result = await response.json();
      if (result.success) {
        setTestUrl('');
        fetchData();
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      alert('Failed to test hotfix');
    } finally {
      setLoading(false);
    }
  };

  const startEditRule = (rule: HotfixRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      urlPattern: rule.urlPattern,
      priority: rule.priority,
      conditions: {
        userAgent: rule.conditions.userAgent || '',
        headers: Object.entries(rule.conditions.headers || {}).map(([k, v]) => `${k}:${v}`),
        query: Object.entries(rule.conditions.query || {}).map(([k, v]) => `${k}:${v}`),
      },
      actions: rule.actions,
      expiresAt: rule.expiresAt ? new Date(rule.expiresAt).toISOString().slice(0, 16) : '',
    });
    setShowCreateForm(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      urlPattern: '',
      priority: 100,
      conditions: {
        userAgent: '',
        headers: [],
        query: [],
      },
      actions: [],
      expiresAt: '',
    });
    setEditingRule(null);
  };

  const addAction = () => {
    setFormData(prev => ({
      ...prev,
      actions: [...prev.actions, {
        type: 'replace',
        selector: '',
        value: '',
      }],
    }));
  };

  const updateAction = (index: number, field: keyof HotfixAction, value: any) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.map((action, i) =>
        i === index ? { ...action, [field]: value } : action
      ),
    }));
  };

  const removeAction = (index: number) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index),
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const isExpired = (rule: HotfixRule) => {
    return rule.expiresAt && new Date(rule.expiresAt) < new Date();
  };

  return (
    <>
      <ConfirmComponent />
      <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Emergency Hotfix Engine</h2>
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'rules' ? 'default' : 'outline'}
            onClick={() => setActiveTab('rules')}
          >
            Rules
          </Button>
          <Button
            variant={activeTab === 'test' ? 'default' : 'outline'}
            onClick={() => setActiveTab('test')}
          >
            Testing
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="p-4">
            <h3 className="text-sm font-medium text-slate-600">Total Rules</h3>
            <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <h3 className="text-sm font-medium text-slate-600">Enabled</h3>
            <p className="text-2xl font-bold text-green-600">{stats.enabled}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <h3 className="text-sm font-medium text-slate-600">Disabled</h3>
            <p className="text-2xl font-bold text-red-600">{stats.disabled}</p>
          </div>
        </Card>
        <Card>
          <div className="p-4">
            <h3 className="text-sm font-medium text-slate-600">Expired</h3>
            <p className="text-2xl font-bold text-yellow-600">{stats.expired}</p>
          </div>
        </Card>
      </div>

      {activeTab === 'rules' ? (
        <>
          {/* Create/Edit Rule Form */}
          {showCreateForm && (
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">
                  {editingRule ? 'Edit Hotfix Rule' : 'Create New Hotfix Rule'}
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Rule Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Priority
                      </label>
                      <input
                        type="number"
                        value={formData.priority}
                        onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        min="0"
                        max="999"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      URL Pattern *
                    </label>
                    <input
                      type="text"
                      value={formData.urlPattern}
                      onChange={(e) => setFormData(prev => ({ ...prev, urlPattern: e.target.value }))}
                      placeholder="https://example.com/.*"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      User Agent Condition
                    </label>
                    <input
                      type="text"
                      value={formData.conditions.userAgent}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        conditions: { ...prev.conditions, userAgent: e.target.value }
                      }))}
                      placeholder="Googlebot|Bingbot"
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Expires At
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.expiresAt}
                      onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-slate-700">
                        Actions
                      </label>
                      <Button type="button" onClick={addAction} size="sm">
                        Add Action
                      </Button>
                    </div>
                    {formData.actions.map((action, index) => (
                      <div key={index} className="border rounded p-3 space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                          <select
                            value={action.type}
                            onChange={(e) => updateAction(index, 'type', e.target.value)}
                            className="px-2 py-1 border border-slate-300 rounded"
                          >
                            <option value="replace">Replace</option>
                            <option value="prepend">Prepend</option>
                            <option value="append">Append</option>
                            <option value="remove">Remove</option>
                            <option value="attribute">Attribute</option>
                          </select>
                          <input
                            type="text"
                            value={action.selector}
                            onChange={(e) => updateAction(index, 'selector', e.target.value)}
                            placeholder="Selector/Regex"
                            className="px-2 py-1 border border-slate-300 rounded"
                          />
                          {action.type !== 'remove' && (
                            <input
                              type="text"
                              value={action.value || ''}
                              onChange={(e) => updateAction(index, 'value', e.target.value)}
                              placeholder="Value"
                              className="px-2 py-1 border border-slate-300 rounded"
                            />
                          )}
                          <Button
                            type="button"
                            onClick={() => removeAction(index)}
                            size="sm"
                            variant="destructive"
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={editingRule ? handleUpdateRule : handleCreateRule}
                      disabled={loading}
                    >
                      {editingRule ? 'Update Rule' : 'Create Rule'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowCreateForm(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Rules List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Hotfix Rules</h3>
              <Button onClick={() => setShowCreateForm(true)}>
                Create New Rule
              </Button>
            </div>

            {rules.map((rule) => (
              <Card key={rule.id}>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{rule.name}</h4>
                        <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                          {rule.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        {isExpired(rule) && (
                          <Badge variant="destructive">Expired</Badge>
                        )}
                        <Badge variant="outline">Priority: {rule.priority}</Badge>
                      </div>
                      {rule.description && (
                        <p className="text-sm text-slate-600 mb-2">{rule.description}</p>
                      )}
                      <div className="text-xs text-slate-500 space-y-1">
                        <div>Pattern: {rule.urlPattern}</div>
                        <div>Created: {formatDate(rule.createdAt)}</div>
                        {rule.expiresAt && (
                          <div>Expires: {formatDate(rule.expiresAt)}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleRule(rule.id)}
                      >
                        {rule.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEditRule(rule)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteRule(rule.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h5 className="font-medium text-sm mb-2">Actions ({rule.actions.length})</h5>
                    <div className="space-y-1">
                      {rule.actions.map((action, index) => (
                        <div key={index} className="text-xs bg-slate-50 p-2 rounded">
                          <span className="font-mono">
                            {action.type}: {action.selector}
                            {action.value && ` → ${action.value}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : (
        /* Testing Tab */
        <div className="space-y-6">
          {/* Test Form */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Test Hotfix on URL</h3>
              <div className="flex gap-4">
                <input
                  type="url"
                  value={testUrl}
                  onChange={(e) => setTestUrl(e.target.value)}
                  placeholder="https://example.com/page"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button onClick={handleTestHotfix} disabled={loading}>
                  {loading ? 'Testing...' : 'Test Hotfix'}
                </Button>
              </div>
            </div>
          </Card>

          {/* Test History */}
          <Card>
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4">Recent Tests</h3>
              {testHistory.length === 0 ? (
                <p className="text-slate-600 text-center py-8">No tests performed yet</p>
              ) : (
                <div className="space-y-4">
                  {testHistory.map((test, index) => (
                    <div key={index} className="border rounded p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h4 className="font-medium text-sm">{test.url}</h4>
                          <p className="text-xs text-slate-500">
                            {formatDate(test.timestamp)} • {test.result.processingTime}ms
                          </p>
                        </div>
                        <Badge variant={test.result.applied ? 'default' : 'secondary'}>
                          {test.result.applied ? 'Applied' : 'No Changes'}
                        </Badge>
                      </div>
                      {test.result.matchedRules.length > 0 && (
                        <div className="text-xs">
                          <span className="font-medium">Matched Rules:</span>
                          <ul className="ml-4 mt-1 space-y-1">
                            {test.result.matchedRules.map((matched, i) => (
                              <li key={i} className="text-slate-600">
                                • {matched.ruleName} ({matched.actions} actions)
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {rules.length === 0 && activeTab === 'rules' && !showCreateForm && (
        <Card>
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">🔧</div>
            <h3 className="text-lg font-semibold mb-2">No Hotfix Rules Yet</h3>
            <p className="text-slate-600 mb-4">
              Create your first hotfix rule to apply real-time changes without deployment
            </p>
            <Button onClick={() => setShowCreateForm(true)}>
              Create First Rule
            </Button>
          </div>
        </Card>
      )}
    </div>
    </>
  );
};

export default HotfixPanel;