import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { HARNESS_DIR, MAX_REVIEW_ITERATIONS } from './config.mjs';
import { atomicWrite, sha256 } from './util.mjs';

// The dashboard never writes run state directly: the running orchestrator keeps state in memory and would
// overwrite it. It drops command files here instead, and the orchestrator applies them at checkpoints.
export const COMMANDS_DIR = path.join(HARNESS_DIR, 'commands');

// Stable id for a human question so answers survive Spec regeneration with the same wording.
export function questionId(text) {
  return sha256(text).slice(0, 16);
}

// Models may return an UNRESOLVED item as a string or as { question, options }.
export function normalizeQuestion(entry, source) {
  const text = typeof entry === 'string' ? entry : String(entry?.question ?? entry?.text ?? JSON.stringify(entry));
  const options = Array.isArray(entry?.options) ? entry.options.map(String).filter(Boolean).slice(0, 6) : [];
  return { id: questionId(text), text, options, source };
}

export function pendingQuestions(record) {
  const answers = record?.unresolved_resolutions ?? {};
  return (record?.unresolved_questions ?? []).filter((question) => !answers[question.id]?.trim());
}

// Applies one dashboard command to run state. Returns { status: 'applied' | 'rejected', reason? }.
export function applyCommand(state, command) {
  const reject = (reason) => ({ status: 'rejected', reason });
  switch (command.type) {
    case 'pin-issue': {
      const issue = state.issues?.[command.issue_id];
      if (!issue) return reject(`Unknown issue ${command.issue_id}.`);
      issue.pinned = Boolean(command.pinned);
      return { status: 'applied' };
    }
    case 'retry-issue': {
      // After REVIEW_LIMIT: allow another MAX_REVIEW_ITERATIONS iterations, keeping the worktree and review feedback.
      const issue = state.issues?.[command.issue_id];
      if (!issue) return reject(`Unknown issue ${command.issue_id}.`);
      const limit = issue.max_attempts ?? MAX_REVIEW_ITERATIONS;
      if (issue.status !== 'REWORK_REQUIRED' || (issue.attempt ?? 0) < limit) return reject('Only an issue that used all its review iterations can be retried.');
      issue.max_attempts = limit + MAX_REVIEW_ITERATIONS;
      return { status: 'applied' };
    }
    case 'resolve-question': {
      // Questions live on the backlog record (Spec) or on an issue record (plan, implementation, review).
      const record = command.issue_id ? state.issues?.[command.issue_id] : state.backlog?.[command.backlog_id];
      const question = record?.unresolved_questions?.find((item) => item.id === command.question_id);
      const answer = String(command.answer ?? '').trim();
      if (!question) return reject(`Unknown question ${command.question_id} for ${command.issue_id ?? command.backlog_id}.`);
      if (!answer) return reject('Answer is empty.');
      record.unresolved_resolutions = { ...(record.unresolved_resolutions ?? {}), [question.id]: answer };
      return { status: 'applied' };
    }
    case 'edit-spec': {
      const record = state.backlog?.[command.backlog_id];
      const markdown = String(command.markdown ?? '').trim();
      if (!record?.spec_markdown) return reject(`No Spec exists for ${command.backlog_id}.`);
      if (record.issue_ids?.length || record.status === 'COMPLETED') return reject('The Spec was already split into issues and can no longer be edited.');
      if (!markdown) return reject('Spec is empty.');
      record.spec_markdown = markdown;
      record.spec_edited_by_human = true;
      record.spec_status = 'SPEC_REVIEW_PENDING';
      if (record.status === 'SPEC_APPROVED') record.status = 'INDEXED';
      // An edit cancels an earlier approval request: the changed Spec must be reviewed or approved again.
      delete record.approval;
      delete record.human_approval;
      return { status: 'applied' };
    }
    case 'approve-spec': {
      const record = state.backlog?.[command.backlog_id];
      if (!record?.spec_markdown) return reject(`No Spec exists for ${command.backlog_id}.`);
      if (record.spec_status === 'SPEC_APPROVED') return reject('The Spec is already approved.');
      const pending = pendingQuestions(record);
      if (pending.length) return reject(`Answer the ${pending.length} open question(s) before approving.`);
      record.human_approval = { requested_at: command.created_at ?? new Date().toISOString() };
      return { status: 'applied' };
    }
    default:
      return reject(`Unknown command type ${command.type}.`);
  }
}

// Applies every pending command file in creation order and archives it with its result.
// Returns the applied commands so the caller can persist the touched records.
export async function applyDashboardCommands(state, directory = COMMANDS_DIR) {
  let names;
  try {
    names = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  } catch {
    return [];
  }
  const archive = path.join(directory, 'processed');
  await mkdir(archive, { recursive: true });
  const results = [];
  for (const name of names) {
    const source = path.join(directory, name);
    let command;
    try {
      command = JSON.parse(await readFile(source, 'utf8'));
    } catch {
      command = { type: 'invalid' };
    }
    const result = applyCommand(state, command);
    await atomicWrite(path.join(archive, name), `${JSON.stringify({ ...command, ...result, processed_at: new Date().toISOString() }, null, 2)}\n`);
    await rm(source, { force: true });
    results.push({ command, ...result });
  }
  return results;
}
