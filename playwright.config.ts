import { defineConfig, devices } from '@playwright/test'

const PORT = 4180

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  globalSetup: './test/e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Signed in as the fictional Avery Stone. The sign-in tests start signed out.
    storageState: 'test-results/.auth/avery.json',
    trace: 'retain-on-failure',
    timezoneId: 'America/Los_Angeles',
    locale: 'en-US',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    { name: 'iphone', use: { ...devices['iPhone 15'] } },
  ],
  webServer: [
    {
      command: 'tsx test/fake-google/server.ts',
      url: 'http://127.0.0.1:8790/__health',
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `vite build --mode e2e && vite preview --mode e2e --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
})
