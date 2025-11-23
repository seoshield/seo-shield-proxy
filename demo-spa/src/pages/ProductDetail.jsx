import { Helmet } from 'react-helmet-async';
import { useParams, Link } from 'react-router-dom';

const productDetails = {
  1: {
    name: 'SEO Shield Pro',
    price: '$99/mo',
    description: 'Perfect for growing businesses that need reliable SEO optimization.',
    features: [
      '✅ Unlimited page renders',
      '✅ Advanced caching strategies',
      '✅ Real-time monitoring dashboard',
      '✅ Priority support',
      '✅ Custom cache rules',
      '✅ 99.9% uptime SLA',
    ],
  },
  2: {
    name: 'SEO Shield Starter',
    price: '$29/mo',
    description: 'Great for small projects and personal websites.',
    features: [
      '✅ 10,000 renders/month',
      '✅ Basic caching',
      '✅ Standard monitoring',
      '✅ Email support',
      '✅ Basic cache rules',
    ],
  },
  3: {
    name: 'SEO Shield Ultimate',
    price: '$199/mo',
    description: 'Enterprise-grade solution for high-traffic applications.',
    features: [
      '✅ Unlimited everything',
      '✅ Multi-region deployment',
      '✅ Advanced analytics',
      '✅ 24/7 dedicated support',
      '✅ Custom integration',
      '✅ 99.99% uptime SLA',
      '✅ White-label option',
    ],
  },
  4: {
    name: 'SEO Shield Free',
    price: 'Free',
    description: 'Try SEO Shield with our free tier.',
    features: [
      '✅ 1,000 renders/month',
      '✅ Basic features',
      '✅ Community support',
      '✅ Standard cache rules',
    ],
  },
};

export default function ProductDetail() {
  const { id } = useParams();
  const product = productDetails[id];

  if (!product) {
    return (
      <div className="page-container">
        <h1>Product Not Found</h1>
        <Link to="/products">← Back to Products</Link>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{product.name} - SEO Demo SPA</title>
        <meta name="description" content={product.description} />
        <meta property="og:title" content={product.name} />
        <meta property="og:type" content="product" />
      </Helmet>

      <div className="page-container">
        <Link to="/products" className="back-link">← Back to Products</Link>

        <div className="product-detail">
          <div className="product-header">
            <h1>{product.name}</h1>
            <div className="product-price-large">{product.price}</div>
          </div>

          <p className="product-description">{product.description}</p>

          <div className="product-features">
            <h2>Features</h2>
            <ul>
              {product.features.map((feature, i) => (
                <li key={i}>{feature}</li>
              ))}
            </ul>
          </div>

          <button className="cta-button">Get Started</button>
        </div>
      </div>
    </>
  );
}
