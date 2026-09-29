import os from 'node:os';
import path from 'node:path';
import { mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { STATE_DIR } from './config.mjs';
import { atomicWrite, newId, writeJson } from './util.mjs';

const pendingWrites = new Map();

export function createInitialState() {
  const now = new Date().toISOString();
  return {
    schema_version: 1,
    run_id: newId(),
    phase: 'INITIALIZED',
    active_backlog_id: null,
    active_issue_ids: [],
    backlog_cursor: 0,
    backlog: {},
    issues: {},
    repo_lanes: {},
    started_at: now,
    updated_at: now,
  };
}

export async function loadState(stateDir = STATE_DIR) {
  try {
    return JSON.parse(await readFile(path.join(stateDir, 'run.json'), 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function saveState(state, stateDir = STATE_DIR) {
  const statePath = path.join(stateDir, 'run.json');
  const previous = pendingWrites.get(statePath) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    state.updated_at = new Date().toISOString();
    await writeJson(statePath, state);
  });
  pendingWrites.set(statePath, next);
  try {
    await next;
  } finally {
    if (pendingWrites.get(statePath) === next) pendingWrites.delete(statePath);
  }
}

export async function saveIssueState(issueId, value, stateDir = STATE_DIR) {
  const issueDir = path.join(stateDir, 'issues');
  await mkdir(issueDir, { recursive: true });
  await writeJson(path.join(issueDir, `${issueId}.json`), value);
}

export async function withStateLock(action, stateDir = STATE_DIR) {
  await mkdir(stateDir, { recursive: true });
  const lockPath = path.join(stateDir, 'lock');
  let handle;
  try {
    handle = await open(lockPath, 'wx');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const lock = JSON.parse(await readFile(lockPath, 'utf8').catch(() => '{}'));
    const ageMs = Date.now() - Date.parse(lock.heartbeat_at ?? lock.started_at ?? 0);
    const sameHost = lock.hostname === os.hostname();
    let alive = true;
    if (sameHost && Number.isInteger(lock.pid)) {
      try { process.kill(lock.pid, 0); } catch { alive = false; }
    }
    if (alive || ageMs < 15 * 60 * 1000) {
      throw new Error(`Harness run already owns state lock (pid ${lock.pid ?? 'unknown'}).`);
    }
    await rename(lockPath, `${lockPath}.stale-${Date.now()}`);
    handle = await open(lockPath, 'wx');
  }

  const lockData = { pid: process.pid, hostname: os.hostname(), started_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() };
  const heartbeat = setInterval(async () => {
    lockData.heartbeat_at = new Date().toISOString();
    await atomicWrite(lockPath, `${JSON.stringify(lockData)}\n`).catch(() => {});
  }, 30_000);
  try {
    await handle.write(`${JSON.stringify(lockData)}\n`);
    await handle.close();
    return await action();
  } finally {
    clearInterval(heartbeat);
    await rm(lockPath, { force: true });
  }
}
