import path from 'node:path';
import { runProcess } from './util.mjs';

export async function git(root, args, options = {}) {
  const result = await runProcess('git', args, { cwd: root, timeoutMs: options.timeoutMs ?? 60_000 });
  if (result.code !== 0 && !options.allowFailure) {
    throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  }
  return result;
}

export async function getGitBase(root) {
  const result = await git(root, ['rev-parse', '--verify', 'HEAD'], { allowFailure: true });
  return result.code === 0 ? result.stdout.trim() : null;
}

export async function worktreePath(root, issueId) {
  return path.join(root, '.worktrees', issueId);
}
