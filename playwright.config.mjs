// UI tests: `npm run test:ui`. Runs every spec on a desktop and a phone-sized
// Chromium against the site served by tests/server.mjs.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/ui',
  // Coverage (COVERAGE=1): clear the last run first, write the raw report after.
  globalSetup: './tests/coverage/ui-setup.mjs',
  globalTeardown: './tests/coverage/ui-teardown.mjs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Playwright uses half the CPUs by default. The tests are deterministic
  // (frozen clocks, fixed randomness), so CI can use all of them.
  workers: process.env.CI ? '100%' : undefined,
  reporter: [
    ['list'],
    ...(process.env.CI ? [['html', { open: 'never' }]] : []),
    // scripts/ui-cache.mjs reads which specs passed from this report.
    ...(process.env.UI_RESULTS ? [['json', { outputFile: process.env.UI_RESULTS }]] : [])
  ],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } }
  ],
  webServer: {
    command: 'node tests/server.mjs',
    env: { PORT: String(PORT) },
    // Waits for the port to open rather than fetching a page, which the
    // server would log as a request no spec made (see scripts/ui-cache.mjs).
    port: PORT,
    reuseExistingServer: !process.env.CI
  }
});
