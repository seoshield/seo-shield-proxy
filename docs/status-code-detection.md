# HTTP Status Code Detection

SEO Shield Proxy supports automatic HTTP status code detection through meta tags. This is essential for proper SEO, especially for Single Page Applications (SPAs) that render 404 or other error pages client-side.

## The Problem: Soft 404s

When a React/Vue/Angular SPA encounters a non-existent route (e.g., `/product/does-not-exist`), it typically:
1. Returns the `index.html` file with HTTP 200 OK
2. Renders a "404 Not Found" message in JavaScript
3. Google sees this as a "Soft 404" and penalizes your SEO

## The Solution

Add a meta tag to your error pages, and SEO Shield Proxy will automatically set the correct HTTP status code for bots:

```html
<meta name="prerender-status-code" content="404" />
```

### Example: React Router 404 Page

```jsx
// NotFoundPage.jsx
import { Helmet } from 'react-helmet';

export default function NotFoundPage() {
  return (
    <div>
      <Helmet>
        <meta name="prerender-status-code" content="404" />
      </Helmet>
      <h1>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist.</p>
    </div>
  );
}
```

## Supported Status Codes

You can use any valid HTTP status code (100-599):

| Code | Use Case | Example |
|------|----------|---------|
| 404 | Page not found | Non-existent product, article |
| 410 | Page permanently deleted | Removed content |
| 403 | Forbidden | Access denied |
| 401 | Unauthorized | Login required |
| 500 | Internal error | Application error |
| 503 | Service unavailable | Maintenance mode |

## How It Works

1. **User Request**: Human users see your normal SPA behavior (HTTP 200)
2. **Bot Request**: When a search engine bot visits:
   - Puppeteer renders your page
   - Detects the `prerender-status-code` meta tag
   - Returns the HTML with the correct HTTP status code
   - Bot indexes your page correctly!

## Verification

You can verify it's working by checking the response headers:

```bash
curl -I -A "Googlebot" https://your-site.com/non-existent-page
```

Look for:
- `X-Prerender-Status-Code: 404` - Detected from meta tag
- HTTP status code should be 404

## SEO Benefits

✅ **Prevents Soft 404 penalties**  
✅ **Proper indexing of error pages**  
✅ **Better crawl efficiency**  
✅ **Accurate search console reporting**  
✅ **100% compatible with SPAs**
