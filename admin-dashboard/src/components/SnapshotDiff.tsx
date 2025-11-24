import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

interface Snapshot {
  id: string;
  url: string;
  timestamp: string;
  screenshot: string;
  html: string;
  title: string;
  dimensions: {
    width: number;
    height: number;
  };
  renderTime: number;
  userAgent: string;
}

interface DiffResult {
  id: string;
  url: string;
  beforeId: string;
  afterId: string;
  timestamp: string;
  diffScore: number;
  diffImage: string;
  beforeSnapshot: Snapshot;
  afterSnapshot: Snapshot;
}

interface SnapshotListResponse {
  snapshots: Snapshot[];
  total: number;
  page: number;
  totalPages: number;
}

const SnapshotDiff = () => {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedBefore, setSelectedBefore] = useState<string>('');
  const [selectedAfter, setSelectedAfter] = useState<string>('');
  const [currentDiff, setCurrentDiff] = useState<DiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [captureUrl, setCaptureUrl] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'compare'>('list');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchSnapshots(page);
  }, [page]);

  const fetchSnapshots = async (pageNum: number) => {
    try {
      const response = await fetch(`/api/snapshots?page=${pageNum}&limit=20`, {
        headers: {
          'Authorization': `Basic ${btoa(localStorage.getItem('adminCredentials') || '')}`,
        },
      });
      const result = await response.json();
      if (result.success) {
        const data = result.data as SnapshotListResponse;
        setSnapshots(data.snapshots);
        setTotalPages(data.totalPages);
      }
    } catch (error) {
      console.error('Failed to fetch snapshots:', error);
    }
  };

  const handleCaptureSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captureUrl.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/snapshots/capture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(localStorage.getItem('adminCredentials') || '')}`,
        },
        body: JSON.stringify({
          url: captureUrl,
          options: {
            width: 1200,
            height: 800,
            fullPage: true,
            waitFor: 'networkidle2',
          },
        }),
      });

      const result = await response.json();
      if (result.success) {
        setCaptureUrl('');
        fetchSnapshots(page);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      alert('Failed to capture snapshot');
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    if (!selectedBefore || !selectedAfter) {
      alert('Please select both "before" and "after" snapshots');
      return;
    }

    if (selectedBefore === selectedAfter) {
      alert('Please select different snapshots for comparison');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/snapshots/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(localStorage.getItem('adminCredentials') || '')}`,
        },
        body: JSON.stringify({
          beforeId: selectedBefore,
          afterId: selectedAfter,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setCurrentDiff(result.data);
        setViewMode('compare');
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      alert('Failed to compare snapshots');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    if (!confirm('Are you sure you want to delete this snapshot?')) return;

    try {
      const response = await fetch(`/api/snapshots/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Basic ${btoa(localStorage.getItem('adminCredentials') || '')}`,
        },
      });

      if (response.ok) {
        fetchSnapshots(page);
        // Clear selections if they were this snapshot
        if (selectedBefore === id) setSelectedBefore('');
        if (selectedAfter === id) setSelectedAfter('');
      }
    } catch (error) {
      alert('Failed to delete snapshot');
    }
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getDiffScoreColor = (score: number) => {
    if (score === 0) return 'text-green-600';
    if (score < 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getDiffScoreBadge = (score: number) => {
    if (score === 0) return 'default';
    if (score < 5) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Visual Snapshot Diff</h2>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            onClick={() => setViewMode('list')}
          >
            Snapshot List
          </Button>
          <Button
            variant={viewMode === 'compare' ? 'default' : 'outline'}
            onClick={() => setViewMode('compare')}
            disabled={!currentDiff}
          >
            Comparison View
          </Button>
        </div>
      </div>

      {/* Capture New Snapshot */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Capture New Snapshot</h3>
          <form onSubmit={handleCaptureSnapshot} className="flex gap-4">
            <input
              type="url"
              value={captureUrl}
              onChange={(e) => setCaptureUrl(e.target.value)}
              placeholder="https://example.com/page"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <Button type="submit" disabled={loading}>
              {loading ? 'Capturing...' : 'Capture Snapshot'}
            </Button>
          </form>
        </div>
      </Card>

      {viewMode === 'list' ? (
        <>
          {/* Comparison Controls */}
          {(selectedBefore || selectedAfter) && (
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4">Compare Snapshots</h3>
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Before Snapshot
                    </label>
                    <select
                      value={selectedBefore}
                      onChange={(e) => setSelectedBefore(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select before snapshot</option>
                      {snapshots.map((snapshot) => (
                        <option key={snapshot.id} value={snapshot.id}>
                          {snapshot.title} - {formatDate(snapshot.timestamp)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      After Snapshot
                    </label>
                    <select
                      value={selectedAfter}
                      onChange={(e) => setSelectedAfter(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select after snapshot</option>
                      {snapshots.map((snapshot) => (
                        <option key={snapshot.id} value={snapshot.id}>
                          {snapshot.title} - {formatDate(snapshot.timestamp)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={handleCompare}
                    disabled={!selectedBefore || !selectedAfter || loading}
                  >
                    Compare
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Snapshots Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {snapshots.map((snapshot) => (
              <Card key={snapshot.id} className="overflow-hidden">
                <div className="aspect-video bg-slate-100 relative">
                  <img
                    src={snapshot.screenshot}
                    alt={snapshot.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {selectedBefore === snapshot.id && (
                    <Badge className="absolute top-2 left-2 bg-blue-600">Before</Badge>
                  )}
                  {selectedAfter === snapshot.id && (
                    <Badge className="absolute top-2 left-2 bg-green-600">After</Badge>
                  )}
                </div>
                <div className="p-4">
                  <h4 className="font-semibold text-sm mb-1 truncate" title={snapshot.title}>
                    {snapshot.title}
                  </h4>
                  <p className="text-xs text-slate-600 mb-2 truncate" title={snapshot.url}>
                    {snapshot.url}
                  </p>
                  <div className="flex justify-between items-center text-xs text-slate-500">
                    <span>{formatDate(snapshot.timestamp)}</span>
                    <span>{snapshot.renderTime}ms</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!selectedBefore) setSelectedBefore(snapshot.id);
                        else if (!selectedAfter) setSelectedAfter(snapshot.id);
                        else setSelectedBefore(snapshot.id);
                      }}
                    >
                      {selectedBefore === snapshot.id ? 'Before' :
                       selectedAfter === snapshot.id ? 'After' : 'Select'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteSnapshot(snapshot.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="py-2 px-4">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        /* Comparison View */
        currentDiff && (
          <div className="space-y-6">
            {/* Diff Stats */}
            <Card>
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Comparison Results</h3>
                  <Badge variant={getDiffScoreBadge(currentDiff.diffScore)}>
                    {currentDiff.diffScore}% Difference
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium">URL:</span>
                    <p className="text-slate-600 truncate" title={currentDiff.url}>
                      {currentDiff.url}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium">Comparison Date:</span>
                    <p className="text-slate-600">{formatDate(currentDiff.timestamp)}</p>
                  </div>
                  <div>
                    <span className="font-medium">Diff Score:</span>
                    <p className={getDiffScoreColor(currentDiff.diffScore)}>
                      {currentDiff.diffScore}% changed
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Screenshots Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <div className="p-4">
                  <h4 className="font-semibold mb-2 text-blue-600">Before</h4>
                  <p className="text-sm text-slate-600 mb-4">
                    {formatDate(currentDiff.beforeSnapshot.timestamp)}
                  </p>
                  <img
                    src={currentDiff.beforeSnapshot.screenshot}
                    alt="Before"
                    className="w-full border rounded"
                  />
                </div>
              </Card>
              <Card>
                <div className="p-4">
                  <h4 className="font-semibold mb-2 text-green-600">After</h4>
                  <p className="text-sm text-slate-600 mb-4">
                    {formatDate(currentDiff.afterSnapshot.timestamp)}
                  </p>
                  <img
                    src={currentDiff.afterSnapshot.screenshot}
                    alt="After"
                    className="w-full border rounded"
                  />
                </div>
              </Card>
            </div>

            {/* Diff Visualization */}
            {currentDiff.diffScore > 0 && (
              <Card>
                <div className="p-4">
                  <h4 className="font-semibold mb-2 text-red-600">Visual Diff</h4>
                  <p className="text-sm text-slate-600 mb-4">
                    Highlighted differences (red areas show changes)
                  </p>
                  <img
                    src={currentDiff.diffImage}
                    alt="Difference"
                    className="w-full border rounded"
                  />
                </div>
              </Card>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              <Button onClick={() => setViewMode('list')}>
                Back to List
              </Button>
            </div>
          </div>
        )
      )}

      {snapshots.length === 0 && viewMode === 'list' && (
        <Card>
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">📸</div>
            <h3 className="text-lg font-semibold mb-2">No Snapshots Yet</h3>
            <p className="text-slate-600 mb-4">
              Capture your first snapshot to start comparing visual changes
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default SnapshotDiff;