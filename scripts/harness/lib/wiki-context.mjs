import { createReadStream } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { WIKI_DIR } from './config.mjs';
import { sha256 } from './util.mjs';

export async function indexWiki(directory = WIKI_DIR) {
  const files = (await readdir(directory)).filter((name) => name.endsWith('.md')).sort();
  const index = new Map();
  for (const name of files) {
    const filePath = path.join(directory, name);
    const headings = [];
    const requirementIds = [];
    let lineNumber = 0;
    let currentHeading = null;
    const stream = readline.createInterface({ input: createReadStream(filePath, 'utf8'), crlfDelay: Infinity });
    for await (const line of stream) {
      lineNumber += 1;
      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        currentHeading = { level: heading[1].length, title: heading[2].trim(), line: lineNumber };
        headings.push(currentHeading);
      }
      for (const match of line.matchAll(/\b(?:ACC|CMS|WEB)-\d+\b/g)) {
        requirementIds.push({ id: match[0], line: lineNumber, heading: currentHeading?.title ?? '' });
      }
    }
    for (let indexPosition = 0; indexPosition < headings.length; indexPosition += 1) {
      const heading = headings[indexPosition];
      const next = headings.slice(indexPosition + 1).find((item) => item.level <= heading.level);
      heading.endLine = next ? next.line - 1 : lineNumber;
    }
    index.set(name, { filePath, lineCount: lineNumber, headings, requirementIds });
  }
  return index;
}

export async function readLineRange(filePath, startLine, endLine) {
  if (startLine < 1 || endLine < startLine) throw new Error(`Invalid line range ${startLine}-${endLine}`);
  const selected = [];
  let lineNumber = 0;
  const stream = readline.createInterface({ input: createReadStream(filePath, 'utf8'), crlfDelay: Infinity });
  for await (const line of stream) {
    lineNumber += 1;
    if (lineNumber >= startLine && lineNumber <= endLine) selected.push(line);
    if (lineNumber > endLine) break;
  }
  if (selected.length !== endLine - startLine + 1) throw new Error(`Range ${startLine}-${endLine} exceeds ${filePath}`);
  return selected.join('\n');
}

function findHeading(index, fileName, pattern) {
  const file = index.get(fileName);
  if (!file) return null;
  return file.headings.find((heading) => pattern.test(heading.title)) ?? null;
}

export async function buildWikiExcerpts(item, index) {
  const excerpts = [];
  const seen = new Set();
  const addRange = async (fileName, startLine, endLine, heading) => {
    const key = `${fileName}:${startLine}-${endLine}`;
    if (seen.has(key)) return;
    seen.add(key);
    const file = index.get(fileName);
    if (!file) return;
    const content = await readLineRange(file.filePath, startLine, endLine);
    excerpts.push({ path: `wiki/${fileName}`, heading, startLine, endLine, content, sha256: sha256(content) });
  };
  const addSection = async (fileName, pattern) => {
    const file = index.get(fileName);
    const heading = findHeading(index, fileName, pattern);
    if (file && heading) await addRange(fileName, heading.line, heading.endLine, heading.title);
  };

  for (const source of item.sources) {
    if (source.path.startsWith('wiki/requirements.md')) {
      await addRange('requirements.md', source.startLine, source.endLine, source.heading);
    }
  }

  const ids = new Set(item.sources.map((source) => source.requirementId));
  if (ids.size > 0) {
    await addSection('api-spec.md', /공통 규칙/);
    await addSection('api-spec.md', /공통 데이터 형식/);
  }
  if ([...ids].some((id) => id.startsWith('ACC-'))) {
    await addSection('architecture.md', /로컬 계정 및 권한 처리/);
    await addSection('api-spec.md', /로컬 stub 인증 API/);
    await addSection('api-spec.md', /계정 및 역할 API/);
    for (const name of ['account', 'app_role', 'account_role', 'account_sync_run', 'admin_session']) {
      await addSection('erd.md', new RegExp(`^\\x60${name}\\x60$`));
    }
  }
  if ([...ids].some((id) => id.startsWith('CMS-'))) {
    await addSection('architecture.md', /API 및 데이터 흐름/);
    await addSection('api-spec.md', /관리자 콘텐츠 API/);
    await addSection('erd.md', /^`content_page`$/);
    await addSection('erd.md', /^`content_revision`$/);
  }
  if ([...ids].some((id) => id.startsWith('WEB-'))) {
    await addSection('architecture.md', /애플리케이션 책임/);
    await addSection('api-spec.md', /공개 API/);
    await addSection('api-spec.md', /관리자 메뉴 API/);
    await addSection('erd.md', /^`content_page`$/);
    await addSection('erd.md', /^`navigation_item`$/);
  }
  return excerpts;
}

export function excerptsToMarkdown(excerpts) {
  return excerpts.map((excerpt) => `### ${excerpt.path}: ${excerpt.heading} (${excerpt.startLine}-${excerpt.endLine})\n\n${excerpt.content}\n\nSHA-256: ${excerpt.sha256}`).join('\n\n');
}
