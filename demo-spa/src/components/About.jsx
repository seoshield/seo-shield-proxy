import React from "react"
import { Helmet } from "react-helmet-async"

const About = () => {
  return (
    <>
      <Helmet>
        <title>About SEO Shield Proxy - Our Mission</title>
        <meta name="description" content="Learn about SEO Shield Proxy - The ultimate solution for server-side rendering and SEO optimization of Single Page Applications" />
        <meta name="keywords" content="about, SEO Shield Proxy, mission, server-side rendering, SEO" />
        <link rel="canonical" href="http://localhost:3000/about" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "AboutPage",
            "name": "About SEO Shield Proxy",
            "description": "Learn about our mission to make SPA applications SEO-friendly",
            "url": "http://localhost:3000/about"
          })}
        </script>
      </Helmet>
      
      <div className="content-section">
        <h1>About SEO Shield Proxy</h1>
        
        <div className="content-section">
          <h2>Our Mission</h2>
          <p>
            SEO Shield Proxy is dedicated to solving one of the biggest challenges in modern web development: 
            making Single Page Applications (SPAs) SEO-friendly without sacrificing the user experience 
            that makes SPAs so popular.
          </p>
        </div>

        <div className="content-section">
          <h2>What We Do</h2>
          <p>
            Our proxy solution sits between your users and your SPA application, providing:
          </p>
          <ul style={{textAlign: "left", maxWidth: "800px", margin: "0 auto"}}>
            <li><strong>Server-Side Rendering:</strong> Generate HTML on the server for faster page loads</li>
            <li><strong>SEO Optimization:</strong> Automatic meta tag generation and structured data</li>
            <li><strong>Caching:</strong> Intelligent caching strategies for optimal performance</li>
            <li><strong>Bot Detection:</strong> Special handling for search engine crawlers</li>
            <li><strong>Analytics:</strong> Detailed metrics and monitoring capabilities</li>
          </ul>
        </div>

        <div className="content-section">
          <h2>Technology Stack</h2>
          <p>
            Built with modern technologies to ensure reliability and performance:
          </p>
          <ul style={{textAlign: "left", maxWidth: "800px", margin: "0 auto"}}>
            <li>Node.js & Express for high-performance server</li>
            <li>Puppeteer for server-side rendering</li>
            <li>Redis for intelligent caching</li>
            <li>TypeScript for type safety and maintainability</li>
            <li>Comprehensive admin dashboard for monitoring</li>
          </ul>
        </div>

        <div className="content-section">
          <h2>Get Started</h2>
          <p>
            Ready to transform your SPA into an SEO-optimized application? 
            Check out our products to see how you can integrate SEO Shield Proxy into your workflow.
          </p>
        </div>
      </div>
    </>
  )
}

export default About
