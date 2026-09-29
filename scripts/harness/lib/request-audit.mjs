import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { sourcePattern } from './backlog.mjs';
import { readLineRange } from './wiki-context.mjs';
import { atomicWrite, sha256 } from './util.mjs';

// Contracts and servers live in `apps`; `admin`/`web` consume them; `e2e` verifies across repositories.
const REPOSITORY_RANK = { apps: 0, admin: 1, web: 1, e2e: 2 };

// Resolves each requirement ID in requirements.md to its section heading and line numbers,
// using only the heading/ID index (never the whole file).
export function indexRequirementIds(wikiIndex) {
  const file = wikiIndex.get('requirements.md');
  const ids = new Map();
  if (!file) return ids;
  for (const entry of file.requirementIds) {
    if (ids.has(entry.id)) continue;
    const heading = file.headings.filter((item) => item.line < entry.line).at(-1);
    if (heading) ids.set(entry.id, { line: entry.line, heading: heading.title, headingLine: heading.line });
  }
  return ids;
}

// Rewrites every requirements.md citation in the request files of `directories` to the heading and
// line range the index currently gives for its ID. Unknown IDs are left for validate to report.
export async function fixRequirementCitations(directories, wikiIndex) {
  const ids = indexRequirementIds(wikiIndex);
  const changed = [];
  for (const directory of directories) {
    const names = (await readdir(directory).catch(() => [])).filter((name) => /^request-.+\.md$/.test(name));
    for (const name of names) {
      const filePath = path.join(directory, name);
      const markdown = await readFile(filePath, 'utf8');
      const fixed = markdown.replace(sourcePattern, (citation, requirementId, _heading, sourcePath) => {
        const indexed = ids.get(requirementId);
        if (!indexed || sourcePath !== 'wiki/requirements.md') return citation;
        const dash = citation.match(/`\s*([-—])\s*「/)[1];
        return `\`${requirementId}\` ${dash} 「${indexed.heading}」, \`${sourcePath}\` ${indexed.headingLine}-${indexed.line}행`;
      });
      if (fixed !== markdown) {
        await atomicWrite(filePath, fixed);
        changed.push(path.relative(directories[0], filePath).replaceAll('\\', '/'));
      }
    }
  }
  return changed;
}

// Checks the request-generation rules that the harness parser does not enforce on its own.
// `deferredItems` are requests parked under requirements/deferred/; they count toward coverage only.
export function auditRequests(items, deferredItems, wikiIndex) {
  const ids = indexRequirementIds(wikiIndex);
  const byName = new Map(items.map((item) => [item.fileName, item]));
  const errors = [];

  for (const item of items) {
    const fail = (message) => errors.push(`${item.fileName}: ${message}`);
    if (item.primaryRepository && !item.fileName.startsWith(`request-${item.primaryRepository}-`)) {
      fail(`File name must start with request-${item.primaryRepository}-.`);
    }
    for (const source of item.sources.filter((entry) => entry.path === 'wiki/requirements.md')) {
      const indexed = ids.get(source.requirementId);
      if (!indexed) continue;
      if (source.heading !== indexed.heading) fail(`${source.requirementId} heading 「${source.heading}」 should be 「${indexed.heading}」.`);
      if (source.startLine !== indexed.headingLine || source.endLine !== indexed.line) {
        fail(`${source.requirementId} range ${source.startLine}-${source.endLine} should be ${indexed.headingLine}-${indexed.line}.`);
      }
    }
    for (const dependency of item.dependencies) {
      const target = byName.get(dependency);
      if (target && REPOSITORY_RANK[target.primaryRepository] > REPOSITORY_RANK[item.primaryRepository]) {
        fail(`${item.primaryRepository} request must not depend on ${target.primaryRepository} request ${dependency}.`);
      }
    }
  }

  const coverage = [...ids.keys()].map((requirementId) => {
    const cites = (item) => item.sources.some((source) => source.requirementId === requirementId);
    const active = items.filter(cites);
    const deferred = deferredItems.filter(cites);
    const repositories = new Set(active.map((item) => item.primaryRepository));
    if (!active.length && !deferred.length) errors.push(`${requirementId}: not cited by any request.`);
    if (repositories.size > 1 && !repositories.has('apps')) errors.push(`${requirementId}: spans ${[...repositories].join(', ')} without an apps request.`);
    if (repositories.size > 1 && !repositories.has('e2e')) errors.push(`${requirementId}: spans ${[...repositories].join(', ')} without an e2e acceptance request.`);
    return { requirementId, active: active.map((item) => item.fileName), deferred: deferred.map((item) => item.fileName) };
  });

  return { errors, coverage };
}

// Records, per request, which requirement ID, heading and line range it was generated from.
export async function renderGenerationPlan(items, deferredItems, wikiIndex, coverage) {
  const file = wikiIndex.get('requirements.md');
  const ids = indexRequirementIds(wikiIndex);
  const rows = [];
  for (const item of [...items, ...deferredItems]) {
    const name = deferredItems.includes(item) ? `deferred/${item.fileName}` : item.fileName;
    for (const [position, source] of item.sources.entries()) {
      let hash = 'range error';
      if (file && source.path === 'wiki/requirements.md') {
        try {
          hash = sha256(await readLineRange(file.filePath, source.startLine, source.endLine)).slice(0, 16);
        } catch {
          // Out-of-range citations are already reported by validate.
        }
      }
      rows.push(position === 0
        ? `| ${name} | ${item.primaryRepository} | ${item.dependencies.join('<br>') || '-'} | ${source.requirementId} | ${source.heading} | ${source.startLine}-${source.endLine} | ${hash} | ${item.hasUnresolved ? 'yes' : '-'} |`
        : `| | | | ${source.requirementId} | ${source.heading} | ${source.startLine}-${source.endLine} | ${hash} | |`);
    }
  }
  return [
    '# Request generation plan',
    '',
    `Indexed \`wiki/requirements.md\` headings and ${ids.size} requirement IDs; only cited line ranges were read.`,
    '',
    '## Index',
    '',
    '| Heading | Line | Requirement IDs |',
    '|---|---:|---|',
    ...(file?.headings ?? []).filter((heading) => heading.level > 1).map((heading) => `| ${heading.title} | ${heading.line} | ${[...ids].filter(([, value]) => value.headingLine === heading.line).map(([id, value]) => `${id} (${value.line})`).join(', ') || '-'} |`),
    '',
    '## Evidence per request',
    '',
    '| Request | Repo | Predecessors | Requirement | Heading | Lines | Excerpt SHA-256 (16) | UNRESOLVED |',
    '|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    '## Coverage',
    '',
    '| Requirement | Active requests | Deferred requests |',
    '|---|---|---|',
    ...coverage.map((entry) => `| ${entry.requirementId} | ${entry.active.join('<br>') || '-'} | ${entry.deferred.map((name) => `deferred/${path.basename(name)}`).join('<br>') || '-'} |`),
    '',
  ].join('\n');
}
