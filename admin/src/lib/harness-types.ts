export type ItemStatus = "WAITING_FOR_HUMAN" | "IN_PROGRESS" | "READY" | "BLOCKED" | "COMPLETED" | "BACKLOG";

export type Question = { id: string; text: string; options: string[]; source?: string };

export type PendingCommand = {
  file: string;
  type: "pin-issue" | "retry-issue" | "resolve-question" | "edit-spec" | "approve-spec";
  createdAt: string;
  issueId?: string;
  backlogId?: string;
  questionId?: string;
  pinned?: boolean;
  answer?: string;
};

export type ProcessedCommand = PendingCommand & { status: "applied" | "rejected"; reason?: string; processedAt: string };

export type Requirement = {
  id: string;
  fileName: string;
  title: string;
  primaryRepository: string;
  requestType: string;
  sourceIds: string[];
  dependencies: string[];
  status: ItemStatus;
  priority: string | null;
  priorityRationale: string;
  issues: string[];
  requestMarkdown: string;
  specMarkdown: string | null;
  specStatus: string | null;
  specEditedByHuman: boolean;
  approval: { type: string; approved_at: string } | null;
  humanApprovalRequested: boolean;
  questions: Question[];
  answers: Record<string, string>;
  reviewFindings: Array<{ severity?: string; text?: string }>;
  canEditSpec: boolean;
};

export type Issue = {
  id: string;
  backlogId: string;
  title: string;
  primaryRepository: string;
  priority: string;
  status: string;
  displayStatus: ItemStatus;
  pinned: boolean;
  dependencies: string[];
  acceptanceCriteria: string[];
  markdown: string;
  attempt: number | null;
  branch: string | null;
  commitSha: string | null;
  mrPath: string | null;
};

export type RunInfo = {
  id: string;
  phase: string;
  activeBacklogId: string | null;
  activeIssueIds: string[];
  pause: { reason?: string; details?: unknown; paused_at?: string } | null;
  updatedAt: string | null;
};

export type DashboardData = {
  run: RunInfo | null;
  requirements: {
    summary: { registered: number; approved: number; needsHuman: number; inProgress: number };
    ready: Requirement[];
    completed: Requirement[];
  };
  issues: {
    summary: { registered: number; mergeCreated: number; needsHuman: number; inProgress: number };
    ready: Issue[];
    completed: Issue[];
  };
  pendingCommands: PendingCommand[];
  recentlyRejected: ProcessedCommand[];
};

export type StepState = "done" | "running" | "waiting" | "pending";

export type Step = { key: string; label: string; state: StepState; detail?: string };

export type StageLog = {
  id: string;
  runId: string;
  label: string;
  model: string | null;
  sessionId: string | null;
  exitCode: number | null;
  completedAt: string | null;
  running: boolean;
};

export type StageContent = { id: string; input: string; output: string; logs: Array<{ path: string; content: string }> };

export type RequirementDetail = { requirement: Requirement; issues: Issue[]; steps: Step[]; stages: StageLog[] };

export type IssueDetail = { issue: Issue; steps: Step[]; stages: StageLog[] };

export type DashboardCommand =
  | { type: "pin-issue"; issueId: string; pinned: boolean }
  | { type: "retry-issue"; issueId: string }
  | { type: "resolve-question"; backlogId: string; questionId: string; answer: string }
  | { type: "edit-spec"; backlogId: string; markdown: string }
  | { type: "approve-spec"; backlogId: string };
