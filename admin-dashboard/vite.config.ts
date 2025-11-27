import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3001,
    cors: true,
    allowedHosts: ['admin-dashboard', 'seo-proxy', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: 'http://localhost:3190',
        changeOrigin: true,
        pathRewrite: {
          '^/api': '/shieldapi',
        },
      },
      '/socket.io': {
        target: 'http://localhost:3190',
        ws: true,
      },
    },
  },
  preview: {
    port: 3001,
    host: '0.0.0.0',
    allowedHosts: ['demo-spa', 'localhost', '127.0.0.1'],
    proxy: {
      '/api': {
        target: 'http://localhost:3190',
        changeOrigin: true,
        pathRewrite: {
          '^/api': '/shieldapi',
        },
      },
      '/socket.io': {
        target: 'http://localhost:3190',
        ws: true,
      },
    },
  },
  build: {
    outDir: '../public/admin',
    emptyOutDir: true,
  },
});