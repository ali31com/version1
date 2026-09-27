import { useEffect, useRef, type ReactNode } from "react";
import type { Annotation } from "../../convex/lib/contracts";
import type { SourceDocumentContent } from "../../convex/lib/presets";
import { CATEGORY_TINT } from "./medcat";

// Light "paper" clinical document with MedCAT spans marked inline.
export function PaperNote({
  document,
  annotations,
  highlighted,
  warning,
  selectedAnnotation,
  onSelectAnnotation,
}: {
  document: SourceDocumentContent;
  annotations: Annotation[];
  highlighted: Set<string>;
  warning: Set<string>;
  selectedAnnotation: string | null;
  onSelectAnnotation: (id: string) => void;
}) {
  const refs = useRef(new Map<string, HTMLElement>());
  const selectedPassage = annotations.find((a) => a.id === selectedAnnotation)?.passageId ?? null;
  const firstTarget = [...highlighted, ...warning][0] ?? selectedPassage;

  useEffect(() => {
    if (!firstTarget) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    refs.current.get(firstTarget)?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [firstTarget]);

  return (
    <article aria-label="Source document" className="rounded-xl bg-paper px-6 py-6 text-ink shadow-[0_1px_0_rgba(0,0,0,.05),0_12px_32px_rgba(0,0,0,.35)] md:px-8">
      <header className="border-b border-stone-300 pb-3">
        <p className="text-sm font-semibold tracking-wide text-stone-500 uppercase">{document.organisation}</p>
        <h2 className="mt-1 font-serif text-2xl font-semibold">{document.title}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
          {document.header.map((h) => (
            <div key={h.label}>
              <dt className="inline text-stone-500">{h.label}: </dt>
              <dd className="inline font-medium">{h.value}</dd>
            </div>
          ))}
        </dl>
      </header>
      {document.sections.map((section) => (
        <section key={section.heading} className="mt-4">
          <h3 className="text-sm font-bold tracking-wider text-stone-500 uppercase">{section.heading}</h3>
          <div className="mt-1 space-y-0.5">
            {section.passages.map((p) => (
              <p
                key={p.id}
                ref={(el) => {
                  if (el) refs.current.set(p.id, el);
                  else refs.current.delete(p.id);
                }}
                className={`rounded-lg px-1.5 py-1 leading-relaxed transition-colors ${warning.has(p.id) ? "bg-mark-warning" : highlighted.has(p.id) ? "bg-mark" : ""}`}
              >
                {markSpans(
                  p.text,
                  annotations.filter((a) => a.passageId === p.id),
                  selectedAnnotation,
                  onSelectAnnotation,
                )}
              </p>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}

// Overlapping spans keep the earliest (longest on ties) and drop the rest.
function markSpans(text: string, spans: Annotation[], selected: string | null, onSelect: (id: string) => void): ReactNode[] {
  const ordered = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: ReactNode[] = [];
  let at = 0;
  for (const a of ordered) {
    if (a.start < at) continue;
    if (a.start > at) out.push(text.slice(at, a.start));
    out.push(
      <button
        key={a.id}
        type="button"
        onClick={() => onSelect(a.id)}
        aria-pressed={selected === a.id}
        title={`${a.concept} · ${a.category}${a.status !== "affirmed" ? ` · ${a.status}` : ""}`}
        className={`rounded-sm px-0.5 text-ink ${CATEGORY_TINT[a.category]} ${a.status === "negated" ? "line-through decoration-2" : ""} ${selected === a.id ? "ring-2 ring-teal-700" : ""}`}
      >
        {text.slice(a.start, a.end)}
      </button>,
    );
    at = a.end;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}
