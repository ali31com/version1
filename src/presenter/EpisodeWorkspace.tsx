import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useMemo, useState, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ANNOTATION_CATEGORIES } from "../../convex/lib/contracts";
import { codeTitle } from "../../convex/lib/references";
import { ProcessingLabel, ResultBadge } from "../components/badges";
import { stageLabel } from "../lib/labels";
import { CATEGORY_TINT } from "./medcat";
import { PaperNote } from "./PaperNote";

type Detail = NonNullable<FunctionReturnType<typeof api.presenter.episodeDetail>>;
type Fact = Detail["facts"][number];
type ProposedCode = NonNullable<Detail["proposal"]>["diagnoses"][number];

export type Selection =
  | { kind: "code"; key: string; code: ProposedCode }
  | { kind: "annotation"; id: string }
  | { kind: "question"; id: string }
  | null;

export function EpisodeWorkspace({ episodeId, paused, onClose }: { episodeId: Id<"episodes">; paused: boolean; onClose: () => void }) {
  const detail = useQuery(api.presenter.episodeDetail, { episodeId });
  const [selection, setSelection] = useState<Selection>(null);

  if (detail === undefined) return <div className="grid flex-1 place-items-center text-muted">Loading Episode…</div>;
  if (detail === null) return <div className="grid flex-1 place-items-center text-muted">Episode not found.</div>;
  return <Workspace detail={detail} paused={paused} onClose={onClose} selection={selection} setSelection={setSelection} />;
}

function Workspace({
  detail,
  paused,
  onClose,
  selection,
  setSelection,
}: {
  detail: Detail;
  paused: boolean;
  onClose: () => void;
  selection: Selection;
  setSelection: (s: Selection) => void;
}) {
  const { episode, run, document, proposal } = detail;
  const index = useEvidenceIndex(detail);

  const { highlighted, warning } = useMemo(() => {
    const hi = new Set<string>();
    const warn = new Set<string>();
    if (selection?.kind === "code") {
      for (const f of selection.code.factIds) index.facts.get(f)?.passageIds.forEach((p) => hi.add(p));
    } else if (selection?.kind === "question") {
      detail.questions.find((q) => q._id === selection.id)?.passageIds.forEach((p) => warn.add(p));
    }
    return { highlighted: hi, warning: warn };
  }, [selection, index, detail.questions]);

  const select = (s: Selection) => setSelection(s);

  return (
    <section aria-label={`Episode ${episode.displayName} (${episode.worklistId})`} className="flex min-w-0 flex-1 flex-col">
      <EpisodeHeader detail={detail} paused={paused} onClose={onClose} />
      {run && <StageRail stages={run.stages} />}
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)_minmax(0,1fr)]">
        <div className="scrollbar-thin min-h-0 overflow-y-auto bg-[#0a1424] p-4">
          {document ? (
            <PaperNote
              document={document}
              annotations={detail.annotations}
              highlighted={highlighted}
              warning={warning}
              selectedAnnotation={selection?.kind === "annotation" ? selection.id : null}
              onSelectAnnotation={(id) => select({ kind: "annotation", id })}
            />
          ) : (
            <p className="text-muted">No source document.</p>
          )}
        </div>
        <Column title="MedCAT">
          <MedcatPanel detail={detail} selection={selection} onSelect={select} />
        </Column>
        <Column title="MedGemma">
          <QuestionCards detail={detail} selection={selection} onSelect={select} />
          <CodesPanel detail={detail} index={index} proposal={proposal} selection={selection} onSelect={select} />
        </Column>
      </div>
    </section>
  );
}

function Column({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="scrollbar-thin min-h-0 space-y-4 overflow-y-auto border-l border-line p-4">
      <h2 className="text-xl font-semibold text-accent">{title}</h2>
      {children}
    </section>
  );
}

function useEvidenceIndex(detail: Detail) {
  return useMemo(() => ({ facts: new Map(detail.facts.map((f) => [f.id, f])) }), [detail]);
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
  return (
    <div className="shrink-0 border-b border-line bg-surface px-4 py-3">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <button type="button" onClick={onClose} className="rounded-md border border-line-strong px-2 py-1 text-muted hover:text-text" aria-label="Back to Worklist">
          ← Worklist
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="truncate text-3xl font-bold">{episode.displayName}</h2>
            <span className="font-mono text-sm text-muted">{episode.worklistId}</span>
            <ResultBadge row={episode} large />
            <ProcessingLabel row={episode} paused={paused} />
          </div>
          <p className="mt-1 text-muted">
            age {episode.age} · {episode.laterality} · {episode.summary}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {episode.processing === "failed" && (
            <button type="button" disabled={busy} onClick={() => act(() => retry({ episodeId: episode._id }))} className="rounded-md bg-danger px-3 py-1.5 font-semibold text-bg disabled:opacity-50">
              ↻ Retry failed stage
            </button>
          )}
          {episode.result === "sent_to_review" && episode.review !== "approved" && (
            <button
              type="button"
              disabled={busy || !canApprove}
              onClick={() => act(() => approve({ episodeId: episode._id }))}
              className="rounded-md bg-success px-3 py-1.5 font-semibold text-bg disabled:cursor-not-allowed disabled:opacity-40"
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
            className="rounded-md border border-line-strong px-3 py-1.5 hover:bg-raised disabled:opacity-40"
          >
            Rerun
          </button>
        </div>
      </div>
      {run?.failure && (
        <p className="mt-2 font-mono text-sm break-words text-danger">
          {stageLabel(run.failedStage ?? "")}: {run.failure}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 rounded-md bg-danger/10 px-3 py-1.5 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

// Five presentation steps; the packet stage is hidden and question/check
// stages are folded into Result.
const RAIL_STEPS = [
  { label: "MedCAT annotations", stages: ["annotate"] },
  { label: "Clinical facts", stages: ["extract"] },
  { label: "References", stages: ["retrieve"] },
  { label: "Proposed codes", stages: ["propose"] },
  { label: "Result", stages: ["resolve", "route"] },
] as const;

function StageRail({ stages }: { stages: NonNullable<Detail["run"]>["stages"] }) {
  return (
    <ol aria-label="Pipeline stages" className="flex shrink-0 items-center gap-2 border-b border-line bg-surface px-4 py-3">
      {RAIL_STEPS.map((step, i) => {
        const statuses = step.stages.map((name) => stages.find((x) => x.stage === name)?.status ?? "pending");
        const status = statuses.includes("failed")
          ? "failed"
          : statuses.every((x) => x === "done")
            ? "done"
            : statuses.includes("running")
              ? "running"
              : statuses.some((x) => x !== "pending")
                ? "queued"
                : "pending";
        const dot =
          status === "done"
            ? "bg-accent text-bg"
            : status === "running"
              ? "bg-accent animate-pulse-dot"
              : status === "failed"
                ? "bg-danger text-bg"
                : status === "queued"
                  ? "border-2 border-accent"
                  : "border-2 border-line-strong";
        return (
          <li key={step.label} className="flex flex-1 items-center gap-2">
            {i > 0 && <span className={`h-px flex-1 ${status === "pending" ? "bg-line-strong" : "bg-accent/60"}`} aria-hidden="true" />}
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm font-bold ${dot}`} aria-label={status} role="img">
              {status === "done" ? "✓" : status === "failed" ? "✕" : ""}
            </span>
            <span className={`whitespace-nowrap font-medium ${status === "pending" ? "text-muted" : "text-text"}`}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

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
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold">{q.question}</p>
              {q.passageIds.length > 0 && (
                <button type="button" aria-pressed={active} onClick={() => onSelect(active ? null : { kind: "question", id: q._id })} className="shrink-0 text-sm text-accent underline">
                  {active ? "Hide passages" : "Show passages"}
                </button>
              )}
            </div>
            {q.status === "answered" && q.answer ? (
              <p className="mt-2 text-success">✓ {q.answer.label}</p>
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
                    className="block w-full rounded-lg border border-warning/50 px-3 py-2 text-left font-semibold hover:bg-warning/15 disabled:opacity-60"
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
      {error && <p role="alert" className="text-danger">{error}</p>}
    </div>
  );
}

function CodesPanel({
  detail,
  index,
  proposal,
  selection,
  onSelect,
}: {
  detail: Detail;
  index: EvidenceIndex;
  proposal: Detail["proposal"];
  selection: Selection;
  onSelect: (s: Selection) => void;
}) {
  if (!proposal) {
    const stage = detail.run?.stages.find((s) => s.stage === "propose")?.status;
    return <p className="text-muted">{stage === "failed" ? "No codes." : "Coding…"}</p>;
  }
  const row = (key: string, code: ProposedCode, tag: string) => {
    const open = selection?.kind === "code" && selection.key === key;
    return (
      <CodeRow key={key} code={code} tag={tag} open={open} index={index} references={detail.references} onToggle={() => onSelect(open ? null : { kind: "code", key, code })} />
    );
  };
  return (
    <div className="space-y-4">
      <div>
        <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">Diagnoses · ICD-10</h3>
        <div className="space-y-2">{proposal.diagnoses.map((d, i) => row(`dx:${i}`, d, d.position ?? "secondary"))}</div>
      </div>
      {proposal.procedureGroups.map((g, gi) => (
        <div key={gi}>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">Procedures · OPCS-4 · {g.label}</h3>
          <div className="space-y-2">{g.codes.map((c, i) => row(`pg:${gi}:${i}`, c, String(i + 1)))}</div>
        </div>
      ))}
      {proposal.omissions.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">Withheld</h3>
          {proposal.omissions.map((o, i) => (
            <div key={i} className="rounded-lg border border-dashed border-warning/50 px-3 py-2">
              <span className="font-mono font-bold text-warning">{o.blocked}</span> <span className="text-muted">— {o.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// A code expands in place to its explanation, supporting facts and references;
// its passages are highlighted on the note by the parent selection.
function CodeRow({
  code,
  tag,
  open,
  index,
  references,
  onToggle,
}: {
  code: ProposedCode;
  tag: string;
  open: boolean;
  index: EvidenceIndex;
  references: Detail["references"];
  onToggle: () => void;
}) {
  const facts = code.factIds.map((id) => index.facts.get(id)).filter((f): f is Fact => Boolean(f));
  const refs = code.referenceIds.map((id) => references.find((r) => r.id === id)).filter((r): r is Detail["references"][number] => Boolean(r));
  return (
    <div className={`rounded-lg border transition-colors ${open ? "border-accent bg-accent/10" : "border-line bg-raised hover:border-line-strong"}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-baseline gap-3 px-3 py-2 text-left">
        <span className="w-20 shrink-0 font-mono text-lg font-bold text-accent">{code.code}</span>
        <span className="flex-1">{codeTitle(code.code)}</span>
        <span className="font-mono text-sm text-muted uppercase">{tag}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line px-3 py-3">
          <p>{code.explanation}</p>
          {facts.length > 0 && (
            <ul className="space-y-1">
              {facts.map((f) => (
                <li key={f.id} className="flex gap-2">
                  <span className="shrink-0 font-mono text-sm text-accent uppercase">{f.kind}</span>
                  <span>{f.statement}</span>
                </li>
              ))}
            </ul>
          )}
          {refs.length > 0 && <p className="text-sm text-muted">{refs.map((r) => `${r.code ?? r.standard} · ${r.source}`).join("  ·  ")}</p>}
        </div>
      )}
    </div>
  );
}

function MedcatPanel({ detail, selection, onSelect }: { detail: Detail; selection: Selection; onSelect: (s: Selection) => void }) {
  if (detail.annotations.length === 0) {
    const stage = detail.run?.stages.find((s) => s.stage === "annotate")?.status;
    return <p className="text-muted">{stage === "done" ? "No concepts found." : "Annotating…"}</p>;
  }
  return (
    <div className="space-y-4">
      {ANNOTATION_CATEGORIES.map((category) => {
        const items = detail.annotations.filter((a) => a.category === category);
        if (items.length === 0) return null;
        return (
          <div key={category}>
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold tracking-wide text-muted uppercase">
              <span className={`inline-block h-3.5 w-3.5 rounded-sm ${CATEGORY_TINT[category]}`} aria-hidden="true" />
              {category}
            </h3>
            <div className="flex flex-wrap gap-2">
              {items.map((a) => {
                const sel = selection?.kind === "annotation" && selection.id === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onSelect(sel ? null : { kind: "annotation", id: a.id })}
                    aria-pressed={sel}
                    className={`rounded-md border px-2.5 py-1 text-left ${sel ? "border-accent bg-accent/15" : "border-line bg-raised hover:border-line-strong"}`}
                  >
                    <span className={a.status === "negated" ? "line-through decoration-muted" : ""}>{a.concept}</span>
                    {a.status !== "affirmed" && <span className="ml-1.5 text-sm text-muted">{a.status}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
