# Debug Mode & Render Preview

## Overview

Debug mode allows developers to see exactly what search engine bots see when they visit your site, without manually changing User-Agent headers. This is essential for troubleshooting CSS issues, missing data, or other rendering problems in the bot-rendered version.

## Quick Start

### Simple Preview Mode

Add `?_render=true` to any URL to trigger SSR rendering as a human user:

```
https://your-site.com/about?_render=true
https://your-site.com/products/123?_render=debug
```

### Debug Mode

Add `?_render=debug` for detailed debugging information:

```
https://your-site.com/about?_render=debug
```

## Use Cases

### 1. Visual Debugging

**Problem**: CSS layout shifts or missing styles in bot-rendered pages

**Solution**: Use `?_render=true` to view the exact HTML that bots receive

```bash
# Open in browser
https://your-site.com/product/123?_render=true
```

**What you'll see**: The fully rendered HTML with all JavaScript executed, exactly as Googlebot sees it.

### 2. Missing Data Detection

**Problem**: Dynamic content not appearing for bots

**Solution**: Compare human version vs bot version

```bash
# Human version (normal SPA)
https://your-site.com/blog/post-1

# Bot version (SSR rendered)
https://your-site.com/blog/post-1?_render=true
```

### 3. Performance Analysis

**Problem**: Need to understand cache behavior and render times

**Solution**: Use debug mode to get detailed metrics

```bash
# Debug mode with full metrics
https://your-site.com/?_render=debug
```

**Debug info includes**:
- Render time (how long Puppeteer took)
- Total response time
- Cache status (HIT/MISS/STALE)
- Queue metrics
- HTTP status code
- Cache decision rules

## Response Headers

### Preview Mode (`?_render=true`)

All SSR responses include standard headers plus:

```
X-Rendered-By: SEO-Shield-Proxy
X-Cache-Status: HIT | MISS | STALE
X-Cache-Rule: reason for cache decision
X-Render-Preview: true
```

### Debug Mode (`?_render=debug`)

Debug mode adds comprehensive metadata:

```
X-Debug-Mode: true
X-Debug-Info: {"timestamp":"2025-11-23T12:34:56.789Z","cacheStatus":"MISS",...}
```

**Example debug info**:
```json
{
  "timestamp": "2025-11-23T12:34:56.789Z",
  "requestPath": "/product/123",
  "cacheStatus": "MISS",
  "cacheRule": "URL matches cache patterns",
  "cacheAllowed": true,
  "httpStatus": 200,
  "renderTime": 3245,
  "totalResponseTime": 3267,
  "prerenderStatusCode": null,
  "queueMetrics": {
    "queued": 0,
    "processing": 2,
    "completed": 1542,
    "errors": 23,
    "maxConcurrency": 5
  }
}
```

## HTML Debug Comment

When using `?_render=debug`, debug information is also injected as an HTML comment at the top of the response:

```html
<!-- SEO Shield Proxy Debug Info
{
  "timestamp": "2025-11-23T12:34:56.789Z",
  "requestPath": "/product/123",
  "cacheStatus": "HIT",
  "cacheTTL": 2847,
  "responseTime": 12,
  "queueMetrics": {
    "queued": 0,
    "processing": 1,
    "completed": 1543,
    "errors": 23,
    "maxConcurrency": 5
  }
}
-->
<!DOCTYPE html>
<html>
...
```

## Debug Workflow

### Step 1: Identify Issue

User reports: "Product prices not showing in Google search results"

### Step 2: Compare Versions

```bash
# Normal human view
curl https://your-site.com/product/123

# Bot view (what Google sees)
curl https://your-site.com/product/123?_render=true
```

### Step 3: Analyze with Debug Mode

```bash
# Get full debug info
curl -i https://your-site.com/product/123?_render=debug
```

**Check**:
- Is the price in the rendered HTML?
- What's the cache status? (Stale data might be the issue)
- Did the render succeed? (Check renderTime)
- Are there queue errors?

### Step 4: Inspect HTML

View source in browser with `?_render=debug` to see the debug comment at the top.

## Cache Status Meanings

| Status | Description | What It Means |
|--------|-------------|---------------|
| **MISS** | Not in cache, freshly rendered | First time page is accessed or cache expired |
| **HIT** | Fresh cache hit | Serving cached HTML within TTL |
| **STALE** | Serving stale content, revalidating in background | Using SWR strategy, immediate response with background refresh |

## Common Issues & Solutions

### Issue 1: CSS Not Loading

**Symptoms**: Styles missing in `?_render=true` view

**Cause**: Puppeteer blocks stylesheets by default (performance optimization)

**Solution**: This is expected. Bots don't care about visual styles, only semantic HTML. Check if the HTML structure and content are correct.

### Issue 2: JavaScript Not Executing

**Symptoms**: Dynamic content missing

**Cause**: JavaScript errors or timeout

**Debug**:
```bash
# Check render time in debug mode
curl -i https://your-site.com/page?_render=debug | grep "renderTime"
```

**Solution**:
- Increase `PUPPETEER_TIMEOUT` if renders are timing out
- Check browser console logs (see Puppeteer logs in server output)
- Ensure JavaScript is not relying on user interactions

### Issue 3: Stale Data Being Served

**Symptoms**: Old content showing up

**Cause**: SWR strategy serving stale cache

**Debug**:
```bash
curl -i https://your-site.com/page?_render=debug | grep "X-Cache-Status"
# If STALE, background revalidation is happening
```

**Solution**:
- Wait a few seconds and refresh (background revalidation will complete)
- Or clear cache via admin panel: `POST http://localhost:8080/cache/clear`

### Issue 4: 404 Pages Not Returning 404

**Symptoms**: 404 pages return HTTP 200

**Solution**: Add prerender status code meta tag to your SPA:

```html
<!-- In your 404 component -->
<meta name="prerender-status-code" content="404">
```

Debug mode will show:
```json
{
  "httpStatus": 404,
  "prerenderStatusCode": 404
}
```

## Browser DevTools Inspection

### Viewing Debug Headers

**Chrome DevTools**:
1. Open DevTools (F12)
2. Go to Network tab
3. Load page with `?_render=debug`
4. Click on the document request
5. View Response Headers

**Look for**:
- `X-Cache-Status`: HIT, MISS, or STALE
- `X-Debug-Info`: Full debug JSON
- `X-Render-Preview`: true

### Viewing HTML Comment

**View Source**:
1. Right-click → View Page Source
2. Debug info appears at the top as an HTML comment

**Or use DevTools**:
1. Elements tab
2. Scroll to top of `<html>` tag
3. Debug comment is visible before `<!DOCTYPE>`

## Performance Testing

### Measure Render Time

```bash
# First render (MISS)
time curl -s "https://your-site.com/page?_render=debug" > /dev/null

# Second render (HIT)
time curl -s "https://your-site.com/page?_render=debug" > /dev/null
```

**Expected Results**:
- First render: 3-5 seconds (Puppeteer rendering)
- Second render: < 100ms (cache hit)

### Check Queue Performance

With debug mode, monitor queue metrics:

```bash
curl -s "https://your-site.com/page?_render=debug" | grep -o '"queueMetrics":{[^}]*}'
```

**Healthy Metrics**:
```json
{
  "queued": 0,
  "processing": 1-5,
  "errors": < 1% of completed
}
```

**Overloaded**:
```json
{
  "queued": > 20,
  "processing": maxConcurrency,
  "errors": > 5% of completed
}
```

## Security Considerations

### Production Usage

**Recommendation**: Disable or restrict debug mode in production

**Option 1**: Require authentication
```typescript
// Add middleware to check auth before allowing _render parameter
if (req.query['_render'] && !isAuthenticated(req)) {
  return res.status(403).send('Forbidden');
}
```

**Option 2**: Disable via environment variable
```bash
# .env
ENABLE_RENDER_PREVIEW=false
```

### Information Disclosure

Debug mode reveals:
- Cache strategy
- Render times
- Queue metrics
- Internal paths

**Risk Level**: Low (information only, no sensitive data)

**Mitigation**: Only use in development or restrict to authenticated users

## Best Practices

1. **Use `?_render=true` for visual inspection** (lightweight, no debug overhead)
2. **Use `?_render=debug` for performance analysis** (full metrics)
3. **Don't use in production** without authentication
4. **Clear cache after code changes** to force fresh renders
5. **Compare with actual bot requests** using User-Agent spoofing in DevTools
6. **Monitor queue metrics** during high traffic testing

## Integration with Testing

### Automated Testing

```javascript
// test/ssr.test.js
describe('SSR Rendering', () => {
  it('should render product page for bots', async () => {
    const response = await fetch('http://localhost:8080/product/123?_render=debug');
    const html = await response.text();

    // Check debug header
    expect(response.headers.get('X-Debug-Mode')).toBe('true');

    // Check HTML contains product data
    expect(html).toContain('<h1>Product Name</h1>');

    // Check debug comment exists
    expect(html).toContain('<!-- SEO Shield Proxy Debug Info');
  });
});
```

### Load Testing

```bash
# Load test with debug mode
ab -n 100 -c 10 "http://localhost:8080/page?_render=true"

# Check queue metrics in logs
grep "Queue:" logs/app.log
```

## CLI Tools

### Quick Debug Check

```bash
#!/bin/bash
# debug-check.sh

URL=$1

echo "=== Render Preview Check ==="
echo "URL: $URL?_render=debug"
echo ""

echo "=== Response Headers ==="
curl -sI "$URL?_render=debug" | grep "X-"

echo ""
echo "=== Debug Info ==="
curl -s "$URL?_render=debug" | grep -A 20 "<!-- SEO Shield Proxy Debug Info"

echo ""
echo "=== Cache Status ==="
curl -sI "$URL?_render=debug" | grep "X-Cache-Status"
```

**Usage**:
```bash
./debug-check.sh https://your-site.com/product/123
```

## Troubleshooting

### Debug Mode Not Working

**Symptom**: `?_render=debug` returns normal HTML without debug info

**Checklist**:
1. Verify query parameter: `?_render=debug` (not `&_render=debug` as first param)
2. Check server logs for "Render preview requested"
3. Ensure TypeScript compiled: `npm run build`
4. Restart server: `npm start`

### Headers Not Visible in Browser

**Symptom**: Can't see `X-Debug-Info` header

**Solution**: Use `curl -i` or browser DevTools Network tab (not Elements tab)

```bash
curl -i "http://localhost:8080/page?_render=debug"
```

### HTML Comment Not Appearing

**Symptom**: No debug comment in HTML source

**Cause**: HTML minification or processing removing comments

**Check**: View source (not DevTools Elements, which may hide comments)

## Conclusion

Debug mode is essential for:
- ✅ Visually inspecting bot-rendered HTML
- ✅ Diagnosing CSS and rendering issues
- ✅ Analyzing cache performance
- ✅ Understanding queue behavior
- ✅ Debugging SEO problems

**Quick Reference**:
- **`?_render=true`**: Simple preview mode
- **`?_render=debug`**: Full debug info with metrics

Use debug mode during development and testing to ensure your SEO Shield Proxy is working correctly!
