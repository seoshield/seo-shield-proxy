import React from "react"
import { Routes, Route } from "react-router-dom"
import { Helmet } from "react-helmet-async"
import Home from "./components/Home"
import About from "./components/About"
import Products from "./components/Products"
import Contact from "./components/Contact"
import Navigation from "./components/Navigation"
import "./App.css"

function App() {
  return (
    <div className="App">
      <Helmet>
        <title>SEO Shield Proxy Demo - SPA</title>
        <meta name="description" content="Test SEO optimization with our Single Page Application demo" />
        <meta name="keywords" content="SEO, SPA, React, Proxy, Shield" />
        <meta property="og:title" content="SEO Shield Proxy Demo" />
        <meta property="og:description" content="Test SEO optimization capabilities" />
        <meta property="og:type" content="website" />
      </Helmet>
      
      <Navigation />
      
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/products" element={<Products />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </main>
      
      <footer className="footer">
        <p>&copy; 2025 SEO Shield Proxy Demo. Built for testing SEO optimization.</p>
      </footer>
    </div>
  )
}

export default App
