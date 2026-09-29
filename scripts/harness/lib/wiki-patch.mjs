import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { atomicWrite } from './util.mjs';
import { indexWiki } from './wiki-context.mjs';

// Applies wiki edits proposed by a session that never read the wiki files, only controller excerpts.
// - `sections`: [{ path: 'wiki/<file>.md', heading, markdown }] replaces one whole heading section. Allowed only
//   when that exact section range was supplied as an excerpt, so the session saw everything it replaces.
// - `requirementLines`: [{ id, line }] replaces one requirement line in wiki/requirements.md, keeping every
//   other line number (and therefore every request citation) unchanged.
// All edits are validated first; if any is invalid nothing is written.
export async function applyWikiEdits(wikiDir, { sections = [], requirementLines = [] }, excerpts) {
  const index = await indexWiki(wikiDir);
  const errors = [];
  const pending = new Map();
  const queue = (fileName, start, end, lines, label) => {
    if (!pending.has(fileName)) pending.set(fileName, []);
    pending.get(fileName).push({ start, end, lines, label });
  };
  const supplied = (sourcePath, predicate) => excerpts.some((excerpt) => excerpt.path === sourcePath && predicate(excerpt));

  for (const edit of sections) {
    const fileName = path.posix.basename(String(edit.path ?? ''));
    const label = `${edit.path}#${edit.heading}`;
    const file = index.get(fileName);
    if (!file || edit.path !== `wiki/${fileName}` || fileName === 'requirements.md') {
      errors.push(`${label}: only sections of wiki files other than requirements.md can be replaced.`);
      continue;
    }
    const matches = file.headings.filter((heading) => heading.title === edit.heading);
    if (matches.length !== 1) {
      errors.push(`${label}: heading must match exactly one section (found ${matches.length}).`);
      continue;
    }
    const [heading] = matches;
    if (!supplied(edit.path, (excerpt) => excerpt.startLine === heading.line && excerpt.endLine === heading.endLine)) {
      errors.push(`${label}: the full section was not supplied as an excerpt.`);
      continue;
    }
    const lines = String(edit.markdown ?? '').replace(/\r\n/g, '\n').trimEnd().split('\n');
    const headingLine = `${'#'.repeat(heading.level)} ${heading.title}`;
    if (lines[0] !== headingLine) {
      errors.push(`${label}: replacement must start with the unchanged heading line "${headingLine}".`);
      continue;
    }
    queue(fileName, heading.line, heading.endLine, lines, label);
  }

  const requirements = index.get('requirements.md');
  for (const edit of requirementLines) {
    const label = `wiki/requirements.md#${edit.id}`;
    const entry = requirements?.requirementIds.find((item) => item.id === edit.id);
    const line = String(edit.line ?? '');
    if (!entry) {
      errors.push(`${label}: requirement ID is not in wiki/requirements.md.`);
      continue;
    }
    if (!supplied('wiki/requirements.md', (excerpt) => excerpt.startLine <= entry.line && entry.line <= excerpt.endLine)) {
      errors.push(`${label}: the requirement line was not supplied as an excerpt.`);
      continue;
    }
    if (!line.startsWith(`- **${edit.id}** `) || /[\r\n]/.test(line)) {
      errors.push(`${label}: replacement must be one line starting with "- **${edit.id}** ".`);
      continue;
    }
    queue('requirements.md', entry.line, entry.line, [line], label);
  }

  for (const edits of pending.values()) {
    edits.sort((a, b) => a.start - b.start);
    for (let position = 1; position < edits.length; position += 1) {
      if (edits[position].start <= edits[position - 1].end) errors.push(`${edits[position].label}: overlaps ${edits[position - 1].label}.`);
    }
  }
  if (errors.length) return { changed: [], errors };

  const changed = [];
  for (const [fileName, edits] of pending) {
    const filePath = index.get(fileName).filePath;
    const content = await readFile(filePath, 'utf8');
    const eol = content.includes('\r\n') ? '\r\n' : '\n';
    const lines = content.split(/\r?\n/);
    for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
      const replacement = [...edit.lines];
      // Keep the blank separator line that ended the original section.
      if (edit.end > edit.start && lines[edit.end - 1] === '') replacement.push('');
      lines.splice(edit.start - 1, edit.end - edit.start + 1, ...replacement);
    }
    const next = lines.join(eol);
    if (next !== content) {
      await atomicWrite(filePath, next);
      changed.push(`wiki/${fileName}`);
    }
  }
  return { changed: changed.sort(), errors: [] };
}
