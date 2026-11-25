import { defineConfig, devices } from '@playwright/test';

// 用系統已安裝的 Chrome（本機與 GitHub runner 都有），不另外下載瀏覽器。
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 20_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  use: { ...devices['Pixel 7'], channel: 'chrome', locale: 'zh-TW', timezoneId: 'Asia/Taipei' }
});
