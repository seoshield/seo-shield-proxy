/**
 * SEO Shield Proxy - Admin Dashboard JavaScript
 * Handles API calls, real-time updates, and UI interactions
 */

// API base path (relative to current location)
const API_BASE = 'api';

// State
let statsInterval = null;
let sseConnection = null;

/**
 * Initialize dashboard on page load
 */
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Admin Dashboard loaded');

  // Initial data load
  loadAllData();

  // Set up auto-refresh every 5 seconds
  statsInterval = setInterval(loadStats, 5000);

  // Set up Server-Sent Events for real-time updates
  setupSSE();

  // Load configuration
  loadConfig();
});

/**
 * Load all dashboard data
 */
async function loadAllData() {
  await Promise.all([
    loadStats(),
    loadTraffic(),
    loadCache(),
    loadTopUrls(),
  ]);
}

/**
 * Load statistics
 */
async function loadStats() {
  try {
    const response = await fetch(`${API_BASE}/stats`);
    const result = await response.json();

    if (result.success) {
      updateStatsUI(result.data);
    }
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

/**
 * Update statistics UI
 */
function updateStatsUI(data) {
  const { metrics, bots, cache } = data;

  // Update uptime
  document.getElementById('uptime').textContent = `Uptime: ${formatUptime(metrics.uptime)}`;

  // Update main stats
  document.getElementById('totalRequests').textContent = formatNumber(metrics.totalRequests);
  document.getElementById('botRequests').textContent = formatNumber(metrics.botRequests);
  document.getElementById('cacheHitRate').textContent = metrics.cacheHitRate + '%';
  document.getElementById('ssrRendered').textContent = formatNumber(metrics.ssrRendered);
  document.getElementById('proxiedDirect').textContent = formatNumber(metrics.proxiedDirect);
  document.getElementById('errors').textContent = formatNumber(metrics.errors);

  // Calculate bot percentage
  const botPercent = metrics.totalRequests > 0
    ? ((metrics.botRequests / metrics.totalRequests) * 100).toFixed(1)
    : 0;
  document.getElementById('botPercent').textContent = botPercent + '%';

  // Update cache details
  document.getElementById('cacheHits').textContent = formatNumber(metrics.cacheHits);
  document.getElementById('cacheMisses').textContent = formatNumber(metrics.cacheMisses);

  // Update bot statistics
  updateBotStats(bots);

  // Update cache stats
  document.getElementById('cachedPages').textContent = cache.keys || 0;
  const cacheSize = cache.vsize ? (cache.vsize / 1024).toFixed(2) : 0;
  document.getElementById('cacheSize').textContent = cacheSize + ' KB';
}

/**
 * Update bot statistics chart
 */
function updateBotStats(bots) {
  const container = document.getElementById('botStats');
  const total = Object.values(bots).reduce((sum, count) => sum + count, 0);

  if (total === 0) {
    container.innerHTML = '<div class="empty-state">No bot traffic yet</div>';
    return;
  }

  const html = Object.entries(bots)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => {
      const percent = ((count / total) * 100).toFixed(1);
      return `
        <div class="bot-stat-item">
          <div class="bot-stat-header">
            <span class="bot-name">${name}</span>
            <span class="bot-count">${count} (${percent}%)</span>
          </div>
          <div class="bot-stat-bar">
            <div class="bot-stat-fill" style="width: ${percent}%"></div>
          </div>
        </div>
      `;
    })
    .join('');

  container.innerHTML = html;
}

/**
 * Load recent traffic
 */
async function loadTraffic() {
  try {
    const response = await fetch(`${API_BASE}/traffic?limit=50`);
    const result = await response.json();

    if (result.success) {
      updateTrafficTable(result.data);
    }
  } catch (error) {
    console.error('Error loading traffic:', error);
  }
}

/**
 * Update traffic table
 */
function updateTrafficTable(traffic) {
  const tbody = document.getElementById('trafficBody');

  if (traffic.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No traffic yet</td></tr>';
    return;
  }

  const html = traffic.map(entry => {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const typeClass = entry.isBot ? 'bot' : 'human';
    const typeBadge = entry.isBot ? '🤖 Bot' : '👤 Human';
    const cacheStatus = entry.cacheStatus || '-';

    return `
      <tr>
        <td>${time}</td>
        <td class="path-cell" title="${entry.path}">${truncate(entry.path, 40)}</td>
        <td><span class="badge ${typeClass}">${typeBadge}</span></td>
        <td><span class="badge action">${entry.action}</span></td>
        <td><span class="badge cache-${cacheStatus.toLowerCase()}">${cacheStatus}</span></td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = html;
}

/**
 * Load cache list
 */
async function loadCache() {
  try {
    const response = await fetch(`${API_BASE}/cache`);
    const result = await response.json();

    if (result.success) {
      updateCacheTable(result.data);
    }
  } catch (error) {
    console.error('Error loading cache:', error);
  }
}

/**
 * Update cache table
 */
function updateCacheTable(cacheData) {
  const tbody = document.getElementById('cacheBody');

  if (cacheData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Cache is empty</td></tr>';
    return;
  }

  const html = cacheData.map(entry => {
    const size = (entry.size / 1024).toFixed(2);
    return `
      <tr>
        <td class="path-cell" title="${entry.url}">${truncate(entry.url, 50)}</td>
        <td>${size} KB</td>
        <td>${entry.ttl}s</td>
        <td>
          <button class="btn btn-sm btn-danger" onclick="clearCacheEntry('${escapeHtml(entry.url)}')">
            Clear
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = html;
}

/**
 * Load top URLs
 */
async function loadTopUrls() {
  try {
    const response = await fetch(`${API_BASE}/urls?limit=20`);
    const result = await response.json();

    if (result.success) {
      updateUrlTable(result.data);
    }
  } catch (error) {
    console.error('Error loading URLs:', error);
  }
}

/**
 * Update URL table
 */
function updateUrlTable(urls) {
  const tbody = document.getElementById('urlBody');

  if (urls.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No URL data yet</td></tr>';
    return;
  }

  const html = urls.map(entry => {
    return `
      <tr>
        <td class="path-cell" title="${entry.path}">${truncate(entry.path, 50)}</td>
        <td>${entry.count}</td>
        <td>${entry.cacheHits} / ${entry.cacheMisses}</td>
        <td>${entry.hitRate}%</td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = html;
}

/**
 * Load configuration
 */
async function loadConfig() {
  try {
    const response = await fetch(`${API_BASE}/config`);
    const result = await response.json();

    if (result.success) {
      populateConfigForm(result.data);
    }
  } catch (error) {
    console.error('Error loading config:', error);
  }
}

/**
 * Populate configuration form
 */
function populateConfigForm(config) {
  // Cache rules
  document.getElementById('noCachePatterns').value = config.cacheRules.noCachePatterns.join(',');
  document.getElementById('cachePatterns').value = config.cacheRules.cachePatterns.join(',');
  document.getElementById('cacheByDefault').checked = config.cacheRules.cacheByDefault;
  document.getElementById('cacheTTL').value = config.cacheTTL;

  // Bot rules
  document.getElementById('renderAllBots').checked = config.botRules.renderAllBots;
  document.getElementById('allowedBots').value = config.botRules.allowedBots.join(',');
  document.getElementById('blockedBots').value = config.botRules.blockedBots.join(',');

  // Admin settings
  document.getElementById('adminPath').value = config.adminPath;
  document.getElementById('adminAuthEnabled').checked = config.adminAuth.enabled;
}

/**
 * Save configuration
 */
async function saveConfig() {
  const config = {
    adminPath: document.getElementById('adminPath').value,
    adminAuth: {
      enabled: document.getElementById('adminAuthEnabled').checked,
    },
    cacheRules: {
      noCachePatterns: document.getElementById('noCachePatterns').value
        .split(',')
        .map(p => p.trim())
        .filter(p => p),
      cachePatterns: document.getElementById('cachePatterns').value
        .split(',')
        .map(p => p.trim())
        .filter(p => p),
      cacheByDefault: document.getElementById('cacheByDefault').checked,
    },
    botRules: {
      renderAllBots: document.getElementById('renderAllBots').checked,
      allowedBots: document.getElementById('allowedBots').value
        .split(',')
        .map(b => b.trim())
        .filter(b => b),
      blockedBots: document.getElementById('blockedBots').value
        .split(',')
        .map(b => b.trim())
        .filter(b => b),
    },
    cacheTTL: parseInt(document.getElementById('cacheTTL').value),
  };

  try {
    const response = await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });

    const result = await response.json();

    if (result.success) {
      showNotification('Configuration saved successfully!', 'success');

      // Reload page if admin path changed
      if (config.adminPath !== window.location.pathname.replace(/\/$/, '')) {
        setTimeout(() => {
          window.location.href = config.adminPath;
        }, 1500);
      }
    } else {
      showNotification('Error saving configuration: ' + result.error, 'error');
    }
  } catch (error) {
    showNotification('Error saving configuration: ' + error.message, 'error');
  }
}

/**
 * Clear all cache
 */
async function clearAllCache() {
  if (!confirm('Are you sure you want to clear ALL cache?')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/cache/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await response.json();

    if (result.success) {
      showNotification('Cache cleared successfully!', 'success');
      loadCache();
      loadStats();
    } else {
      showNotification('Error clearing cache', 'error');
    }
  } catch (error) {
    showNotification('Error clearing cache: ' + error.message, 'error');
  }
}

/**
 * Clear specific cache entry
 */
async function clearCacheEntry(url) {
  try {
    const response = await fetch(`${API_BASE}/cache/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    const result = await response.json();

    if (result.success) {
      showNotification('Cache entry cleared', 'success');
      loadCache();
      loadStats();
    } else {
      showNotification('Error clearing cache entry', 'error');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

/**
 * Refresh traffic manually
 */
function refreshTraffic() {
  loadTraffic();
  showNotification('Traffic refreshed', 'info');
}

/**
 * Set up Server-Sent Events for real-time updates
 */
function setupSSE() {
  if (sseConnection) {
    sseConnection.close();
  }

  try {
    sseConnection = new EventSource(`${API_BASE}/stream`);

    sseConnection.onmessage = (event) => {
      const data = JSON.parse(event.data);
      updateStatsUI(data);
    };

    sseConnection.onerror = () => {
      console.log('SSE connection lost, will retry...');
      sseConnection.close();
      // Retry after 5 seconds
      setTimeout(setupSSE, 5000);
    };
  } catch (error) {
    console.error('SSE not supported, using polling');
  }
}

/**
 * Utility: Format uptime
 */
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/**
 * Utility: Format number with commas
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Utility: Truncate string
 */
function truncate(str, length) {
  if (str.length <= length) return str;
  return str.substring(0, length) + '...';
}

/**
 * Utility: Escape HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Show notification
 */
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;

  document.body.appendChild(notification);

  // Auto-remove after 3 seconds
  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (statsInterval) clearInterval(statsInterval);
  if (sseConnection) sseConnection.close();
});
