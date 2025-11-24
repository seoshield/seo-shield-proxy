const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Create dist directory
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

// Copy core files that don't have admin dependencies
const coreFiles = [
  'src/server.ts',
  'src/browser.ts',
  'src/config.ts',
  'src/cache.ts',
  'src/cache-rules.ts'
];

// Compile TypeScript files without admin dependencies
console.log('Compiling core files...');
try {
  // First try to compile just the main files without admin dependencies
  const cmd = `npx tsc src/server.ts src/browser.ts src/config.ts src/cache.ts src/cache-rules.ts src/cache/cache-factory.ts src/cache/cache-interface.ts src/cache/memory-cache.ts src/cache/redis-cache.ts src/cache/simple-cache.ts src/middleware/rate-limiter.ts --outDir dist --module commonjs --target ES2022 --skipLibCheck true --esModuleInterop true --allowSyntheticDefaultImports true --moduleResolution node --noResolve false`;

  execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });

  // Copy package.json to dist
  fs.copyFileSync('package.json', 'dist/package.json');

  // Create a simple server.js entry point that requires the compiled server
  const serverJs = `// Generated entry point
require('./server.js');`;

  fs.writeFileSync('dist/index.js', serverJs);

  console.log('✅ Build completed successfully!');
  console.log('📁 Output written to dist/');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}