
import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: 'tests/e2e',
  use: {
    baseURL: 'http://localhost:3000',  // ❗ absolute URL
  },
  webServer: {
    command: 'pnpm run dev',           // optional: Startet deinen Dev-Server
    url: 'http://localhost:3000',
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
  },
});