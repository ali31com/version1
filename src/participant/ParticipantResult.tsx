import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { PIPELINE_STAGES, stageLabel } from "../lib/labels";
import { formatDuration, useNow } from "../lib/time";

type Episode = NonNullable<NonNullable<FunctionReturnType<typeof api.participants.view>>["episode"]>;

// Read-only live view of the participant's submitted Episode.
export function ParticipantResult({ episode, paused }: { episode: Episode; paused: boolean }) {
  const now = useNow();
  const done = episode.processing === "completed";
  const elapsed = (episode.firstActionableAt ?? (done ? episode.submittedAt : now)) - episode.submittedAt;

  return (
    <div className="space-y-6">
      <section>
        <p className="font-mono text-xs tracking-widest text-teal-700 uppercase">Your Episode · {episode.worklistId}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{episode.summary}</h1>
        <p className="mt-1 text-slate-600">{episode.laterality}</p>
        <StatusBanner episode={episode} paused={paused} elapsed={elapsed} />
      </section>

      <section aria-labelledby="progress-title" className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 id="progress-title" className="text-sm font-semibold text-slate-500">Pipeline</h2>
        <ol className="mt-3 space-y-2" aria-live="polite">
          {PIPELINE_STAGES.map((s) => {
            const state = episode.stages.find((x) => x.stage === s.stage)?.status ?? "pending";
            return (
              <li key={s.stage} className="flex items-center gap-3">
                <StageDot status={state} />
                <span className={state === "pending" ? "text-slate-400" : "text-slate-900"}>{s.label}</span>
              </li>
            );
          })}
        </ol>
      </section>

      {episode.questions.length > 0 && (
        <section aria-labelledby="q-title" className="space-y-3">
          <h2 id="q-title" className="text-lg font-semibold">Review</h2>
          {episode.questions.map((q, i) => (
            <div key={i} className="rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-xs font-semibold tracking-wide text-amber-800 uppercase">
                {q.status === "answered" ? "Answered by the presenter" : q.answerable ? "Open question for the presenter" : "Blocks approval"}
              </p>
              <p className="mt-1 font-medium text-amber-950">{q.question}</p>
              {q.answer && <p className="mt-2 text-sm text-amber-900">Answer: {q.answer}</p>}
            </div>
          ))}
        </section>
      )}

      {(episode.diagnoses.length > 0 || episode.procedures.length > 0) && (
        <section aria-labelledby="codes-title" className="space-y-4">
          <h2 id="codes-title" className="text-lg font-semibold">Codes</h2>
          <div className="rounded-xl border border-slate-200 bg-white">
            <p className="border-b border-slate-100 px-4 py-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Diagnoses · ICD-10</p>
            <ul className="divide-y divide-slate-100">
              {episode.diagnoses.map((d) => (
                <CodeRow key={d.code} code={d.code} title={d.title} tag={d.position === "primary" ? "Primary" : "Secondary"} explanation={d.explanation} />
              ))}
            </ul>
          </div>
          {episode.procedures.map((g, gi) => (
            <div key={gi} className="rounded-xl border border-slate-200 bg-white">
              <p className="border-b border-slate-100 px-4 py-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                Procedures · OPCS-4 · in sequence
              </p>
              <p className="px-4 pt-3 text-sm text-slate-600">{g.label}</p>
              <ol className="divide-y divide-slate-100">
                {g.codes.map((c, i) => (
                  <CodeRow key={c.code + i} code={c.code} title={c.title} tag={`${i + 1}`} explanation={c.explanation} />
                ))}
              </ol>
            </div>
          ))}
        </section>
      )}

      {episode.facts.length > 0 && (
        <section aria-labelledby="facts-title">
          <h2 id="facts-title" className="text-lg font-semibold">Clinical facts found</h2>
          <ul className="mt-3 space-y-2">
            {episode.facts.map((f) => (
              <li key={f.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <span className="mr-2 font-mono text-xs text-teal-700 uppercase">{f.kind}</span>
                {f.statement}
              </li>
            ))}
          </ul>
        </section>
      )}

      {episode.document && (
        <details className="rounded-xl border border-stone-300 bg-[#f8f6f1] p-4 text-stone-900">
          <summary className="cursor-pointer font-medium">Your synthetic operation note</summary>
          <div className="mt-3 space-y-3 text-sm leading-relaxed">
            {episode.document.sections.map((s) => (
              <div key={s.heading}>
                <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">{s.heading}</p>
                {s.passages.map((p) => (
                  <p key={p.id} className="mt-1">{p.text}</p>
                ))}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function StatusBanner({ episode, paused, elapsed }: { episode: Episode; paused: boolean; elapsed: number }) {
  let tone = "bg-slate-100 text-slate-800";
  let title: string;
  let detail: string | null = null;
  if (episode.processing === "failed") {
    tone = "bg-red-50 text-red-900 border border-red-200";
    title = "A processing stage failed";
    detail = episode.failure ?? null;
  } else if (episode.processing !== "completed") {
    if (paused && episode.processing === "queued") {
      tone = "bg-amber-50 text-amber-900 border border-amber-200";
      title = "Processing paused by the presenter";
    } else if (episode.processing === "queued") {
      title = `Queued for ${stageLabel(episode.currentStage)}`;
      detail = episode.queueAhead ? `${episode.queueAhead} request${episode.queueAhead === 1 ? "" : "s"} ahead of yours.` : "Waiting for a free processing slot.";
    } else {
      tone = "bg-teal-50 text-teal-950 border border-teal-200";
      title = `Running: ${stageLabel(episode.currentStage)}`;
    }
  } else if (episode.review === "approved") {
    tone = "bg-emerald-50 text-emerald-950 border border-emerald-200";
    title = "✓ Approved by the presenter";
  } else if (episode.result === "auto_coded") {
    tone = "bg-emerald-50 text-emerald-950 border border-emerald-200";
    title = "✓ Auto-coded";
  } else {
    tone = "bg-amber-50 text-amber-950 border border-amber-200";
    title = "? Sent to review";
  }
  return (
    <div className={`mt-4 rounded-xl px-4 py-3 ${tone}`} role="status">
      <p className="flex items-center justify-between gap-3 font-semibold">
        {title}
        <span className="font-mono text-sm font-normal tabular-nums">{formatDuration(elapsed)}</span>
      </p>
      {detail && <p className="mt-1 text-sm">{detail}</p>}
    </div>
  );
}

function StageDot({ status }: { status: string }) {
  const cls =
    status === "done"
      ? "bg-teal-600"
      : status === "running"
        ? "bg-teal-500 animate-pulse-dot"
        : status === "queued"
          ? "border-2 border-teal-500 bg-white"
          : status === "failed"
            ? "bg-red-600"
            : "border-2 border-slate-300 bg-white";
  const label = { done: "done", running: "running", queued: "queued", failed: "failed" }[status] ?? "pending";
  return <span className={`inline-block h-3 w-3 shrink-0 rounded-full ${cls}`} aria-label={label} role="img" />;
}

function CodeRow({ code, title, tag, explanation }: { code: string; title: string; tag: string; explanation: string }) {
  return (
    <li className="px-4 py-3">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-base font-bold text-teal-800">{code}</span>
        <span className="flex-1 text-sm text-slate-700">{title}</span>
        <span className="font-mono text-xs text-slate-500">{tag}</span>
      </div>
      <p className="mt-1 text-sm text-slate-500">{explanation}</p>
    </li>
  );
}
