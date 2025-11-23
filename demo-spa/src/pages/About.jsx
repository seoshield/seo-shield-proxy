import { Helmet } from 'react-helmet-async';

export default function About() {
  return (
    <>
      <Helmet>
        <title>About Us - SEO Demo SPA</title>
        <meta name="description" content="Learn about SEO Shield Proxy - A production-ready reverse proxy for Single Page Applications" />
        <meta property="og:title" content="About Us - SEO Demo SPA" />
      </Helmet>

      <div className="page-container">
        <h1>About SEO Shield Proxy</h1>

        <div className="content-section">
          <h2>What is SEO Shield Proxy?</h2>
          <p>
            SEO Shield Proxy is a production-ready Node.js reverse proxy that solves SEO problems
            for Single Page Applications (SPAs) without modifying client-side code.
          </p>
        </div>

        <div className="content-section">
          <h2>Key Features</h2>
          <ul className="feature-list">
            <li>✅ Automatic bot detection using isbot library</li>
            <li>✅ Server-side rendering with Puppeteer for bots</li>
            <li>✅ Transparent proxying for human users</li>
            <li>✅ Smart caching with configurable TTL</li>
            <li>✅ Pattern-based cache rules</li>
            <li>✅ Meta tag cache control</li>
            <li>✅ Real-time admin dashboard</li>
            <li>✅ WebSocket monitoring</li>
            <li>✅ Production-grade error handling</li>
            <li>✅ Docker support</li>
          </ul>
        </div>

        <div className="content-section">
          <h2>How It Works</h2>
          <div className="workflow">
            <div className="workflow-step">
              <span className="step-number">1</span>
              <div className="step-content">
                <h3>Request Arrives</h3>
                <p>Proxy receives HTTP request</p>
              </div>
            </div>
            <div className="workflow-arrow">→</div>
            <div className="workflow-step">
              <span className="step-number">2</span>
              <div className="step-content">
                <h3>Bot Detection</h3>
                <p>User agent is analyzed</p>
              </div>
            </div>
            <div className="workflow-arrow">→</div>
            <div className="workflow-step">
              <span className="step-number">3</span>
              <div className="step-content">
                <h3>Route Decision</h3>
                <p>Bot → SSR, Human → Proxy</p>
              </div>
            </div>
            <div className="workflow-arrow">→</div>
            <div className="workflow-step">
              <span className="step-number">4</span>
              <div className="step-content">
                <h3>Response</h3>
                <p>Optimized content served</p>
              </div>
            </div>
          </div>
        </div>

        <div className="content-section">
          <h2>Technology Stack</h2>
          <div className="tech-grid">
            <div className="tech-item">
              <strong>Backend:</strong> Node.js + Express
            </div>
            <div className="tech-item">
              <strong>Rendering:</strong> Puppeteer
            </div>
            <div className="tech-item">
              <strong>Caching:</strong> node-cache
            </div>
            <div className="tech-item">
              <strong>Bot Detection:</strong> isbot
            </div>
            <div className="tech-item">
              <strong>Proxy:</strong> http-proxy-middleware
            </div>
            <div className="tech-item">
              <strong>Real-time:</strong> Socket.io
            </div>
            <div className="tech-item">
              <strong>Admin UI:</strong> React + Recharts
            </div>
            <div className="tech-item">
              <strong>Container:</strong> Docker
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
