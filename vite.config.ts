import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solid()],
  server: {
    host: true,
    port: 5173
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    chunkSizeWarningLimit: 2048
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/unit/vitest.setup.ts',
    include: ['tests/unit/**/*.spec.ts', 'tests/unit/**/*.spec.tsx'],
    api: { host: '127.0.0.1', port: 0 }
  }
});
