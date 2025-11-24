import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface SSREvent {
  event: string;
  url: string;
  timestamp: number;
  duration?: number;
  success?: boolean;
  htmlLength?: number;
  userAgent?: string;
}

const SSRMonitor: React.FC = () => {
  const [activeRenders] = useState(0);
  const [recentEvents, setRecentEvents] = useState<SSREvent[]>([
    {
      event: 'render_complete',
      url: '/prompt/test-render',
      timestamp: Date.now() - 5000,
      duration: 2340,
      success: true,
      htmlLength: 15678,
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    }
  ]);

  // Simulate SSR events
  useEffect(() => {
    const interval = setInterval(() => {
      const mockEvents: SSREvent[] = [
        {
          event: 'render_complete',
          url: `/page/${Math.floor(Math.random() * 1000)}`,
          timestamp: Date.now(),
          duration: 1500 + Math.floor(Math.random() * 2000),
          success: Math.random() > 0.1,
          htmlLength: 10000 + Math.floor(Math.random() * 20000),
          userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
        },
        {
          event: 'render_start',
          url: `/product/${Math.floor(Math.random() * 500)}`,
          timestamp: Date.now(),
          userAgent: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'
        },
        {
          event: 'render_complete',
          url: `/category/${Math.floor(Math.random() * 100)}`,
          timestamp: Date.now(),
          duration: 2000 + Math.floor(Math.random() * 3000),
          success: true,
          htmlLength: 15000 + Math.floor(Math.random() * 25000),
          userAgent: 'Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)'
        }
      ];

      if (Math.random() > 0.7) {
        const newEvent = mockEvents[Math.floor(Math.random() * mockEvents.length)];
        setRecentEvents(prev => [newEvent, ...prev.slice(0, 19)]);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatDuration = (duration: number) => {
    if (duration < 1000) return `${duration}ms`;
    return `${(duration / 1000).toFixed(2)}s`;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getEventIcon = (event: string) => {
    switch (event) {
      case 'render_start':
        return '🚀';
      case 'render_complete':
        return '✅';
      case 'render_error':
        return '❌';
      default:
        return '📡';
    }
  };

  const getEventColor = (event: string) => {
    switch (event) {
      case 'render_start':
        return 'text-blue-600';
      case 'render_complete':
        return 'text-green-600';
      case 'render_error':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Renders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🔄</span>
            Active Renders ({activeRenders})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeRenders === 0 ? (
            <p className="text-gray-500 text-sm">No active SSR renders</p>
          ) : (
            <div className="space-y-2">
              {Array.from({length: activeRenders}).map((_, index) => (
                <div key={`render_${index}`} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin">🔄</div>
                    <span className="font-medium text-sm">Rendering...</span>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-gray-600">Processing SSR request...</div>
                    <div className="text-blue-600">Queue processing...</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* SSR Event Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>📊</span>
            SSR Event Log
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recentEvents.length === 0 ? (
              <p className="text-gray-500 text-sm">No SSR events yet</p>
            ) : (
              recentEvents.map((event, index) => (
                <div key={`event_${index}`} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg text-sm">
                  <div className={getEventColor(event.event)}>
                    {getEventIcon(event.event)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">
                      {event.event === 'render_start' && 'Render Started'}
                      {event.event === 'render_complete' && 'Render Completed'}
                      {event.event === 'render_error' && 'Render Failed'}
                    </div>
                    <div className="text-gray-600 truncate">{event.url}</div>
                    <div className="flex gap-4 mt-1 text-xs text-gray-500">
                      <span>{formatTime(event.timestamp)}</span>
                      {event.duration && (
                        <span>Duration: {formatDuration(event.duration)}</span>
                      )}
                      {event.htmlLength && (
                        <span>Size: {(event.htmlLength / 1024).toFixed(1)}KB</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SSRMonitor;