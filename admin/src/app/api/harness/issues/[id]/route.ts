import { getIssueDetail } from "@/lib/harness-store";
import { jsonError, noStore, rejectNonLocalRequest } from "@/lib/harness-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const rejected = rejectNonLocalRequest(request);
  if (rejected) return rejected;
  try {
    const { id } = await context.params;
    if (!/^BL-[a-z0-9-]+--[a-z0-9-]+$/.test(id)) return jsonError("Invalid issue id.", 400);
    const detail = await getIssueDetail(id);
    return detail ? noStore(detail) : jsonError("Issue not found.", 404);
  } catch (error) {
    return jsonError(error, 500);
  }
}
