import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCommand, applyDashboardCommands, normalizeQuestion, pendingQuestions } from '../lib/commands.mjs';

const question = normalizeQuestion({ question: 'Logout for revoked sessions?', options: ['204', '403'] }, 'approval');

function state() {
  return {
    backlog: {
      'BL-a': { status: 'WAITING_FOR_HUMAN', spec_status: 'WAITING_FOR_HUMAN', spec_markdown: '# Spec', unresolved_questions: [question] },
      'BL-done': { status: 'ISSUES_READY', spec_status: 'SPEC_APPROVED', spec_markdown: '# Spec', issue_ids: ['BL-done--x'] },
    },
    issues: { 'BL-done--x': { status: 'READY', pinned: false } },
  };
}

test('questions keep a stable id and optional choices', () => {
  assert.deepEqual(normalizeQuestion('Plain question?', 'spec'), { id: normalizeQuestion('Plain question?', 'x').id, text: 'Plain question?', options: [], source: 'spec' });
  assert.deepEqual(question.options, ['204', '403']);
});

test('answers, then approval; approval is refused while questions are open', () => {
  const current = state();
  assert.deepEqual(applyCommand(current, { type: 'approve-spec', backlog_id: 'BL-a' }), { status: 'rejected', reason: 'Answer the 1 open question(s) before approving.' });
  assert.deepEqual(applyCommand(current, { type: 'resolve-question', backlog_id: 'BL-a', question_id: question.id, answer: ' 204 ' }), { status: 'applied' });
  assert.equal(current.backlog['BL-a'].unresolved_resolutions[question.id], '204');
  assert.deepEqual(pendingQuestions(current.backlog['BL-a']), []);
  assert.equal(applyCommand(current, { type: 'approve-spec', backlog_id: 'BL-a', created_at: 't' }).status, 'applied');
  assert.deepEqual(current.backlog['BL-a'].human_approval, { requested_at: 't' });
});

test('Spec edits are accepted until the Spec is split into issues', () => {
  const current = state();
  assert.equal(applyCommand(current, { type: 'edit-spec', backlog_id: 'BL-a', markdown: '# Edited' }).status, 'applied');
  assert.equal(current.backlog['BL-a'].spec_markdown, '# Edited');
  assert.equal(current.backlog['BL-a'].spec_edited_by_human, true);
  assert.equal(current.backlog['BL-a'].spec_status, 'SPEC_REVIEW_PENDING');
  assert.equal(applyCommand(current, { type: 'edit-spec', backlog_id: 'BL-done', markdown: '# Late' }).status, 'rejected');
  current.backlog['BL-a'].unresolved_questions = [];
  applyCommand(current, { type: 'approve-spec', backlog_id: 'BL-a' });
  applyCommand(current, { type: 'edit-spec', backlog_id: 'BL-a', markdown: '# Edited again' });
  assert.equal(current.backlog['BL-a'].human_approval, undefined);
});

test('pins toggle and unknown targets are rejected', () => {
  const current = state();
  assert.equal(applyCommand(current, { type: 'pin-issue', issue_id: 'BL-done--x', pinned: true }).status, 'applied');
  assert.equal(current.issues['BL-done--x'].pinned, true);
  assert.equal(applyCommand(current, { type: 'pin-issue', issue_id: 'nope', pinned: true }).status, 'rejected');
  assert.equal(applyCommand(current, { type: 'resolve-question', backlog_id: 'BL-a', question_id: 'nope', answer: 'x' }).status, 'rejected');
});

test('an issue that hit the review limit gets three more iterations', () => {
  const current = state();
  current.issues['BL-done--x'] = { status: 'REWORK_REQUIRED', attempt: 3 };
  assert.equal(applyCommand(current, { type: 'retry-issue', issue_id: 'BL-done--x' }).status, 'applied');
  assert.equal(current.issues['BL-done--x'].max_attempts, 6);
  assert.equal(applyCommand(current, { type: 'retry-issue', issue_id: 'BL-done--x' }).status, 'rejected');
});

test('a retry can carry owner guidance as an answered decision', () => {
  const current = state();
  current.issues['BL-done--x'] = { status: 'REWORK_REQUIRED', attempt: 3 };
  applyCommand(current, { type: 'retry-issue', issue_id: 'BL-done--x', note: 'Follow api-spec: fields stays empty for 400.' });
  const issue = current.issues['BL-done--x'];
  assert.equal(issue.unresolved_questions.length, 1);
  assert.equal(issue.unresolved_resolutions[issue.unresolved_questions[0].id], 'Follow api-spec: fields stays empty for 400.');
  assert.deepEqual(pendingQuestions(issue), []);
});

test('command files are applied in order and archived with their result', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'harness-commands-'));
  try {
    await writeFile(path.join(dir, '001.json'), JSON.stringify({ type: 'pin-issue', issue_id: 'BL-done--x', pinned: true }));
    await writeFile(path.join(dir, '002.json'), JSON.stringify({ type: 'pin-issue', issue_id: 'BL-done--x', pinned: false }));
    await writeFile(path.join(dir, '003.json'), '{broken');
    const current = state();
    const results = await applyDashboardCommands(current, dir);
    assert.deepEqual(results.map((result) => result.status), ['applied', 'applied', 'rejected']);
    assert.equal(current.issues['BL-done--x'].pinned, false);
    assert.deepEqual((await readdir(dir)).sort(), ['processed']);
    const archived = JSON.parse(await readFile(path.join(dir, 'processed', '003.json'), 'utf8'));
    assert.equal(archived.status, 'rejected');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('answers can target an issue-level question', () => {
  const current = state();
  const issueQuestion = normalizeQuestion('Which stub fixture wins?', 'code-review');
  current.issues['BL-done--x'].unresolved_questions = [issueQuestion];
  assert.equal(applyCommand(current, { type: 'resolve-question', issue_id: 'BL-done--x', question_id: issueQuestion.id, answer: 'Keep the existing stub' }).status, 'applied');
  assert.equal(current.issues['BL-done--x'].unresolved_resolutions[issueQuestion.id], 'Keep the existing stub');
  assert.deepEqual(pendingQuestions(current.issues['BL-done--x']), []);
});
