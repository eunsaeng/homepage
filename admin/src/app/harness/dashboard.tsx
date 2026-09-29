"use client";

import { useCallback, useEffect, useState } from "react";
import type { DashboardData, Issue, IssueDetail, Requirement, RequirementDetail } from "@/lib/harness-types";
import { IssueDetailView } from "./issue-detail";
import { RequirementDetailView } from "./requirement-detail";
import { PriorityBadge, Section, StatusBadge, SummaryCards, sendCommand, usePolling } from "./ui";

type Tab = "requirements" | "issues";
const POLL_MS = 4000;

// Tab and selection live in the query string, so a manual browser reload returns to the same view.
function readLocation(): { tab: Tab; id: string | null } {
  if (typeof window === "undefined") return { tab: "requirements", id: null };
  const params = new URLSearchParams(window.location.search);
  return { tab: params.get("tab") === "issues" ? "issues" : "requirements", id: params.get("id") };
}

function RequirementRows({ items, selectedId, onSelect, empty }: { items: Requirement[]; selectedId: string | null; onSelect: (id: string) => void; empty: string }) {
  if (!items.length) return <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500">{empty}</p>;
  return (
    <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white">
      {items.map((item) => (
        <li key={item.id}>
          <button type="button" onClick={() => onSelect(item.id)}
            className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${selectedId === item.id ? "bg-zinc-100" : "hover:bg-zinc-50"}`}>
            <PriorityBadge priority={item.priority} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-zinc-900">{item.title}</span>
              <span className="block truncate font-mono text-[11px] text-zinc-500">{item.id}</span>
            </span>
            <span className="hidden w-14 text-xs text-zinc-500 sm:block">{item.primaryRepository}</span>
            {item.issues.length > 0 && <span className="hidden text-xs text-zinc-500 sm:block">이슈 {item.issues.length}</span>}
            <StatusBadge status={item.status} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function IssueRows({ items, selectedId, onSelect, pinnedOf, pendingPin, onTogglePin, empty }: {
  items: Issue[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  pinnedOf: (issue: Issue) => boolean;
  pendingPin: (id: string) => boolean;
  onTogglePin?: (issue: Issue) => void;
  empty: string;
}) {
  if (!items.length) return <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500">{empty}</p>;
  return (
    <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white">
      {items.map((issue) => {
        const pinned = pinnedOf(issue);
        return (
          <li key={issue.id} className={`flex items-center ${selectedId === issue.id ? "bg-zinc-100" : "hover:bg-zinc-50"}`}>
            <button type="button" onClick={() => onSelect(issue.id)} className="flex min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left">
              <PriorityBadge priority={issue.priority} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-zinc-900">{pinned && <span className="mr-1 text-violet-600">●</span>}{issue.title}</span>
                <span className="block truncate font-mono text-[11px] text-zinc-500">{issue.id}</span>
              </span>
              <span className="hidden w-14 text-xs text-zinc-500 sm:block">{issue.primaryRepository}</span>
              {issue.attempt ? <span className="hidden text-xs text-zinc-500 sm:block">{issue.attempt}/3회차</span> : null}
              <StatusBadge status={issue.displayStatus} />
            </button>
            {onTogglePin && (
              <button type="button" onClick={() => onTogglePin(issue)} title="고정하면 같은 저장소 lane에서 우선 처리합니다"
                className={`mr-3 shrink-0 rounded border px-2.5 py-1 text-xs ${pinned ? "border-violet-300 bg-violet-50 text-violet-800" : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"}`}>
                {pinned ? "고정됨" : "고정"}{pendingPin(issue.id) ? " …" : ""}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function HarnessDashboard() {
  const [tab, setTab] = useState<Tab>("requirements");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openStages, setOpenStages] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const initial = readLocation();
    // Restoring view state from the URL after hydration keeps server and client markup identical.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTab(initial.tab);
    setSelectedId(initial.id);
  }, []);

  const select = useCallback((nextTab: Tab, id: string | null) => {
    setTab(nextTab);
    setSelectedId(id);
    const params = new URLSearchParams({ tab: nextTab });
    if (id) params.set("id", id);
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, []);

  const dashboard = usePolling<DashboardData>("/api/harness/dashboard", POLL_MS);
  const detailUrl = selectedId ? `/api/harness/${tab === "issues" ? "issues" : "requirements"}/${encodeURIComponent(selectedId)}` : null;
  const requirementDetail = usePolling<RequirementDetail>(tab === "requirements" ? detailUrl : null, POLL_MS);
  const issueDetail = usePolling<IssueDetail>(tab === "issues" ? detailUrl : null, POLL_MS);

  const refreshAll = useCallback(() => {
    void dashboard.refresh();
    void requirementDetail.refresh();
    void issueDetail.refresh();
  }, [dashboard, requirementDetail, issueDetail]);

  const toggleStage = useCallback((id: string) => {
    setOpenStages((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const data = dashboard.data;
  const pending = data?.pendingCommands ?? [];
  // A queued pin shows immediately; the harness applies it at its next checkpoint.
  const latestPin = (id: string) => [...pending].reverse().find((command) => command.type === "pin-issue" && command.issueId === id);
  const pinnedOf = (issue: Issue) => latestPin(issue.id)?.pinned ?? issue.pinned;
  const togglePin = async (issue: Issue) => {
    setActionError(null);
    try {
      await sendCommand({ type: "pin-issue", issueId: issue.id, pinned: !pinnedOf(issue) });
      refreshAll();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : String(caught));
    }
  };

  const run = data?.run;
  const paused = run?.phase.startsWith("PAUSED");
  const readyIssues = data ? [...data.issues.ready].sort((a, b) => Number(pinnedOf(b)) - Number(pinnedOf(a))) : [];

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-6 py-3">
          <h1 className="text-base font-semibold">개발 하네스 대시보드</h1>
          {run ? (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${paused ? "bg-amber-100 text-amber-800" : run.phase === "RUNNING" ? "bg-blue-100 text-blue-800" : "bg-zinc-100 text-zinc-700"}`}>{run.phase}</span>
          ) : data ? <span className="text-xs text-zinc-500">실행 기록 없음</span> : null}
          {run?.updatedAt && <span className="text-xs text-zinc-500">상태 갱신 {new Date(run.updatedAt).toLocaleString("ko-KR", { hour12: false })}</span>}
          {pending.length > 0 && <span className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-800">반영 대기 명령 {pending.length}건</span>}
          {dashboard.error && <span className="text-xs text-red-600">갱신 실패: {dashboard.error}</span>}
          <nav className="ml-auto flex rounded-lg bg-zinc-100 p-0.5">
            {(["requirements", "issues"] as const).map((item) => (
              <button key={item} type="button" onClick={() => select(item, null)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === item ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800"}`}>
                {item === "requirements" ? "요구사항" : "이슈"}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-6">
        {paused && run?.pause && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-medium">하네스가 멈췄습니다 ({run.pause.reason}). 필요한 결정을 입력한 뒤 터미널에서 <code className="rounded bg-amber-100 px-1">pnpm harness resume</code>을 실행하세요.</p>
            {run.activeBacklogId && (
              <button type="button" onClick={() => select("requirements", run.activeBacklogId)} className="mt-1 text-amber-800 underline">{run.activeBacklogId} 열기</button>
            )}
          </div>
        )}
        {actionError && <p className="text-sm text-red-600">{actionError}</p>}
        {data?.recentlyRejected.length ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            하네스가 거부한 최근 명령: {data.recentlyRejected.map((command) => `${command.type} (${command.reason})`).join(" · ")}
          </div>
        ) : null}

        {!data ? (
          <p className="text-sm text-zinc-500">불러오는 중…</p>
        ) : tab === "requirements" ? (
          <>
            <SummaryCards cards={[
              { label: "전체 요구사항 (등록)", value: data.requirements.summary.registered },
              { label: "승인", value: data.requirements.summary.approved },
              { label: "사람 개입 필요", value: data.requirements.summary.needsHuman, tone: "amber" },
              { label: "진행 중", value: data.requirements.summary.inProgress, tone: "blue" },
            ]} />
            <div className="grid gap-6 lg:grid-cols-2">
              <Section title={`진행 가능한 요구사항 · 우선순위순 (${data.requirements.ready.length})`}>
                <RequirementRows items={data.requirements.ready} selectedId={selectedId} onSelect={(id) => select("requirements", id)} empty="진행 가능한 요구사항이 없습니다." />
              </Section>
              <Section title={`완료된 요구사항 (${data.requirements.completed.length})`}>
                <RequirementRows items={data.requirements.completed} selectedId={selectedId} onSelect={(id) => select("requirements", id)} empty="아직 완료된 요구사항이 없습니다." />
              </Section>
            </div>
            {selectedId && (requirementDetail.data?.requirement.id === selectedId ? (
              <RequirementDetailView key={selectedId} detail={requirementDetail.data} pending={pending} openStages={openStages} onToggleStage={toggleStage}
                onChanged={refreshAll} onSelectIssue={(id) => select("issues", id)} />
            ) : <p className="text-sm text-zinc-500">{requirementDetail.error ?? "불러오는 중…"}</p>)}
          </>
        ) : (
          <>
            <SummaryCards cards={[
              { label: "전체 이슈 (등록)", value: data.issues.summary.registered },
              { label: "MR 생성", value: data.issues.summary.mergeCreated },
              { label: "사람 개입 필요", value: data.issues.summary.needsHuman, tone: "amber" },
              { label: "진행 중", value: data.issues.summary.inProgress, tone: "blue" },
            ]} />
            <div className="grid gap-6 lg:grid-cols-2">
              <Section title={`진행 가능한 이슈 · 우선순위순 (${readyIssues.length})`}>
                <IssueRows items={readyIssues} selectedId={selectedId} onSelect={(id) => select("issues", id)} pinnedOf={pinnedOf}
                  pendingPin={(id) => Boolean(latestPin(id))} onTogglePin={togglePin} empty="진행 가능한 이슈가 없습니다." />
              </Section>
              <Section title={`완료된 이슈 · MR 생성 (${data.issues.completed.length})`}>
                <IssueRows items={data.issues.completed} selectedId={selectedId} onSelect={(id) => select("issues", id)} pinnedOf={pinnedOf}
                  pendingPin={() => false} empty="아직 MR이 생성된 이슈가 없습니다." />
              </Section>
            </div>
            {selectedId && (issueDetail.data?.issue.id === selectedId ? (
              <IssueDetailView key={selectedId} detail={issueDetail.data} pinned={pinnedOf(issueDetail.data.issue)} pinPending={Boolean(latestPin(selectedId))}
                onTogglePin={() => togglePin(issueDetail.data!.issue)}
                pending={pending} onChanged={refreshAll}
                retryPending={pending.some((command) => command.type === "retry-issue" && command.issueId === selectedId)}
                onRetry={() => { void sendCommand({ type: "retry-issue", issueId: selectedId }).then(refreshAll, (caught: unknown) => setActionError(caught instanceof Error ? caught.message : String(caught))); }}
                openStages={openStages} onToggleStage={toggleStage}
                onSelectRequirement={(id) => select("requirements", id)} />
            ) : <p className="text-sm text-zinc-500">{issueDetail.error ?? "불러오는 중…"}</p>)}
          </>
        )}
      </main>
    </div>
  );
}
