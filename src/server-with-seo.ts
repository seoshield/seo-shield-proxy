import express from 'express';
import { initializeSEOProtocols, seoOptimizationMiddleware, etagMiddleware, seoStatusEndpoint, seoConfigEndpoint } from './admin/seo-integration';

/**
 * Example server integration with advanced SEO protocols
 *
 * This file demonstrates how to integrate all SEO optimization protocols
 * with your existing server infrastructure.
 */

async function createServer() {
  const app = express();
  const PORT = process.env.PORT || 8080;

  // Initialize SEO protocols service
  console.log('🚀 Initializing SEO Protocols...');
  await initializeSEOProtocols();

  // Basic Express middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // SEO Protocol Middlewares (order matters!)

  // 1. ETag middleware for browser caching
  app.use(etagMiddleware());

  // 2. SEO optimization middleware (applies all protocols)
  app.use(seoOptimizationMiddleware());

  // 3. Your existing middleware and routes
  app.use((req, res, next) => {
    // Your existing logic here...
    console.log(`${req.method} ${req.url} - Bot: ${req.isBot ? 'Yes' : 'No'}`);
    next();
  });

  // SEO Protocol Management Endpoints

  // Status endpoint - GET /api/seo/status
  app.get('/api/seo/status', seoStatusEndpoint());

  // Configuration endpoints - GET/POST /api/seo/config
  const configEndpoints = seoConfigEndpoint();
  app.get('/api/seo/config', configEndpoints.get);
  app.post('/api/seo/config', configEndpoints.post);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0-seo-enhanced'
    });
  });

  // Example route that demonstrates SEO optimization
  app.get('/test-seo', (req, res) => {
    if (req.isBot) {
      // This will be processed by SEO protocols
      res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="description" content="Test page for SEO optimization">
          <title>SEO Test Page - Your Proxy</title>
        </head>
        <body>
          <h1>SEO Optimization Test</h1>
          <p>This page demonstrates the advanced SEO protocols in action:</p>
          <ul>
            <li>✅ Content Health Check</li>
            <li>✅ Virtual Scroll & Lazy Load</li>
            <li>✅ ETag & 304 Strategy</li>
            <li>✅ Shadow DOM Extraction</li>
            <li>✅ Circuit Breaker Protection</li>
          </ul>
          <div style="height: 2000px; background: linear-gradient(to bottom, #f0f0f0, #e0e0e0);">
            <p>Scroll content for virtual scroll testing...</p>
          </div>
          <img data-src="https://example.com/image.jpg" alt="Lazy loaded image" />
        </body>
        </html>
      `);
    } else {
      // Regular users get simple response
      res.json({ message: 'This endpoint is optimized for search engine bots' });
    }
  });

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`🌐 Server running on port ${PORT}`);
    console.log(`📊 SEO Status: http://localhost:${PORT}/api/seo/status`);
    console.log(`🔧 SEO Config: http://localhost:${PORT}/api/seo/config`);
    console.log(`🧪 SEO Test: http://localhost:${PORT}/test-seo`);
    console.log(`💚 Health: http://localhost:${PORT}/health`);
  });

  return app;
}

// Start the server
if (require.main === module) {
  createServer().catch(console.error);
}

export { createServer };