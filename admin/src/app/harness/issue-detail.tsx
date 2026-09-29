"use client";

import type { IssueDetail, PendingCommand } from "@/lib/harness-types";
import { useState } from "react";
import { QuestionCard } from "./requirement-detail";
import { MarkdownView, PriorityBadge, Section, StageAccordion, StatusBadge, Stepper } from "./ui";

type Props = {
  detail: IssueDetail;
  pinned: boolean;
  pinPending: boolean;
  onTogglePin: () => void;
  retryPending: boolean;
  onRetry: (note: string) => void;
  pending: PendingCommand[];
  onChanged: () => void;
  openStages: Set<string>;
  onToggleStage: (id: string) => void;
  onSelectRequirement: (id: string) => void;
};

export function IssueDetailView({ detail, pinned, pinPending, onTogglePin, retryPending, onRetry, pending, onChanged, openStages, onToggleStage, onSelectRequirement }: Props) {
  const { issue, steps, stages } = detail;
  const done = issue.status === "MR_READY";
  const [retryNote, setRetryNote] = useState("");
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

      {issue.status === "REWORK_REQUIRED" && issue.displayStatus === "WAITING_FOR_HUMAN" && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <span className="flex-1">구현↔리뷰 반복 한도를 모두 사용했습니다. 마지막 리뷰 지적을 입력으로 3회 더 반복하거나, 처리 로그의 코드 리뷰를 확인하세요.</span>
          <textarea value={retryNote} onChange={(event) => setRetryNote(event.target.value)} rows={2} placeholder="재시도에 전달할 결정 (선택)"
            className="w-full rounded border border-amber-300 bg-white p-2 text-sm text-zinc-800" />
          <button type="button" disabled={retryPending} onClick={() => onRetry(retryNote)}
            className="rounded bg-amber-600 px-3 py-1.5 font-medium text-white hover:bg-amber-700 disabled:opacity-50">
            {retryPending ? "재시도 요청됨 · 하네스 재개 시 반영" : "3회 더 반복"}
          </button>
        </div>
      )}

      {issue.questions.length > 0 && (
        <Section title="사람 결정">
          {issue.questions.map((question) => (
            <QuestionCard key={question.id} target={{ issueId: issue.id }} question={question} answer={issue.answers[question.id]}
              pendingAnswer={pending.find((command) => command.type === "resolve-question" && command.issueId === issue.id && command.questionId === question.id)?.answer}
              onChanged={onChanged} />
          ))}
        </Section>
      )}

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
