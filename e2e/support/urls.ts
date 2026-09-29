// Ports default to the local dev servers; the harness assigns free ports per run through these variables.
export const webPort = Number(process.env.E2E_WEB_PORT ?? 3000);
export const adminPort = Number(process.env.E2E_ADMIN_PORT ?? 3001);
export const apiPort = Number(process.env.E2E_API_PORT ?? 8080);

export const webURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${webPort}`;
export const adminURL = process.env.E2E_ADMIN_URL ?? `http://127.0.0.1:${adminPort}`;
export const apiURL = process.env.E2E_API_URL ?? `http://127.0.0.1:${apiPort}`;
