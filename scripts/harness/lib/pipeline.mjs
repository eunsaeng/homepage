import { createServer } from 'node:net';
import { access, mkdir, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MAX_REVIEW_ITERATIONS, MODELS, REPOSITORIES, REQUIREMENTS_DIR, ROOT, RUNS_DIR, STATE_DIR, TEST_COMMANDS, WIKI_DIR, WORKTREES_DIR } from './config.mjs';
import { loadBacklog } from './backlog.mjs';
import { runClaudeStage } from './claude-session.mjs';
import { PROMPTS } from './prompts.mjs';
import { getGitBase, git } from './git.mjs';
import { buildWikiExcerpts, excerptsToMarkdown, indexWiki } from './wiki-context.mjs';
import { applyWikiEdits } from './wiki-patch.mjs';
import { applyDashboardCommands, normalizeQuestion, pendingQuestions } from './commands.mjs';
import { createInitialState, loadState, saveIssueState, saveState, withStateLock } from './state.mjs';
import { appendJsonLine, atomicWrite, ensureDir, newId, parseJsonPayload, runProcess, safeId, sha256, writeStageMarkdown } from './util.mjs';

const priorityRank = { P0: 0, P1: 1, P2: 2, P3: 3 };
const commitIdentity = ['-c', 'user.name=Homepage Harness', '-c', 'user.email=harness@localhost'];
let activeState = null;

const MAX_SCHEMA_FAILURES = 3;
const SPEC_FIELDS = ['spec_markdown', 'spec_status', 'spec_path', 'unresolved_questions', 'unresolved_resolutions', 'appended_resolution_ids', 'human_approval', 'review_findings', 'approval'];

// The model answered but not in the requested JSON shape; retried a few times, then treated as a human decision.
class StageSchemaError extends Error {}

// Thrown from deep inside a stage to stop the run with an alert; runHarness turns it into pause().
export class StagePauseError extends Error {
  constructor(reason, details) {
    super(typeof details === 'string' ? details : details.message);
    this.reason = reason;
    this.details = details;
  }
}

function jsonData(output, stage) {
  try { return parseJsonPayload(output); }
  catch (error) { throw new StageSchemaError(`${stage} must return a fenced JSON object: ${error.message}`); }
}

function stageInput(title, sections) {
  return [`# ${title}`, '', ...sections.flatMap(([heading, body]) => [`## ${heading}`, '', body || '(none)', ''])].join('\n');
}

export async function modelStage({ runDir, stage, model, prompt, cwd = runDir, edits = false, readOnly = false, disallowedTools, parseJson = true }) {
  if (activeState) {
    activeState.active_stages ??= {};
    activeState.active_stages[stage] = { model, status: 'RUNNING', started_at: new Date().toISOString() };
    await saveState(activeState);
  }
  let attempt = 0;
  let schemaFailures = 0;
  while (true) {
    attempt += 1;
    const callStage = attempt === 1 ? stage : `${stage}/retry-${attempt}`;
    try {
      const response = await runClaudeStage({ runDir, stage: callStage, model, input: prompt, cwd, edits, readOnly, disallowedTools });
      const data = parseJson ? jsonData(response.output, callStage) : null;
      if (activeState) {
        activeState.active_stages[stage] = { model, status: 'COMPLETE', session_id: response.record.session_id, attempts: attempt, completed_at: new Date().toISOString() };
        activeState.last_completed_stage = stage;
        activeState.claude_session_ids ??= [];
        if (!activeState.claude_session_ids.includes(response.record.session_id)) activeState.claude_session_ids.push(response.record.session_id);
        await saveState(activeState);
      }
      return { ...response, data };
    } catch (error) {
      if (error instanceof StageSchemaError) {
        schemaFailures += 1;
        if (schemaFailures >= MAX_SCHEMA_FAILURES) {
          if (activeState) {
            activeState.active_stages[stage] = { model, status: 'FAILED', attempts: attempt, last_error: error.message };
            await saveState(activeState);
          }
          throw new StagePauseError('UNRESOLVED', {
            message: `Stage ${stage} returned output that does not match the requested JSON schema ${schemaFailures} times.`,
            stage,
            last_output: path.join(runDir, callStage, 'output.md'),
            error: error.message,
          });
        }
      }
      // Schema errors retry quickly; process/network errors back off up to five minutes.
      const delayMs = error instanceof StageSchemaError ? 1_000 : Math.min(1_000 * (2 ** Math.min(attempt - 1, 8)), 5 * 60 * 1_000);
      if (activeState) {
        activeState.active_stages[stage] = { model, status: 'RETRYING', attempts: attempt, last_error: error.message, next_retry_at: new Date(Date.now() + delayMs).toISOString() };
        await saveState(activeState);
      }
      await appendJsonLine(path.join(runDir, 'logs', 'controller.jsonl'), { stage, model, attempt, status: 'RETRYING', error: error.message, retry_in_ms: delayMs });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

// Applies dashboard commands (pins, answers, Spec edits and approvals) to the in-memory state.
async function applyCommandsAtCheckpoint(state) {
  const results = await applyDashboardCommands(state);
  if (!results.length) return;
  for (const result of results) {
    if (result.status === 'applied' && result.command.type === 'pin-issue') await saveIssueState(result.command.issue_id, state.issues[result.command.issue_id]);
  }
  await saveState(state);
}

async function writeNamedArtifact(runDir, relativePath, markdown) {
  const filePath = path.join(runDir, relativePath);
  await ensureDir(path.dirname(filePath));
  await atomicWrite(filePath, `${markdown.trim()}\n`);
  return filePath;
}

function priority(value) {
  return Object.hasOwn(priorityRank, value) ? value : null;
}

function normalizeBacklogDependency(value, knownIds) {
  const text = String(value ?? '').trim();
  const withoutPrefix = text.replace(/^BL-/, '').replace(/^request-/, '').replace(/\.md$/, '');
  const id = text.startsWith('BL-') ? text : `BL-${withoutPrefix}`;
  return knownIds.has(id) ? id : null;
}

function topoSort(items, dependencyMap, idOf) {
  const visited = new Set();
  const active = new Set();
  const output = [];
  const visit = (id) => {
    if (visited.has(id)) return;
    if (active.has(id)) throw new Error(`Dependency cycle detected at ${id}`);
    active.add(id);
    for (const dependency of dependencyMap.get(id) ?? []) visit(dependency);
    active.delete(id);
    visited.add(id);
    output.push(id);
  };
  for (const item of items) visit(idOf(item));
  return output;
}

async function pause(runDir, state, reason, details) {
  state.phase = reason === 'REVIEW_LIMIT' ? 'PAUSED_REVIEW_LIMIT' : 'PAUSED_UNRESOLVED';
  state.pause = { reason, details, paused_at: new Date().toISOString() };
  const alert = [
    '# Harness pause',
    '',
    `- Run: ${state.run_id}`,
    `- Reason: ${reason}`,
    `- Backlog: ${state.active_backlog_id ?? 'n/a'}`,
    `- Issues: ${(state.active_issue_ids ?? []).join(', ') || 'n/a'}`,
    '',
    '## Details',
    '',
    typeof details === 'string' ? details : JSON.stringify(details, null, 2),
    '',
    'Resolve the listed decision in the source artifact, then run `pnpm harness resume`.',
  ].join('\n');
  const alertPath = path.join(path.dirname(runDir), '..', 'alerts', `${state.run_id}-${safeId(reason)}.md`);
  await atomicWrite(alertPath, `${alert}\n`);
  await saveState(state);
  return { paused: true, reason, alertPath };
}

async function bootstrapRepository(runDir, state) {
  const base = await getGitBase(ROOT);
  if (base) return base;

  const inventoryResult = await git(ROOT, ['ls-files', '--others', '--exclude-standard']);
  const inventory = inventoryResult.stdout.split(/\r?\n/).filter(Boolean).sort();
  if (inventory.length === 0) throw new Error('Unborn repository has no files to create a baseline commit.');
  const input = stageInput('Repository bootstrap', [
    ['Git branch', (await git(ROOT, ['branch', '--show-current'])).stdout.trim()],
    ['Untracked file inventory', inventory.map((file) => `- ${file}`).join('\n')],
    ['Policy', 'Return every listed path exactly once in included_paths. Do not invent paths. If ownership/purpose is unclear, put it in unresolved.'],
  ]);
  const stage = await modelStage({ runDir, stage: 'bootstrap', model: MODELS.bootstrap, prompt: `${input}\n\nReturn JSON exactly: {"included_paths":["..."],"unresolved":[],"rationale":"..."}.` });
  await writeNamedArtifact(runDir, 'bootstrap/baseline-manifest.md', `# Baseline manifest\n\n${stage.output}`);
  if (stage.data.unresolved?.length) return pause(runDir, state, 'UNRESOLVED', stage.data.unresolved);
  const selected = [...new Set(stage.data.included_paths ?? [])].sort();
  if (JSON.stringify(selected) !== JSON.stringify(inventory)) {
    return pause(runDir, state, 'UNRESOLVED', { message: 'Bootstrap manifest differs from the exact untracked inventory.', inventory, selected });
  }
  if (selected.some((file) => path.isAbsolute(file) || file.split(/[\\/]/).includes('..') || file.startsWith('.harness/') || file.startsWith('.worktrees/'))) {
    return pause(runDir, state, 'UNRESOLVED', 'Bootstrap manifest contains a path outside the approved workspace.');
  }
  await git(ROOT, ['add', '--', ...selected]);
  const whitespace = await git(ROOT, ['diff', '--cached', '--check'], { allowFailure: true });
  if (whitespace.code !== 0) return pause(runDir, state, 'UNRESOLVED', whitespace.stderr || whitespace.stdout);
  const commit = await git(ROOT, [...commitIdentity, 'commit', '-m', 'chore: bootstrap harness workspace']);
  state.bootstrap_commit = (await git(ROOT, ['rev-parse', 'HEAD'])).stdout.trim();
  await saveState(state);
  return state.bootstrap_commit;
}

async function triageBacklog(runDir, state, items, wikiIndex) {
  const knownIds = new Set(items.map((item) => item.backlogId));
  for (const item of items) {
    const saved = state.backlog[item.backlogId];
    const excerpts = await buildWikiExcerpts(item, wikiIndex);
    const excerptHash = sha256(excerpts.map((excerpt) => `${excerpt.path}:${excerpt.sha256}`).join('\n'));
    if (saved?.source_hash === item.contentHash && saved?.excerpt_hash === excerptHash && saved?.priority && saved?.triage_status === 'READY') continue;
    // The request or its wiki evidence changed (for example after a human answered an UNRESOLVED question in
    // the wiki). A Spec that has not been split into issues yet is regenerated from the new evidence.
    // A Spec edited in the dashboard is kept; the person who edited it owns reconciling it with the new evidence.
    if (saved && saved.status !== 'COMPLETED' && !saved.issue_ids?.length && !saved.spec_edited_by_human && (saved.source_hash !== item.contentHash || saved.excerpt_hash !== excerptHash)) {
      for (const field of SPEC_FIELDS) delete saved[field];
    }
    const excerptMarkdown = excerptsToMarkdown(excerpts);
    const input = stageInput('Backlog triage', [
      ['Backlog ID', item.backlogId],
      ['Source request', item.markdown],
      ['Request metadata', JSON.stringify({ repository: item.primaryRepository, requestType: item.requestType, sourceRequirements: item.sources, dependencies: item.dependencies }, null, 2)],
      ['Relevant wiki excerpts only', excerptMarkdown],
    ]);
    const stage = await modelStage({
      runDir,
      stage: `backlog-index/${item.backlogId}`,
      model: MODELS.backlogIndex,
      prompt: `${PROMPTS.backlogIndex(item, excerptMarkdown)}\n\nUse only the request's priority/dependency ambiguity for unresolved; everything else goes in notes. Carry requirement-level UNRESOLVED forward to Spec creation. Return JSON: {"priority":"P0|P1|P2|P3","rationale":"...","dependencies":["BL-id or request-file.md"],"notes":["..."],"unresolved":[]}.`,
    });
    await writeNamedArtifact(runDir, `backlog-index/${item.backlogId}.md`, stage.output);
    if (stage.data.unresolved?.length) return pause(runDir, state, 'UNRESOLVED', stage.data.unresolved);
    const assignedPriority = priority(stage.data.priority);
    if (!assignedPriority) return pause(runDir, state, 'UNRESOLVED', `Backlog triage returned invalid priority for ${item.backlogId}.`);
    const dependencyInputs = [...item.dependencies, ...(stage.data.dependencies ?? [])];
    const dependencies = [...new Set(dependencyInputs.map((value) => normalizeBacklogDependency(value, knownIds)))];
    if (dependencies.some((value) => value === null)) return pause(runDir, state, 'UNRESOLVED', `Unknown backlog dependency for ${item.backlogId}: ${dependencyInputs.join(', ')}`);
    state.backlog[item.backlogId] = {
      ...(state.backlog[item.backlogId] ?? {}),
      file_name: item.fileName,
      source_hash: item.contentHash,
      excerpt_hash: excerptHash,
      priority: assignedPriority,
      priority_rationale: stage.data.rationale ?? '',
      triage_notes: stage.data.notes ?? [],
      dependencies,
      triage_status: 'READY',
      status: state.backlog[item.backlogId]?.status === 'COMPLETED' ? 'COMPLETED' : 'INDEXED',
      excerpt_manifest: excerpts.map(({ path: sourcePath, heading, startLine, endLine, sha256 }) => ({ path: sourcePath, heading, startLine, endLine, sha256 })),
    };
    await saveState(state);
  }
  const dependencyMap = new Map(items.map((item) => [item.backlogId, state.backlog[item.backlogId].dependencies]));
  try { topoSort(items, dependencyMap, (item) => item.backlogId); }
  catch (error) { return pause(runDir, state, 'UNRESOLVED', error.message); }
  return { paused: false };
}

function nextBacklog(items, state) {
  const pending = items.filter((item) => state.backlog[item.backlogId]?.status !== 'COMPLETED');
  if (pending.length === 0) return null;
  const ready = pending.filter((item) => state.backlog[item.backlogId].dependencies.every((dep) => state.backlog[dep]?.status === 'COMPLETED'));
  ready.sort((a, b) => priorityRank[state.backlog[a.backlogId].priority] - priorityRank[state.backlog[b.backlogId].priority] || a.backlogId.localeCompare(b.backlogId));
  return ready[0] ?? false;
}

async function selectBacklog(runDir, state, items) {
  const deterministic = nextBacklog(items, state);
  if (deterministic === null) return null;
  if (deterministic === false) return pause(runDir, state, 'UNRESOLVED', 'No READY backlog item exists; inspect backlog dependency cycle or blocked predecessor.');
  const candidates = items
    .filter((item) => state.backlog[item.backlogId].status !== 'COMPLETED')
    .filter((item) => state.backlog[item.backlogId].dependencies.every((dep) => state.backlog[dep]?.status === 'COMPLETED'))
    .map((item) => ({ id: item.backlogId, priority: state.backlog[item.backlogId].priority, dependencies: state.backlog[item.backlogId].dependencies }));
  const input = stageInput('Backlog selection', [['READY backlog candidates', JSON.stringify(candidates, null, 2)]]);
  const stage = await modelStage({ runDir, stage: `selection/backlog-${state.backlog_cursor}`, model: MODELS.backlogSelect, prompt: `${PROMPTS.select(candidates)}\n\nThe deterministic controller rank is ${deterministic.backlogId}. Return that id unless a supplied dependency/status proves it is not ready. Schema: {"selected_id":"...","rationale":"..."}.` });
  const selected = candidates.find((candidate) => candidate.id === stage.data.selected_id);
  const chosen = selected?.id === deterministic.backlogId ? selected.id : deterministic.backlogId;
  await writeNamedArtifact(runDir, `selection/backlog-${state.backlog_cursor}/selection.md`, `# Backlog selection\n\n- Selected: ${chosen}\n- Controller rank: ${deterministic.backlogId}\n- Model rationale: ${stage.data.rationale ?? ''}\n- Model candidate accepted: ${selected?.id === deterministic.backlogId}`);
  return items.find((item) => item.backlogId === chosen);
}

async function generateSpec(runDir, state, item, wikiIndex) {
  const record = state.backlog[item.backlogId];
  if (record.spec_status === 'SPEC_APPROVED' && record.spec_markdown) {
    return { paused: false, specMarkdown: record.spec_markdown };
  }
  const excerpts = excerptsToMarkdown(await buildWikiExcerpts(item, wikiIndex));
  let specMarkdown = record.spec_markdown ?? null;
  record.spec_path ??= `specs/${item.backlogId}/spec.md`;
  if (!specMarkdown) {
    const input = stageInput('Spec generation', [
      ['Backlog request', item.markdown],
      ['Backlog priority/dependencies', JSON.stringify({ priority: record.priority, rationale: record.priority_rationale, dependencies: record.dependencies }, null, 2)],
      ['Relevant wiki excerpts only', excerpts],
    ]);
    const stage = await modelStage({ runDir, stage: `specs/${item.backlogId}`, model: MODELS.spec, prompt: `${PROMPTS.spec(item, record.priority, excerpts, record.priority_rationale, record.triage_notes)}\n\nReturn JSON: {"markdown":"# Spec ...","priority":"${record.priority}","dependencies":["BL-id"],"primary_repositories":["apps|web|admin|e2e"],"unresolved":[]}. Do not change priority.` });
    specMarkdown = stage.data.markdown ?? stage.output;
    const questions = [
      ...(item.hasUnresolved ? [normalizeQuestion(item.unresolvedText, 'backlog')] : []),
      ...(stage.data.unresolved ?? []).map((entry) => normalizeQuestion(entry, 'spec')),
    ];
    record.unresolved_questions = [...new Map(questions.map((question) => [question.id, question])).values()];
    record.spec_markdown = specMarkdown;
    record.spec_status = record.unresolved_questions.length ? 'WAITING_FOR_HUMAN' : 'SPEC_REVIEW_PENDING';
    record.spec_path = `specs/${item.backlogId}/spec.md`;
    await writeNamedArtifact(runDir, record.spec_path, specMarkdown);
    await saveState(state);
  }

  // Questions stay on the record so the dashboard can answer them; the run waits until all are answered.
  const waitForHuman = async (newQuestions) => {
    const known = new Map((record.unresolved_questions ?? []).map((question) => [question.id, question]));
    for (const question of newQuestions) if (!known.has(question.id)) known.set(question.id, question);
    record.unresolved_questions = [...known.values()];
    record.status = 'WAITING_FOR_HUMAN';
    record.spec_status = 'WAITING_FOR_HUMAN';
    await saveState(state);
    return pause(runDir, state, 'UNRESOLVED', pendingQuestions(record).map(({ id, text, options, source }) => ({ id, text, options, source })));
  };
  if (pendingQuestions(record).length) return waitForHuman([]);

  // Answers not yet written into the Spec are appended once, so a revised Spec keeps earlier decisions too.
  const appended = new Set(record.appended_resolution_ids ?? []);
  const freshAnswers = (record.unresolved_questions ?? []).filter((question) => !appended.has(question.id));
  if (freshAnswers.length) {
    const heading = specMarkdown.includes('\n## Human decisions\n') ? '' : '\n\n## Human decisions';
    specMarkdown += `${heading}\n\n${freshAnswers.map((question) => `### ${question.text}\n\n${record.unresolved_resolutions[question.id]}`).join('\n\n')}`;
    record.spec_markdown = specMarkdown;
    record.appended_resolution_ids = [...appended, ...freshAnswers.map((question) => question.id)];
    record.spec_status = 'SPEC_REVIEW_PENDING';
    await writeNamedArtifact(runDir, record.spec_path, specMarkdown);
    await saveState(state);
  }

  const approve = async (type) => {
    record.status = 'SPEC_APPROVED';
    record.spec_markdown = specMarkdown;
    record.spec_status = 'SPEC_APPROVED';
    record.approval = { type, approved_at: new Date().toISOString() };
    await writeNamedArtifact(runDir, record.spec_path ?? `specs/${item.backlogId}/spec.md`, specMarkdown);
    await saveState(state);
    return { paused: false, specMarkdown };
  };
  // Approval from the dashboard replaces the automatic review.
  if (record.human_approval) return approve('human');

  for (let reviewAttempt = 1; reviewAttempt <= 3; reviewAttempt += 1) {
    const review = await modelStage({ runDir, stage: `approvals/${item.backlogId}/attempt-${reviewAttempt}`, model: MODELS.specApproval, prompt: `${PROMPTS.specApproval(specMarkdown, item.markdown, excerpts)}\n\nReturn JSON: {"decision":"APPROVE|REQUEST_CHANGES","findings":[],"unresolved":[]}.` });
    await writeNamedArtifact(runDir, `approvals/${item.backlogId}/attempt-${reviewAttempt}/approval-review.md`, review.output);
    if (review.data.unresolved?.length) return waitForHuman(review.data.unresolved.map((entry) => normalizeQuestion(entry, 'approval')));
    if (review.data.decision === 'APPROVE') return approve('automatic');
    if (reviewAttempt === 3) {
      // A person decides: edit the Spec (reviewed again on resume) or approve it as it is.
      record.status = 'WAITING_FOR_HUMAN';
      record.spec_status = 'NEEDS_HUMAN_REVIEW';
      record.review_findings = review.data.findings ?? [];
      await saveState(state);
      return pause(runDir, state, 'UNRESOLVED', { backlog: item.backlogId, message: 'Spec review requested changes three times. Edit or approve the Spec in the dashboard, then resume.', findings: record.review_findings });
    }
    const revisionPrompt = [
      stageInput('Revise Spec', [
        ['Current Spec', specMarkdown],
        ['Independent Review findings', JSON.stringify(review.data.findings ?? [], null, 2)],
        ['Relevant wiki excerpts', excerpts],
      ]),
      `Return JSON: {"markdown":"# Revised Spec ...","priority":"${record.priority}","dependencies":["BL-id"],"primary_repositories":["apps|web|admin|e2e"],"unresolved":[]}.`,
    ].join('\n\n');
    const revision = await modelStage({ runDir, stage: `specs/${item.backlogId}/revision-${reviewAttempt}`, model: MODELS.spec, prompt: revisionPrompt });
    if (revision.data.unresolved?.length) return waitForHuman(revision.data.unresolved.map((entry) => normalizeQuestion(entry, 'spec')));
    specMarkdown = revision.data.markdown;
    record.spec_markdown = specMarkdown;
    await saveState(state);
    await writeNamedArtifact(runDir, `specs/${item.backlogId}/spec.md`, specMarkdown);
  }
  return { paused: false, specMarkdown };
}

async function validateIssues(issues, backlogId) {
  const ids = new Set();
  const normalized = [];
  for (const issue of issues) {
    const localId = safeId(issue.id ?? issue.title);
    const id = `${backlogId}--${localId}`;
    if (ids.has(id)) throw new Error(`Duplicate issue id ${id}`);
    ids.add(id);
    if (!REPOSITORIES.includes(issue.primary_repository)) throw new Error(`Invalid primary repository in ${id}`);
    if (!Array.isArray(issue.acceptance_criteria) || !issue.acceptance_criteria.length) throw new Error(`Issue ${id} has no acceptance criteria`);
    normalized.push({ ...issue, id, local_id: localId, priority: priority(issue.priority) ?? 'P2', dependencies: issue.dependencies ?? [], allowed_paths: issue.allowed_paths ?? [] });
  }
  const localIds = new Map(normalized.map((issue) => [issue.local_id, issue.id]));
  for (const issue of normalized) issue.dependencies = issue.dependencies.map((dependency) => localIds.get(dependency) ?? dependency);
  return normalized;
}

async function createIssues(runDir, state, item, specMarkdown) {
  const predecessorIssues = state.backlog[item.backlogId].dependencies.flatMap((backlogId) => (state.backlog[backlogId]?.issue_ids ?? []).map((issueId) => state.issues[issueId]).filter(Boolean));
  const upstream = predecessorIssues.map((issue) => ({ id: issue.id, repository: issue.primary_repository, status: issue.status, commit: issue.commit_sha, markdown: issue.markdown }));
  const upstreamMarkdown = JSON.stringify(upstream, null, 2);
  const input = stageInput('Development Issue decomposition', [['Approved Spec', specMarkdown], ['Backlog dependencies', JSON.stringify(state.backlog[item.backlogId].dependencies, null, 2)], ['Completed upstream Issues', upstreamMarkdown]]);
  const stage = await modelStage({ runDir, stage: `issues/${item.backlogId}`, model: MODELS.issues, prompt: `${PROMPTS.issues(specMarkdown, upstreamMarkdown)}\n\nReturn JSON: {"issues":[{"id":"slug","title":"...","primary_repository":"apps|web|admin|e2e","priority":"P0|P1|P2|P3","dependencies":["issue-id"],"acceptance_criteria":["..."],"allowed_paths":["..."],"markdown":"# Issue ..."}],"unresolved":[]}.` });
  if (stage.data.unresolved?.length) return pause(runDir, state, 'UNRESOLVED', stage.data.unresolved);
  const issues = await validateIssues(stage.data.issues ?? [], item.backlogId);
  if (!issues.length) return pause(runDir, state, 'UNRESOLVED', `Issue decomposition returned no issues for ${item.backlogId}.`);
  await writeNamedArtifact(runDir, `issues/${item.backlogId}/issues.md`, issues.map((issue) => issue.markdown ?? `# ${issue.title}\n\n${JSON.stringify(issue, null, 2)}`).join('\n\n---\n\n'));
  return { paused: false, issues };
}

function topoIssues(issues, extraEdges = []) {
  const byId = new Map(issues.map((issue) => [issue.id, issue]));
  const edges = new Map(issues.map((issue) => [issue.id, new Set(issue.dependencies.filter((id) => byId.has(id)))]));
  for (const edge of extraEdges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) throw new Error(`DAG references unknown issue: ${edge.from} -> ${edge.to}`);
    edges.get(edge.to).add(edge.from);
  }
  const active = new Set();
  const visited = new Set();
  const order = [];
  const visit = (id) => {
    if (visited.has(id)) return;
    if (active.has(id)) throw new Error(`Issue DAG cycle at ${id}`);
    active.add(id);
    for (const predecessor of edges.get(id)) visit(predecessor);
    active.delete(id);
    visited.add(id);
    order.push(id);
  };
  for (const issue of issues) visit(issue.id);
  return { order, edges: Object.fromEntries([...edges].map(([id, deps]) => [id, [...deps]])) };
}

async function createDag(runDir, state, backlogId, issues) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const stage = await modelStage({ runDir, stage: `dags/${backlogId}/attempt-${attempt}`, model: MODELS.issueDag, prompt: `${PROMPTS.dag(issues)}\n\nReturn JSON: {"edges":[{"from":"issue-id","to":"issue-id"}],"topological_order":["issue-id"],"unresolved":[]}. Use the globally prefixed issue IDs supplied below.\n${issues.map((issue) => `${issue.id} depends on ${issue.dependencies.join(', ') || 'none'}`).join('\n')}` });
    if (stage.data.unresolved?.length) return pause(runDir, state, 'UNRESOLVED', stage.data.unresolved);
    try {
      const dag = topoIssues(issues, stage.data.edges ?? []);
      await writeNamedArtifact(runDir, `dags/${backlogId}/issue-dag.md`, `# Issue DAG\n\n${JSON.stringify({ ...dag, model_topological_order: stage.data.topological_order ?? [] }, null, 2)}`);
      return { paused: false, dag };
    } catch (error) {
      if (attempt === 3) return pause(runDir, state, 'UNRESOLVED', error.message);
    }
  }
  return pause(runDir, state, 'UNRESOLVED', 'Unable to validate issue DAG.');
}

function sortIssueCandidates(issues, issueState = {}) {
  return [...issues].sort((a, b) => Number(Boolean(issueState[b.id]?.pinned)) - Number(Boolean(issueState[a.id]?.pinned)) || priorityRank[a.priority] - priorityRank[b.priority] || a.id.localeCompare(b.id));
}

function globRegex(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '§').replace(/\*/g, '[^/]*').replace(/§/g, '.*');
  return new RegExp(`^${escaped}$`);
}

const isWikiPath = (file) => /^wiki\/[^/]+\.md$/.test(file.replaceAll('\\', '/'));

function pathAllowed(file, patterns) {
  const normalized = file.replaceAll('\\', '/').replace(/^\.\//, '');
  return patterns.some((pattern) => globRegex(pattern.replaceAll('\\', '/')).test(normalized));
}

async function changedPaths(worktree) {
  const diff = await git(worktree, ['diff', '--name-only', 'HEAD']);
  const untracked = await git(worktree, ['ls-files', '--others', '--exclude-standard']);
  return [...new Set(`${diff.stdout}\n${untracked.stdout}`.split(/\r?\n/).map((file) => file.trim()).filter(Boolean))].sort();
}

async function buildDependencyBase(runDir, state, issue) {
  const predecessors = issue.dependencies.map((id) => ({ id, record: state.issues[id] }));
  if (predecessors.some(({ record }) => record?.status !== 'MR_READY' || !record.commit_sha)) {
    return pause(runDir, state, 'UNRESOLVED', `Issue ${issue.id} is missing an accepted predecessor commit.`);
  }
  if (predecessors.length === 0) return { paused: false, baseSha: state.base_sha };
  const commits = predecessors.map(({ record }) => record.commit_sha);
  if (commits.length === 1) return { paused: false, baseSha: commits[0] };

  const signature = sha256(commits.join('\n')).slice(0, 12);
  const integrationKey = `${issue.id}:${signature}`;
  const cached = state.integrations?.[integrationKey];
  if (cached?.commit_sha) return { paused: false, baseSha: cached.commit_sha };
  const integrationBranch = `harness/integration/${safeId(issue.id)}-${signature}`;
  const integrationWorktree = path.join(WORKTREES_DIR, `integration-${safeId(issue.id)}-${signature}`);
  await ensureDir(path.dirname(integrationWorktree));
  try {
    await access(path.join(integrationWorktree, '.git'));
  } catch {
    const branchExists = await git(ROOT, ['show-ref', '--verify', '--quiet', `refs/heads/${integrationBranch}`], { allowFailure: true });
    if (branchExists.code === 0) await git(ROOT, ['worktree', 'add', integrationWorktree, integrationBranch]);
    else await git(ROOT, ['worktree', 'add', '-b', integrationBranch, integrationWorktree, state.base_sha]);
  }

  for (const predecessor of predecessors) {
    const alreadyIncluded = await git(integrationWorktree, ['merge-base', '--is-ancestor', predecessor.record.commit_sha, 'HEAD'], { allowFailure: true });
    if (alreadyIncluded.code === 0) continue;
    const merge = await git(integrationWorktree, [...commitIdentity, 'merge', '--no-ff', '--no-edit', predecessor.record.commit_sha], { allowFailure: true });
    if (merge.code === 0) continue;

    const conflicts = (await git(integrationWorktree, ['diff', '--name-only', '--diff-filter=U'])).stdout.split(/\r?\n/).filter(Boolean);
    if (conflicts.length === 0) return pause(runDir, state, 'UNRESOLVED', { issue: issue.id, predecessor: predecessor.id, error: merge.stderr || merge.stdout });
    const mergePrompt = stageInput('Dependency merge conflict resolution', [
      ['Issue', JSON.stringify({ id: issue.id, title: issue.title, repository: issue.primary_repository }, null, 2)],
      ['Predecessor commits', JSON.stringify(predecessors.map(({ id, record }) => ({ id, commit: record.commit_sha })), null, 2)],
      ['Conflicted paths', conflicts.join('\n')],
      ['Git conflict status', (await git(integrationWorktree, ['status', '--short'])).stdout],
      ['Rule', 'Resolve only the listed merge conflicts. Do not run commands or edit unrelated paths.'],
    ]);
    const resolution = await modelStage({ runDir, stage: `integrations/${safeId(issue.id)}/${signature}/${safeId(predecessor.id)}`, model: MODELS.readySelect, cwd: integrationWorktree, edits: true, parseJson: false, prompt: mergePrompt });
    const remainingMarkers = [];
    for (const conflictPath of conflicts) {
      const content = await readFile(path.join(integrationWorktree, conflictPath), 'utf8').catch(() => '');
      if (/^(?:<<<<<<<|=======|>>>>>>>)(?: |$)/m.test(content)) remainingMarkers.push(conflictPath);
    }
    if (remainingMarkers.length) return pause(runDir, state, 'UNRESOLVED', { issue: issue.id, conflicts: remainingMarkers, resolution: resolution.output });
    await git(integrationWorktree, ['add', '--', ...conflicts]);
    const remaining = (await git(integrationWorktree, ['diff', '--name-only', '--diff-filter=U'])).stdout.split(/\r?\n/).filter(Boolean);
    if (remaining.length) return pause(runDir, state, 'UNRESOLVED', { issue: issue.id, conflicts: remaining, resolution: resolution.output });
    await git(integrationWorktree, [...commitIdentity, 'commit', '--no-edit']);
  }

  const commitSha = (await git(integrationWorktree, ['rev-parse', 'HEAD'])).stdout.trim();
  state.integrations ??= {};
  state.integrations[integrationKey] = { branch: integrationBranch, commit_sha: commitSha, predecessor_commits: commits };
  await saveState(state);
  await git(ROOT, ['worktree', 'remove', integrationWorktree]);
  return { paused: false, baseSha: commitSha };
}

export async function testCommandsFor(repository, worktree, ids) {
  const definitions = {
    'apps:test': { command: 'pwsh.exe', args: ['-NoProfile', '-File', path.join(worktree, 'scripts/gradle-api.ps1'), 'test', '--rerun'] },
    'web:typecheck': { command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args: ['--filter', 'web', 'exec', 'tsc', '--noEmit'] },
    'web:build': { command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args: ['--filter', 'web', 'build'] },
    'admin:typecheck': { command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args: ['--filter', 'admin', 'exec', 'tsc', '--noEmit'] },
    'admin:build': { command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args: ['--filter', 'admin', 'build'] },
    'e2e:test': { command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args: ['test:e2e'], env: { CI: '1' } },
  };
  const results = [];
  for (const id of ids) {
    const definition = definitions[id];
    if (!definition || !TEST_COMMANDS[repository].includes(id)) throw new Error(`Test command ${id} is not allowlisted for ${repository}.`);
    const env = { ...definition.env };
    const database = id === 'e2e:test' ? await createE2eDatabase() : null;
    try {
      if (database) {
        // Playwright starts API, web and admin from this worktree on free ports against a fresh database.
        Object.assign(env, database.env, {
          E2E_WEB_PORT: String(await allocatePort()),
          E2E_ADMIN_PORT: String(await allocatePort()),
          E2E_API_PORT: String(await allocatePort()),
        });
      }
      const result = await runProcess(definition.command, definition.args, { cwd: worktree, env, timeoutMs: 30 * 60 * 1000 });
      results.push({ id, exit_code: result.code, stdout: result.stdout.slice(-12000), stderr: result.stderr.slice(-12000) });
    } finally {
      if (database) await database.drop();
    }
  }
  return results;
}

// E2E runs get their own database in the local PostgreSQL container so parallel lanes and the developer's
// data never share state. A setup failure is an infrastructure error, not a failed verification.
async function createE2eDatabase() {
  const container = process.env.HARNESS_POSTGRES_CONTAINER ?? 'homepage-postgres';
  const user = process.env.DB_USERNAME ?? 'homepage';
  const name = `homepage_e2e_${newId().replaceAll('-', '').slice(0, 12)}`;
  const psql = (tool, ...args) => runProcess('podman', ['exec', container, tool, '-U', user, ...args], { timeoutMs: 60_000 });
  const created = await psql('createdb', name);
  if (created.code !== 0) throw new Error(`Could not create E2E database ${name} in container ${container}: ${created.stderr.trim()}`);
  return {
    env: {
      DB_R2DBC_URL: `r2dbc:postgresql://localhost:5432/${name}`,
      DB_JDBC_URL: `jdbc:postgresql://localhost:5432/${name}`,
    },
    drop: () => psql('dropdb', '--if-exists', '--force', name),
  };
}

async function allocatePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function workerTestIds(repository) {
  return TEST_COMMANDS[repository];
}

async function getDiff(worktree, baseSha) {
  const tracked = await git(worktree, ['diff', `${baseSha}...HEAD`], { allowFailure: true });
  const working = await git(worktree, ['diff', 'HEAD'], { allowFailure: true });
  const untracked = await git(worktree, ['ls-files', '--others', '--exclude-standard']);
  const additions = [];
  for (const file of untracked.stdout.split(/\r?\n/).filter(Boolean)) {
    const content = await readFile(path.join(worktree, file), 'utf8').catch(() => '');
    additions.push(`\n--- new file: ${file} ---\n${content.slice(0, 20_000)}`);
  }
  return `${tracked.stdout}\n${working.stdout}\n${additions.join('\n')}`.slice(0, 250_000);
}

async function ensureWorktree(state, issue, baseSha) {
  const record = state.issues[issue.id] ?? {};
  const worktree = record.worktree ?? path.join(WORKTREES_DIR, issue.id);
  const branch = record.branch ?? `harness/${safeId(issue.id)}`;
  await ensureDir(path.dirname(worktree));
  try {
    await access(path.join(worktree, '.git'));
  } catch {
    const branchExists = await git(ROOT, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { allowFailure: true });
    if (branchExists.code === 0) await git(ROOT, ['worktree', 'add', worktree, branch]);
    else await git(ROOT, ['worktree', 'add', '-b', branch, worktree, baseSha]);
  }
  record.worktree = worktree;
  record.branch = branch;
  record.status = 'WORKTREE_READY';
  state.issues[issue.id] = record;
  await saveState(state);
  const install = await runProcess(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['install', '--offline', '--frozen-lockfile'], { cwd: worktree, timeoutMs: 30 * 60 * 1000 });
  if (install.code !== 0) throw new Error(`Workspace install failed in ${issue.id}: ${install.stderr.slice(-2000)}`);
  return record;
}

// Wiki slices never touch files through Claude: the session proposes section or requirement-line replacements
// from the excerpts it was given, and the controller applies them. Rejected proposals are retried with the errors.
async function applyWikiSlice({ runDir, state, issue, plan, slice, stage, wikiDir, excerptList, wikiExcerpts, feedback }) {
  let rejected = '';
  for (let proposal = 1; proposal <= MAX_SCHEMA_FAILURES; proposal += 1) {
    const proposalStage = proposal === 1 ? stage : `${stage}/proposal-${proposal}`;
    const response = await modelStage({
      runDir,
      stage: proposalStage,
      model: MODELS.implement,
      readOnly: true,
      prompt: PROMPTS.wikiEdit(issue, plan.markdown ?? '', slice, wikiExcerpts, [feedback, rejected].filter(Boolean).join('\n\n')),
    });
    if (response.data.unresolved?.length) return pause(runDir, state, 'UNRESOLVED', response.data.unresolved);
    const edits = { sections: response.data.sections ?? [], requirementLines: response.data.requirement_lines ?? [] };
    const touched = [...edits.sections.map((edit) => edit.path), ...(edits.requirementLines.length ? ['wiki/requirements.md'] : [])];
    const notOwned = [...new Set(touched)].filter((file) => !(slice.paths ?? []).includes(file));
    const result = notOwned.length
      ? { changed: [], errors: notOwned.map((file) => `${file} is not owned by wiki slice ${slice.id}.`) }
      : await applyWikiEdits(wikiDir, edits, excerptList);
    await writeNamedArtifact(runDir, `${proposalStage}/wiki-edit.md`, [
      `# Wiki slice ${slice.id}`,
      '',
      response.data.summary ?? '',
      '',
      `Changed: ${result.changed.join(', ') || '(none)'}`,
      '',
      'Rejected edits:',
      result.errors.map((error) => `- ${error}`).join('\n') || '(none)',
    ].join('\n'));
    if (!result.errors.length) return { paused: false, changed: result.changed };
    rejected = `Rejected edits (fix and resubmit):\n${result.errors.join('\n')}`;
  }
  return pause(runDir, state, 'UNRESOLVED', { issue: issue.id, slice: slice.id, message: `Wiki edits were rejected ${MAX_SCHEMA_FAILURES} times.`, errors: rejected });
}

async function processIssue(runDir, state, issue, specMarkdown, item) {
  const record = state.issues[issue.id] ?? { status: 'READY', attempt: 0 };
  if (record.status === 'MR_READY') return { paused: false };
  const firstAttempt = record.status === 'REWORK_REQUIRED' ? record.attempt + 1 : Math.max(record.attempt || 1, 1);
  if (firstAttempt > MAX_REVIEW_ITERATIONS) return pause(runDir, state, 'REVIEW_LIMIT', { issue: issue.id, attempts: record.attempt, message: 'The issue already used all allowed implementation/review iterations.' });
  const dependencyBase = await buildDependencyBase(runDir, state, issue);
  if (dependencyBase.paused) return dependencyBase;
  const work = await ensureWorktree(state, issue, dependencyBase.baseSha);
  record.base_sha = dependencyBase.baseSha;
  state.issues[issue.id] = record;
  await saveIssueState(issue.id, record);
  await saveState(state);
  const repoCwd = work.worktree;
  const inventory = await git(work.worktree, ['ls-files', issue.primary_repository]);
  // Excerpts come from the worktree so they include wiki changes merged from predecessor issues.
  const wikiDir = path.join(work.worktree, 'wiki');
  let excerptList = await buildWikiExcerpts(item, await indexWiki(wikiDir));
  let wikiExcerpts = excerptsToMarkdown(excerptList);
  const planPrompt = `${PROMPTS.implementationPlan(issue, specMarkdown, wikiExcerpts, inventory.stdout)}\n\nReturn JSON: {"markdown":"# Implementation plan ...","slices":[{"id":"...","kind":"code|wiki","goal":"...","paths":["..."]}],"allowed_paths":["..."] ,"test_ids":["..."],"unresolved":[]}.`;
  let plan;
  let planFeedback = '';
  for (let planAttempt = 1; planAttempt <= 3; planAttempt += 1) {
    const response = await modelStage({ runDir, stage: `issues/${issue.id}/plans/attempt-${planAttempt}`, model: MODELS.implementationPlan, cwd: work.worktree, readOnly: true, disallowedTools: ['Read(wiki/**)', 'Grep(wiki/**)', 'Glob(wiki/**)'], prompt: `${planPrompt}\n\nPlan revision feedback:\n${planFeedback || '(none)'}` });
    if (response.data.unresolved?.length) return pause(runDir, state, 'UNRESOLVED', response.data.unresolved);
    plan = response.data;
    await writeNamedArtifact(runDir, `issues/${issue.id}/plans/implementation-plan.md`, plan.markdown ?? response.output);
    const sliceErrors = [];
    if (!Array.isArray(plan.slices) || plan.slices.length === 0) sliceErrors.push('Plan must contain at least one worker slice.');
    for (const slice of plan.slices ?? []) {
      if (!Array.isArray(slice.paths) || slice.paths.length === 0) sliceErrors.push(`Slice ${slice.id ?? 'unknown'} has no owned paths.`);
      if ((slice.paths?.length ?? 0) > 5) sliceErrors.push(`Slice ${slice.id ?? 'unknown'} owns more than five paths.`);
      const wikiPaths = (slice.paths ?? []).filter(isWikiPath);
      if ((slice.kind ?? 'code') === 'wiki') {
        if (wikiPaths.length !== (slice.paths?.length ?? 0)) sliceErrors.push(`Wiki slice ${slice.id ?? 'unknown'} may only own wiki/*.md paths.`);
      } else if (slice.kind !== undefined && slice.kind !== 'code') {
        sliceErrors.push(`Slice ${slice.id ?? 'unknown'} has unknown kind ${slice.kind}.`);
      } else if (wikiPaths.length) {
        sliceErrors.push(`Code slice ${slice.id ?? 'unknown'} owns wiki paths; move them to a slice of kind "wiki".`);
      }
    }
    const slicePathOwners = new Map();
    for (const slice of plan.slices ?? []) {
      for (const ownedPath of slice.paths ?? []) {
        if (slicePathOwners.has(ownedPath)) sliceErrors.push(`Path ${ownedPath} is owned by multiple slices.`);
        slicePathOwners.set(ownedPath, slice.id);
      }
    }
    if (sliceErrors.length) {
      planFeedback = JSON.stringify(sliceErrors);
      if (planAttempt === 3) return pause(runDir, state, 'UNRESOLVED', { issue: issue.id, planErrors: sliceErrors });
      continue;
    }
    const review = await modelStage({ runDir, stage: `issues/${issue.id}/plans/review-${planAttempt}`, model: MODELS.planReview, prompt: `${PROMPTS.planReview(issue, specMarkdown, plan.markdown ?? response.output, wikiExcerpts)}\n\nReturn JSON: {"decision":"APPROVE|REQUEST_CHANGES","findings":[],"unresolved":[]}.` });
    await writeNamedArtifact(runDir, `issues/${issue.id}/plans/plan-review-${planAttempt}.md`, review.output);
    if (review.data.unresolved?.length) return pause(runDir, state, 'UNRESOLVED', review.data.unresolved);
    if (review.data.decision === 'APPROVE') break;
    if (planAttempt === 3) return pause(runDir, state, 'UNRESOLVED', `Implementation plan for ${issue.id} remains unapproved after three revisions.`);
    planFeedback = JSON.stringify(review.data.findings ?? []);
  }
  const allowedPaths = plan.allowed_paths ?? issue.allowed_paths;
  if (!Array.isArray(allowedPaths) || !allowedPaths.length) return pause(runDir, state, 'UNRESOLVED', `Plan for ${issue.id} has no allowed_paths.`);
  record.allowed_paths = allowedPaths;
  record.primary_repository = issue.primary_repository;
  state.issues[issue.id] = record;
  await saveIssueState(issue.id, record);
  await saveState(state);
  const slices = plan.slices?.length ? plan.slices : [{ id: 'primary', goal: issue.title, paths: allowedPaths }];
  const tests = workerTestIds(issue.primary_repository);

  for (let attempt = firstAttempt; attempt <= MAX_REVIEW_ITERATIONS; attempt += 1) {
    record.attempt = attempt;
    record.status = 'IMPLEMENTING';
    state.issues[issue.id] = record;
    await saveIssueState(issue.id, record);
    await saveState(state);
    for (const slice of slices) {
      const slicePaths = slice.paths?.length ? slice.paths : allowedPaths;
      const sliceStage = `issues/${issue.id}/iterations/${String(attempt).padStart(2, '0')}/implementation/${safeId(slice.id)}`;
      if (slice.kind === 'wiki') {
        const applied = await applyWikiSlice({ runDir, state, issue, plan, slice, stage: sliceStage, wikiDir, excerptList, wikiExcerpts, feedback: record.feedback ?? '' });
        if (applied.paused) return applied;
        excerptList = await buildWikiExcerpts(item, await indexWiki(wikiDir));
        wikiExcerpts = excerptsToMarkdown(excerptList);
      } else {
        const implementation = await modelStage({
          runDir,
          stage: sliceStage,
          model: MODELS.implement,
          cwd: repoCwd,
          edits: true,
          disallowedTools: ['Read(wiki/**)', 'Grep(wiki/**)', 'Glob(wiki/**)', 'Edit(wiki/**)', 'Write(wiki/**)'],
          prompt: `${PROMPTS.implement(issue, plan.markdown ?? '', record.feedback ?? '', record.last_verification ?? '')}\n\nWorker slice ${slice.id}: ${slice.goal}\nAllowed paths: ${slicePaths.join(', ')}\nReturn JSON: {"summary":"...","changed_paths":["..."],"unresolved":[]}.`,
        });
        await writeNamedArtifact(runDir, `issues/${issue.id}/iterations/${attempt}/implementation/${safeId(slice.id)}/implementation.md`, implementation.output);
      }
      const changed = await changedPaths(work.worktree);
      const violations = changed.filter((file) => !pathAllowed(file, [...slicePaths, ...allowedPaths]));
      if (violations.length) return pause(runDir, state, 'UNRESOLVED', { issue: issue.id, message: 'Worker edited paths outside the approved allowlist.', files: violations });
    }

    // Diff against this issue's own base so predecessor commits merged into it are not reviewed again.
    const diff = await getDiff(work.worktree, record.base_sha);
    const testPlan = await modelStage({ runDir, stage: `issues/${issue.id}/iterations/${attempt}/test-plan`, model: MODELS.testPlan, prompt: `${PROMPTS.testPlan(issue, plan.markdown ?? '', diff, tests.map((id) => ({ id })))}\n\nSelect every relevant allowed test id. Return JSON: {"test_ids":["..."],"rationale":"...","concerns":["..."]}.` });
    // The test plan only picks commands; doubts about the change go to the reviewer, since real test results follow.
    const testIds = testPlan.data.test_ids?.length ? testPlan.data.test_ids : tests;
    const invalidTestIds = testIds.filter((id) => !tests.includes(id));
    if (invalidTestIds.length) return pause(runDir, state, 'UNRESOLVED', { issue: issue.id, message: 'Test plan selected commands outside the repository allowlist.', invalidTestIds });
    const testStageKey = `issues/${issue.id}/iterations/${attempt}/verification`;
    const testStageInput = stageInput('Actual Test/Verify', [
      ['Issue acceptance criteria', issue.acceptance_criteria.join('\n')],
      ['Test plan', testPlan.output],
      ['Commands selected from allowlist', testIds.join('\n')],
      ['Worktree', work.worktree],
    ]);
    await writeStageMarkdown(path.join(runDir, 'issues', issue.id, 'iterations', String(attempt), 'verification-stage'), testStageInput, '# Verification running\n');
    state.active_stages ??= {};
    state.active_stages[testStageKey] = { model: MODELS.testPlan, status: 'RUNNING', started_at: new Date().toISOString() };
    await saveState(state);
    const testResults = await testCommandsFor(issue.primary_repository, work.worktree, testIds);
    for (const result of testResults) {
      const logPath = path.join(runDir, 'issues', issue.id, 'iterations', String(attempt), 'test', 'commands', `${safeId(result.id)}.log`);
      await atomicWrite(logPath, `exit_code=${result.exit_code}\n\nSTDOUT\n${result.stdout}\n\nSTDERR\n${result.stderr}`);
      await appendJsonLine(path.join(runDir, 'logs', 'controller.jsonl'), { stage: 'test', issue_id: issue.id, attempt, command_id: result.id, exit_code: result.exit_code, log_path: logPath });
    }
    const testsPassed = testResults.length > 0 && testResults.every((result) => result.exit_code === 0);
    const verificationResults = testResults.map((result) => `## ${result.id}: ${result.exit_code === 0 ? 'PASS' : 'FAIL'}\n\nExit code: ${result.exit_code}\n\n\`\`\`text\n${result.stdout}\n${result.stderr}\n\`\`\``).join('\n\n');
    const testConcerns = (testPlan.data.concerns ?? testPlan.data.unresolved ?? []).map((concern) => `- ${typeof concern === 'string' ? concern : JSON.stringify(concern)}`).join('\n');
    const verification = testConcerns ? `${verificationResults}\n\n## Test plan concerns for review\n\n${testConcerns}` : verificationResults;
    await writeStageMarkdown(path.join(runDir, 'issues', issue.id, 'iterations', String(attempt), 'verification-stage'), testStageInput, verification || 'No test commands were executed.');
    await writeNamedArtifact(runDir, `issues/${issue.id}/iterations/${attempt}/verification.md`, verification);
    state.active_stages[testStageKey] = { model: MODELS.testPlan, status: testResults.every((result) => result.exit_code === 0) ? 'COMPLETE' : 'FAILED', completed_at: new Date().toISOString() };
    state.last_completed_stage = testStageKey;
    await appendJsonLine(path.join(runDir, 'logs', 'controller.jsonl'), { stage: testStageKey, issue_id: issue.id, attempt, exit_codes: testResults.map((result) => result.exit_code) });
    await saveState(state);
    record.last_verification = verification;
    record.status = 'REVIEWING';
    await saveIssueState(issue.id, record);
    await saveState(state);

    // The reviewer may read the worktree (not wiki/) to check code the diff relies on, such as predecessor commits.
    const review = await modelStage({ runDir, stage: `issues/${issue.id}/iterations/${attempt}/review`, model: MODELS.codeReview, cwd: work.worktree, readOnly: true, prompt: `${PROMPTS.codeReview(issue, specMarkdown, plan.markdown ?? '', diff, verification, wikiExcerpts)}\n\nReturn JSON: {"decision":"APPROVE|REQUEST_CHANGES","findings":[],"unresolved":[]}.` });
    await writeNamedArtifact(runDir, `issues/${issue.id}/iterations/${attempt}/review/code-review.md`, review.output);
    if (review.data.unresolved?.length) return pause(runDir, state, 'UNRESOLVED', review.data.unresolved);
    if (!testsPassed || review.data.decision !== 'APPROVE') {
      record.feedback = JSON.stringify({ testsPassed, findings: review.data.findings ?? [] }, null, 2);
      record.status = 'REWORK_REQUIRED';
      if (attempt === MAX_REVIEW_ITERATIONS) {
        return pause(runDir, state, 'REVIEW_LIMIT', { issue: issue.id, review: review.data, verification });
      }
      continue;
    }

    const files = await changedPaths(work.worktree);
    if (files.length === 0) return pause(runDir, state, 'UNRESOLVED', `Issue ${issue.id} passed review but has no changed files.`);
    await git(work.worktree, ['add', '--', ...files]);
    await git(work.worktree, [...commitIdentity, 'commit', '-m', `feat(${issue.primary_repository}): ${issue.id}`]);
    const commitSha = (await git(work.worktree, ['rev-parse', 'HEAD'])).stdout.trim();
    const diffStat = (await git(work.worktree, ['show', '--stat', '--oneline', 'HEAD'])).stdout;
    const mr = await modelStage({ runDir, stage: `issues/${issue.id}/merge-request`, model: MODELS.localMr, prompt: `${PROMPTS.localMr(issue, specMarkdown, plan.markdown ?? '', review.output, verification, diffStat)}\n\nReturn JSON: {"title":"...","markdown":"# Local MR ...","unresolved":[]}. This is local Git only; do not claim remote publication.` });
    if (mr.data.unresolved?.length) return pause(runDir, state, 'UNRESOLVED', mr.data.unresolved);
    const mrPath = await writeNamedArtifact(runDir, `merge-requests/${issue.id}.md`, `${mr.data.markdown ?? mr.output}\n\nSource branch: ${work.branch}\nCommit: ${commitSha}`);
    record.status = 'MR_READY';
    record.commit_sha = commitSha;
    record.mr_path = mrPath;
    record.completed_at = new Date().toISOString();
    state.issues[issue.id] = record;
    await saveIssueState(issue.id, record);
    await saveState(state);
    return { paused: false };
  }
  return pause(runDir, state, 'REVIEW_LIMIT', `Issue ${issue.id} exceeded the review iteration limit.`);
}

async function createSpecIssuesAndRun(runDir, state, item, wikiIndex, allItems) {
  const specResult = await generateSpec(runDir, state, item, wikiIndex);
  if (specResult.paused) return specResult;
  const issueResult = await createIssues(runDir, state, item, specResult.specMarkdown);
  if (issueResult.paused) return issueResult;
  const dagResult = await createDag(runDir, state, item.backlogId, issueResult.issues);
  if (dagResult.paused) return dagResult;
  state.backlog[item.backlogId].issue_ids = issueResult.issues.map((issue) => issue.id);
  state.backlog[item.backlogId].status = 'ISSUES_READY';
  for (const issue of issueResult.issues) {
    const existing = state.issues[issue.id] ?? {};
    state.issues[issue.id] = {
      ...existing,
      id: issue.id,
      backlog_id: item.backlogId,
      title: issue.title,
      primary_repository: issue.primary_repository,
      priority: issue.priority,
      base_priority: existing.base_priority ?? issue.priority,
      dependencies: issue.dependencies,
      acceptance_criteria: issue.acceptance_criteria,
      allowed_paths: issue.allowed_paths,
      markdown: issue.markdown,
      status: existing.status ?? (issue.dependencies.length ? 'BLOCKED' : 'READY'),
      pinned: existing.pinned ?? false,
    };
    await saveIssueState(issue.id, state.issues[issue.id]);
  }
  state.dag_sha = sha256(JSON.stringify(dagResult.dag));
  await saveState(state);

  const currentIssueIds = new Set(issueResult.issues.map((issue) => issue.id));
  const completed = new Set(Object.entries(state.issues).filter(([, record]) => record.status === 'MR_READY').map(([id]) => id));
  while ([...currentIssueIds].some((id) => !completed.has(id))) {
    const ready = issueResult.issues.filter((issue) => !completed.has(issue.id) && issue.dependencies.every((dep) => completed.has(dep)));
    if (!ready.length) return pause(runDir, state, 'UNRESOLVED', `No READY issue remains in DAG ${item.backlogId}.`);
    await applyCommandsAtCheckpoint(state);
    // One issue per repository lane; a pinned issue goes first in its lane without stopping the other lanes.
    const selected = [];
    for (const repository of REPOSITORIES) {
      const candidate = sortIssueCandidates(ready.filter((issue) => issue.primary_repository === repository), state.issues)[0];
      if (candidate) selected.push(candidate);
    }
    const selectionInput = stageInput('READY issue wave', [['Candidates', JSON.stringify(selected.map(({ id, primary_repository, priority, dependencies }) => ({ id, primary_repository, priority, dependencies })), null, 2)]]);
    const waveId = `issues-${state.backlog_cursor}-${completed.size}`;
    const selection = await modelStage({ runDir, stage: `selection/${waveId}`, model: MODELS.readySelect, prompt: `${selectionInput}\nSelect the first priority-ordered issue for each repository lane. Do not choose blocked issues. Return JSON: {"selected":["issue-id"],"rationale":"..."}.` });
    const modelSelected = new Set(selection.data.selected ?? []);
    const worktreePlan = selected.map((issue) => `- ${issue.id}: repo=${issue.primary_repository}, branch=harness/${safeId(issue.id)}, base=${state.base_sha}${modelSelected.has(issue.id) ? '' : ' (controller deterministic selection)'}`).join('\n');
    await writeNamedArtifact(runDir, `selection/${waveId}/worktree-plan.md`, `# READY issue wave\n\n${worktreePlan}`);
    state.active_issue_ids = selected.map((issue) => issue.id);
    await saveState(state);
    // Let every lane reach a checkpoint before stopping, so one lane's pause or error does not orphan the others.
    const settled = await Promise.allSettled(selected.map((issue) => processIssue(runDir, state, issue, specResult.specMarkdown, item)));
    const failure = settled.find((result) => result.status === 'rejected');
    if (failure) throw failure.reason;
    const paused = settled.map((result) => result.value).find((result) => result.paused);
    if (paused) return paused;
    for (const issue of selected) completed.add(issue.id);
    await writeNamedArtifact(runDir, `selection/${waveId}/next-selection.md`, `# Next selection checkpoint\n\nCompleted wave: ${selected.map((issue) => issue.id).join(', ')}\n\nRemaining in DAG: ${[...currentIssueIds].filter((id) => !completed.has(id)).join(', ') || '(none)'}`);
    state.active_issue_ids = [];
    await saveState(state);
  }
  state.backlog[item.backlogId].status = 'COMPLETED';
  state.backlog[item.backlogId].completed_at = new Date().toISOString();
  state.backlog_cursor += 1;
  await saveState(state);
  return { paused: false };
}

export async function runHarness({ resume = false, only = [] } = {}) {
  try {
    return await withStateLock(async () => {
    let state = await loadState();
    if (resume && !state) throw new Error('No state exists. Start with `pnpm harness run`.');
    if (!resume && state && state.phase !== 'QUEUE_DRAINED') {
      throw new Error('An active or paused run exists. Use `pnpm harness resume` or inspect it with `pnpm harness status`.');
    }
    if (!resume || state.phase === 'QUEUE_DRAINED') {
      state = createInitialState();
      // `run --only` limits a trial run to named backlog items; resume keeps the same scope.
      state.only_backlog_ids = only;
    }
    activeState = state;
    await applyCommandsAtCheckpoint(state);
    state.phase = 'RUNNING';
    await saveState(state);
    const runDir = path.join(RUNS_DIR, state.run_id);
    await ensureDir(runDir);
    try {
    const baseSha = await bootstrapRepository(runDir, state);
    if (typeof baseSha !== 'string') return baseSha;
    state.base_sha = baseSha;
    await saveState(state);

    const allItems = await loadBacklog(REQUIREMENTS_DIR);
    const scope = state.only_backlog_ids ?? [];
    const unknown = scope.filter((id) => !allItems.some((item) => item.backlogId === id));
    if (unknown.length) throw new Error(`Unknown backlog id for --only: ${unknown.join(', ')}`);
    const items = scope.length ? allItems.filter((item) => scope.includes(item.backlogId)) : allItems;
    const wikiIndex = await indexWiki(WIKI_DIR);
    state.backlog_snapshot = items.map((item) => ({ id: item.backlogId, file_name: item.fileName, source_hash: item.contentHash }));
    await saveState(state);
    const triage = await triageBacklog(runDir, state, items, wikiIndex);
    if (triage.paused) return triage;

    while (true) {
      await applyCommandsAtCheckpoint(state);
      const item = await selectBacklog(runDir, state, items);
      if (item === null) {
        state.phase = 'QUEUE_DRAINED';
        state.completed_at = new Date().toISOString();
        await saveState(state);
        return { phase: state.phase, run_id: state.run_id };
      }
      if (item?.paused) return item;
      state.active_backlog_id = item.backlogId;
      await saveState(state);
      const result = await createSpecIssuesAndRun(runDir, state, item, wikiIndex, items);
      if (result.paused) return result;
      state.active_backlog_id = null;
      await saveState(state);
    }
    } catch (error) {
      if (error instanceof StagePauseError) return pause(runDir, state, error.reason, error.details);
      throw error;
    }
    });
  } finally {
    activeState = null;
  }
}
