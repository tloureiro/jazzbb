import { defineConfig, devices } from '@playwright/test';

const ensureNoProxyHosts = () => {
  const requiredHosts = ['localhost', '127.0.0.1'];
  const current = process.env.NO_PROXY ?? process.env.no_proxy ?? '';
  const entries = current
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  for (const host of requiredHosts) {
    if (!entries.includes(host)) {
      entries.push(host);
    }
  }
  const joined = entries.join(',');
  process.env.NO_PROXY = joined;
  process.env.no_proxy = joined;
};

ensureNoProxyHosts();

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://127.0.0.1:4321',
    trace: 'on-first-retry',
    headless: true
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'npm run preview -- --port 4321 --host 127.0.0.1 --strictPort',
    url: 'http://127.0.0.1:4321',
    reuseExistingServer: !process.env.CI
  }
});
