import React from "react"
import { Link } from "react-router-dom"
import { Helmet } from "react-helmet-async"

const Home = () => {
  return (
    <>
      <Helmet>
        <title>SEO Shield Proxy Demo - Home</title>
        <meta name="description" content="Welcome to SEO Shield Proxy Demo - Test server-side rendering and SEO optimization for Single Page Applications" />
        <meta name="keywords" content="home, SEO, SPA, server-side rendering" />
        <link rel="canonical" href="http://localhost:3000/" />
      </Helmet>
      
      <div className="hero">
        <h1>SEO Shield Proxy Demo</h1>
        <p>Test server-side rendering and SEO optimization for Single Page Applications</p>
        <Link to="/products" className="btn">View Products</Link>
        <Link to="/about" className="btn btn-secondary">Learn More</Link>
      </div>

      <div className="features">
        <div className="feature-card">
          <h3>🚀 Server-Side Rendering</h3>
          <p>Experience lightning-fast page loads with server-side rendering capabilities.</p>
        </div>
        <div className="feature-card">
          <h3>🔍 SEO Optimization</h3>
          <p>Perfect meta tags, structured data, and SEO-friendly URLs for better search rankings.</p>
        </div>
        <div className="feature-card">
          <h3>📱 Responsive Design</h3>
          <p>Works seamlessly across all devices with mobile-first responsive design.</p>
        </div>
        <div className="feature-card">
          <h3>⚡ Performance</h3>
          <p>Optimized loading times and caching strategies for the best user experience.</p>
        </div>
      </div>

      <div className="content-section">
        <h2>Why Choose SEO Shield Proxy?</h2>
        <p>
          SEO Shield Proxy transforms your Single Page Applications into SEO-optimized, 
          server-rendered websites without changing your existing codebase. 
          Perfect for React, Vue, Angular, and other modern JavaScript frameworks.
        </p>
        <p>
          This demo application showcases the power of server-side rendering combined with 
          advanced SEO optimization techniques. Navigate through different pages to see 
          how meta tags, titles, and structured data are dynamically generated.
        </p>
      </div>
    </>
  )
}

export default Home
