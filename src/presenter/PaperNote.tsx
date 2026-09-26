import { useEffect, useRef } from "react";
import type { SourceDocumentContent } from "../../convex/lib/presets";

// Light "paper" clinical document with individually selectable passages.
export function PaperNote({
  document,
  highlighted,
  warning,
  selectedPassage,
  spanMark,
  onSelectPassage,
}: {
  document: SourceDocumentContent;
  highlighted: Set<string>;
  warning: Set<string>;
  selectedPassage: string | null;
  spanMark: { passageId: string; start: number; end: number } | null;
  onSelectPassage: (id: string) => void;
}) {
  const refs = useRef(new Map<string, HTMLElement>());
  const firstTarget = [...highlighted, ...warning][0] ?? selectedPassage;

  useEffect(() => {
    if (!firstTarget) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    refs.current.get(firstTarget)?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [firstTarget]);

  return (
    <article aria-label="Source document" className="mx-auto max-w-3xl rounded-xl bg-paper px-6 py-6 text-ink shadow-[0_1px_0_rgba(0,0,0,.05),0_12px_32px_rgba(0,0,0,.35)] md:px-8">
      <header className="border-b border-stone-300 pb-3">
        <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">{document.organisation}</p>
        <h2 className="mt-1 font-serif text-2xl font-semibold">{document.title}</h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
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
          <h3 className="text-xs font-bold tracking-wider text-stone-500 uppercase">{section.heading}</h3>
          <div className="mt-1 space-y-0.5">
            {section.passages.map((p) => {
              const isWarn = warning.has(p.id);
              const isHit = highlighted.has(p.id);
              const isSel = selectedPassage === p.id;
              const text =
                spanMark && spanMark.passageId === p.id ? (
                  <>
                    {p.text.slice(0, spanMark.start)}
                    <mark className="rounded-sm bg-teal-400/50 px-0.5 text-ink">{p.text.slice(spanMark.start, spanMark.end)}</mark>
                    {p.text.slice(spanMark.end)}
                  </>
                ) : (
                  p.text
                );
              return (
                <button
                  key={p.id}
                  type="button"
                  ref={(el) => {
                    if (el) refs.current.set(p.id, el);
                    else refs.current.delete(p.id);
                  }}
                  onClick={() => onSelectPassage(p.id)}
                  aria-pressed={isSel}
                  className={`group grid w-full grid-cols-[4.5rem_1fr] gap-2 rounded-lg px-1.5 py-1 text-left leading-[1.45] transition-colors ${
                    isWarn ? "bg-mark-warning" : isHit ? "bg-mark" : "hover:bg-stone-200/60"
                  } ${isSel ? "ring-2 ring-teal-600" : ""}`}
                >
                  <span className="pt-0.5 font-mono text-[11px] text-stone-400 group-hover:text-stone-600">{p.id.split(".").pop()}</span>
                  <span className="text-[15px]">
                    {text}
                    {p.context !== "current" && (
                      <span className="ml-2 align-middle font-mono text-[10px] text-stone-400 uppercase">{p.context}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <p className="mt-6 border-t border-stone-300 pt-2 text-xs text-stone-500">Synthetic training data — not for clinical use.</p>
    </article>
  );
}
