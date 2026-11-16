import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// GitHub Pages serves this app from the /intereth/ repository subpath.
// Chunking uses Rolldown's defaults: the manual codeSplitting groups that
// used to live here produced a chunk graph whose initialization order left
// a React binding undefined in the web3-onboard chunk, blanking the page
// only in production builds.
export default defineConfig({
  base: '/intereth/',
  plugins: [react()],
  // With "type": "module" in package.json, Vite 8's dev server binds default
  // imports of CJS deps (e.g. @mui/icons-material/*) to the raw module.exports
  // namespace instead of its .default, so React receives an object and the
  // app renders blank. This flag restores the __esModule-aware interop.
  legacy: { inconsistentCjsInterop: true },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
