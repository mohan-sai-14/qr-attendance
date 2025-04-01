// vercel-install.cjs - CommonJS script
const { execSync } = require('child_process');

console.log('Installing CSS processing dependencies...');
try {
  execSync('npm install autoprefixer postcss tailwindcss -D', { stdio: 'inherit' });
  console.log('Dependencies installed successfully!');
} catch (error) {
  console.error('Failed to install dependencies:', error);
  process.exit(1);
} 