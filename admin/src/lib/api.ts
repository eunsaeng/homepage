// The browser calls the API directly so the `local_session` cookie is sent; the address is inlined at build time.
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

/** Calls an admin API endpoint (`/api/admin/**`) with the session cookie. */
export function fetchAdminApi(path: `/api/admin/${string}`, init?: RequestInit): Promise<Response> {
  return fetch(new URL(path, apiBaseUrl), { ...init, credentials: "include" });
}
