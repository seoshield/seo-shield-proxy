import { Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import About from './pages/About';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import NoCache from './pages/NoCache';
import Contact from './pages/Contact';
import NotFound from './pages/NotFound';

function App() {
  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-container">
          <Link to="/" className="logo">
            🛡️ SEO Demo SPA
          </Link>
          <div className="nav-links">
            <Link to="/">Home</Link>
            <Link to="/about">About</Link>
            <Link to="/blog">Blog</Link>
            <Link to="/products">Products</Link>
            <Link to="/no-cache">No Cache</Link>
            <Link to="/contact">Contact</Link>
          </div>
        </div>
      </nav>

      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/products" element={<Products />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/no-cache" element={<NoCache />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <footer className="footer">
        <p>© 2024 SEO Demo SPA - Testing SEO Shield Proxy</p>
        <p className="footer-note">
          🤖 Bots get SSR | 👤 Humans get direct SPA
        </p>
      </footer>
    </div>
  );
}

export default App;
