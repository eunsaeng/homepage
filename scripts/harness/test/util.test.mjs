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
