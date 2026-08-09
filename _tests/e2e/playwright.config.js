import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 45000,
  expect: { timeout: 10000 },
  retries: 1,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:8333',
    headless: true,
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
    trace: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    command: 'python -m http.server 8333',
    url: 'http://127.0.0.1:8333/index.html',
    reuseExistingServer: true,
    cwd: '../..',
    timeout: 15000
  }
});
