import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8000,
    proxy: {
      // Proxy all API requests to backend server on port 3000
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  },
  // Allow loading local modules
  optimizeDeps: {
    include: ['@reown/appkit', '@reown/appkit-adapter-ethers', 'ethers']
  }
});
