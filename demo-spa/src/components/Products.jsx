import React, { useState } from "react"
import { Helmet } from "react-helmet-async"

const Products = () => {
  const [selectedCategory, setSelectedCategory] = useState("all")
  
  const products = [
    {
      id: 1,
      name: "SEO Shield Basic",
      category: "basic",
      price: "$29/month",
      description: "Perfect for small websites and personal projects",
      features: ["Server-Side Rendering", "Basic SEO Optimization", "10,000 requests/month"]
    },
    {
      id: 2,
      name: "SEO Shield Professional",
      category: "professional", 
      price: "$99/month",
      description: "Ideal for growing businesses and high-traffic sites",
      features: ["Advanced Caching", "Custom Bot Rules", "100,000 requests/month", "Priority Support"]
    },
    {
      id: 3,
      name: "SEO Shield Enterprise",
      category: "enterprise",
      price: "Custom Pricing",
      description: "Complete solution for large-scale applications",
      features: ["Unlimited Requests", "Custom Integrations", "Dedicated Support", "Advanced Analytics"]
    },
    {
      id: 4,
      name: "SEO Shield E-commerce",
      category: "ecommerce",
      price: "$149/month", 
      description: "Specialized for online stores and product catalogs",
      features: ["Product Page Optimization", "Price Monitoring", "Inventory Sync", "Rich Snippets"]
    }
  ]

  const filteredProducts = selectedCategory === "all" 
    ? products 
    : products.filter(p => p.category === selectedCategory)

  return (
    <>
      <Helmet>
        <title>SEO Shield Products - Pricing Plans</title>
        <meta name="description" content="Explore SEO Shield Proxy pricing plans - from Basic to Enterprise solutions for SPA SEO optimization" />
        <meta name="keywords" content="products, pricing, plans, SEO Shield, proxy, server-side rendering" />
        <link rel="canonical" href="http://localhost:3000/products" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "SEO Shield Proxy",
            "description": "Server-side rendering and SEO optimization for SPAs",
            "offers": filteredProducts.map(product => ({
              "@type": "Offer",
              "name": product.name,
              "price": product.price,
              "description": product.description
            }))
          })}
        </script>
      </Helmet>

      <div className="content-section">
        <h1>SEO Shield Products</h1>
        <p>Choose the perfect plan for your needs</p>

        <div style={{margin: "2rem 0"}}>
          <button 
            onClick={() => setSelectedCategory("all")}
            className={`btn ${selectedCategory === "all" ? "" : "btn-secondary"}`}
          >
            All Products
          </button>
          <button 
            onClick={() => setSelectedCategory("basic")}
            className={`btn ${selectedCategory === "basic" ? "" : "btn-secondary"}`}
          >
            Basic
          </button>
          <button 
            onClick={() => setSelectedCategory("professional")}
            className={`btn ${selectedCategory === "professional" ? "" : "btn-secondary"}`}
          >
            Professional
          </button>
          <button 
            onClick={() => setSelectedCategory("enterprise")}
            className={`btn ${selectedCategory === "enterprise" ? "" : "btn-secondary"}`}
          >
            Enterprise
          </button>
          <button 
            onClick={() => setSelectedCategory("ecommerce")}
            className={`btn ${selectedCategory === "ecommerce" ? "" : "btn-secondary"}`}
          >
            E-commerce
          </button>
        </div>

        <div className="product-grid">
          {filteredProducts.map(product => (
            <div key={product.id} className="product-card">
              <h3>{product.name}</h3>
              <p>{product.description}</p>
              <div className="price">{product.price}</div>
              <ul style={{textAlign: "left", margin: "1rem 0"}}>
                {product.features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
              <button className="btn">Get Started</button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default Products
