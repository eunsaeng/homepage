import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import type {
  DashboardCommand,
  DashboardData,
  Issue,
  IssueDetail,
  ItemStatus,
  PendingCommand,
  ProcessedCommand,
  Question,
  Requirement,
  RequirementDetail,
  RunInfo,
  StageContent,
  StageLog,
  Step,
  StepState,
} from "./harness-types";

// Read-only view of harness state plus a command queue. The dashboard never writes run state itself:
// the orchestrator keeps state in memory and applies queued commands at its checkpoints
// (scripts/harness/lib/commands.mjs).

type Record_ = Record<string, any>;
type HarnessState = {
  run_id: string;
  phase: string;
  active_backlog_id?: string | null;
  active_issue_ids?: string[];
  active_stages?: Record<string, { status?: string; model?: string }>;
  backlog?: Record<string, Record_>;
  issues?: Record<string, Record_>;
  pause?: { reason?: string; details?: any; paused_at?: string } | null;
  updated_at?: string;
};

const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
const requestId = (fileName: string) => `BL-${fileName.replace(/^request-/, "").replace(/\.md$/, "")}`;
const inProgressIssueStatuses = new Set(["WORKTREE_READY", "IMPLEMENTING", "REWORK_REQUIRED", "REVIEWING"]);

async function findWorkspaceRoot(start = process.cwd()): Promise<string> {
  let current = path.resolve(start);
  while (true) {
    try {
      await readFile(path.join(current, "pnpm-workspace.yaml"), "utf8");
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) throw new Error("Could not locate workspace root.");
      current = parent;
    }
  }
}

export async function getHarnessPaths() {
  // HARNESS_WORKSPACE_ROOT points the dashboard at another workspace (for example a test fixture).
  const root = process.env.HARNESS_WORKSPACE_ROOT ? path.resolve(process.env.HARNESS_WORKSPACE_ROOT) : await findWorkspaceRoot();
  const harness = path.join(root, ".harness");
  return {
    root,
    requirements: path.join(root, "requirements"),
    harness,
    state: path.join(harness, "state", "run.json"),
    commands: path.join(harness, "commands"),
  };
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || error instanceof SyntaxError) return null;
    throw error;
  }
}

type RequestFile = { id: string; fileName: string; title: string; primaryRepository: string; requestType: string; sourceIds: string[]; dependencies: string[]; markdown: string };

async function readRequests(directory: string): Promise<RequestFile[]> {
  const names = (await readdir(directory)).filter((name) => /^request-.+\.md$/.test(name)).sort();
  return Promise.all(names.map(async (fileName) => {
    const markdown = await readFile(path.join(directory, fileName), "utf8");
    const dependencySection = markdown.match(/^## 구현 의존성\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/m)?.[1] ?? "";
    return {
      id: requestId(fileName),
      fileName,
      title: markdown.match(/^#\s+(.+)$/m)?.[1] ?? fileName,
      primaryRepository: markdown.match(/^- Primary repository: `([^`]+)`/m)?.[1] ?? "unknown",
      requestType: markdown.match(/^- Request type: (.+)$/m)?.[1] ?? "request",
      sourceIds: [...new Set([...markdown.matchAll(/`((?:ACC|CMS|WEB)-\d+)`\s*[-—]/g)].map((match) => match[1]))],
      dependencies: [...dependencySection.matchAll(/^\s*-\s*(?:선행|계약)\s*:.*?\]\((request-[^)]+\.md)\)/gm)].map((match) => requestId(match[1])),
      markdown,
    };
  }));
}

function pendingQuestionCount(record: Record_ | undefined) {
  const answers = record?.unresolved_resolutions ?? {};
  return (record?.unresolved_questions ?? []).filter((question: Question) => !answers[question.id]?.trim()).length;
}

function isPaused(state: HarnessState | null) {
  return Boolean(state?.phase?.startsWith("PAUSED"));
}

function toRequirement(file: RequestFile, state: HarnessState | null, completedIds: Set<string>): Requirement {
  const record = state?.backlog?.[file.id];
  const dependencies: string[] = record?.dependencies ?? file.dependencies;
  let status: ItemStatus;
  if (record?.status === "COMPLETED") status = "COMPLETED";
  else if (record && (record.status === "WAITING_FOR_HUMAN" || record.spec_status === "NEEDS_HUMAN_REVIEW" || pendingQuestionCount(record) > 0 || (isPaused(state) && state?.active_backlog_id === file.id))) status = "WAITING_FOR_HUMAN";
  else if (state?.active_backlog_id === file.id || ["SPEC_APPROVED", "ISSUES_READY"].includes(record?.status)) status = "IN_PROGRESS";
  else status = dependencies.every((dependency) => completedIds.has(dependency)) ? "READY" : "BLOCKED";
  const specApproved = record?.spec_status === "SPEC_APPROVED";
  return {
    id: file.id,
    fileName: file.fileName,
    title: file.title,
    primaryRepository: file.primaryRepository,
    requestType: file.requestType,
    sourceIds: file.sourceIds,
    dependencies,
    status,
    priority: record?.priority ?? null,
    priorityRationale: record?.priority_rationale ?? "",
    issues: record?.issue_ids ?? [],
    requestMarkdown: file.markdown,
    specMarkdown: record?.spec_markdown ?? null,
    specStatus: record?.spec_status ?? null,
    specEditedByHuman: Boolean(record?.spec_edited_by_human),
    approval: record?.approval ?? null,
    humanApprovalRequested: Boolean(record?.human_approval),
    questions: (record?.unresolved_questions ?? []).map((question: Question) => ({ ...question, options: question.options ?? [] })),
    answers: record?.unresolved_resolutions ?? {},
    reviewFindings: record?.review_findings ?? [],
    canEditSpec: Boolean(record?.spec_markdown) && !specApproved && !(record?.issue_ids ?? []).length && record?.status !== "COMPLETED",
  };
}

function pausedIssueId(state: HarnessState | null): string | null {
  const details = state?.pause?.details;
  return details && typeof details === "object" && !Array.isArray(details) && typeof details.issue === "string" ? details.issue : null;
}

function toIssue(id: string, record: Record_, state: HarnessState | null): Issue {
  const dependenciesDone = (record.dependencies ?? []).every((dependency: string) => state?.issues?.[dependency]?.status === "MR_READY");
  let displayStatus: ItemStatus;
  if (record.status === "MR_READY") displayStatus = "COMPLETED";
  else if (isPaused(state) && (pausedIssueId(state) === id || (state?.active_issue_ids ?? []).includes(id))) displayStatus = "WAITING_FOR_HUMAN";
  else if (inProgressIssueStatuses.has(record.status)) displayStatus = "IN_PROGRESS";
  else displayStatus = dependenciesDone ? "READY" : "BLOCKED";
  return {
    id,
    backlogId: record.backlog_id ?? "",
    title: record.title ?? id,
    primaryRepository: record.primary_repository ?? "unknown",
    priority: record.priority ?? "P2",
    status: record.status ?? "BACKLOG",
    displayStatus,
    pinned: Boolean(record.pinned),
    dependencies: record.dependencies ?? [],
    acceptanceCriteria: record.acceptance_criteria ?? [],
    markdown: record.markdown ?? "",
    attempt: typeof record.attempt === "number" ? record.attempt : null,
    branch: record.branch ?? null,
    commitSha: record.commit_sha ?? null,
    mrPath: record.mr_path ?? null,
    questions: (record.unresolved_questions ?? []).map((question: Question) => ({ ...question, options: question.options ?? [] })),
    answers: record.unresolved_resolutions ?? {},
  };
}

const byPriority = (a: { priority: string | null; id: string }, b: { priority: string | null; id: string }) =>
  (priorityOrder[a.priority ?? ""] ?? 9) - (priorityOrder[b.priority ?? ""] ?? 9) || a.id.localeCompare(b.id);

// List payloads are polled every few seconds, so they carry no Markdown bodies.
function summarize(requirement: Requirement): Requirement {
  return { ...requirement, requestMarkdown: "", specMarkdown: null };
}

async function readCommands(paths: Awaited<ReturnType<typeof getHarnessPaths>>) {
  const toPending = (file: string, raw: Record_): PendingCommand => ({
    file,
    type: raw.type,
    createdAt: raw.created_at ?? "",
    issueId: raw.issue_id,
    backlogId: raw.backlog_id,
    questionId: raw.question_id,
    pinned: raw.pinned,
    answer: raw.answer,
  });
  const pending: PendingCommand[] = [];
  for (const file of (await readdir(paths.commands).catch(() => [] as string[])).filter((name) => name.endsWith(".json")).sort()) {
    const raw = await readJson<Record_>(path.join(paths.commands, file));
    if (raw) pending.push(toPending(file, raw));
  }
  const processedDir = path.join(paths.commands, "processed");
  const processedFiles = (await readdir(processedDir).catch(() => [] as string[])).filter((name) => name.endsWith(".json")).sort().slice(-50);
  const rejected: ProcessedCommand[] = [];
  for (const file of processedFiles) {
    const raw = await readJson<Record_>(path.join(processedDir, file));
    if (raw?.status === "rejected") rejected.push({ ...toPending(file, raw), status: "rejected", reason: raw.reason, processedAt: raw.processed_at ?? "" });
  }
  return { pending, rejected: rejected.slice(-5).reverse() };
}

async function loadModel() {
  const paths = await getHarnessPaths();
  const [files, state, commands] = await Promise.all([readRequests(paths.requirements), readJson<HarnessState>(paths.state), readCommands(paths)]);
  const completedIds = new Set(files.filter((file) => state?.backlog?.[file.id]?.status === "COMPLETED").map((file) => file.id));
  const requirements = files.map((file) => toRequirement(file, state, completedIds));
  const issues = Object.entries(state?.issues ?? {}).map(([id, record]) => toIssue(id, record, state));
  return { paths, state, requirements, issues, commands };
}

export async function getDashboardData(): Promise<DashboardData> {
  const { state, requirements, issues, commands } = await loadModel();
  const run: RunInfo | null = state
    ? { id: state.run_id, phase: state.phase, activeBacklogId: state.active_backlog_id ?? null, activeIssueIds: state.active_issue_ids ?? [], pause: state.pause ?? null, updatedAt: state.updated_at ?? null }
    : null;
  return {
    run,
    requirements: {
      summary: {
        registered: requirements.length,
        approved: requirements.filter((item) => item.specStatus === "SPEC_APPROVED" || item.status === "COMPLETED").length,
        needsHuman: requirements.filter((item) => item.status === "WAITING_FOR_HUMAN").length,
        inProgress: requirements.filter((item) => item.status === "IN_PROGRESS").length,
      },
      ready: requirements.filter((item) => item.status !== "COMPLETED" && item.status !== "BLOCKED").sort(byPriority).map(summarize),
      completed: requirements.filter((item) => item.status === "COMPLETED").sort((a, b) => a.id.localeCompare(b.id)).map(summarize),
    },
    issues: {
      summary: {
        registered: issues.length,
        mergeCreated: issues.filter((issue) => issue.status === "MR_READY").length,
        needsHuman: issues.filter((issue) => issue.displayStatus === "WAITING_FOR_HUMAN").length,
        inProgress: issues.filter((issue) => issue.displayStatus === "IN_PROGRESS").length,
      },
      ready: issues
        .filter((issue) => issue.displayStatus !== "COMPLETED" && issue.displayStatus !== "BLOCKED")
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || byPriority(a, b)),
      completed: issues.filter((issue) => issue.displayStatus === "COMPLETED").sort((a, b) => a.id.localeCompare(b.id)),
    },
    pendingCommands: commands.pending,
    recentlyRejected: commands.rejected,
  };
}

// ---- Stage logs ---------------------------------------------------------------------------------

type StageDir = { id: string; directory: string };

async function listStageDirectories(directory: string, runDirectory: string, found: StageDir[] = [], depth = 0): Promise<StageDir[]> {
  if (depth > 12) return found;
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  if (entries.some((entry) => entry.isFile() && (entry.name === "input.md" || entry.name === "output.md"))) {
    found.push({ id: path.relative(runDirectory, directory).replaceAll("\\", "/"), directory });
  }
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== "logs") await listStageDirectories(path.join(directory, entry.name), runDirectory, found, depth + 1);
  }
  return found;
}

// Stage ids are paths such as "specs/BL-x", "issues/BL-x--issue/plans/attempt-1". Matching whole path
// segments keeps BL-apps-publishing from also matching BL-apps-publishing-contract.
function belongsTo(stageId: string, id: string, includeIssues: boolean) {
  return stageId.split("/").some((segment) => segment === id || (includeIssues && segment.startsWith(`${id}--`)));
}

async function readText(filePath: string) {
  return (await readFile(filePath, "utf8").catch(() => "")).slice(0, 200_000);
}

async function filesUnder(directory: string, predicate: (name: string) => boolean, depth: number): Promise<string[]> {
  if (depth < 0) return [];
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const found: string[] = [];
  for (const entry of entries) {
    const child = path.join(directory, entry.name);
    if (entry.isFile() && predicate(entry.name)) found.push(child);
    else if (entry.isDirectory()) found.push(...await filesUnder(child, predicate, depth - 1));
  }
  return found;
}

function stageLabel(stageId: string): string {
  const parts = stageId.split("/");
  const retry = parts.at(-1)?.match(/^retry-(\d+)$/);
  if (retry) return `${stageLabel(parts.slice(0, -1).join("/"))} (재시도 ${retry[1]})`;
  const proposal = parts.at(-1)?.match(/^proposal-(\d+)$/);
  if (proposal) return `${stageLabel(parts.slice(0, -1).join("/"))} (제안 ${proposal[1]})`;
  const [kind] = parts;
  const rest = parts.slice(2).join("/");
  if (kind === "backlog-index") return "백로그 분류";
  if (kind === "selection") return parts[1].startsWith("backlog") ? "백로그 선택" : "READY 이슈 선택";
  if (kind === "specs") return rest.startsWith("revision-") ? `Spec 수정 ${rest.slice(9)}` : "Spec 생성";
  if (kind === "approvals") return `Spec 승인 검토 ${rest.replace("attempt-", "")}`;
  if (kind === "dags") return "이슈 DAG";
  if (kind === "integrations") return "선행 이슈 통합";
  if (kind === "issues" && parts.length === 2) return "이슈 분해";
  if (kind === "issues") {
    if (rest.startsWith("plans/attempt-")) return `구현 계획 ${rest.slice(14)}`;
    if (rest.startsWith("plans/review-")) return `계획 리뷰 ${rest.slice(13)}`;
    const iteration = rest.match(/^iterations\/0*(\d+)\/(.+)$/);
    if (iteration) {
      const [, attempt, step] = iteration;
      if (step.startsWith("implementation/")) return `구현 ${attempt} · ${step.slice(15)}`;
      if (step === "test-plan") return `테스트 계획 ${attempt}`;
      if (step === "verification-stage") return `실제 검증 ${attempt}`;
      if (step === "review") return `코드 리뷰 ${attempt}`;
    }
    if (rest === "merge-request") return "MR 생성";
  }
  return stageId;
}

async function readStages(state: HarnessState, runId: string, dirs: StageDir[]): Promise<StageLog[]> {
  const stages = await Promise.all(dirs.map(async ({ id, directory }) => {
    const session = await readJson<Record_>(path.join(directory, "session.json"));
    const sessionId: string | null = session?.session_id ?? null;
    const inputStat = await stat(path.join(directory, "input.md")).catch(() => null);
    const activeStage = state.active_stages?.[id];
    return {
      sortKey: session?.started_at ?? inputStat?.mtime.toISOString() ?? "",
      stage: {
        id,
        runId,
        label: stageLabel(id),
        model: session?.model ?? activeStage?.model ?? null,
        sessionId,
        exitCode: typeof session?.exit_code === "number" ? session.exit_code : null,
        completedAt: session?.completed_at ?? null,
        running: activeStage?.status === "RUNNING" || activeStage?.status === "RETRYING",
      } satisfies StageLog,
    };
  }));
  return stages.sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.stage.id.localeCompare(b.stage.id)).map((entry) => entry.stage);
}

// ---- Progress steps -----------------------------------------------------------------------------

type StepDefinition = { key: string; label: string; test: (rest: string) => boolean };

function stepStates(definitions: StepDefinition[], stageRests: string[], activeRests: string[], waiting: boolean): Step[] {
  const steps: Step[] = definitions.map((definition) => {
    const running = activeRests.some(definition.test);
    const done = stageRests.some(definition.test);
    return { key: definition.key, label: definition.label, state: running ? "running" : done ? "done" : "pending" };
  });
  if (waiting) {
    const last = steps.map((step) => step.state).lastIndexOf("done");
    if (last >= 0 && !steps.some((step) => step.state === "running")) steps[last] = { ...steps[last], state: "waiting" };
  }
  return steps;
}

function requirementSteps(requirement: Requirement, issues: Issue[], stageIds: string[], state: HarnessState): Step[] {
  const id = requirement.id;
  const within = (prefix: string) => (stageId: string) => stageId === `${prefix}/${id}` || stageId.startsWith(`${prefix}/${id}/`);
  const active = Object.entries(state.active_stages ?? {}).filter(([, stage]) => stage.status === "RUNNING" || stage.status === "RETRYING").map(([key]) => key);
  const definitions: StepDefinition[] = [
    { key: "triage", label: "백로그 분류", test: within("backlog-index") },
    { key: "spec", label: "Spec 생성", test: within("specs") },
    { key: "approval", label: "Spec 승인", test: within("approvals") },
    { key: "issues", label: "이슈 분해", test: within("issues") },
    { key: "dag", label: "이슈 DAG", test: within("dags") },
  ];
  const steps = stepStates(definitions, stageIds, active, requirement.status === "WAITING_FOR_HUMAN");
  const approval = steps.find((step) => step.key === "approval")!;
  if (requirement.specStatus === "SPEC_APPROVED") Object.assign(approval, { state: "done" as StepState, detail: requirement.approval?.type === "human" ? "수동 승인" : "자동 승인" });
  else if (approval.state === "done") approval.state = requirement.status === "WAITING_FOR_HUMAN" ? "waiting" : "pending";
  const merged = issues.filter((issue) => issue.status === "MR_READY").length;
  steps.push({
    key: "delivery",
    label: "이슈 구현·MR",
    state: issues.length && merged === issues.length ? "done" : issues.some((issue) => issue.displayStatus === "WAITING_FOR_HUMAN") ? "waiting" : issues.some((issue) => issue.displayStatus === "IN_PROGRESS") ? "running" : "pending",
    detail: issues.length ? `${merged}/${issues.length} MR` : undefined,
  });
  return steps;
}

function issueSteps(issue: Issue, stageIds: string[], state: HarnessState): Step[] {
  const prefix = `issues/${issue.id}/`;
  const rests = stageIds.filter((stageId) => stageId.startsWith(prefix)).map((stageId) => stageId.slice(prefix.length));
  const active = Object.entries(state.active_stages ?? {})
    .filter(([key, stage]) => key.startsWith(prefix) && (stage.status === "RUNNING" || stage.status === "RETRYING"))
    .map(([key]) => key.slice(prefix.length));
  const iteration = (step: RegExp) => (rest: string) => step.test(rest.replace(/^iterations\/0*\d+\//, "")) && rest.startsWith("iterations/");
  const steps = stepStates([
    { key: "plan", label: "구현 계획", test: (rest) => rest.startsWith("plans/attempt-") },
    { key: "plan-review", label: "계획 리뷰", test: (rest) => rest.startsWith("plans/review-") },
    { key: "implement", label: "구현", test: iteration(/^implementation/) },
    { key: "verify", label: "실제 검증", test: iteration(/^(test-plan|verification-stage)/) },
    { key: "review", label: "독립 리뷰", test: iteration(/^review/) },
    { key: "mr", label: "MR 생성", test: (rest) => rest.startsWith("merge-request") },
  ], rests, active, issue.displayStatus === "WAITING_FOR_HUMAN");
  if (issue.attempt) for (const step of steps) if (["implement", "verify", "review"].includes(step.key)) step.detail = `${issue.attempt}/3회차`;
  if (issue.status === "MR_READY") for (const step of steps) step.state = "done";
  return steps;
}

// Work carried over from an earlier run keeps its logs in that run's directory.
async function stagesFor(state: HarnessState | null, harnessDir: string, id: string, includeIssues: boolean, carriedFromRun?: string) {
  if (!state?.run_id) return { stageIds: [] as string[], stages: [] as StageLog[] };
  const runDirectory = path.join(harnessDir, "runs", carriedFromRun ?? state.run_id);
  const dirs = (await listStageDirectories(runDirectory, runDirectory)).filter((dir) => belongsTo(dir.id, id, includeIssues));
  return { stageIds: dirs.map((dir) => dir.id), stages: await readStages(state, carriedFromRun ?? state.run_id, dirs) };
}

// Input, output and logs of one stage, loaded only when its accordion item is opened.
export async function getStageContent(stageId: string, runId?: string): Promise<StageContent | null> {
  const paths = await getHarnessPaths();
  const state = await readJson<HarnessState>(paths.state);
  if (!state?.run_id) return null;
  const runDirectory = path.join(paths.harness, "runs", runId ?? state.run_id);
  const directory = path.resolve(runDirectory, ...stageId.split("/"));
  const relative = path.relative(runDirectory, directory);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || relative.split(path.sep)[0] === "logs") return null;
  const session = await readJson<Record_>(path.join(directory, "session.json"));
  const sessionId: string | null = session?.session_id ?? null;
  const sessionLogs = sessionId ? await filesUnder(path.join(runDirectory, "logs", ...stageId.split("/")), (name) => name.startsWith(sessionId), 0) : [];
  const commandLogs = stageId.endsWith("verification-stage") ? await filesUnder(path.join(path.dirname(directory), "test"), (name) => name.endsWith(".log"), 2) : [];
  const [input, output] = await Promise.all([readText(path.join(directory, "input.md")), readText(path.join(directory, "output.md"))]);
  if (!input && !output) return null;
  const logs = await Promise.all([...sessionLogs, ...commandLogs].map(async (file) => ({ path: path.relative(runDirectory, file).replaceAll("\\", "/"), content: await readText(file) })));
  return { id: stageId, input, output, logs };
}

export async function getRequirementDetail(id: string): Promise<RequirementDetail | null> {
  const { paths, state, requirements, issues } = await loadModel();
  const requirement = requirements.find((item) => item.id === id);
  if (!requirement) return null;
  const relatedIssues = issues.filter((issue) => issue.backlogId === id).sort(byPriority);
  const { stageIds, stages } = await stagesFor(state, paths.harness, id, true, state?.backlog?.[id]?.carried_from_run);
  const steps = state ? requirementSteps(requirement, relatedIssues, stageIds, state) : [];
  return { requirement, issues: relatedIssues, steps, stages };
}

export async function getIssueDetail(id: string): Promise<IssueDetail | null> {
  const { paths, state, issues } = await loadModel();
  const issue = issues.find((item) => item.id === id);
  if (!issue) return null;
  const { stageIds, stages } = await stagesFor(state, paths.harness, id, false, state?.issues?.[id]?.carried_from_run);
  return { issue, steps: state ? issueSteps(issue, stageIds, state) : [], stages };
}

// ---- Commands -----------------------------------------------------------------------------------

export async function enqueueCommand(command: DashboardCommand) {
  const paths = await getHarnessPaths();
  const state = await readJson<HarnessState>(paths.state);
  if (!state) throw new Error("No harness run exists yet.");
  const payload: Record_ = { type: command.type, created_at: new Date().toISOString(), source: "dashboard" };
  if (command.type === "resolve-question" && command.issueId) {
    if (!state.issues?.[command.issueId]) throw new Error("Unknown issue.");
    Object.assign(payload, { issue_id: command.issueId, question_id: command.questionId, answer: command.answer });
  } else if (command.type === "pin-issue" || command.type === "retry-issue") {
    if (!state.issues?.[command.issueId]) throw new Error("Unknown issue.");
    payload.issue_id = command.issueId;
    if (command.type === "pin-issue") payload.pinned = command.pinned;
  } else {
    if (!command.backlogId || !state.backlog?.[command.backlogId]) throw new Error("Unknown requirement.");
    payload.backlog_id = command.backlogId;
    if (command.type === "resolve-question") Object.assign(payload, { question_id: command.questionId, answer: command.answer });
    if (command.type === "edit-spec") payload.markdown = command.markdown;
  }
  // Timestamp prefix keeps the orchestrator's name-ordered processing in submission order.
  const name = `${Date.now().toString().padStart(15, "0")}-${randomUUID().slice(0, 8)}.json`;
  await mkdir(paths.commands, { recursive: true });
  const temporary = path.join(paths.commands, `${name}.tmp`);
  await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(temporary, path.join(paths.commands, name));
  return { file: name };
}
