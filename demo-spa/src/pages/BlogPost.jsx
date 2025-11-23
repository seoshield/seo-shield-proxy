import { Helmet } from 'react-helmet-async';
import { useParams, Link } from 'react-router-dom';

const posts = {
  'seo-for-spas': {
    title: 'SEO Best Practices for Single Page Applications',
    content: `
      Single Page Applications (SPAs) are fantastic for user experience, but they can be challenging for SEO.
      Here's why and how to fix it.

      ## The Problem

      Traditional SPAs load content dynamically with JavaScript, which means search engine crawlers might not
      see your content. This can severely impact your search rankings.

      ## The Solution

      1. **Server-Side Rendering (SSR)** - Render pages on the server for bots
      2. **Static Site Generation** - Pre-render pages at build time
      3. **Reverse Proxy with SSR** - Like SEO Shield Proxy!

      ## Why SEO Shield Proxy?

      - ✅ No code changes required
      - ✅ Bot detection is automatic
      - ✅ Smart caching reduces server load
      - ✅ Human users get full SPA experience
      - ✅ Production-ready and scalable

      ## Best Practices

      1. Use semantic HTML
      2. Add proper meta tags
      3. Implement structured data
      4. Optimize page load speed
      5. Ensure mobile responsiveness
    `,
    date: '2024-01-15',
    author: 'SEO Expert',
  },
  'server-side-rendering': {
    title: 'Understanding Server-Side Rendering',
    content: `
      Server-Side Rendering (SSR) is a technique where web pages are rendered on the server before being
      sent to the client.

      ## Benefits of SSR

      1. **Better SEO** - Search engines can easily crawl your content
      2. **Faster Initial Load** - Users see content quicker
      3. **Social Sharing** - Meta tags work properly for social media
      4. **Accessibility** - Works even with JavaScript disabled

      ## Challenges

      1. Server load increases
      2. More complex deployment
      3. Potential caching issues
      4. Higher hosting costs

      ## SEO Shield Proxy Approach

      Our proxy solves these challenges by:
      - Only rendering for bots (reduces load)
      - Intelligent caching (improves performance)
      - No app changes needed (easy deployment)
      - Pattern-based rules (flexible control)
    `,
    date: '2024-01-10',
    author: 'Tech Writer',
  },
  'bot-detection-techniques': {
    title: 'Advanced Bot Detection Techniques',
    content: `
      Detecting bots accurately is crucial for serving the right content and protecting your application.

      ## Common Detection Methods

      1. **User Agent Analysis** - Check the user agent string
      2. **IP Reputation** - Use known bot IP ranges
      3. **Behavioral Analysis** - Monitor request patterns
      4. **JavaScript Challenges** - Test client-side execution

      ## The isbot Library

      SEO Shield Proxy uses the isbot library which:
      - Maintains an up-to-date list of known bots
      - Uses pattern matching on user agents
      - Covers 1000+ different bots
      - Regular updates via npm

      ## Why Accurate Detection Matters

      - ✅ Serve optimized content to bots
      - ✅ Preserve SPA experience for humans
      - ✅ Reduce unnecessary rendering
      - ✅ Improve cache efficiency
    `,
    date: '2024-01-05',
    author: 'Security Team',
  },
  'caching-strategies': {
    title: 'Smart Caching Strategies for Web Apps',
    content: `
      Caching is one of the most effective ways to improve web application performance.

      ## Caching Layers

      1. **Browser Cache** - Client-side caching
      2. **CDN Cache** - Edge caching
      3. **Application Cache** - Server-side caching
      4. **Database Cache** - Query result caching

      ## SEO Shield Proxy Caching

      Our proxy implements intelligent caching:

      - **Pattern-based Rules** - Cache by URL patterns
      - **TTL Configuration** - Set expiration times
      - **Meta Tag Control** - Dynamic cache control
      - **LRU Eviction** - Automatic cleanup

      ## Cache Strategies

      1. Cache-aside (lazy loading)
      2. Write-through cache
      3. Write-back cache
      4. Refresh-ahead cache

      ## Best Practices

      - Set appropriate TTL values
      - Use cache invalidation
      - Monitor cache hit rates
      - Implement cache warming
    `,
    date: '2023-12-28',
    author: 'Performance Engineer',
  },
};

export default function BlogPost() {
  const { slug } = useParams();
  const post = posts[slug];

  if (!post) {
    return (
      <div className="page-container">
        <h1>Post Not Found</h1>
        <Link to="/blog">← Back to Blog</Link>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{post.title} - SEO Demo SPA</title>
        <meta name="description" content={post.content.substring(0, 160)} />
        <meta property="og:title" content={post.title} />
        <meta property="og:type" content="article" />
        <meta name="author" content={post.author} />
      </Helmet>

      <div className="page-container">
        <Link to="/blog" className="back-link">← Back to Blog</Link>

        <article className="blog-post">
          <h1>{post.title}</h1>
          <div className="post-meta">
            <span>📅 {post.date}</span>
            <span>👤 {post.author}</span>
          </div>
          <div className="post-content">
            {post.content.split('\n').map((paragraph, i) => {
              if (paragraph.trim().startsWith('##')) {
                return <h2 key={i}>{paragraph.replace('##', '').trim()}</h2>;
              }
              if (paragraph.trim().startsWith('-')) {
                return <li key={i}>{paragraph.replace('-', '').trim()}</li>;
              }
              if (paragraph.trim()) {
                return <p key={i}>{paragraph}</p>;
              }
              return null;
            })}
          </div>
        </article>
      </div>
    </>
  );
}
