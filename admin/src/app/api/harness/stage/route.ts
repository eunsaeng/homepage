import { getStageContent } from "@/lib/harness-store";
import { jsonError, noStore, rejectNonLocalRequest } from "@/lib/harness-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rejected = rejectNonLocalRequest(request);
  if (rejected) return rejected;
  const params = new URL(request.url).searchParams;
  const id = params.get("id") ?? "";
  // Work carried over from an earlier run keeps its stage files under that run's directory.
  const run = params.get("run") || undefined;
  if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(id)) return jsonError("Invalid stage id.", 400);
  if (run && !/^[A-Za-z0-9-]{1,64}$/.test(run)) return jsonError("Invalid run id.", 400);
  try {
    const content = await getStageContent(id, run);
    return content ? noStore(content) : jsonError("Stage not found.", 404);
  } catch (error) {
    return jsonError(error, 500);
  }
}
