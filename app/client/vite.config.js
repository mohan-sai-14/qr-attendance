import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          qr: ['qrcode', 'qrcode.react', 'html5-qrcode']
        }
      },
      external: ['react-qr-reader']
    }
  },
  optimizeDeps: {
    include: ['jsqr'],
  }
}); 