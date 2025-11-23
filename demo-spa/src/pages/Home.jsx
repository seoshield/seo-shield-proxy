import { Helmet } from 'react-helmet-async';

export default function Home() {
  return (
    <>
      <Helmet>
        <title>Home - SEO Demo SPA</title>
        <meta name="description" content="Welcome to SEO Demo SPA - Testing SEO Shield Proxy with server-side rendering for bots" />
        <meta property="og:title" content="Home - SEO Demo SPA" />
        <meta property="og:description" content="Welcome to SEO Demo SPA" />
        <meta property="og:type" content="website" />
      </Helmet>

      <div className="page-container">
        <div className="hero">
          <h1>🛡️ Welcome to SEO Demo SPA</h1>
          <p className="hero-subtitle">Testing SEO Shield Proxy</p>
        </div>

        <div className="cards-grid">
          <div className="card">
            <div className="card-icon">🤖</div>
            <h2>Bot Detection</h2>
            <p>Search engine bots automatically get server-side rendered HTML for perfect SEO indexing.</p>
          </div>

          <div className="card">
            <div className="card-icon">👤</div>
            <h2>Human Users</h2>
            <p>Real users get the full SPA experience with no delay - direct proxy to the application.</p>
          </div>

          <div className="card">
            <div className="card-icon">💾</div>
            <h2>Smart Caching</h2>
            <p>Rendered pages are cached intelligently with configurable TTL and pattern-based rules.</p>
          </div>

          <div className="card">
            <div className="card-icon">📊</div>
            <h2>Real-time Monitoring</h2>
            <p>Watch live traffic, cache hits, and bot activity in the admin dashboard.</p>
          </div>
        </div>

        <div className="demo-section">
          <h2>Test Different Scenarios</h2>
          <div className="demo-links">
            <a href="/blog" className="demo-link">📝 Blog Posts (Cached)</a>
            <a href="/products" className="demo-link">🛍️ Products (Cached)</a>
            <a href="/no-cache" className="demo-link">🚫 No Cache Page</a>
            <a href="/about" className="demo-link">ℹ️ About (Static)</a>
          </div>
        </div>

        <div className="info-box">
          <h3>🧪 How to Test</h3>
          <div className="code-block">
            <p><strong>As a Bot (SSR):</strong></p>
            <code>curl -A "Googlebot" http://localhost:8080/</code>
          </div>
          <div className="code-block">
            <p><strong>As a Human (Proxy):</strong></p>
            <code>curl http://localhost:8080/</code>
          </div>
          <div className="code-block">
            <p><strong>Admin Dashboard:</strong></p>
            <code>http://localhost:8080/admin</code>
          </div>
        </div>
      </div>
    </>
  );
}
