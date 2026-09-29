import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const newId = () => randomUUID();
export const sha256 = (text) => createHash('sha256').update(text).digest('hex');
export const safeId = (value) => value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '');

export async function ensureDir(directory) {
  await mkdir(directory, { recursive: true });
}

export async function atomicWrite(filePath, data) {
  await ensureDir(path.dirname(filePath));
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, data, 'utf8');
  await rename(temporary, filePath);
}

export async function writeJson(filePath, value) {
  await atomicWrite(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeStageMarkdown(stageDir, input, output) {
  await ensureDir(stageDir);
  await atomicWrite(path.join(stageDir, 'input.md'), `${input.trim()}\n`);
  await atomicWrite(path.join(stageDir, 'output.md'), `${output.trim()}\n`);
}

// Stage outputs often carry Markdown with other code blocks (for example ```kotlin) before the JSON reply,
// so every fenced block is tried, json-tagged ones first and later ones before earlier ones.
export function parseJsonPayload(markdown) {
  const blocks = [...markdown.matchAll(/```([\w-]*)[^\n]*\n([\s\S]*?)\n?```/g)].map((match) => ({ tag: match[1].toLowerCase(), body: match[2] }));
  const ordered = [...blocks.filter((block) => block.tag === 'json').reverse(), ...blocks.filter((block) => block.tag !== 'json').reverse()];
  const asObject = (text) => {
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first < 0 || last < first) return null;
    try {
      const value = JSON.parse(text.slice(first, last + 1));
      return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    } catch {
      return null;
    }
  };
  for (const block of ordered) {
    const value = asObject(block.body);
    if (value) return value;
  }
  const whole = asObject(markdown);
  if (whole) return whole;
  throw new Error('Model output did not contain a JSON object.');
}

// Node refuses to spawn Windows batch files (pnpm.cmd) without a shell, so they run through cmd.exe with
// each argument quoted.
function windowsBatchInvocation(command, args) {
  const quote = (value) => (/^[\w@%+=:,./\\-]+$/.test(value) ? value : `"${value.replaceAll('"', '""')}"`);
  return { command: process.env.ComSpec ?? 'cmd.exe', args: ['/d', '/s', '/c', `"${[command, ...args].map(quote).join(' ')}"`] };
}

export function runProcess(command, args, options = {}) {
  const { cwd, env, timeoutMs = 30 * 60 * 1000, input } = options;
  const batch = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(command);
  const invocation = batch ? windowsBatchInvocation(command, args) : { command, args };
  return new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.args, {
      cwd,
      env: { ...process.env, ...env },
      windowsHide: true,
      windowsVerbatimArguments: batch,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, signal, stdout, stderr });
    });
    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
}

export async function appendJsonLine(filePath, value) {
  await ensureDir(path.dirname(filePath));
  const handle = await open(filePath, 'a');
  try {
    await handle.write(`${JSON.stringify(value)}\n`);
  } finally {
    await handle.close();
  }
}

export async function removeIfExists(filePath) {
  await rm(filePath, { force: true, recursive: true });
}
