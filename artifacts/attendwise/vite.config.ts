import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const port = Number(process.env.PORT) || 3000;
const basePath = process.env.BASE_PATH || '/';

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
      '@workspace/attendwise-design-system/styles.css': path.resolve(
        import.meta.dirname,
        '..',
        'attendwise-design-system',
        'src',
        'index.css',
      ),
      '@workspace/attendwise-design-system': path.resolve(
        import.meta.dirname,
        '..',
        'attendwise-design-system',
        'src',
      ),
      '@workspace/api-client-react': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'lib',
        'api-client-react',
      ),
      '@workspace/api-zod': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'lib',
        'api-zod',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
