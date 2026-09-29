import path from "node:path";
import {
  appendFile,
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile,
} from "node:fs/promises";

export type DashboardStatus = "WAITING_FOR_HUMAN" | "IN_PROGRESS" | "READY" | "COMPLETED" | "BACKLOG" | "BLOCKED";

type RequestItem = {
  id: string;
  fileName: string;
  title: string;
  primaryRepository: string;
  requestType: string;
  sourceIds: string[];
  dependencies: string[];
  status: DashboardStatus;
  priority: string;
  priorityRationale: string;
  issues: string[];
  unresolved: Array<{ id: string; text: string; source?: string }>;
  markdown: string;
};

type IssueItem = {
  id: string;
  backlogId: string;
  title: string;
  primaryRepository: string;
  priority: string;
  status: string;
  pinned: boolean;
  dependencies: string[];
  acceptanceCriteria: string[];
  markdown: string;
  commitSha?: string;
  mrPath?: string;
};

type HarnessState = {
  run_id: string;
  phase: string;
  active_backlog_id?: string | null;
  active_issue_ids?: string[];
  backlog?: Record<string, Record<string, any>>;
  issues?: Record<string, Record<string, any>>;
  pause?: { reason?: string; details?: unknown };
  [key: string]: any;
};

const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
const requestId = (fileName: string) => `BL-${fileName.replace(/^request-/, "").replace(/\.md$/, "")}`;

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
  const root = await findWorkspaceRoot();
  return {
    root,
    requirements: path.join(root, "requirements"),
    harness: path.join(root, ".harness"),
    state: path.join(root, ".harness", "state", "run.json"),
  };
}

async function readState(): Promise<HarnessState | null> {
  const paths = await getHarnessPaths();
  try {
    return JSON.parse(await readFile(paths.state, "utf8")) as HarnessState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function readRequests(): Promise<RequestItem[]> {
  const paths = await getHarnessPaths();
  const names = (await readdir(paths.requirements)).filter((name) => /^request-.+\.md$/.test(name)).sort();
  const items: RequestItem[] = [];
  for (const fileName of names) {
    const markdown = await readFile(path.join(paths.requirements, fileName), "utf8");
    const stateId = requestId(fileName);
    const primaryRepository = markdown.match(/^- Primary repository: `([^`]+)`/m)?.[1] ?? "unknown";
    const requestType = markdown.match(/^- Request type: (.+)$/m)?.[1] ?? "request";
    const title = markdown.match(/^#\s+(.+)$/m)?.[1] ?? fileName;
    const sourceIds = [...new Set([...markdown.matchAll(/`((?:ACC|CMS|WEB)-\d+)`\s+—/g)].map((match) => match[1]))];
    const dependencySection = markdown.match(/^## 구현 의존성\s*\n([\s\S]*?)(?=^## |$)/m)?.[1] ?? "";
    const dependencies = [...dependencySection.matchAll(/^\s*-\s*(?:선행|계약):.*?\((request-[^)]+\.md)\)/gm)].map((match) => requestId(match[1]));
    const unresolvedSection = markdown.match(/^## UNRESOLVED\s*\n([\s\S]*?)(?=^## |$)/m)?.[1]?.trim() ?? "";
    const unresolvedFromRequest = unresolvedSection && !/^(?:없음|none|n\/a|해당 없음)[.!。]?$/i.test(unresolvedSection)
      ? [{ id: `source-${fileName}`, text: unresolvedSection, source: "backlog" }]
      : [];
    items.push({
      id: stateId,
      fileName,
      title,
      primaryRepository,
      requestType,
      sourceIds,
      dependencies,
      status: "BACKLOG",
      priority: "P2",
      priorityRationale: "",
      issues: [],
      unresolved: unresolvedFromRequest,
      markdown,
    });
  }
  return items;
}

function mapRequest(item: RequestItem, state: HarnessState | null) {
  const record = state?.backlog?.[item.id];
  if (!record) return item;
  const issueIds = record.issue_ids ?? [];
  const unresolved = record.unresolved_questions ?? item.unresolved;
  let status: DashboardStatus = "BACKLOG";
  if (record.status === "COMPLETED") status = "COMPLETED";
  else if ((state?.phase?.startsWith("PAUSED") && state.active_backlog_id === item.id) || unresolved.some((question: any) => !record.unresolved_resolutions?.[question.id])) status = "WAITING_FOR_HUMAN";
  else if (record.status === "SPEC_APPROVED" || record.status === "ISSUES_READY" || state?.active_backlog_id === item.id) status = "IN_PROGRESS";
  else if (record.status === "INDEXED") status = "READY";
  return {
    ...item,
    status,
    priority: record.priority ?? item.priority,
    priorityRationale: record.priority_rationale ?? "",
    dependencies: (record.dependencies as string[] | undefined) ?? item.dependencies,
    issues: issueIds,
    unresolved,
    markdown: item.markdown,
    specMarkdown: record.spec_markdown ?? null,
    specStatus: record.spec_status ?? null,
    approval: record.approval ?? null,
  };
}

function mapIssue(id: string, issue: Record<string, any>): IssueItem {
  return {
    id,
    backlogId: issue.backlog_id ?? "",
    title: issue.title ?? id,
    primaryRepository: issue.primary_repository ?? "unknown",
    priority: issue.priority ?? "P2",
    status: issue.status ?? "BACKLOG",
    pinned: Boolean(issue.pinned),
    dependencies: issue.dependencies ?? [],
    acceptanceCriteria: issue.acceptance_criteria ?? [],
    markdown: issue.markdown ?? "",
    commitSha: issue.commit_sha,
    mrPath: issue.mr_path,
  };
}

export async function getDashboardData() {
  const [requests, state, paths] = await Promise.all([readRequests(), readState(), getHarnessPaths()]);
  const requirements = requests.map((item) => mapRequest(item, state));
  const issues = Object.entries(state?.issues ?? {}).map(([id, item]) => mapIssue(id, item));
  const completedRequirementIds = new Set(requirements.filter((item) => item.status === "COMPLETED").map((item) => item.id));
  const readyRequirements = requirements
    .filter((item) => item.status !== "COMPLETED" && item.dependencies.every((dependency) => completedRequirementIds.has(dependency)))
    .sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9) || a.id.localeCompare(b.id));
  const completedIssues = issues.filter((issue) => issue.status === "MR_READY").sort((a, b) => a.id.localeCompare(b.id));
  const readyIssues = issues
    .filter((issue) => issue.status !== "MR_READY" && issue.dependencies.every((dependency) => state?.issues?.[dependency]?.status === "MR_READY"))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9) || a.id.localeCompare(b.id));
  const needsHumanIssues = issues.filter((issue) => state?.phase?.startsWith("PAUSED") && (state.active_issue_ids ?? []).includes(issue.id));
  const inProgressIssues = issues.filter((issue) => ["WORKTREE_READY", "IMPLEMENTING", "REWORK_REQUIRED", "REVIEWING"].includes(issue.status));
  return {
    updatedAt: state?.updated_at ?? null,
    run: state ? { id: state.run_id, phase: state.phase, activeBacklogId: state.active_backlog_id, activeIssueIds: state.active_issue_ids ?? [], pause: state.pause ?? null } : null,
    requirements: {
      summary: {
        registered: requirements.length,
        approved: requirements.filter((item) => ["IN_PROGRESS", "COMPLETED"].includes(item.status) && Boolean((item as any).specMarkdown || state?.backlog?.[item.id]?.spec_markdown)).length,
        needsHuman: requirements.filter((item) => item.status === "WAITING_FOR_HUMAN").length,
        inProgress: requirements.filter((item) => item.status === "IN_PROGRESS").length,
      },
      ready: readyRequirements,
      completed: requirements.filter((item) => item.status === "COMPLETED"),
      all: requirements,
    },
    issues: {
      summary: {
        registered: issues.length,
        mergeCreated: issues.filter((issue) => issue.status === "MR_READY").length,
        needsHuman: needsHumanIssues.length,
        inProgress: inProgressIssues.length,
      },
      ready: readyIssues,
      completed: completedIssues,
      all: issues,
    },
    root: paths.root,
  };
}

async function safeRead(filePath: string | null | undefined, root: string): Promise<string> {
  if (!filePath) return "";
  const resolved = path.resolve(root, filePath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Artifact path escapes workspace root.");
  try {
    const content = await readFile(resolved, "utf8");
    return content.slice(0, 250_000);
  } catch {
    return "";
  }
}

async function walkStageDirectories(directory: string, root: string, results: Array<Record<string, any>>, depth = 0): Promise<void> {
  if (depth > 12) return;
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
  const files = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
  if (files.has("input.md") || files.has("output.md")) {
    const relative = path.relative(root, directory).replaceAll("\\", "/");
    const [session, input, output] = await Promise.all([
      safeRead(path.join(directory, "session.json"), root).then((raw) => { try { return JSON.parse(raw); } catch { return null; } }),
      safeRead(path.join(directory, "input.md"), root),
      safeRead(path.join(directory, "output.md"), root),
    ]);
    results.push({ id: relative, stage: path.basename(directory), input, output, session, logs: [] });
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "node_modules") continue;
    await walkStageDirectories(path.join(directory, entry.name), root, results, depth + 1);
  }
}

async function attachLogs(runDirectory: string, stages: Array<Record<string, any>>) {
  const logRoot = path.join(runDirectory, "logs");
  for (const stage of stages) {
    const sessionId = stage.session?.session_id;
    if (sessionId) {
      const files = await findNamedFiles(logRoot, sessionId);
      stage.logs = await Promise.all(files.map(async (file) => ({ path: path.relative(runDirectory, file), content: await safeRead(file, runDirectory) })));
    }
    const localLogRoot = path.dirname(path.join(runDirectory, stage.id));
    const localLogs = await findFilesWithExtension(localLogRoot, ".log", 4);
    stage.logs.push(...await Promise.all(localLogs.map(async (file) => ({ path: path.relative(runDirectory, file), content: await safeRead(file, runDirectory) }))));
  }
  return stages;
}

async function findNamedFiles(directory: string, name: string, depth = 0): Promise<string[]> {
  if (depth > 10) return [];
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { return []; }
  const found: string[] = [];
  for (const entry of entries) {
    const child = path.join(directory, entry.name);
    if (entry.isFile() && entry.name.startsWith(name)) found.push(child);
    else if (entry.isDirectory()) found.push(...await findNamedFiles(child, name, depth + 1));
  }
  return found;
}

async function findFilesWithExtension(directory: string, extension: string, depth: number): Promise<string[]> {
  if (depth < 0) return [];
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { return []; }
  const found: string[] = [];
  for (const entry of entries) {
    const child = path.join(directory, entry.name);
    if (entry.isFile() && entry.name.endsWith(extension)) found.push(child);
    else if (entry.isDirectory()) found.push(...await findFilesWithExtension(child, extension, depth - 1));
  }
  return found;
}

async function getStagesFor(backlogId: string, issueIds: string[] = []) {
  const state = await readState();
  const paths = await getHarnessPaths();
  if (!state?.run_id) return [];
  const runDirectory = path.join(paths.harness, "runs", state.run_id);
  const all: Array<Record<string, any>> = [];
  await walkStageDirectories(runDirectory, runDirectory, all);
  const needles = [backlogId, ...issueIds];
  const selected = all.filter((stage) => needles.some((needle) => stage.id.includes(needle)));
  selected.sort((a, b) => a.id.localeCompare(b.id));
  return attachLogs(runDirectory, selected);
}

export async function getRequirementDetail(id: string) {
  const dashboard = await getDashboardData();
  const requirement = dashboard.requirements.all.find((item) => item.id === id);
  if (!requirement) return null;
  const stages = await getStagesFor(id, requirement.issues);
  return { requirement, stages };
}

export async function getIssueDetail(id: string) {
  const dashboard = await getDashboardData();
  const issue = dashboard.issues.all.find((item) => item.id === id);
  if (!issue) return null;
  const stages = await getStagesFor(issue.backlogId, [id]);
  return { issue, stages };
}

export async function mutateHarnessState<T>(mutator: (state: HarnessState, paths: Awaited<ReturnType<typeof getHarnessPaths>>) => Promise<T> | T): Promise<T> {
  const paths = await getHarnessPaths();
  let state: HarnessState;
  try { state = JSON.parse(await readFile(paths.state, "utf8")) as HarnessState; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error("No active harness run exists.");
    throw error;
  }
  const result = await mutator(state, paths);
  state.updated_at = new Date().toISOString();
  const temporary = `${paths.state}.${process.pid}.tmp`;
  await mkdir(path.dirname(paths.state), { recursive: true });
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(temporary, paths.state);
  await appendFile(path.join(paths.harness, "dashboard-audit.jsonl"), `${JSON.stringify({ time: state.updated_at, action: "dashboard-mutation" })}\n`);
  return result;
}
