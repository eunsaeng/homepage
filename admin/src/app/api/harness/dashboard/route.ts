import { getDashboardData } from "@/lib/harness-store";
import { jsonError, noStore, rejectNonLocalRequest } from "@/lib/harness-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rejected = rejectNonLocalRequest(request);
  if (rejected) return rejected;
  try {
    return noStore(await getDashboardData());
  } catch (error) {
    return jsonError(error, 500);
  }
}
