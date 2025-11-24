import React from "react"
import { Link } from "react-router-dom"
import { Helmet } from "react-helmet-async"

const Navigation = () => {
  return (
    <>
      <Helmet>
        <meta name="nav-type" content="main-navigation" />
      </Helmet>
      <nav>
        <ul>
          <li><Link to="/" className="nav-link">Home</Link></li>
          <li><Link to="/about" className="nav-link">About</Link></li>
          <li><Link to="/products" className="nav-link">Products</Link></li>
          <li><Link to="/contact" className="nav-link">Contact</Link></li>
        </ul>
      </nav>
    </>
  )
}

export default Navigation
