import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { REQUIREMENTS_DIR } from './config.mjs';
import { sha256 } from './util.mjs';

export const sourcePattern = /`((?:ACC|CMS|WEB)-\d+)`\s*[-—]\s*「([^」]+)」,\s*`(wiki\/[^`]+)`\s*(\d+)-(\d+)행/g;
const dependencyPattern = /\]\((request-[^)]+\.md)\)/g;

function readUnresolvedSection(markdown) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => /^## UNRESOLVED\s*$/i.test(line));
  if (start < 0) return '';
  const section = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/.test(line)) break;
    section.push(line);
  }
  const content = section.join('\n').trim();
  return /^(?:없음|none|n\/a|해당 없음)[.!。]?$/i.test(content) ? '' : content;
}

function readPredecessorLinks(markdown) {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => /^## 구현 의존성\s*$/.test(line));
  if (start < 0) return [];
  const links = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/.test(line)) break;
    if (!/^\s*-\s*(?:선행|계약)\s*:/.test(line)) continue;
    for (const match of line.matchAll(dependencyPattern)) links.push(match[1]);
  }
  return [...new Set(links)];
}

export async function loadBacklog(directory = REQUIREMENTS_DIR) {
  const names = (await readdir(directory))
    .filter((name) => /^request-.+\.md$/.test(name))
    .sort((left, right) => left.localeCompare(right));

  const items = [];
  for (const name of names) {
    const filePath = path.join(directory, name);
    const markdown = await readFile(filePath, 'utf8');
    const primaryRepository = markdown.match(/^- Primary repository: `([^`]+)`/m)?.[1] ?? null;
    const requestType = markdown.match(/^- Request type: (.+)$/m)?.[1] ?? null;
    const title = markdown.match(/^#\s+(.+)$/m)?.[1] ?? name;
    const dependencies = readPredecessorLinks(markdown);
    const sources = [...markdown.matchAll(sourcePattern)].map((match) => ({
      requirementId: match[1],
      heading: match[2],
      path: match[3],
      startLine: Number(match[4]),
      endLine: Number(match[5]),
    }));
    const unresolvedSection = readUnresolvedSection(markdown);
    const contentHash = sha256(markdown);
    const backlogId = `BL-${name.replace(/^request-/, '').replace(/\.md$/, '')}`;

    items.push({
      backlogId,
      fileName: name,
      filePath,
      title,
      primaryRepository,
      requestType,
      dependencies: [...new Set(dependencies)],
      sources,
      hasUnresolved: Boolean(unresolvedSection),
      unresolvedText: unresolvedSection,
      contentHash,
      markdown,
    });
  }
  return items;
}

export function validateBacklogItem(item) {
  const errors = [];
  if (!item.primaryRepository) errors.push('Missing Primary repository.');
  if (!item.requestType) errors.push('Missing Request type.');
  if (item.sources.length === 0) errors.push('Missing requirement ID and wiki line-range evidence.');
  return errors;
}
