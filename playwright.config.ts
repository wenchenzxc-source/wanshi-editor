import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/e2e', timeout: 90000, expect: { timeout: 15000 }, fullyParallel: false, workers: 1, reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4311', channel: 'chrome', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'node --import tsx server/index.ts', url: 'http://127.0.0.1:4311', reuseExistingServer: !process.env.CI, timeout: 30000, env: { PORT: '4311', DATA_DIR: 'test-results/server-data' } }
});
