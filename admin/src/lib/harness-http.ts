import { NextResponse } from "next/server";

const allowedHosts = new Set(["localhost:3001", "127.0.0.1:3001"]);
const allowedOrigins = new Set(["http://localhost:3001", "http://127.0.0.1:3001"]);

export function rejectNonLocalRequest(request: Request) {
  const host = request.headers.get("host") ?? "";
  const origin = request.headers.get("origin");
  if (!allowedHosts.has(host) || (origin && !allowedOrigins.has(origin))) {
    return NextResponse.json({ error: "Harness dashboard API is local-only." }, { status: 403 });
  }
  return null;
}

export function jsonError(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Request failed.";
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export function noStore<T>(payload: T) {
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
