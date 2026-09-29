import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { runProcess } from '../lib/util.mjs';
import { carryOverCompleted, isRepositoryTestPath, modelStage, StagePauseError } from '../lib/pipeline.mjs';

// A stand-in for `claude -p --output-format json`: replies from a script of responses, one per call.
async function fakeClaude(dir, replies) {
  const counter = path.join(dir, 'calls.txt');
  const script = path.join(dir, 'fake-claude.mjs');
  await writeFile(script, `
import { appendFileSync, readFileSync } from 'node:fs';
let calls = 0;
try { calls = readFileSync(${JSON.stringify(counter)}, 'utf8').length; } catch {}
appendFileSync(${JSON.stringify(counter)}, 'x');
const replies = ${JSON.stringify(replies)};
process.stdin.resume();
process.stdin.on('end', () => {
  process.stdout.write(JSON.stringify({ type: 'result', result: replies[Math.min(calls, replies.length - 1)], session_id: 'fake-' + calls }));
});
`);
  if (process.platform !== 'win32') return { bin: script, counter, shebang: true };
  const bin = path.join(dir, 'claude.cmd');
  await writeFile(bin, `@"${process.execPath}" "${script}" %*\r\n`);
  return { bin, counter };
}

async function withFakeClaude(replies, run) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'harness-stage-'));
  const previous = process.env.CLAUDE_BIN;
  try {
    const fake = await fakeClaude(dir, replies);
    if (fake.shebang) {
      await writeFile(fake.bin, `#!${process.execPath}\n${await readFile(fake.bin, 'utf8')}`, { mode: 0o755 });
    }
    process.env.CLAUDE_BIN = fake.bin;
    await run(dir, async () => (await readFile(fake.counter, 'utf8')).length);
  } finally {
    if (previous === undefined) delete process.env.CLAUDE_BIN;
    else process.env.CLAUDE_BIN = previous;
    await rm(dir, { recursive: true, force: true });
  }
}

test('runProcess runs Windows batch files with quoted arguments', { skip: process.platform !== 'win32' }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'harness-batch-'));
  try {
    const script = path.join(dir, 'args.cjs');
    await writeFile(script, 'console.log(JSON.stringify(process.argv.slice(2)));');
    const bin = path.join(dir, 'args.cmd');
    await writeFile(bin, `@"${process.execPath}" "${script}" %*\r\n`);
    const result = await runProcess(bin, ['plain', 'with space', 'quote"inside']);
    assert.equal(result.code, 0);
    assert.deepEqual(JSON.parse(result.stdout), ['plain', 'with space', 'quote"inside']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a stage that keeps ignoring the JSON schema pauses after three answers', { timeout: 60_000 }, () =>
  withFakeClaude(['not json'], async (dir, calls) => {
    await assert.rejects(
      modelStage({ runDir: dir, stage: 'specs/BL-x', model: 'sonnet', prompt: 'p' }),
      (error) => error instanceof StagePauseError && error.reason === 'UNRESOLVED' && error.details.stage === 'specs/BL-x'
        && error.details.last_output === path.join(dir, 'specs/BL-x/retry-3', 'output.md'),
    );
    assert.equal(await calls(), 3);
  }));

test('a stage recovers when a retry returns valid JSON', { timeout: 60_000 }, () =>
  withFakeClaude(['not json', '```json\n{"ok":true}\n```'], async (dir, calls) => {
    const response = await modelStage({ runDir: dir, stage: 'specs/BL-y', model: 'sonnet', prompt: 'p' });
    assert.deepEqual(response.data, { ok: true });
    assert.equal(await calls(), 2);
  }));

test('a new run carries over completed backlog items and their issues only', () => {
  const previous = {
    run_id: 'run-a',
    backlog: { 'BL-done': { status: 'COMPLETED', issue_ids: ['BL-done--x'] }, 'BL-open': { status: 'WAITING_FOR_HUMAN', issue_ids: [] } },
    issues: { 'BL-done--x': { status: 'MR_READY', commit_sha: 'abc' }, 'BL-open--y': { status: 'READY' } },
  };
  const next = carryOverCompleted(previous, { run_id: 'run-b', backlog: {}, issues: {} });
  assert.deepEqual(Object.keys(next.backlog), ['BL-done']);
  assert.deepEqual(Object.keys(next.issues), ['BL-done--x']);
  assert.equal(next.backlog['BL-done'].carried_from_run, 'run-a');
  assert.equal(next.issues['BL-done--x'].carried_from_run, 'run-a');
  // Carried records keep pointing at the run that produced them.
  assert.equal(carryOverCompleted(next, { run_id: 'run-c', backlog: {}, issues: {} }).backlog['BL-done'].carried_from_run, 'run-a');
});

test('only test sources of the issue repository may be updated outside the plan allowlist', () => {
  assert.equal(isRepositoryTestPath('apps/api/src/test/kotlin/x/AdminAccessRulesTests.kt', 'apps'), true);
  assert.equal(isRepositoryTestPath('apps/api/src/main/kotlin/x/AdminRouteRoles.kt', 'apps'), false);
  assert.equal(isRepositoryTestPath('admin/src/lib/auth/session.test.ts', 'admin'), true);
  assert.equal(isRepositoryTestPath('admin/src/lib/auth/session.ts', 'admin'), false);
  assert.equal(isRepositoryTestPath('web/src/app/page.spec.tsx', 'admin'), false);
  assert.equal(isRepositoryTestPath('e2e/tests/login.spec.ts', 'e2e'), true);
});
