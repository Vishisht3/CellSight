import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],

  // Make VITE_API_URL available at build time; empty string = same-origin
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(
      process.env.VITE_API_URL ?? ''
    ),
  },

  build: {
    // Emit source maps in CI so stack traces are readable
    sourcemap: mode !== 'production',
    outDir: 'dist',
  },

  server: {
    port: 5173,
    proxy: {
      // Local dev: forward /api to the Express backend
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
}));
