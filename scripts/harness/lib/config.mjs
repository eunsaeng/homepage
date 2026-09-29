import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(here, '../../..');
export const REQUIREMENTS_DIR = path.join(ROOT, 'requirements');
export const DEFERRED_REQUIREMENTS_DIR = path.join(REQUIREMENTS_DIR, 'deferred');
export const WIKI_DIR = path.join(ROOT, 'wiki');
export const HARNESS_DIR = path.join(ROOT, '.harness');
export const STATE_DIR = path.join(HARNESS_DIR, 'state');
export const RUNS_DIR = path.join(HARNESS_DIR, 'runs');
export const WORKTREES_DIR = path.join(ROOT, '.worktrees');
export const MAX_REVIEW_ITERATIONS = 3;
export const REPOSITORIES = ['apps', 'web', 'admin', 'e2e'];

export const MODELS = Object.freeze({
  backlogIndex: 'sonnet',
  backlogSelect: 'sonnet',
  bootstrap: 'sonnet',
  spec: 'opus',
  specApproval: 'sonnet',
  issues: 'opus',
  issueDag: 'haiku',
  readySelect: 'sonnet',
  implementationPlan: 'opus',
  planReview: 'sonnet',
  implement: 'sonnet',
  testPlan: 'haiku',
  codeReview: 'sonnet',
  localMr: 'haiku',
});

export const TEST_COMMANDS = Object.freeze({
  apps: ['apps:test'],
  web: ['web:typecheck', 'web:build'],
  admin: ['admin:typecheck', 'admin:build'],
  e2e: ['e2e:test'],
});
