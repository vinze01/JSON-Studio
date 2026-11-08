import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  use: {
    viewport: { width: 1280, height: 800 },
  },
  // Chromium intends to launch a browser with the unpacked extension loaded together.
  expect: { timeout: 10_000 },
  retries: 0,
});
