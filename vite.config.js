export default {
  plugins: [],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          qr: ['qrcode', 'qrcode.react', 'html5-qrcode']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
} 