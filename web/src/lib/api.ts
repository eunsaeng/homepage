// Server-side only: read at request time, so the API address can change without a rebuild.
const apiBaseUrl = process.env.API_BASE_URL ?? "http://localhost:8080";

/** Calls a public API endpoint (`/api/public/**`) from a Server Component or Route Handler. */
export function fetchPublicApi(path: `/api/public/${string}`, init?: RequestInit): Promise<Response> {
  return fetch(new URL(path, apiBaseUrl), init);
}
