/**
 * SSR Events Store
 * In-memory storage for SSR render events
 * Used for real-time monitoring and admin dashboard
 */

interface HealthCheckIssue {
  type: 'error' | 'warning' | string;
  selector?: string;
  message: string;
}

export interface SSREvent {
  id: string;
  event: 'render_start' | 'render_complete' | 'render_error' | 'health_check';
  url: string;
  timestamp: number;
  duration?: number;
  success?: boolean;
  htmlLength?: number;
  statusCode?: number;
  error?: string;
  queueSize?: number;
  processing?: number;
  renderId?: string;
  // Health check specific
  score?: number;
  passed?: boolean;
  issues?: HealthCheckIssue[];
}

export interface SSRStats {
  totalRenders: number;
  successfulRenders: number;
  failedRenders: number;
  activeRenders: number;
  totalRenderTime: number;
  successRate: number;
  avgRenderTime: number;
  lastRenderTime: number;
}

class SSREventsStore {
  private events: SSREvent[] = [];
  private maxEvents: number = 1000;
  private stats = {
    totalRenders: 0,
    successfulRenders: 0,
    failedRenders: 0,
    activeRenders: 0,
    totalRenderTime: 0,
    lastRenderTime: 0,
  };

  /**
   * Add a new SSR event
   */
  addEvent(event: SSREvent): void {
    // Add to front of array (newest first)
    this.events.unshift(event);

    // Limit array size
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }

    // Update stats based on event type
    this.updateStats(event);
  }

  /**
   * Update statistics based on event
   */
  private updateStats(event: SSREvent): void {
    switch (event.event) {
      case 'render_start':
        this.stats.activeRenders++;
        break;

      case 'render_complete':
        this.stats.activeRenders = Math.max(0, this.stats.activeRenders - 1);
        this.stats.totalRenders++;
        this.stats.successfulRenders++;
        if (event.duration) {
          this.stats.totalRenderTime += event.duration;
          this.stats.lastRenderTime = event.duration;
        }
        break;

      case 'render_error':
        this.stats.activeRenders = Math.max(0, this.stats.activeRenders - 1);
        this.stats.totalRenders++;
        this.stats.failedRenders++;
        if (event.duration) {
          this.stats.lastRenderTime = event.duration;
        }
        break;
    }
  }

  /**
   * Get recent events
   */
  getRecentEvents(limit: number = 50): SSREvent[] {
    return this.events.slice(0, limit);
  }

  /**
   * Get events by type
   */
  getEventsByType(type: SSREvent['event'], limit: number = 50): SSREvent[] {
    return this.events.filter((e) => e.event === type).slice(0, limit);
  }

  /**
   * Get all events (for filtering)
   */
  getEvents(): SSREvent[] {
    return [...this.events];
  }

  /**
   * Get computed statistics
   */
  getStats(): SSRStats {
    const successRate =
      this.stats.totalRenders > 0
        ? (this.stats.successfulRenders / this.stats.totalRenders) * 100
        : 0;

    const avgRenderTime =
      this.stats.successfulRenders > 0
        ? Math.round(this.stats.totalRenderTime / this.stats.successfulRenders)
        : 0;

    return {
      ...this.stats,
      successRate: Math.round(successRate * 100) / 100,
      avgRenderTime,
    };
  }

  /**
   * Reset all stats and events
   */
  reset(): void {
    this.events = [];
    this.stats = {
      totalRenders: 0,
      successfulRenders: 0,
      failedRenders: 0,
      activeRenders: 0,
      totalRenderTime: 0,
      lastRenderTime: 0,
    };
  }

  /**
   * Get event count
   */
  getEventCount(): number {
    return this.events.length;
  }
}

// Singleton instance
export const ssrEventsStore = new SSREventsStore();
export default ssrEventsStore;
