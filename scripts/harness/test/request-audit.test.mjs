import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBacklog } from '../lib/backlog.mjs';
import { DEFERRED_REQUIREMENTS_DIR } from '../lib/config.mjs';
import { auditRequests, fixRequirementCitations, indexRequirementIds } from '../lib/request-audit.mjs';
import { indexWiki } from '../lib/wiki-context.mjs';

const wikiIndex = new Map([['requirements.md', {
  filePath: 'unused',
  headings: [{ level: 1, title: 'Doc', line: 1 }, { level: 2, title: '계정', line: 3 }],
  requirementIds: [
    { id: 'ACC-01', line: 5, heading: '계정' },
    { id: 'ACC-02', line: 6, heading: '계정' },
  ],
}]]);

const request = (fileName, primaryRepository, sources, dependencies = []) => ({
  fileName,
  primaryRepository,
  dependencies,
  hasUnresolved: false,
  sources: sources.map(([requirementId, startLine, endLine, heading = '계정']) => ({ requirementId, heading, path: 'wiki/requirements.md', startLine, endLine })),
});

test('the current backlog satisfies the request generation rules', async () => {
  const items = await loadBacklog();
  const deferred = await loadBacklog(DEFERRED_REQUIREMENTS_DIR);
  const { errors, coverage } = auditRequests(items, deferred, await indexWiki());
  assert.deepEqual(errors, []);
  assert.deepEqual(coverage.find((entry) => entry.requirementId === 'ACC-02').active, []);
});

test('requirement IDs resolve to their section heading and line', () => {
  assert.deepEqual(indexRequirementIds(wikiIndex).get('ACC-02'), { line: 6, heading: '계정', headingLine: 3 });
});

test('audit reports naming, evidence and coverage violations', () => {
  const items = [
    request('request-apps-sync.md', 'apps', [['ACC-01', 3, 5]]),
    request('request-sync-screen.md', 'admin', [['ACC-01', 1, 5, '다른 제목']]),
  ];
  assert.deepEqual(auditRequests(items, [], wikiIndex).errors, [
    'request-sync-screen.md: File name must start with request-admin-.',
    'request-sync-screen.md: ACC-01 heading 「다른 제목」 should be 「계정」.',
    'request-sync-screen.md: ACC-01 range 1-5 should be 3-5.',
    'ACC-01: spans apps, admin without an e2e acceptance request.',
    'ACC-02: not cited by any request.',
  ]);
});

test('audit rejects dependencies that run against apps → admin/web → e2e order', () => {
  const items = [
    request('request-apps-sync.md', 'apps', [['ACC-01', 3, 5], ['ACC-02', 3, 6]], ['request-admin-sync.md']),
    request('request-admin-sync.md', 'admin', [['ACC-01', 3, 5]]),
    request('request-e2e-sync.md', 'e2e', [['ACC-01', 3, 5]], ['request-apps-sync.md', 'request-admin-sync.md']),
  ];
  assert.deepEqual(auditRequests(items, [], wikiIndex).errors, [
    'request-apps-sync.md: apps request must not depend on admin request request-admin-sync.md.',
  ]);
});

test('a requirement cited only by deferred requests is not reported as uncovered', () => {
  const items = [request('request-apps-sync.md', 'apps', [['ACC-01', 3, 5]])];
  const deferred = [request('request-apps-daou.md', 'apps', [['ACC-02', 3, 6]])];
  assert.deepEqual(auditRequests(items, deferred, wikiIndex).errors, []);
});

test('fix rewrites stale citations in active and deferred requests and leaves unknown IDs alone', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'harness-fix-'));
  try {
    const deferred = path.join(root, 'deferred');
    await mkdir(deferred);
    await writeFile(path.join(root, 'request-apps-a.md'), '- `ACC-01` — 「옛 제목」, `wiki/requirements.md` 1-2행\n- `ACC-09` — 「계정」, `wiki/requirements.md` 3-9행\n');
    await writeFile(path.join(root, 'request-apps-b.md'), '- `ACC-01` — 「계정」, `wiki/requirements.md` 3-5행\n');
    await writeFile(path.join(deferred, 'request-apps-c.md'), '- `ACC-02` - 「계정」, `wiki/requirements.md` 3-4행\n');

    const changed = await fixRequirementCitations([root, deferred], wikiIndex);

    assert.deepEqual(changed, ['request-apps-a.md', 'deferred/request-apps-c.md']);
    assert.equal(await readFile(path.join(root, 'request-apps-a.md'), 'utf8'), '- `ACC-01` — 「계정」, `wiki/requirements.md` 3-5행\n- `ACC-09` — 「계정」, `wiki/requirements.md` 3-9행\n');
    assert.equal(await readFile(path.join(deferred, 'request-apps-c.md'), 'utf8'), '- `ACC-02` - 「계정」, `wiki/requirements.md` 3-6행\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
