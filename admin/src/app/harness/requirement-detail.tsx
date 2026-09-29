"use client";

import { useState } from "react";
import type { PendingCommand, Question, RequirementDetail } from "@/lib/harness-types";
import { MarkdownView, PriorityBadge, Section, StageAccordion, StatusBadge, Stepper, sendCommand } from "./ui";

type Props = {
  detail: RequirementDetail;
  pending: PendingCommand[];
  openStages: Set<string>;
  onToggleStage: (id: string) => void;
  onChanged: () => void;
  onSelectIssue: (id: string) => void;
};

function QuestionCard({ backlogId, question, answer, pendingAnswer, onChanged }: { backlogId: string; question: Question; answer?: string; pendingAnswer?: string; onChanged: () => void }) {
  const [choice, setChoice] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const composed = [choice, note.trim()].filter(Boolean).join("\n\n");

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await sendCommand({ type: "resolve-question", backlogId, questionId: question.id, answer: composed });
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-amber-200 bg-white p-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">{question.source === "approval" ? "승인 검토" : question.source === "backlog" ? "요청 문서" : "Spec"}</span>
        <p className="flex-1 text-sm whitespace-pre-wrap text-zinc-800">{question.text}</p>
      </div>
      {answer ? (
        <div className="mt-3 rounded bg-emerald-50 p-3 text-sm whitespace-pre-wrap text-emerald-900"><span className="font-medium">결정: </span>{answer}</div>
      ) : pendingAnswer ? (
        <div className="mt-3 rounded bg-blue-50 p-3 text-sm whitespace-pre-wrap text-blue-900"><span className="font-medium">제출됨 · 하네스 재개 시 반영: </span>{pendingAnswer}</div>
      ) : (
        <div className="mt-3 space-y-2">
          {question.options.length > 0 && (
            <fieldset className="space-y-1.5">
              {question.options.map((option) => (
                <label key={option} className="flex cursor-pointer items-start gap-2 text-sm text-zinc-800">
                  <input type="radio" name={`q-${question.id}`} className="mt-1" checked={choice === option} onChange={() => setChoice(option)} />
                  <span>{option}</span>
                </label>
              ))}
              {choice && <button type="button" className="text-xs text-zinc-500 underline" onClick={() => setChoice("")}>선택 해제</button>}
            </fieldset>
          )}
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2}
            placeholder={question.options.length ? "보충 설명 또는 직접 입력 (선택)" : "결정을 입력하세요"}
            className="w-full rounded border border-zinc-300 p-2 text-sm focus:border-zinc-500 focus:outline-none" />
          <div className="flex items-center gap-3">
            <button type="button" disabled={!composed || busy} onClick={submit}
              className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">결정 제출</button>
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function SpecPanel({ detail, pending, onChanged }: { detail: RequirementDetail; pending: PendingCommand[]; onChanged: () => void }) {
  const { requirement } = detail;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingEdit = pending.find((command) => command.type === "edit-spec" && command.backlogId === requirement.id);
  const pendingApproval = pending.find((command) => command.type === "approve-spec" && command.backlogId === requirement.id);
  const openQuestions = requirement.questions.filter((question) => !requirement.answers[question.id]?.trim()).length;
  const approved = requirement.specStatus === "SPEC_APPROVED";
  const canApprove = Boolean(requirement.specMarkdown) && !approved && !requirement.humanApprovalRequested && !pendingApproval && openQuestions === 0 && !editing;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  };

  const approvalText = approved
    ? `${requirement.approval?.type === "human" ? "수동" : "자동"} 승인됨`
    : requirement.humanApprovalRequested || pendingApproval ? "승인 요청됨 · 하네스 재개 시 반영"
      : requirement.specStatus === "NEEDS_HUMAN_REVIEW" ? "자동 검토 3회 반려 · 수정 또는 승인 필요"
        : openQuestions ? `미결정 ${openQuestions}건` : requirement.specStatus ? "승인 검토 대기" : "";

  return (
    <Section title="Spec" aside={
      <div className="flex items-center gap-2">
        {approvalText && <span className="text-xs text-zinc-500">{approvalText}</span>}
        {requirement.specEditedByHuman && <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[11px] text-violet-800">사람이 수정함</span>}
        {pendingEdit && <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[11px] text-blue-800">수정본 반영 대기</span>}
        {requirement.canEditSpec && !editing && (
          <button type="button" onClick={() => { setDraft(requirement.specMarkdown ?? ""); setEditing(true); }}
            className="rounded border border-zinc-300 bg-white px-3 py-1 text-sm hover:bg-zinc-50">수정</button>
        )}
        {canApprove && (
          <button type="button" disabled={busy} onClick={() => run(() => sendCommand({ type: "approve-spec", backlogId: requirement.id }))}
            className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-40">승인</button>
        )}
      </div>
    }>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!requirement.specMarkdown ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500">아직 Spec이 생성되지 않았습니다.</p>
      ) : editing ? (
        <div className="space-y-2">
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={24}
            className="w-full rounded-lg border border-zinc-300 p-3 font-mono text-sm focus:border-zinc-500 focus:outline-none" />
          <div className="flex gap-2">
            <button type="button" disabled={busy || !draft.trim()}
              onClick={() => run(async () => { await sendCommand({ type: "edit-spec", backlogId: requirement.id, markdown: draft }); setEditing(false); })}
              className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">저장</button>
            <button type="button" onClick={() => setEditing(false)} className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm">취소</button>
            <span className="self-center text-xs text-zinc-500">저장하면 승인 요청이 취소되고, 하네스가 재개될 때 수정본으로 승인 검토를 다시 합니다.</span>
          </div>
        </div>
      ) : (
        <div className="max-h-[36rem] overflow-auto rounded-lg border border-zinc-200 bg-white p-5">
          <MarkdownView source={requirement.specMarkdown} />
        </div>
      )}
    </Section>
  );
}

export function RequirementDetailView({ detail, pending, openStages, onToggleStage, onChanged, onSelectIssue }: Props) {
  const { requirement, issues, steps, stages } = detail;
  const pendingAnswers = new Map(pending.filter((command) => command.type === "resolve-question" && command.backlogId === requirement.id).map((command) => [command.questionId, command.answer]));
  const needsDecision = requirement.questions.length > 0 || requirement.reviewFindings.length > 0;

  return (
    <div className="space-y-6 rounded-xl border border-zinc-200 bg-zinc-50/60 p-5">
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <PriorityBadge priority={requirement.priority} />
          <h2 className="text-lg font-semibold text-zinc-900">{requirement.title}</h2>
          <StatusBadge status={requirement.status} />
        </div>
        <p className="font-mono text-xs text-zinc-500">{requirement.id} · {requirement.primaryRepository} · {requirement.requestType} · {requirement.sourceIds.join(", ")}</p>
        {requirement.priorityRationale && <p className="text-sm text-zinc-600">{requirement.priorityRationale}</p>}
      </header>

      <Section title="단계 진행"><Stepper steps={steps} /></Section>

      {needsDecision && (
        <Section title="사람 결정">
          {requirement.reviewFindings.length > 0 && requirement.specStatus === "NEEDS_HUMAN_REVIEW" && (
            <div className="rounded-lg border border-amber-200 bg-white p-4 text-sm">
              <p className="mb-2 font-medium text-amber-800">자동 승인 검토가 세 번 변경을 요청했습니다. Spec을 수정하거나 그대로 승인하세요.</p>
              <ul className="list-disc space-y-1 pl-5 text-zinc-700">
                {requirement.reviewFindings.map((finding, index) => <li key={index}>{finding.severity ? `[${finding.severity}] ` : ""}{finding.text}</li>)}
              </ul>
            </div>
          )}
          {requirement.questions.map((question) => (
            <QuestionCard key={question.id} backlogId={requirement.id} question={question} answer={requirement.answers[question.id]} pendingAnswer={pendingAnswers.get(question.id)} onChanged={onChanged} />
          ))}
        </Section>
      )}

      <SpecPanel detail={detail} pending={pending} onChanged={onChanged} />

      {issues.length > 0 && (
        <Section title={`이슈 (${issues.length})`}>
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 bg-white">
            {issues.map((issue) => (
              <li key={issue.id}>
                <button type="button" onClick={() => onSelectIssue(issue.id)} className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-zinc-50">
                  <PriorityBadge priority={issue.priority} />
                  <span className="flex-1 text-sm text-zinc-800">{issue.title}</span>
                  <span className="text-xs text-zinc-500">{issue.primaryRepository}</span>
                  <StatusBadge status={issue.displayStatus} />
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <details className="rounded-lg border border-zinc-200 bg-white">
        <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-zinc-700">원본 요청 문서 ({requirement.fileName})</summary>
        <div className="max-h-[28rem] overflow-auto border-t border-zinc-200 p-5"><MarkdownView source={requirement.requestMarkdown} /></div>
      </details>

      <Section title={`처리 로그 (${stages.length})`}><StageAccordion stages={stages} open={openStages} onToggle={onToggleStage} /></Section>
    </div>
  );
}
