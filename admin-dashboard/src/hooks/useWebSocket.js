import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

export function useWebSocket() {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState(null);
  const [traffic, setTraffic] = useState([]);

  useEffect(() => {
    // Connect to Socket.io server
    const newSocket = io('http://localhost:8080', {
      path: '/admin/socket.io',
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

    newSocket.on('stats', (data) => {
      setStats(data);
    });

    newSocket.on('traffic', (data) => {
      setTraffic((prev) => [...prev.slice(-59), data].slice(-60)); // Keep last 60 data points
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return { socket, isConnected, stats, traffic };
}
