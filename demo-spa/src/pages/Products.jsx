import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

const products = [
  { id: 1, name: 'SEO Shield Pro', price: '$99/mo', category: 'Enterprise' },
  { id: 2, name: 'SEO Shield Starter', price: '$29/mo', category: 'Starter' },
  { id: 3, name: 'SEO Shield Ultimate', price: '$199/mo', category: 'Enterprise' },
  { id: 4, name: 'SEO Shield Free', price: 'Free', category: 'Free' },
];

export default function Products() {
  return (
    <>
      <Helmet>
        <title>Products - SEO Demo SPA</title>
        <meta name="description" content="Browse our SEO Shield Proxy products and pricing plans" />
        <meta property="og:title" content="Products - SEO Demo SPA" />
      </Helmet>

      <div className="page-container">
        <h1>🛍️ Products</h1>
        <p className="page-subtitle">Choose the perfect plan for your needs</p>

        <div className="products-grid">
          {products.map((product) => (
            <Link to={`/products/${product.id}`} key={product.id} className="product-card">
              <div className="product-category">{product.category}</div>
              <h2>{product.name}</h2>
              <div className="product-price">{product.price}</div>
              <button className="product-btn">View Details →</button>
            </Link>
          ))}
        </div>

        <div className="info-box">
          <p>💡 <strong>Note:</strong> Product pages are cached for optimal performance.</p>
        </div>
      </div>
    </>
  );
}
