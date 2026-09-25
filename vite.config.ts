import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this app from the /intereth/ repository subpath.
export default defineConfig({
  base: '/intereth/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
