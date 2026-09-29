import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { loadBacklog, validateBacklogItem } from './lib/backlog.mjs';
import { DEFERRED_REQUIREMENTS_DIR, HARNESS_DIR, REQUIREMENTS_DIR, REPOSITORIES, RUNS_DIR, STATE_DIR, WIKI_DIR } from './lib/config.mjs';
import { auditRequests, fixRequirementCitations, renderGenerationPlan } from './lib/request-audit.mjs';
import { buildWikiExcerpts, indexWiki } from './lib/wiki-context.mjs';
import { loadState } from './lib/state.mjs';
import { appendJsonLine, atomicWrite, ensureDir } from './lib/util.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const command = process.argv[2] ?? 'help';

async function validate({ fix = false } = {}) {
  const wikiIndex = await indexWiki();
  if (fix) {
    const changed = await fixRequirementCitations([REQUIREMENTS_DIR, DEFERRED_REQUIREMENTS_DIR], wikiIndex);
    console.log(changed.length
      ? `Fixed requirement citations in:\n${changed.map((name) => `- requirements/${name}`).join('\n')}\n`
      : 'Requirement citations already match the wiki index.\n');
  }
  const items = await loadBacklog();
  const names = new Set(items.map((item) => item.fileName));
  const errors = [];
  const rows = [];

  for (const item of items) {
    const itemErrors = validateBacklogItem(item);
    if (!REPOSITORIES.includes(item.primaryRepository)) itemErrors.push(`Unknown primary repository: ${item.primaryRepository}`);
    for (const dependency of item.dependencies) {
      if (!names.has(dependency)) itemErrors.push(`Missing dependency request: ${dependency}`);
    }
    for (const source of item.sources) {
      const indexed = wikiIndex.get(path.basename(source.path));
      const match = indexed?.requirementIds.some((entry) => entry.id === source.requirementId && entry.line >= source.startLine && entry.line <= source.endLine);
      if (!match) itemErrors.push(`Requirement source does not match wiki index: ${source.requirementId} ${source.path}:${source.startLine}-${source.endLine}`);
    }
    const excerpts = await buildWikiExcerpts(item, wikiIndex);
    if (item.sources.length > 0 && excerpts.length === 0) itemErrors.push('No relevant wiki excerpts were resolved.');
    errors.push(...itemErrors.map((message) => `${item.fileName}: ${message}`));
    rows.push(`| ${item.backlogId} | ${item.primaryRepository ?? 'MISSING'} | ${item.sources.map((source) => source.requirementId).join(', ')} | ${item.hasUnresolved ? 'UNRESOLVED' : 'clear'} | ${itemErrors.length ? itemErrors.join('; ') : 'OK'} |`);
  }

  const deferredItems = existsSync(DEFERRED_REQUIREMENTS_DIR) ? await loadBacklog(DEFERRED_REQUIREMENTS_DIR) : [];
  const audit = auditRequests(items, deferredItems, wikiIndex);
  errors.push(...audit.errors);

  const input = `# Harness Preflight Input\n\nBacklog files: ${items.length} (deferred: ${deferredItems.length})\nWiki files indexed by headings: ${[...wikiIndex.keys()].join(', ')}\n`;
  const output = [
    '# Harness Preflight Report',
    '',
    '| Backlog ID | Primary repo | Requirement IDs | Status | Validation |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    `Result: ${errors.length ? 'FAIL' : 'PASS'}`,
    ...errors.map((error) => `- ${error}`),
  ].join('\n');
  const stageDir = path.join(HARNESS_DIR, 'preflight');
  await ensureDir(stageDir);
  await atomicWrite(path.join(stageDir, 'input.md'), `${input}\n`);
  await atomicWrite(path.join(stageDir, 'output.md'), `${output}\n`);
  await atomicWrite(path.join(stageDir, 'generation-plan.md'), await renderGenerationPlan(items, deferredItems, wikiIndex, audit.coverage));
  await appendJsonLine(path.join(stageDir, 'controller.jsonl'), { time: new Date().toISOString(), backlog_count: items.length, error_count: errors.length });
  console.log(output);
  if (errors.length) process.exitCode = 1;
}

async function status() {
  const state = await loadState();
  if (!state) {
    console.log('No active harness run. Use `pnpm harness run` to start.');
    console.log(`Backlog: ${await loadBacklog().then((items) => items.length)} request files`);
    return;
  }
  console.log(JSON.stringify({
    run_id: state.run_id,
    phase: state.phase,
    active_backlog_id: state.active_backlog_id,
    active_issue_ids: state.active_issue_ids,
    backlog_cursor: state.backlog_cursor,
    unresolved: state.pause?.details ?? [],
    updated_at: state.updated_at,
  }, null, 2));
}

async function run(resume) {
  const { runHarness } = await import('./lib/pipeline.mjs');
  const result = await runHarness({ resume });
  if (result?.paused) {
    console.error(`Harness paused: ${result.reason}\nAlert: ${result.alertPath}`);
  } else if (result?.phase === 'QUEUE_DRAINED') {
    console.log(`Harness queue drained. Run: ${result.run_id}`);
  }
}

switch (command) {
  case 'validate':
    await validate({ fix: process.argv.includes('--fix') });
    break;
  case 'status':
    await status();
    break;
  case 'run':
    await run(false);
    break;
  case 'resume':
    await run(true);
    break;
  default:
    console.log('Usage: pnpm harness <validate [--fix]|status|run|resume>');
    process.exitCode = command === 'help' ? 0 : 2;
}
