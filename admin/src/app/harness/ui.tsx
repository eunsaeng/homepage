"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { DashboardCommand, ItemStatus, StageContent, StageLog, Step } from "@/lib/harness-types";

// Polls a JSON endpoint and only replaces state when the body actually changed, so React keeps the
// existing DOM (scroll positions, open panels, text selection) between refreshes. When the URL changes,
// the previous data stays on screen until the new response arrives, so nothing flashes.
export function usePolling<T>(url: string | null, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastBody = useRef("");

  const refresh = useCallback(async () => {
    if (!url) return;
    try {
      const response = await fetch(url, { cache: "no-store" });
      const body = await response.text();
      if (!response.ok) {
        setError((JSON.parse(body) as { error?: string }).error ?? response.statusText);
        return;
      }
      setError(null);
      if (body !== lastBody.current) {
        lastBody.current = body;
        setData(JSON.parse(body) as T);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, [url]);

  useEffect(() => {
    if (!url) return;
    // Fetch on the next tick so the initial request does not run synchronously inside the effect.
    const first = setTimeout(refresh, 0);
    const timer = intervalMs > 0 ? setInterval(() => { if (!document.hidden) void refresh(); }, intervalMs) : null;
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [url, intervalMs, refresh]);

  return { data, error, refresh };
}

export async function sendCommand(command: DashboardCommand) {
  const response = await fetch("/api/harness/commands", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? response.statusText);
  }
}

// Memoised on the source text so polling does not re-render (and re-layout) unchanged documents.
export const MarkdownView = memo(function MarkdownView({ source }: { source: string }) {
  if (!source.trim()) return <p className="text-sm text-zinc-500">(비어 있음)</p>;
  return (
    <div className="md-body">
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>{source}</Markdown>
    </div>
  );
});

const statusStyle: Record<ItemStatus, { label: string; className: string }> = {
  WAITING_FOR_HUMAN: { label: "사람 개입 필요", className: "bg-amber-100 text-amber-800 ring-amber-300" },
  IN_PROGRESS: { label: "진행 중", className: "bg-blue-100 text-blue-800 ring-blue-300" },
  READY: { label: "진행 가능", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  BLOCKED: { label: "선행 대기", className: "bg-zinc-100 text-zinc-600 ring-zinc-200" },
  COMPLETED: { label: "완료", className: "bg-zinc-800 text-white ring-zinc-800" },
  BACKLOG: { label: "백로그", className: "bg-zinc-100 text-zinc-600 ring-zinc-200" },
};

export function StatusBadge({ status }: { status: ItemStatus }) {
  const style = statusStyle[status];
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style.className}`}>{style.label}</span>;
}

export function PriorityBadge({ priority }: { priority: string | null }) {
  const tone = priority === "P0" ? "bg-red-600 text-white" : priority === "P1" ? "bg-orange-500 text-white" : priority === "P2" ? "bg-sky-600 text-white" : priority === "P3" ? "bg-zinc-500 text-white" : "bg-zinc-200 text-zinc-600";
  return <span className={`inline-flex w-8 shrink-0 justify-center rounded px-1 py-0.5 font-mono text-xs font-semibold ${tone}`}>{priority ?? "–"}</span>;
}

export function SummaryCards({ cards }: { cards: Array<{ label: string; value: number; tone?: "amber" | "blue" }> }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-lg border bg-white p-4 ${card.tone === "amber" && card.value ? "border-amber-300" : card.tone === "blue" && card.value ? "border-blue-300" : "border-zinc-200"}`}>
          <div className="text-xs text-zinc-500">{card.label}</div>
          <div className={`mt-1 text-2xl font-semibold tabular-nums ${card.tone === "amber" && card.value ? "text-amber-700" : card.tone === "blue" && card.value ? "text-blue-700" : "text-zinc-900"}`}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}

const stepStyle: Record<Step["state"], { dot: string; text: string; label: string }> = {
  done: { dot: "bg-emerald-500 border-emerald-500", text: "text-zinc-900", label: "완료" },
  running: { dot: "bg-blue-500 border-blue-500 animate-pulse", text: "text-blue-700", label: "진행 중" },
  waiting: { dot: "bg-amber-400 border-amber-400", text: "text-amber-700", label: "사람 개입 필요" },
  pending: { dot: "bg-white border-zinc-300", text: "text-zinc-400", label: "대기" },
};

export function Stepper({ steps }: { steps: Step[] }) {
  if (!steps.length) return null;
  return (
    <ol className="flex flex-wrap items-start gap-y-3">
      {steps.map((step, index) => {
        const style = stepStyle[step.state];
        return (
          <li key={step.key} className="flex items-start">
            <div className="flex w-28 flex-col items-center text-center">
              <span className={`h-3.5 w-3.5 rounded-full border-2 ${style.dot}`} title={style.label} />
              <span className={`mt-1.5 text-xs font-medium ${style.text}`}>{step.label}</span>
              <span className="text-[11px] text-zinc-500">{step.detail ?? style.label}</span>
            </div>
            {index < steps.length - 1 && <span className={`mt-1.5 h-0.5 w-6 ${step.state === "done" ? "bg-emerald-400" : "bg-zinc-200"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

function shortTime(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// Stage outputs are fenced JSON replies; their "markdown" field is the document a person wants to read.
function splitStageOutput(source: string): { markdown: string | null; data: Record<string, unknown> | null } {
  const fenced = source.match(/```json\s*\n([\s\S]*?)\n```/);
  const raw = fenced?.[1] ?? (source.trim().startsWith("{") ? source.trim() : null);
  if (!raw) return { markdown: null, data: null };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { markdown: null, data: null };
    const { markdown, ...rest } = parsed;
    return { markdown: typeof markdown === "string" ? markdown : null, data: rest };
  } catch {
    return { markdown: null, data: null };
  }
}

const StageOutput = memo(function StageOutput({ source }: { source: string }) {
  const { markdown, data } = splitStageOutput(source);
  if (!data) return <MarkdownView source={source} />;
  const fields = Object.keys(data).length ? JSON.stringify(data, null, 2) : null;
  return (
    <div className="space-y-4">
      {markdown !== null && <MarkdownView source={markdown} />}
      {fields && (
        <details open={markdown === null}>
          <summary className="cursor-pointer text-xs font-medium text-zinc-500">응답 필드</summary>
          <pre className="mt-2 overflow-auto rounded bg-zinc-900 p-3 font-mono text-xs whitespace-pre-wrap text-zinc-100">{fields}</pre>
        </details>
      )}
    </div>
  );
});

function StageBody({ stage }: { stage: StageLog }) {
  // Running stages refresh; finished ones load once (the version key changes when a stage completes).
  const url = `/api/harness/stage?id=${encodeURIComponent(stage.id)}&v=${encodeURIComponent(stage.completedAt ?? "")}`;
  const { data, error } = usePolling<StageContent>(url, stage.running ? 4000 : 0);
  const [tab, setTab] = useState<"output" | "input" | "logs">("output");
  if (error && !data) return <p className="px-4 py-3 text-sm text-red-600">{error}</p>;
  if (!data) return <p className="px-4 py-3 text-sm text-zinc-500">불러오는 중…</p>;
  const tabs = [
    { key: "output" as const, label: "출력" },
    { key: "input" as const, label: "입력" },
    { key: "logs" as const, label: `로그 (${data.logs.length})` },
  ];
  return (
    <div className="border-t border-zinc-200">
      <div className="flex gap-1 border-b border-zinc-200 bg-zinc-50 px-3 pt-2">
        {tabs.map((item) => (
          <button key={item.key} type="button" onClick={() => setTab(item.key)}
            className={`rounded-t px-3 py-1.5 text-xs font-medium ${tab === item.key ? "border border-b-white border-zinc-200 bg-white text-zinc-900" : "text-zinc-500 hover:text-zinc-800"}`}>
            {item.label}
          </button>
        ))}
      </div>
      {/* Each pane keeps its own scroll position; panes stay mounted so switching tabs does not reset it. */}
      <div data-pane="output" className={tab === "output" ? "max-h-[32rem] overflow-auto p-4" : "hidden"}><StageOutput source={data.output} /></div>
      <div data-pane="input" className={tab === "input" ? "max-h-[32rem] overflow-auto p-4" : "hidden"}><MarkdownView source={data.input} /></div>
      <div data-pane="logs" className={tab === "logs" ? "max-h-[32rem] space-y-3 overflow-auto p-4" : "hidden"}>
        {data.logs.length === 0 && <p className="text-sm text-zinc-500">로그 파일 없음</p>}
        {data.logs.map((log) => (
          <div key={log.path}>
            <div className="mb-1 font-mono text-xs text-zinc-500">{log.path}</div>
            <pre className="max-h-80 overflow-auto rounded bg-zinc-900 p-3 font-mono text-xs whitespace-pre-wrap text-zinc-100">{log.content || "(비어 있음)"}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StageAccordion({ stages, open, onToggle }: { stages: StageLog[]; open: Set<string>; onToggle: (id: string) => void }) {
  if (!stages.length) return <p className="text-sm text-zinc-500">아직 실행된 단계가 없습니다.</p>;
  return (
    <div className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white">
      {stages.map((stage) => {
        const expanded = open.has(stage.id);
        const failed = stage.exitCode !== null && stage.exitCode !== 0;
        return (
          <div key={stage.id}>
            <button type="button" onClick={() => onToggle(stage.id)} aria-expanded={expanded}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-zinc-50">
              <span className={`text-xs text-zinc-400 transition-transform ${expanded ? "rotate-90" : ""}`}>▶</span>
              <span className={`h-2 w-2 shrink-0 rounded-full ${stage.running ? "animate-pulse bg-blue-500" : failed ? "bg-red-500" : "bg-emerald-500"}`} />
              <span className="flex-1 text-sm font-medium text-zinc-800">{stage.label}</span>
              {stage.model && <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600">{stage.model}</span>}
              <span className="hidden font-mono text-[11px] text-zinc-400 md:inline">{stage.id}</span>
              <span className="w-24 shrink-0 text-right font-mono text-[11px] text-zinc-500">{stage.running ? "실행 중" : stage.completedAt ? shortTime(stage.completedAt) : ""}</span>
            </button>
            {expanded && <StageBody stage={stage} />}
          </div>
        );
      })}
    </div>
  );
}

export function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-zinc-700">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}
