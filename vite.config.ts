/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the app from /EkoizpenLab/ (repository name, case-sensitive).
export default defineConfig({
  base: '/EkoizpenLab/',
  plugins: [react()],
  define: { __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)) },
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    testTimeout: 60_000,
  },
});
