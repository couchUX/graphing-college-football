import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load all env vars (empty prefix, not just VITE_*) so the dev proxy can read
  // the server-side CFB_API_KEY without exposing it to client code.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    server: {
      historyApiFallback: true,
      // Mirror the production serverless proxy locally: forward /api/cfbd/* to
      // CFBD with the key injected here, so `npm run dev` works unchanged and
      // the key never reaches the browser.
      proxy: {
        '/api/cfbd': {
          target: 'https://api.collegefootballdata.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/cfbd/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (env.CFB_API_KEY) {
                proxyReq.setHeader('Authorization', `Bearer ${env.CFB_API_KEY.trim()}`);
              }
            });
          },
        },
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          games: resolve(__dirname, 'games.html'),
          ratings: resolve(__dirname, 'ratings.html'),
          trends: resolve(__dirname, 'trends.html'),
        },
      },
    },
  };
});
