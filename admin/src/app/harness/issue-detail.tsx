"use client";

import type { IssueDetail } from "@/lib/harness-types";
import { MarkdownView, PriorityBadge, Section, StageAccordion, StatusBadge, Stepper } from "./ui";

type Props = {
  detail: IssueDetail;
  pinned: boolean;
  pinPending: boolean;
  onTogglePin: () => void;
  openStages: Set<string>;
  onToggleStage: (id: string) => void;
  onSelectRequirement: (id: string) => void;
};

export function IssueDetailView({ detail, pinned, pinPending, onTogglePin, openStages, onToggleStage, onSelectRequirement }: Props) {
  const { issue, steps, stages } = detail;
  const done = issue.status === "MR_READY";
  return (
    <div className="space-y-6 rounded-xl border border-zinc-200 bg-zinc-50/60 p-5">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={issue.priority} />
          <h2 className="text-lg font-semibold text-zinc-900">{issue.title}</h2>
          <StatusBadge status={issue.displayStatus} />
          {!done && (
            <button type="button" onClick={onTogglePin}
              className={`ml-auto rounded border px-3 py-1 text-sm ${pinned ? "border-violet-300 bg-violet-50 text-violet-800" : "border-zinc-300 bg-white text-zinc-700"}`}>
              {pinned ? "고정 해제" : "고정"}{pinPending ? " · 반영 대기" : ""}
            </button>
          )}
        </div>
        <p className="font-mono text-xs text-zinc-500">
          {issue.id} · {issue.primaryRepository}
          {issue.branch ? ` · ${issue.branch}` : ""}
          {issue.commitSha ? ` · ${issue.commitSha.slice(0, 10)}` : ""}
        </p>
        <button type="button" onClick={() => onSelectRequirement(issue.backlogId)} className="text-xs text-blue-700 underline">{issue.backlogId}</button>
      </header>

      <Section title="단계 진행"><Stepper steps={steps} /></Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="이슈">
          <div className="max-h-[28rem] overflow-auto rounded-lg border border-zinc-200 bg-white p-5"><MarkdownView source={issue.markdown} /></div>
        </Section>
        <Section title="완료 조건">
          <ul className="list-disc space-y-1 rounded-lg border border-zinc-200 bg-white p-5 pl-9 text-sm text-zinc-800">
            {issue.acceptanceCriteria.map((criterion, index) => <li key={index}>{criterion}</li>)}
          </ul>
          {issue.dependencies.length > 0 && <p className="text-xs text-zinc-500">선행: {issue.dependencies.join(", ")}</p>}
          {issue.mrPath && <p className="font-mono text-xs break-all text-zinc-500">MR: {issue.mrPath}</p>}
        </Section>
      </div>

      <Section title={`처리 로그 (${stages.length})`}><StageAccordion stages={stages} open={openStages} onToggle={onToggleStage} /></Section>
    </div>
  );
}
