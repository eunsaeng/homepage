import { enqueueCommand } from "@/lib/harness-store";
import { jsonError, noStore, rejectNonLocalRequest } from "@/lib/harness-http";
import type { DashboardCommand } from "@/lib/harness-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requirementId = /^BL-[a-z0-9-]+$/;
const issueId = /^BL-[a-z0-9-]+--[a-z0-9-]+$/;

function parseCommand(body: unknown): DashboardCommand {
  const input = (body ?? {}) as Record<string, unknown>;
  const text = (value: unknown, max: number) => {
    if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error("Invalid text field.");
    return value;
  };
  switch (input.type) {
    case "pin-issue":
      if (typeof input.issueId !== "string" || !issueId.test(input.issueId) || typeof input.pinned !== "boolean") throw new Error("Invalid pin command.");
      return { type: "pin-issue", issueId: input.issueId, pinned: input.pinned };
    case "retry-issue":
      if (typeof input.issueId !== "string" || !issueId.test(input.issueId)) throw new Error("Invalid retry command.");
      return { type: "retry-issue", issueId: input.issueId };
    case "resolve-question": {
      // A question belongs to a requirement (Spec) or to an issue (plan, implementation, review).
      const forIssue = typeof input.issueId === "string" && issueId.test(input.issueId);
      const forRequirement = typeof input.backlogId === "string" && requirementId.test(input.backlogId);
      if (forIssue === forRequirement || typeof input.questionId !== "string" || !/^[0-9a-f]{16}$/.test(input.questionId)) throw new Error("Invalid answer command.");
      const answer = text(input.answer, 10_000);
      return forIssue
        ? { type: "resolve-question", issueId: input.issueId as string, questionId: input.questionId, answer }
        : { type: "resolve-question", backlogId: input.backlogId as string, questionId: input.questionId, answer };
    }
    case "edit-spec":
      if (typeof input.backlogId !== "string" || !requirementId.test(input.backlogId)) throw new Error("Invalid Spec edit command.");
      return { type: "edit-spec", backlogId: input.backlogId, markdown: text(input.markdown, 200_000) };
    case "approve-spec":
      if (typeof input.backlogId !== "string" || !requirementId.test(input.backlogId)) throw new Error("Invalid approval command.");
      return { type: "approve-spec", backlogId: input.backlogId };
    default:
      throw new Error("Unknown command type.");
  }
}

export async function POST(request: Request) {
  const rejected = rejectNonLocalRequest(request);
  if (rejected) return rejected;
  let command: DashboardCommand;
  try {
    command = parseCommand(await request.json());
  } catch (error) {
    return jsonError(error, 400);
  }
  try {
    return noStore(await enqueueCommand(command));
  } catch (error) {
    return jsonError(error, 409);
  }
}
