import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { applyWikiEdits } from '../lib/wiki-patch.mjs';
import { buildWikiExcerpts, indexWiki } from '../lib/wiki-context.mjs';

const api = ['# API', '', '## 1. 공통 규칙', '', '- 규칙 A', '', '## 3. 공개 API', '', '### `GET /a`', '', 'A 설명', '', '## 4. 기타', '', '끝', ''].join('\r\n');
const requirements = ['# 요구사항', '', '## 공개 홈페이지', '', '- **WEB-01** 방문자는 페이지를 본다.', '- **WEB-02** 방문자는 메뉴를 쓴다.', ''].join('\n');

async function withWiki(run) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'wiki-patch-'));
  try {
    await writeFile(path.join(dir, 'api-spec.md'), api);
    await writeFile(path.join(dir, 'requirements.md'), requirements);
    const index = await indexWiki(dir);
    const excerpts = await buildWikiExcerpts({ sources: [{ requirementId: 'WEB-01', path: 'wiki/requirements.md', startLine: 3, endLine: 5, heading: '공개 홈페이지' }] }, index);
    await run(dir, excerpts);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('replaces a supplied section and keeps CRLF and the following section', () => withWiki(async (dir, excerpts) => {
  const result = await applyWikiEdits(dir, { sections: [{ path: 'wiki/api-spec.md', heading: '3. 공개 API', markdown: '## 3. 공개 API\n\n### `GET /a`\n\nA 설명\n\n### `GET /b`\n\nB 설명\n' }] }, excerpts);
  assert.deepEqual(result, { changed: ['wiki/api-spec.md'], errors: [] });
  const content = await readFile(path.join(dir, 'api-spec.md'), 'utf8');
  assert.ok(content.includes('### `GET /b`\r\n\r\nB 설명\r\n\r\n## 4. 기타'));
  assert.ok(!content.replaceAll('\r\n', '').includes('\n'));
}));

test('replaces one requirement line without moving other lines', () => withWiki(async (dir, excerpts) => {
  const result = await applyWikiEdits(dir, { requirementLines: [{ id: 'WEB-01', line: '- **WEB-01** 방문자는 게시된 페이지를 본다.' }] }, excerpts);
  assert.deepEqual(result.errors, []);
  const lines = (await readFile(path.join(dir, 'requirements.md'), 'utf8')).split('\n');
  assert.equal(lines[4], '- **WEB-01** 방문자는 게시된 페이지를 본다.');
  assert.equal(lines[5], '- **WEB-02** 방문자는 메뉴를 쓴다.');
}));

test('rejects edits outside the supplied excerpts and writes nothing', () => withWiki(async (dir, excerpts) => {
  const result = await applyWikiEdits(dir, {
    sections: [
      { path: 'wiki/api-spec.md', heading: '3. 공개 API', markdown: '## 3. 공개 API\n\nok' },
      { path: 'wiki/api-spec.md', heading: '4. 기타', markdown: '## 4. 기타\n\nnot supplied' },
      { path: 'wiki/api-spec.md', heading: '1. 공통 규칙', markdown: '## 1. 규칙 이름 변경' },
      { path: 'wiki/requirements.md', heading: '공개 홈페이지', markdown: '## 공개 홈페이지' },
    ],
    requirementLines: [
      { id: 'WEB-02', line: '- **WEB-02** not supplied' },
      { id: 'WEB-01', line: '- **WEB-09** wrong id' },
    ],
  }, excerpts);
  assert.deepEqual(result.changed, []);
  assert.deepEqual(result.errors, [
    'wiki/api-spec.md#4. 기타: the full section was not supplied as an excerpt.',
    'wiki/api-spec.md#1. 공통 규칙: replacement must start with the unchanged heading line "## 1. 공통 규칙".',
    'wiki/requirements.md#공개 홈페이지: only sections of wiki files other than requirements.md can be replaced.',
    'wiki/requirements.md#WEB-02: the requirement line was not supplied as an excerpt.',
    'wiki/requirements.md#WEB-01: replacement must be one line starting with "- **WEB-01** ".',
  ]);
  assert.equal(await readFile(path.join(dir, 'api-spec.md'), 'utf8'), api);
}));
