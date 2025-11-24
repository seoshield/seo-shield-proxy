const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Create dist directory
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

console.log('Creating build without admin dependencies...');

try {
  // Use ts-node to transpile the main server file
  const cmd = `npx ts-node --compilerOptions '{"module":"commonjs","target":"ES2022","outDir":"dist","skipLibCheck":true,"esModuleInterop":true,"allowSyntheticDefaultImports":true}' src/server.ts`;

  execSync(cmd, { stdio: 'pipe', cwd: process.cwd() });

  // Read the transpiled output and write to dist/server.js
  const result = execSync(cmd, { encoding: 'utf8', cwd: process.cwd() });

  fs.writeFileSync('dist/server.js', result);

  // Copy other necessary files
  const copyFiles = [
    'src/config.ts',
    'src/cache.ts',
    'src/cache-rules.ts',
    'src/browser.ts'
  ];

  for (const file of copyFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const compiled = execSync(`npx ts-node --compilerOptions '{"module":"commonjs","target":"ES2022","skipLibCheck":true,"esModuleInterop":true,"allowSyntheticDefaultImports":true}' --print ${file}`, { encoding: 'utf8' });
    const distPath = path.join('dist', path.basename(file).replace('.ts', '.js'));
    fs.writeFileSync(distPath, compiled);
  }

  console.log('✅ Simple build completed successfully!');
  console.log('📁 Output written to dist/');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}