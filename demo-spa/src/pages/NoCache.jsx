import { Helmet } from 'react-helmet-async';
import { useState, useEffect } from 'react';

export default function NoCache() {
  const [timestamp, setTimestamp] = useState(null);

  useEffect(() => {
    setTimestamp(new Date().toISOString());
  }, []);

  return (
    <>
      <Helmet>
        <title>No Cache Example - SEO Demo SPA</title>
        <meta name="description" content="This page demonstrates cache control using meta tags" />
        {/* This meta tag tells SEO Shield NOT to cache this page */}
        <meta name="x-seo-shield-cache" content="false" />
      </Helmet>

      <div className="page-container">
        <h1>🚫 No Cache Page</h1>
        <p className="page-subtitle">This page will NOT be cached</p>

        <div className="alert alert-warning">
          <strong>⚠️ Cache Control Active</strong>
          <p>This page includes the meta tag:</p>
          <code>&lt;meta name="x-seo-shield-cache" content="false" /&gt;</code>
          <p>Even if a bot requests this page, it will not be cached by the proxy.</p>
        </div>

        <div className="content-section">
          <h2>Use Cases for No-Cache Pages</h2>
          <ul className="feature-list">
            <li>🔐 User dashboards with personalized content</li>
            <li>🛒 Shopping cart and checkout pages</li>
            <li>📊 Real-time data displays</li>
            <li>👤 User profile pages</li>
            <li>🎯 A/B testing scenarios</li>
            <li>💳 Payment and sensitive forms</li>
          </ul>
        </div>

        <div className="dynamic-content">
          <h2>Dynamic Content</h2>
          <div className="timestamp-display">
            <p><strong>Page Generated At:</strong></p>
            <code>{timestamp || 'Loading...'}</code>
          </div>
          <p>This timestamp changes on every visit because the page is not cached.</p>
        </div>

        <div className="content-section">
          <h2>How It Works</h2>
          <ol className="feature-list">
            <li>Bot requests this page</li>
            <li>SEO Shield renders it with Puppeteer</li>
            <li>Meta tag is detected: <code>x-seo-shield-cache="false"</code></li>
            <li>Page is NOT stored in cache</li>
            <li>Next bot request will render again (fresh content)</li>
          </ol>
        </div>

        <div className="info-box">
          <p>💡 <strong>Tip:</strong> Use this feature for pages with user-specific or real-time data.</p>
        </div>
      </div>
    </>
  );
}
