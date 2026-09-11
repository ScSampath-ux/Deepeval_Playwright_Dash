// @ts-check
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: false,
  timeout: 300000, // 5 minutes overall test timeout to process LLM prompts
  use: {
    baseURL: 'https://sandbox.shipconsole.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: false,
    actionTimeout: 30000,
    viewport: null,
    launchOptions: {
      args: ['--start-maximized'],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        viewport: null,
        launchOptions: {
          args: ['--start-maximized'],
        },
      },
    },
  ],
});
