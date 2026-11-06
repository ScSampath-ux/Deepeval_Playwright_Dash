// @ts-check
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const portalUrl = process.env.SHIPPING_PORTAL_URL || 'https://qa.shipconsole.com/ShipConsole/login';
let defaultBaseURL = 'https://qa.shipconsole.com';
try {
  defaultBaseURL = new URL(portalUrl).origin;
} catch {
  // fallback to qa baseURL
}

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: false,
  timeout: 300000, // 5 minutes overall test timeout to process LLM prompts
  use: {
    baseURL: defaultBaseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: process.env.HEADLESS === 'true',
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
