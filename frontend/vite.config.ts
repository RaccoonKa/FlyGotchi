import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const usePolling =
  process.env.CHOKIDAR_USEPOLLING === 'true' ||
  process.env.WATCHPACK_POLLING === 'true' ||
  true;

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling,
      interval: 250,
    },
    hmr: {
      clientPort: 5173,
    },
  },
});
