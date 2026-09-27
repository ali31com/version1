import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useMemo, useState, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { codeTitle } from "../../convex/lib/references";
import { ProcessingLabel, ResultBadge } from "../components/badges";
import { PIPELINE_STAGES } from "../lib/labels";
import { formatClock, formatDuration } from "../lib/time";
import { PaperNote } from "./PaperNote";

type Detail = NonNullable<FunctionReturnType<typeof api.presenter.episodeDetail>>;
type Fact = Detail["facts"][number];
type ProposedCode = NonNullable<Detail["proposal"]>["diagnoses"][number];

export type Selection =
  | { kind: "code"; key: string; code: ProposedCode }
  | { kind: "fact"; id: string }
  | { kind: "passage"; id: string }
  | { kind: "annotation"; id: string }
  | { kind: "question"; id: string }
  | null;

const TABS = ["Codes", "Facts", "Hints", "References", "Checks", "Run log"] as const;
type Tab = (typeof TABS)[number];

export function EpisodeWorkspace({ episodeId, paused, onClose }: { episodeId: Id<"episodes">; paused: boolean; onClose: () => void }) {
  const detail = useQuery(api.presenter.episodeDetail, { episodeId });
  const [selection, setSelection] = useState<Selection>(null);
  const [tab, setTab] = useState<Tab>("Codes");

  if (detail === undefined) return <div className="grid flex-1 place-items-center text-muted">Loading Episode…</div>;
  if (detail === null) return <div className="grid flex-1 place-items-center text-muted">Episode not found.</div>;
  return <Workspace detail={detail} paused={paused} onClose={onClose} selection={selection} setSelection={setSelection} tab={tab} setTab={setTab} />;
}

function Workspace({
  detail,
  paused,
  onClose,
  selection,
  setSelection,
  tab,
  setTab,
}: {
  detail: Detail;
  paused: boolean;
  onClose: () => void;
  selection: Selection;
  setSelection: (s: Selection) => void;
  tab: Tab;
  setTab: (t: Tab) => void;
}) {
  const { episode, run, document, proposal } = detail;
  const index = useEvidenceIndex(detail);

  const { highlighted, warning, spanMark } = useMemo(() => {
    const hi = new Set<string>();
    const warn = new Set<string>();
    let mark: { passageId: string; start: number; end: number } | null = null;
    if (selection?.kind === "code") {
      for (const f of selection.code.factIds) index.facts.get(f)?.passageIds.forEach((p) => hi.add(p));
    } else if (selection?.kind === "fact") {
      index.facts.get(selection.id)?.passageIds.forEach((p) => hi.add(p));
    } else if (selection?.kind === "annotation") {
      const a = index.annotations.get(selection.id);
      if (a) mark = { passageId: a.passageId, start: a.start, end: a.end };
    } else if (selection?.kind === "question") {
      detail.questions.find((q) => q._id === selection.id)?.passageIds.forEach((p) => warn.add(p));
    }
    return { highlighted: hi, warning: warn, spanMark: mark };
  }, [selection, index, detail.questions]);

  const selectedPassage =
    selection?.kind === "passage" ? selection.id : selection?.kind === "annotation" ? (index.annotations.get(selection.id)?.passageId ?? null) : null;

  const select = (s: Selection) => setSelection(s);

  return (
    <section aria-label={`Episode ${episode.worklistId}`} className="flex min-w-0 flex-1 flex-col">
      <EpisodeHeader detail={detail} paused={paused} onClose={onClose} />
      {run && <StageRail stages={run.stages} attempts={detail.attempts.filter((a) => a.runId === run._id)} />}
      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(26rem,0.95fr)]">
        <div className="scrollbar-thin min-h-0 overflow-y-auto bg-[#0a1424] p-4 md:p-6">
          {document ? (
            <PaperNote
              document={document}
              highlighted={highlighted}
              warning={warning}
              selectedPassage={selectedPassage}
              spanMark={spanMark}
              onSelectPassage={(id) => select({ kind: "passage", id })}
            />
          ) : (
            <p className="text-muted">No source document.</p>
          )}
        </div>
        <div className="scrollbar-thin min-h-0 space-y-4 overflow-y-auto border-l border-line p-4">
          <ResultCard detail={detail} />
          <QuestionCards detail={detail} selection={selection} onSelect={select} />
          {selection && (
            <Inspector detail={detail} index={index} selection={selection} onSelect={select} onClear={() => select(null)} />
          )}
          <div role="tablist" aria-label="Episode detail" className="flex flex-wrap gap-1 border-b border-line">
            {TABS.map((t) => (
              <button
                key={t}
                role="tab"
                type="button"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${tab === t ? "border-accent text-accent" : "border-transparent text-muted hover:text-text"}`}
              >
                {t}
                {t === "Facts" && detail.facts.length > 0 && <Count n={detail.facts.length} />}
                {t === "Hints" && detail.annotations.length > 0 && <Count n={detail.annotations.length} />}
                {t === "References" && detail.references.length > 0 && <Count n={detail.references.length} />}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === "Codes" && <CodesPanel detail={detail} proposal={proposal} selection={selection} onSelect={select} />}
            {tab === "Facts" && <FactsPanel detail={detail} selection={selection} onSelect={select} />}
            {tab === "Hints" && <HintsPanel detail={detail} selection={selection} onSelect={select} />}
            {tab === "References" && <ReferencesPanel refs={detail.references} />}
            {tab === "Checks" && <ChecksPanel checks={run?.checks ?? []} />}
            {tab === "Run log" && <RunLog detail={detail} />}
          </div>
        </div>
      </div>
    </section>
  );
}

function Count({ n }: { n: number }) {
  return <span className="ml-1.5 rounded-full bg-white/10 px-1.5 text-xs text-muted tabular-nums">{n}</span>;
}

function useEvidenceIndex(detail: Detail) {
  return useMemo(() => {
    const facts = new Map(detail.facts.map((f) => [f.id, f]));
    const annotations = new Map(detail.annotations.map((a) => [a.id, a]));
    const codes: { key: string; code: ProposedCode; group: string }[] = [];
    detail.proposal?.diagnoses.forEach((d, i) => codes.push({ key: `dx:${i}`, code: d, group: "Diagnoses" }));
    detail.proposal?.procedureGroups.forEach((g, gi) => g.codes.forEach((c, i) => codes.push({ key: `pg:${gi}:${i}`, code: c, group: g.label })));
    const passageText = new Map<string, string>();
    detail.document?.sections.forEach((s) => s.passages.forEach((p) => passageText.set(p.id, p.text)));
    return { facts, annotations, codes, passageText };
  }, [detail]);
}
type EvidenceIndex = ReturnType<typeof useEvidenceIndex>;

function EpisodeHeader({ detail, paused, onClose }: { detail: Detail; paused: boolean; onClose: () => void }) {
  const { episode, run } = detail;
  const approve = useMutation(api.presenter.approve);
  const retry = useMutation(api.presenter.retry);
  const rerun = useMutation(api.presenter.rerun);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const act = (p: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    p()
      .catch((e: unknown) => setError(e instanceof ConvexError ? String(e.data) : "Action failed."))
      .finally(() => setBusy(false));
  };
  const canApprove = episode.review === "ready";
  const approveHint =
    episode.result !== "sent_to_review"
      ? null
      : episode.review === "approved"
        ? "Final coding approved."
        : episode.review === "ready"
          ? "All Open questions answered and all checks pass."
          : episode.review === "open"
            ? "Answer the Open question to enable approval."
            : "Approval blocked: see the Open question or failed checks.";

  return (
    <div className="shrink-0 border-b border-line bg-surface px-4 py-3">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <button type="button" onClick={onClose} className="rounded-md border border-line-strong px-2 py-1 text-sm text-muted hover:text-text" aria-label="Back to Worklist">
          ← Worklist
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="font-mono text-xl font-bold">{episode.worklistId}</h2>
            <ResultBadge row={episode} large />
            <span className="text-sm">
              <ProcessingLabel row={episode} paused={paused} />
            </span>
            {episode.origin === "presenter" && <span className="rounded bg-white/10 px-2 py-0.5 text-xs text-muted">Presenter teaching fixture</span>}
          </div>
          <p className="mt-1 text-sm">
            <span className="font-medium">{episode.displayName}</span>
            <span className="text-muted"> · age {episode.age} · {episode.laterality} · {episode.summary}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Submitted {formatClock(episode.submittedAt)}
            {episode.firstActionableAt && <> · first actionable result in <span className="font-mono">{formatDuration(episode.firstActionableAt - episode.submittedAt)}</span></>}
            {run && <> · run {run.number}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {episode.processing === "failed" && (
            <button type="button" disabled={busy} onClick={() => act(() => retry({ episodeId: episode._id }))} className="rounded-md bg-danger px-3 py-1.5 text-sm font-semibold text-bg disabled:opacity-50">
              ↻ Retry failed stage
            </button>
          )}
          {episode.result === "sent_to_review" && episode.review !== "approved" && (
            <button
              type="button"
              disabled={busy || !canApprove}
              onClick={() => act(() => approve({ episodeId: episode._id }))}
              title={approveHint ?? undefined}
              className="rounded-md bg-success px-3 py-1.5 text-sm font-semibold text-bg disabled:cursor-not-allowed disabled:opacity-40"
            >
              ✓ Approve final coding
            </button>
          )}
          <button
            type="button"
            disabled={busy || episode.processing === "running"}
            onClick={() => {
              if (window.confirm("Start a new full run? The current run and its evidence stay in the history.")) act(() => rerun({ episodeId: episode._id }));
            }}
            className="rounded-md border border-line-strong px-3 py-1.5 text-sm hover:bg-raised disabled:opacity-40"
          >
            Rerun
          </button>
        </div>
      </div>
      {approveHint && episode.review !== "approved" && <p className="mt-1 text-right text-xs text-muted">{approveHint}</p>}
      {error && (
        <p role="alert" className="mt-2 rounded-md bg-danger/10 px-3 py-1.5 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function StageRail({ stages, attempts }: { stages: NonNullable<Detail["run"]>["stages"]; attempts: Detail["attempts"] }) {
  return (
    <ol aria-label="Pipeline stages" className="scrollbar-thin flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-surface px-4 py-2">
      {PIPELINE_STAGES.map((s, i) => {
        const st = stages.find((x) => x.stage === s.stage);
        const status = st?.status ?? "pending";
        const tries = attempts.filter((a) => a.stage === s.stage);
        const dur = st?.startedAt && st.finishedAt ? st.finishedAt - st.startedAt : null;
        const dot =
          status === "done"
            ? "bg-accent"
            : status === "running"
              ? "bg-accent animate-pulse-dot"
              : status === "failed"
                ? "bg-danger"
                : status === "queued"
                  ? "border-2 border-accent"
                  : "border-2 border-line-strong";
        return (
          <li key={s.stage} className="flex min-w-[8.5rem] flex-1 items-start gap-2">
            <span className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className={`text-xs font-medium ${status === "pending" ? "text-muted" : "text-text"}`}>
                <span className="text-muted">{i + 1}.</span> {s.label}
              </p>
              <p className="truncate text-xs text-muted">
                {status}
                {dur !== null && s.stage !== "packet" && ` · ${formatDuration(dur)}`}
                {tries.length > 1 && ` · ${tries.length} attempts`}
              </p>
              <p className="truncate text-xs text-muted/80">{s.role}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ResultCard({ detail }: { detail: Detail }) {
  const { run, episode } = detail;
  if (!run) return null;
  const proposer = detail.attempts.find((a) => a.runId === run._id && a.stage === "propose" && a.status === "succeeded");
  return (
    <div className={`rounded-xl border p-3 ${episode.processing === "failed" ? "border-danger/40 bg-danger/10" : episode.result === "auto_coded" || episode.review === "approved" ? "border-success/30 bg-success/5" : episode.result === "sent_to_review" ? "border-warning/30 bg-warning/5" : "border-line bg-raised"}`}>
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">Coding result</p>
      {run.reason ? (
        <p className="mt-1 text-sm">{run.reason}</p>
      ) : (
        <p className="mt-1 text-sm text-muted">Processing live; results appear as each stage is accepted.</p>
      )}
      {run.failure && (
        <p className="mt-2 font-mono text-xs break-words text-danger">
          {run.failedStage}: {run.failure}
        </p>
      )}
      {proposer && (
        <p className="mt-2 text-xs text-muted">
          Codes proposed by <span className="font-mono text-text">{proposer.model}</span> (Gemini Flash) emulating MedGemma · no confidence scores are shown.
        </p>
      )}
    </div>
  );
}

const BASIS_LABEL: Record<string, string> = {
  teaching_policy: "Demo teaching policy",
  source_conflict: "Source contradiction",
  reference_gate: "Reference gate not passed",
  system_failure: "System failure",
};

function QuestionCards({ detail, selection, onSelect }: { detail: Detail; selection: Selection; onSelect: (s: Selection) => void }) {
  const answer = useMutation(api.presenter.answerQuestion);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (detail.questions.length === 0) return null;
  return (
    <div className="space-y-3">
      {detail.questions.map((q) => {
        const active = selection?.kind === "question" && selection.id === q._id;
        return (
          <div key={q._id} className={`rounded-xl border p-3 ${q.status === "answered" ? "border-line bg-raised" : "border-warning/40 bg-warning/10"}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold tracking-wide text-warning uppercase">
                {q.status === "answered" ? "Open question · answered" : "Open question"} · {BASIS_LABEL[q.basis]}
              </p>
              {q.passageIds.length > 0 && (
                <button type="button" aria-pressed={active} onClick={() => onSelect(active ? null : { kind: "question", id: q._id })} className="text-xs text-accent underline">
                  {active ? "Hide passages" : `Show ${q.passageIds.length} passage${q.passageIds.length > 1 ? "s" : ""}`}
                </button>
              )}
            </div>
            <p className="mt-1 font-semibold">{q.question}</p>
            <p className="mt-1 text-sm text-muted">
              <span className="text-text">Re-read:</span> {q.revisited}
            </p>
            <p className="mt-1 text-sm text-muted">
              <span className="text-text">Blocks:</span> {q.blocks}
            </p>
            {q.status === "answered" && q.answer ? (
              <p className="mt-2 text-sm text-success">
                ✓ {q.answer.label} <span className="text-muted">· {formatClock(q.answer.at)}</span>
              </p>
            ) : q.answerable ? (
              <div className="mt-2 space-y-2">
                {q.options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setError(null);
                      setPending(true);
                      answer({ questionId: q._id, optionId: o.id })
                        .catch((e: unknown) => setError(e instanceof ConvexError ? String(e.data) : "Could not record the answer."))
                        .finally(() => setPending(false));
                    }}
                    className="block w-full disabled:opacity-60 rounded-lg border border-warning/50 px-3 py-2 text-left hover:bg-warning/15"
                  >
                    <span className="block text-sm font-semibold">{o.label}</span>
                    <span className="block text-xs text-muted">{o.detail}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm font-medium text-warning">Cannot be answered in this demo; final approval stays blocked.</p>
            )}
          </div>
        );
      })}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

function CodePill({ code, tag, selected, onClick, dim = false }: { code: string; tag?: string; selected: boolean; onClick: () => void; dim?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex w-full items-baseline gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
        selected ? "border-accent bg-accent/15" : "border-line bg-raised hover:border-line-strong"
      } ${dim ? "opacity-60" : ""}`}
    >
      <span className="w-14 shrink-0 font-mono text-base font-bold text-accent">{code}</span>
      <span className="flex-1 text-sm">{codeTitle(code)}</span>
      {tag && <span className="font-mono text-xs text-muted uppercase">{tag}</span>}
    </button>
  );
}

function CodesPanel({ detail, proposal, selection, onSelect }: { detail: Detail; proposal: Detail["proposal"]; selection: Selection; onSelect: (s: Selection) => void }) {
  if (!proposal) {
    return <p className="text-sm text-muted">No codes yet. The MedGemma-role proposal appears once facts and references are accepted.</p>;
  }
  const isSel = (key: string) => selection?.kind === "code" && selection.key === key;
  return (
    <div className="space-y-4">
      {detail.run?.amended && (
        <p className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-xs">
          Amended by a recorded presenter decision. The model's original proposal is kept in the run history.
        </p>
      )}
      <div>
        <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Diagnoses · ICD-10 5th Ed</h3>
        <div className="space-y-1.5">
          {proposal.diagnoses.map((d, i) => (
            <CodePill key={i} code={d.code} tag={d.position ?? "secondary"} selected={isSel(`dx:${i}`)} onClick={() => onSelect({ kind: "code", key: `dx:${i}`, code: d })} />
          ))}
        </div>
      </div>
      {proposal.procedureGroups.map((g, gi) => (
        <div key={gi}>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Procedures · OPCS-4.11 · {g.label}</h3>
          <ol className="space-y-1.5">
            {g.codes.map((c, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-5 text-right font-mono text-xs text-muted">{i + 1}</span>
                <CodePill code={c.code} selected={isSel(`pg:${gi}:${i}`)} onClick={() => onSelect({ kind: "code", key: `pg:${gi}:${i}`, code: c })} />
              </li>
            ))}
          </ol>
        </div>
      ))}
      {proposal.omissions.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Withheld by the proposer</h3>
          {proposal.omissions.map((o, i) => (
            <div key={i} className="rounded-lg border border-dashed border-warning/50 px-3 py-2 text-sm">
              <span className="font-mono font-bold text-warning">{o.blocked}</span> <span className="text-muted">— {o.reason}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted">Select a code to see its facts, highlighted source passages, explanation and references.</p>
    </div>
  );
}

function FactsPanel({ detail, selection, onSelect }: { detail: Detail; selection: Selection; onSelect: (s: Selection) => void }) {
  if (detail.facts.length === 0) return <p className="text-sm text-muted">No accepted Clinical facts yet.</p>;
  return (
    <div className="space-y-2">
      {detail.conflicts.map((c) => (
        <div key={c.id} className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <p className="font-mono text-xs text-warning uppercase">Contradiction · {c.topic}</p>
          <p className="mt-1">{c.description}</p>
          <ul className="mt-1 space-y-0.5">
            {c.sides.map((s, i) => (
              <li key={i} className="text-xs text-muted">
                <span className="text-text">{s.value}</span> — {s.passageIds.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {detail.facts.map((f) => (
        <FactCard key={f.id} fact={f} selected={selection?.kind === "fact" && selection.id === f.id} onClick={() => onSelect({ kind: "fact", id: f.id })} />
      ))}
    </div>
  );
}

function FactCard({ fact, selected, onClick }: { fact: Fact; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`block w-full rounded-lg border px-3 py-2 text-left ${selected ? "border-accent bg-accent/15" : "border-line bg-raised hover:border-line-strong"}`}
    >
      <span className="flex items-center gap-2 font-mono text-xs uppercase">
        <span className="text-muted">{fact.id}</span>
        <span className="text-accent">{fact.kind}</span>
        {fact.laterality !== "not_applicable" && <span className="text-muted">· {fact.laterality}</span>}
        {fact.source === "presenter" && <span className="text-warning">· presenter decision</span>}
        <span className="ml-auto text-muted normal-case">{fact.passageIds.length} passage{fact.passageIds.length > 1 ? "s" : ""}</span>
      </span>
      <span className="mt-0.5 block text-sm">{fact.statement}</span>
    </button>
  );
}

function HintsPanel({ detail, selection, onSelect }: { detail: Detail; selection: Selection; onSelect: (s: Selection) => void }) {
  const annotator = detail.attempts.find((a) => a.stage === "annotate" && a.status === "succeeded");
  return (
    <div className="space-y-3">
      <p className="rounded-md bg-white/5 px-3 py-2 text-xs text-muted">
        Annotations are <span className="text-text">hints</span> from {annotator?.model ?? "Gemini Flash"} emulating MedCAT. They are never the reason for a code.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {detail.annotations.map((a) => {
          const sel = selection?.kind === "annotation" && selection.id === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onSelect({ kind: "annotation", id: a.id })}
              aria-pressed={sel}
              title={`“${a.span}” in ${a.passageId}`}
              className={`rounded-md border px-2 py-1 text-left text-xs ${sel ? "border-accent bg-accent/15" : "border-line bg-raised hover:border-line-strong"} ${a.status === "negated" ? "line-through decoration-muted" : ""}`}
            >
              <span className="text-accent">{a.concept}</span> <span className="font-mono text-xs text-muted uppercase">{a.category}{a.status !== "affirmed" && ` · ${a.status}`}</span>
            </button>
          );
        })}
      </div>
      {detail.rejectedAnnotations.length > 0 && (
        <div className="text-xs text-muted">
          <p className="font-semibold text-danger">Rejected hints (span not exact)</p>
          {detail.rejectedAnnotations.map((r, i) => (
            <p key={i}>
              {r.passageId}: “{r.span}” — {r.reason}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function ReferencesPanel({ refs }: { refs: Detail["references"] }) {
  if (refs.length === 0) return <p className="text-sm text-muted">No references retrieved yet.</p>;
  return (
    <div className="space-y-2">
      {refs.map((r) => (
        <ReferenceCard key={r.id} r={r} />
      ))}
    </div>
  );
}

function ReferenceCard({ r }: { r: Detail["references"][number] }) {
  return (
    <div className="rounded-lg border border-line bg-raised px-3 py-2">
      <p className="font-mono text-xs text-muted">
        {r.source}
        {r.page && ` · p.${r.page}`}
      </p>
      <p className="text-sm">
        <span className="font-mono font-bold text-accent">{r.code ?? r.standard}</span> {r.title}
      </p>
      {(r.note || r.summary) && <p className="mt-0.5 text-xs text-muted">{r.note ?? r.summary}</p>}
      {r.url && (
        <a href={r.url} target="_blank" rel="noreferrer" className="text-xs text-accent underline">
          Source ↗
        </a>
      )}
    </div>
  );
}

function ChecksPanel({ checks }: { checks: NonNullable<Detail["run"]>["checks"] }) {
  if (checks.length === 0) return <p className="text-sm text-muted">Checks run after the proposal is accepted.</p>;
  return (
    <ul className="space-y-1.5">
      {checks.map((c) => (
        <li key={c.id} className="flex gap-3 rounded-lg border border-line bg-raised px-3 py-2">
          <span className={`font-mono text-sm font-bold ${c.status === "passed" ? "text-success" : c.status === "blocked" ? "text-warning" : "text-danger"}`}>
            {c.status === "passed" ? "✓" : c.status === "blocked" ? "■" : "✕"}
          </span>
          <div>
            <p className="text-sm font-medium">
              <span className="font-mono text-muted">{c.id}</span> {c.label} <span className="text-xs text-muted">· {c.status}</span>
            </p>
            <p className="text-xs text-muted">{c.detail}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function RunLog({ detail }: { detail: Detail }) {
  const { run } = detail;
  return (
    <div className="space-y-4 text-xs">
      {run && (
        <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1">
          <dt className="text-muted">Run</dt>
          <dd>
            {run.number} · {run.status}
          </dd>
          <dt className="text-muted">Reference library</dt>
          <dd className="font-mono">{run.referenceVersion}</dd>
          <dt className="text-muted">Preset</dt>
          <dd className="font-mono">{run.presetVersion}</dd>
          <dt className="text-muted">Prompts</dt>
          <dd className="font-mono">{Object.values(run.promptVersions).join(" · ")}</dd>
        </dl>
      )}
      <div>
        <p className="mb-1 font-semibold">Model attempts</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-muted">
              <tr>
                <th className="py-1 pr-2 font-normal">Stage</th>
                <th className="py-1 pr-2 font-normal">Role / model</th>
                <th className="py-1 pr-2 font-normal">#</th>
                <th className="py-1 pr-2 font-normal">Status</th>
                <th className="py-1 pr-2 text-right font-normal">Wait</th>
                <th className="py-1 pr-2 text-right font-normal">Model</th>
              </tr>
            </thead>
            <tbody>
              {detail.attempts.map((a) => (
                <tr key={a._id} className={`border-t border-line align-top ${run && a.runId !== run._id ? "opacity-50" : ""}`}>
                  <td className="py-1 pr-2">{a.stage}</td>
                  <td className="py-1 pr-2">
                    {a.role} · <span className="font-mono">{a.model ?? "—"}</span>
                  </td>
                  <td className="py-1 pr-2 font-mono">
                    {a.round > 0 ? `r${a.round}.` : ""}
                    {a.attemptNumber}
                  </td>
                  <td className={`py-1 pr-2 ${a.status === "succeeded" ? "text-success" : a.status === "failed" || a.status === "timed_out" ? "text-danger" : "text-muted"}`}>
                    {a.status}
                    {a.error && <span className="block max-w-[18rem] break-words text-muted">{a.error}</span>}
                  </td>
                  <td className="py-1 pr-2 text-right font-mono">{a.startedAt ? formatDuration(a.startedAt - a.queuedAt) : "—"}</td>
                  <td className="py-1 pr-2 text-right font-mono">{a.latencyMs !== null ? formatDuration(a.latencyMs) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {detail.decisions.length > 0 && (
        <div>
          <p className="mb-1 font-semibold">Presenter decisions</p>
          <ul className="space-y-1">
            {detail.decisions.map((d) => (
              <li key={d._id}>
                <span className="font-mono text-muted">{formatClock(d.at)}</span> <span className="text-accent">{d.kind}</span> {d.summary}
              </li>
            ))}
          </ul>
        </div>
      )}
      {detail.finalCoding && (
        <div>
          <p className="mb-1 font-semibold">Final coding</p>
          <p className="font-mono">
            {detail.finalCoding.diagnoses.map((d) => d.code).join(", ")} | {detail.finalCoding.procedures.map((p) => p.code).join(", ")}
          </p>
          <p className="text-muted">
            Completed by {detail.finalCoding.completedBy} at {formatClock(detail.finalCoding.completedAt)}
          </p>
        </div>
      )}
    </div>
  );
}

// Selection inspector: code → facts, passages, references; fact → passages,
// hints, codes; passage → facts, codes, hints.
function Inspector({
  detail,
  index,
  selection,
  onSelect,
  onClear,
}: {
  detail: Detail;
  index: EvidenceIndex;
  selection: NonNullable<Selection>;
  onSelect: (s: Selection) => void;
  onClear: () => void;
}) {
  const codesCitingFacts = (factIds: string[]) => index.codes.filter((c) => c.code.factIds.some((f) => factIds.includes(f)));
  const passageLink = (id: string) => (
    <button key={id} type="button" onClick={() => onSelect({ kind: "passage", id })} className="block w-full rounded-md bg-paper px-2 py-1 text-left text-xs text-ink hover:ring-2 hover:ring-accent">
      <span className="mr-2 font-mono text-stone-500">{id.split(".").pop()}</span>
      {index.passageText.get(id) ?? "(missing passage)"}
    </button>
  );
  const factLink = (f: Fact) => <FactCard key={f.id} fact={f} selected={false} onClick={() => onSelect({ kind: "fact", id: f.id })} />;
  const codeLinks = (list: EvidenceIndex["codes"]) =>
    list.length === 0 ? (
      <p className="text-xs text-muted">No code cites this.</p>
    ) : (
      <div className="flex flex-wrap gap-1.5">
        {list.map((c) => (
          <button key={c.key} type="button" onClick={() => onSelect({ kind: "code", key: c.key, code: c.code })} className="rounded-md border border-line-strong px-2 py-0.5 font-mono text-sm font-bold text-accent hover:bg-accent/10">
            {c.code.code}
          </button>
        ))}
      </div>
    );

  let title: string;
  let body: ReactNode;
  if (selection.kind === "code") {
    const c = selection.code;
    const facts = c.factIds.map((id) => index.facts.get(id)).filter((f): f is Fact => Boolean(f));
    const passages = [...new Set(facts.flatMap((f) => f.passageIds))];
    const refs = c.referenceIds.map((id) => detail.references.find((r) => r.id === id)).filter((r): r is Detail["references"][number] => Boolean(r));
    const missingRefs = c.referenceIds.filter((id) => !detail.references.some((r) => r.id === id));
    title = `${c.code} · ${codeTitle(c.code)}`;
    body = (
      <>
        <Block label="Explanation">
          <p className="text-sm">{c.explanation}</p>
        </Block>
        <Block label={`Supporting facts (${facts.length})`}>{facts.length ? facts.map(factLink) : <p className="text-xs text-danger">No valid supporting fact.</p>}</Block>
        <Block label={`Source passages (${passages.length})`}>{passages.map(passageLink)}</Block>
        <Block label={`Coding references (${refs.length})`}>
          {refs.map((r) => (
            <ReferenceCard key={r.id} r={r} />
          ))}
          {missingRefs.length > 0 && <p className="text-xs text-danger">Not retrieved: {missingRefs.join(", ")}</p>}
        </Block>
      </>
    );
  } else if (selection.kind === "fact") {
    const f = index.facts.get(selection.id);
    title = f ? `Fact ${f.id} · ${f.kind}` : "Fact";
    body = f ? (
      <>
        <p className="text-sm">{f.statement}</p>
        <Block label="Source passages">{f.passageIds.map(passageLink)}</Block>
        {f.annotationIds.length > 0 && (
          <Block label="Annotation hints">
            <p className="text-xs text-muted">{f.annotationIds.map((id) => index.annotations.get(id)?.concept ?? id).join(" · ")}</p>
          </Block>
        )}
        <Block label="Codes citing this fact">{codeLinks(codesCitingFacts([f.id]))}</Block>
      </>
    ) : null;
  } else if (selection.kind === "passage") {
    const facts = detail.facts.filter((f) => f.passageIds.includes(selection.id));
    const hints = detail.annotations.filter((a) => a.passageId === selection.id);
    title = `Passage ${selection.id}`;
    body = (
      <>
        <p className="rounded-md bg-paper px-2 py-1 text-sm text-ink">{index.passageText.get(selection.id)}</p>
        <Block label={`Facts citing this passage (${facts.length})`}>{facts.length ? facts.map(factLink) : <p className="text-xs text-muted">No fact cites this passage.</p>}</Block>
        <Block label="Codes supported via those facts">{codeLinks(codesCitingFacts(facts.map((f) => f.id)))}</Block>
        {hints.length > 0 && (
          <Block label="Annotation hints">
            <div className="flex flex-wrap gap-1">
              {hints.map((a) => (
                <button key={a.id} type="button" onClick={() => onSelect({ kind: "annotation", id: a.id })} className="rounded border border-line px-1.5 py-0.5 text-xs text-accent hover:bg-white/5">
                  {a.concept}
                </button>
              ))}
            </div>
          </Block>
        )}
      </>
    );
  } else if (selection.kind === "annotation") {
    const a = index.annotations.get(selection.id);
    title = a ? `Hint · ${a.concept}` : "Hint";
    body = a ? (
      <p className="text-sm">
        “<span className="font-mono">{a.span}</span>” in {a.passageId} · {a.category} · {a.status}. Hints are not evidence on their own.
      </p>
    ) : null;
  } else {
    const q = detail.questions.find((x) => x._id === selection.id);
    title = "Open question passages";
    body = q ? <Block label={`${q.passageIds.length} passages`}>{q.passageIds.map(passageLink)}</Block> : null;
  }

  return (
    <div className="rounded-xl border border-accent/40 bg-accent/5 p-3" aria-live="polite">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">{title}</p>
        <button type="button" onClick={onClear} className="text-xs text-muted hover:text-text" aria-label="Clear selection">
          ✕ Clear
        </button>
      </div>
      <div className="mt-2 space-y-3">{body}</div>
    </div>
  );
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
