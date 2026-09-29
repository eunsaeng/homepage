import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBacklog, validateBacklogItem } from '../lib/backlog.mjs';
import { indexWiki, buildWikiExcerpts } from '../lib/wiki-context.mjs';

// ACC-02 (DAOU Office 실제 동기화)는 requirements/deferred/로 보류되어 하네스 범위에서 제외한다.
const expectedIds = new Set([
  ...Array.from({ length: 13 }, (_, index) => `ACC-${String(index + 1).padStart(2, '0')}`).filter((id) => id !== 'ACC-02'),
  ...Array.from({ length: 13 }, (_, index) => `CMS-${String(index + 1).padStart(2, '0')}`),
  ...Array.from({ length: 6 }, (_, index) => `WEB-${String(index + 1).padStart(2, '0')}`),
]);

test('loads one backlog item per request markdown file', async () => {
  const items = await loadBacklog();
  assert.equal(items.length, 28);
  assert.ok(items.every((item) => validateBacklogItem(item).length === 0));
  const ids = new Set(items.flatMap((item) => item.sources.map((source) => source.requirementId)));
  assert.deepEqual([...expectedIds].filter((id) => !ids.has(id)), []);
});

test('only predecessor and contract links become dependencies', async () => {
  const items = await loadBacklog();
  const localContract = items.find((item) => item.fileName === 'request-apps-local-account-contract.md');
  const localImplementation = items.find((item) => item.fileName === 'request-apps-local-account-auth.md');
  assert.deepEqual(localContract.dependencies, []);
  assert.deepEqual(localImplementation.dependencies, ['request-apps-local-account-contract.md']);
});

test('wiki context is limited to cited lines and related indexed sections', async () => {
  const items = await loadBacklog();
  const item = items.find((entry) => entry.fileName === 'request-apps-local-account-contract.md');
  const index = await indexWiki();
  const excerpts = await buildWikiExcerpts(item, index);
  const requirementExcerpt = excerpts.find((excerpt) => excerpt.path === 'wiki/requirements.md');
  assert.ok(requirementExcerpt);
  assert.equal(requirementExcerpt.startLine, 9);
  assert.equal(requirementExcerpt.endLine, 15);
  assert.ok(excerpts.some((excerpt) => excerpt.path === 'wiki/api-spec.md' && /공통 규칙/.test(excerpt.heading)));
  assert.ok(excerpts.every((excerpt) => excerpt.endLine <= index.get(excerpt.path.split('/').at(-1)).lineCount));
  assert.ok(excerpts.every((excerpt) => excerpt.content.length < 20_000));
});

test('wiki context includes the ERD tables for each requirement prefix', async () => {
  const index = await indexWiki();
  const expectedTables = {
    'ACC-01': ['`account`', '`app_role`', '`account_role`', '`account_sync_run`', '`admin_session`'],
    'CMS-02': ['`content_page`', '`content_revision`'],
    'WEB-03': ['`content_page`', '`navigation_item`'],
  };
  for (const [requirementId, tables] of Object.entries(expectedTables)) {
    const excerpts = await buildWikiExcerpts({ sources: [{ requirementId, path: 'wiki/requirements.md', startLine: 1, endLine: 1, heading: '' }] }, index);
    const erdHeadings = excerpts.filter((excerpt) => excerpt.path === 'wiki/erd.md').map((excerpt) => excerpt.heading);
    assert.deepEqual(erdHeadings, tables, requirementId);
  }
});
