import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';

const blogPosts = [
  {
    slug: 'seo-for-spas',
    title: 'SEO Best Practices for Single Page Applications',
    excerpt: 'Learn how to optimize your SPA for search engines without compromising user experience.',
    date: '2024-01-15',
    author: 'SEO Expert',
    category: 'SEO',
  },
  {
    slug: 'server-side-rendering',
    title: 'Understanding Server-Side Rendering',
    excerpt: 'Deep dive into SSR, its benefits, and when you should use it for your application.',
    date: '2024-01-10',
    author: 'Tech Writer',
    category: 'Development',
  },
  {
    slug: 'bot-detection-techniques',
    title: 'Advanced Bot Detection Techniques',
    excerpt: 'Explore different methods to detect and handle bot traffic effectively.',
    date: '2024-01-05',
    author: 'Security Team',
    category: 'Security',
  },
  {
    slug: 'caching-strategies',
    title: 'Smart Caching Strategies for Web Apps',
    excerpt: 'Optimize your application performance with intelligent caching patterns.',
    date: '2023-12-28',
    author: 'Performance Engineer',
    category: 'Performance',
  },
];

export default function Blog() {
  return (
    <>
      <Helmet>
        <title>Blog - SEO Demo SPA</title>
        <meta name="description" content="Read our latest articles about SEO, performance, and web development" />
        <meta property="og:title" content="Blog - SEO Demo SPA" />
      </Helmet>

      <div className="page-container">
        <h1>📝 Blog</h1>
        <p className="page-subtitle">Latest articles and insights</p>

        <div className="blog-grid">
          {blogPosts.map((post) => (
            <Link to={`/blog/${post.slug}`} key={post.slug} className="blog-card">
              <div className="blog-category">{post.category}</div>
              <h2>{post.title}</h2>
              <p className="blog-excerpt">{post.excerpt}</p>
              <div className="blog-meta">
                <span className="blog-author">👤 {post.author}</span>
                <span className="blog-date">📅 {post.date}</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="info-box">
          <p>💡 <strong>Note:</strong> Blog posts are cached by default. Bots will receive pre-rendered HTML.</p>
        </div>
      </div>
    </>
  );
}
