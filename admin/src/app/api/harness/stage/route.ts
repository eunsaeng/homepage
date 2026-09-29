import { getStageContent } from "@/lib/harness-store";
import { jsonError, noStore, rejectNonLocalRequest } from "@/lib/harness-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rejected = rejectNonLocalRequest(request);
  if (rejected) return rejected;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(id)) return jsonError("Invalid stage id.", 400);
  try {
    const content = await getStageContent(id);
    return content ? noStore(content) : jsonError("Stage not found.", 404);
  } catch (error) {
    return jsonError(error, 500);
  }
}
