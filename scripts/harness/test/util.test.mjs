import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonPayload, safeId, sha256 } from '../lib/util.mjs';

test('parses fenced JSON embedded in a Markdown stage output', () => {
  assert.deepEqual(parseJsonPayload('Result:\n```json\n{"ok":true}\n```'), { ok: true });
});

test('normalizes stable ids and hashes deterministically', () => {
  assert.equal(safeId('BL:apps/local account'), 'bl-apps-local-account');
  assert.equal(sha256('same'), sha256('same'));
});

test('finds the JSON reply after other code blocks in a stage output', () => {
  const output = '# Plan\n\n```kotlin\nfun main() { println("{x}") }\n```\n\nText\n\n```json\n{"slices":[{"id":"a"}],"unresolved":[]}\n```\n';
  assert.deepEqual(parseJsonPayload(output), { slices: [{ id: 'a' }], unresolved: [] });
  assert.deepEqual(parseJsonPayload('{"ok":1}'), { ok: 1 });
  assert.throws(() => parseJsonPayload('```kotlin\nval x = 1\n```'), /did not contain a JSON object/);
});
