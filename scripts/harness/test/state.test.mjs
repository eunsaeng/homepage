import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { loadState, saveState, withStateLock, createInitialState } from '../lib/state.mjs';

test('state writes atomically and reloads', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'harness-state-'));
  try {
    const state = createInitialState();
    await saveState(state, temp);
    const restored = await loadState(temp);
    assert.equal(restored.run_id, state.run_id);
    assert.equal(restored.phase, 'INITIALIZED');
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test('state lock excludes a concurrent runner and releases after completion', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'harness-lock-'));
  try {
    await withStateLock(async () => {
      await assert.rejects(() => withStateLock(async () => {}, temp), /already owns state lock/);
    }, temp);
    await withStateLock(async () => 'ok', temp);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
