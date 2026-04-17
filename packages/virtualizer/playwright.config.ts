import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3999',
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'pnpm --filter @zenbu/virtualizer-example dev',
    port: 3999,
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
})
