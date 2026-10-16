// UI tests: `npm run test:ui`. Runs every spec on a desktop and a phone-sized
// Chromium against the site served by tests/server.mjs: those in tests/ui/,
// and each module's in its test/ folder (apps/snake/test/page.spec.mjs).
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
// The test server logs which files each spec was served here, for the result
// cache (scripts/ui-cache.mjs sets its own) and the check that a module's
// specs use only what it declares (tests/ui/inputs.mjs).
process.env.SERVED_LOG ||= path.resolve('.test-cache/served.log');
// With COVERAGE set, the fixture writes each test's coverage here, raw
// (tests/ui/fixtures.mjs), and the teardown merges it into coverage/ui.
if (process.env.COVERAGE) process.env.UI_COVERAGE ||= path.resolve('coverage/ui-raw');

export default defineConfig({
  testDir: '.',
  testMatch: /(^|\/)(tests\/ui\/[\w.-]+|(apps|shared|site)\/[\w-]+\/test\/[\w-]+)\.spec\.mjs$/,
  // Coverage (COVERAGE=1): clear the last run first, write the raw report
  // after. Then the check that each module's specs used only what it declares.
  globalSetup: ['./tests/coverage/ui-setup.mjs', './tests/ui/inputs-setup.mjs'],
  globalTeardown: ['./tests/coverage/ui-teardown.mjs', './tests/ui/inputs-teardown.mjs'],
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
    env: { PORT: String(PORT), SERVED_LOG: process.env.SERVED_LOG },
    // Waits for the port to open rather than fetching a page, which the
    // server would log as a request no spec made (see scripts/ui-cache.mjs).
    port: PORT,
    reuseExistingServer: !process.env.CI
  }
});
