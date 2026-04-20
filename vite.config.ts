import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [],
        manifest: {
          name: 'Technical Lexicon',
          short_name: 'Lexicon',
          description: 'Bilingual Technical Dictionary (EN-KN) powered by AI',
          theme_color: '#0F172A',
          background_color: '#F8FAFC',
          display: 'standalone',
          icons: [
            {
              src: 'https://cdn.pixabay.com/photo/2012/04/13/13/21/book-32367_1280.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://cdn.pixabay.com/photo/2012/04/13/13/21/book-32367_1280.png',
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.OPENROUTER_API_KEY': JSON.stringify(env.VITE_OPENROUTER_API_KEY || env.OPENROUTER_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
