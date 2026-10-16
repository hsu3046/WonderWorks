import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: true, hmr: false, watch: { ignored: ['**/out/**', '**/ref/**', '**/tools/**', '**/shots/**'] } },
  optimizeDeps: { include: ['three'] },
});
