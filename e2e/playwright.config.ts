import { defineConfig, devices } from '@playwright/test';
import { adminURL, apiURL, apiPort, adminPort, webPort, webURL } from './support/urls';

// Servers already running (for example `pnpm dev:*` and bootRun) are reused locally.
// E2E_EXTERNAL_SERVERS=true skips starting them; E2E_EXTERNAL_WEB is the older name of the same switch.
const externalServers = process.env.E2E_EXTERNAL_SERVERS === 'true' || process.env.E2E_EXTERNAL_WEB === 'true';
const reuseExistingServer = !process.env.CI;

// The browser loads admin and web from 127.0.0.1, so the API must accept those origins with credentials.
const allowedOrigins = [webURL, adminURL, `http://localhost:${webPort}`, `http://localhost:${adminPort}`].join(',');

function inheritedEnv(extra: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
  return { ...env, ...extra };
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: webURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: externalServers
    ? undefined
    : [
        {
          name: 'api',
          // Settings go through Spring Boot environment variables; quoted --args do not survive pwsh → gradlew.bat.
          command: 'pwsh -NoProfile -File scripts/gradle-api.ps1 bootRun',
          cwd: '..',
          url: `${apiURL}/actuator/health`,
          env: inheritedEnv({
            SPRING_PROFILES_ACTIVE: 'local',
            SERVER_PORT: String(apiPort),
            HOMEPAGE_CORS_ALLOWEDORIGINS: allowedOrigins,
          }),
          reuseExistingServer,
          timeout: 240_000,
        },
        {
          name: 'web',
          command: `pnpm --filter web exec next dev --hostname 127.0.0.1 --port ${webPort}`,
          url: webURL,
          env: inheritedEnv({ API_BASE_URL: apiURL }),
          reuseExistingServer,
          timeout: 120_000,
        },
        {
          name: 'admin',
          command: `pnpm --filter admin exec next dev --hostname 127.0.0.1 --port ${adminPort}`,
          url: adminURL,
          env: inheritedEnv({ NEXT_PUBLIC_API_BASE_URL: apiURL }),
          reuseExistingServer,
          timeout: 120_000,
        },
      ],
});
