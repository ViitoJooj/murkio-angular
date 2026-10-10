import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@murkio/html': fileURLToPath(new URL('../html/src/index.ts', import.meta.url)) } },
  test: { environment: 'happy-dom', include: ['test/**/*.test.ts'] },
});
