import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <>
      <Helmet>
        <title>404 - Page Not Found</title>
        <meta name="description" content="The page you're looking for doesn't exist" />
      </Helmet>

      <div className="page-container">
        <div className="not-found">
          <h1 className="error-code">404</h1>
          <h2>Page Not Found</h2>
          <p>The page you're looking for doesn't exist or has been moved.</p>
          <Link to="/" className="home-link">← Go Home</Link>
        </div>
      </div>
    </>
  );
}
