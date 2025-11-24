import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import type { UseWebSocketReturn, StatsData, TrafficData } from '../types';

export function useWebSocket(): UseWebSocketReturn {
  const [socket, setSocket] = useState<any>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [traffic, setTraffic] = useState<TrafficData[]>([]);

  useEffect(() => {
    // Connect to Socket.io server (API server on port 8190)
    const newSocket = io('http://localhost:8190', {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to server');
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setIsConnected(false);
    });

    newSocket.on('stats', (data: StatsData) => {
      setStats(data);
    });

    newSocket.on('traffic', (data: TrafficData) => {
      setTraffic((prev) => [...prev.slice(-59), data].slice(-60)); // Keep last 60 data points
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return { socket, isConnected, stats, traffic };
}