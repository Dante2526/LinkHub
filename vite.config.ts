import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/@firebase/storage') || id.includes('node_modules/firebase/storage')) {
              return 'vendor-firebase-storage';
            }
            if (id.includes('node_modules/@firebase/firestore') || id.includes('node_modules/firebase/firestore')) {
              return 'vendor-firebase-firestore';
            }
            if (id.includes('node_modules/@firebase') || id.includes('node_modules/firebase')) {
              return 'vendor-firebase-core';
            }
            if (id.includes('node_modules/framer-motion') || id.includes('node_modules/motion')) {
              return 'vendor-motion';
            }
            if (id.includes('node_modules/react-router-dom')) {
              return 'vendor-router';
            }
            if (id.includes('node_modules/react-colorful')) {
              return 'vendor-colorpicker';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
