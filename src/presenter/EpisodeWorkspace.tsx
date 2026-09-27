import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useMemo, useState, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { codeTitle } from "../../convex/lib/references";
import { ProcessingLabel, ResultBadge } from "../components/badges";
import { stageLabel } from "../lib/labels";
import { formatClock } from "../lib/time";
import { ANNOTATION_CATEGORIES } from "../../convex/lib/contracts";
import { CATEGORY_TINT } from "./medcat";
import { PaperNote } from "./PaperNote";

type Detail = NonNullable<FunctionReturnType<typeof api.presenter.episodeDetail>>;
type Fact = Detail["facts"][number];
type ProposedCode = NonNullable<Detail["proposal"]>["diagnoses"][number];

export type Selection =
  | { kind: "code"; key: string; code: ProposedCode }
  | { kind: "fact"; id: string }
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
    } else if (selection?.kind === "fact") {
      index.facts.get(selection.id)?.passageIds.forEach((p) => hi.add(p));
    } else if (selection?.kind === "question") {
      detail.questions.find((q) => q._id === selection.id)?.passageIds.forEach((p) => warn.add(p));
    }
    return { highlighted: hi, warning: warn };
  }, [selection, index, detail.questions]);

  const select = (s: Selection) => setSelection(s);

  return (
    <section aria-label={`Episode ${episode.worklistId}`} className="flex min-w-0 flex-1 flex-col">
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
          {selection && selection.kind !== "annotation" && (
            <Inspector detail={detail} index={index} selection={selection} onSelect={select} onClear={() => select(null)} />
          )}
          <CodesPanel detail={detail} proposal={proposal} selection={selection} onSelect={select} />
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
  return (
    <div className="shrink-0 border-b border-line bg-surface px-4 py-3">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <button type="button" onClick={onClose} className="rounded-md border border-line-strong px-2 py-1 text-muted hover:text-text" aria-label="Back to Worklist">
          ← Worklist
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h2 className="font-mono text-2xl font-bold">{episode.worklistId}</h2>
            <ResultBadge row={episode} large />
            <ProcessingLabel row={episode} paused={paused} />
          </div>
          <p className="mt-1">
            <span className="font-medium">{episode.displayName}</span>
            <span className="text-muted"> · age {episode.age} · {episode.laterality} · {episode.summary}</span>
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
    <p key={id} className="rounded-md bg-paper px-2 py-1 text-sm text-ink">
      {index.passageText.get(id) ?? "(missing passage)"}
    </p>
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
