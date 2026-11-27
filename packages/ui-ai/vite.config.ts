import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  cacheDir: fileURLToPath(new URL('./.artifacts/vite-cache/', import.meta.url)),
  server: {
    watch: { ignored: ['**/.artifacts/**', '**/dist/**'] },
  },
  optimizeDeps: { entries: ['index.html'] },
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: 'index',
      cssFileName: 'style',
    },
    rolldownOptions: {
      external: ['vue', '@warmsea/ui-vue', '@warmsea/ui-tokens'],
    },
  },
});
