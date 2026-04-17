import { defineConfig } from '@playwright/test'

/**
 * Performance test config — runs against a PRODUCTION build of the example app.
 * React production mode removes dev-only checks, warnings, and overhead,
 * giving accurate performance numbers.
 *
 * Uses port 3998 to avoid conflicting with the dev server on 3999.
 */
export default defineConfig({
  testDir: './tests',
  testMatch: 'virtualizer-perf.spec.ts',
  timeout: 120_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3998',
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'pnpm --filter @zenbu/virtualizer-example build && pnpm --filter @zenbu/virtualizer-example run start:perf',
    port: 3998,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
})
