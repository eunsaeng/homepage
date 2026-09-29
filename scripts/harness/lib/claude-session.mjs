import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { atomicWrite, ensureDir, runProcess, sha256 } from './util.mjs';

const SYSTEM_PROMPT = [
  'You are one isolated stage in a local development harness.',
  'Use only the supplied input and excerpts. Never read an entire wiki document.',
  'Do not claim tests passed unless the controller supplied actual execution results.',
  'Do not request secrets or print environment variables.',
  'Return the requested Markdown artifact. If machine-readable metadata is required, include exactly one fenced json block.',
].join('\n');

function decodeResult(stdout) {
  try {
    const envelope = JSON.parse(stdout);
    if (typeof envelope.result === 'string') {
      return { text: envelope.result, sessionId: envelope.session_id ?? null };
    }
  } catch {
    // Text output is preserved for CLI versions that return non-JSON output.
  }
  return { text: stdout, sessionId: null };
}

export async function runClaudeStage({ runDir, stage, model, input, cwd, edits = false, readOnly = false, disallowedTools = ['Read(wiki/**)', 'Grep(wiki/**)', 'Glob(wiki/**)'], timeoutMs }) {
  const stageDir = path.join(runDir, stage);
  await ensureDir(stageDir);
  const inputHash = sha256(input);
  const recordPath = path.join(stageDir, 'session.json');
  try {
    const previous = JSON.parse(await readFile(recordPath, 'utf8'));
    if (previous.input_sha256 === inputHash && previous.model === model && previous.exit_code === 0) {
      const output = await readFile(path.join(stageDir, 'output.md'), 'utf8');
      return { output, record: previous, stageDir, cached: true };
    }
  } catch {
    // Missing or partial artifacts are regenerated in a fresh Claude session.
  }
  await atomicWrite(path.join(stageDir, 'input.md'), `${input.trim()}\n`);
  const prompt = `Stage: ${stage}\nModel: ${model}\n\n${input}`;
  const args = [
    '-p',
    '--model', model,
    '--output-format', 'json',
    '--append-system-prompt', SYSTEM_PROMPT,
    '--permission-mode', edits ? 'acceptEdits' : 'plan',
  ];
  if (edits) args.push('--tools', 'Read,Edit,Write,Glob,Grep', '--allowedTools', 'Read,Edit,Write,Glob,Grep');
  else if (readOnly) args.push('--tools', 'Read,Glob,Grep', '--allowedTools', 'Read,Glob,Grep');
  else args.push('--tools', '');
  if (disallowedTools.length) args.push('--disallowedTools', disallowedTools.join(','));

  const startedAt = new Date().toISOString();
  let result;
  try {
    result = await runProcess(process.env.CLAUDE_BIN || 'claude', args, { cwd, timeoutMs, input: prompt });
  } catch (error) {
    const sessionId = randomUUID();
    const logDir = path.join(runDir, 'logs', stage.replace(/[^a-zA-Z0-9/_-]+/g, '-'));
    await ensureDir(logDir);
    await atomicWrite(path.join(stageDir, 'output.md'), `# Stage process failure\n\n${error.message}\n`);
    await atomicWrite(path.join(logDir, `${sessionId}.jsonl`), `${JSON.stringify({ stage, model, session_id: sessionId, started_at: startedAt, error: error.message })}\n`);
    await atomicWrite(path.join(logDir, `${sessionId}.stderr.log`), error.stack ?? error.message);
    await atomicWrite(path.join(stageDir, 'session.json'), `${JSON.stringify({ stage, model, session_id: sessionId, started_at: startedAt, completed_at: new Date().toISOString(), input_sha256: inputHash, exit_code: null, error: error.message }, null, 2)}\n`);
    throw error;
  }
  const decoded = decodeResult(result.stdout);
  const output = decoded.text;
  await atomicWrite(path.join(stageDir, 'output.md'), `${output.trim()}\n`);
  const sessionId = decoded.sessionId ?? randomUUID();
  const logDir = path.join(runDir, 'logs', stage.replace(/[^a-zA-Z0-9/_-]+/g, '-'));
  await ensureDir(logDir);
  await atomicWrite(path.join(logDir, `${sessionId}.jsonl`), `${result.stdout.trim()}\n`);
  await atomicWrite(path.join(logDir, `${sessionId}.stderr.log`), result.stderr);
  const record = {
    stage,
    model,
    session_id: sessionId,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    cwd,
    input_sha256: inputHash,
    output_sha256: sha256(output),
    exit_code: result.code,
    signal: result.signal,
  };
  await atomicWrite(recordPath, `${JSON.stringify(record, null, 2)}\n`);
  if (result.code !== 0) throw new Error(`Claude stage ${stage} exited ${result.code}: ${result.stderr.slice(-2000)}`);
  return { output, record, stageDir, cached: false };
}
