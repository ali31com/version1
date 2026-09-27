import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ProcessingLabel, ResultBadge } from "../components/badges";
import { formatDuration, useNow } from "../lib/time";

type Row = FunctionReturnType<typeof api.presenter.worklist>[number];

export function Worklist({
  sessionId,
  selected,
  onSelect,
  paused,
  compact,
}: {
  sessionId: Id<"demoSessions">;
  selected: Id<"episodes"> | null;
  onSelect: (id: Id<"episodes">) => void;
  paused: boolean;
  compact: boolean;
}) {
  const rows = useQuery(api.presenter.worklist, { sessionId });
  const seen = useRef<Set<string> | null>(null);
  const [arrived, setArrived] = useState<Set<string>>(new Set());

  // Highlight newly arrived Episodes without moving the selection.
  useEffect(() => {
    if (!rows) return;
    if (seen.current === null) {
      seen.current = new Set(rows.map((r) => r._id));
      return;
    }
    const fresh = rows.filter((r) => !seen.current!.has(r._id)).map((r) => r._id);
    if (fresh.length === 0) return;
    fresh.forEach((id) => seen.current!.add(id));
    setArrived((prev) => new Set([...prev, ...fresh]));
    const t = window.setTimeout(() => setArrived((prev) => new Set([...prev].filter((id) => !fresh.some((f) => f === id)))), 2600);
    return () => window.clearTimeout(t);
  }, [rows]);

  const list = rows ?? [];
  const counts = {
    total: rows?.length ?? 0,
    active: rows?.filter((r) => r.processing === "queued" || r.processing === "running").length ?? 0,
    auto: rows?.filter((r) => r.result === "auto_coded").length ?? 0,
    review: rows?.filter((r) => r.result === "sent_to_review" && r.review !== "approved").length ?? 0,
    failed: rows?.filter((r) => r.processing === "failed").length ?? 0,
  };

  return (
    <section
      aria-label="Worklist"
      className={`flex min-h-0 flex-col border-r border-line bg-surface ${compact ? "hidden w-[22rem] shrink-0 lg:flex" : "flex-1"}`}
    >
      <div className="border-b border-line p-3">
        <div className={compact ? "space-y-0.5" : "flex items-baseline justify-between gap-3"}>
          <h1 className="text-lg font-semibold">Worklist</h1>
          <p className="text-sm text-muted" aria-live="polite">
            {counts.total} Episodes · {counts.active} in progress · <span className="text-success">{counts.auto} auto-coded</span> ·{" "}
            <span className="text-warning">{counts.review} review</span>
            {counts.failed > 0 && <span className="text-danger"> · {counts.failed} failed</span>}
          </p>
        </div>
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {rows === undefined ? (
          <p className="p-4 text-sm text-muted">Loading…</p>
        ) : list.length === 0 ? (
          <p className="p-4 text-muted">Waiting for the first submission.</p>
        ) : compact ? (
          <ul>
            {list.map((r) => (
              <li key={r._id}>
                <button
                  type="button"
                  onClick={() => onSelect(r._id)}
                  aria-current={selected === r._id}
                  className={`block w-full border-b border-line px-3 py-2 text-left hover:bg-white/[0.03] ${selected === r._id ? "bg-accent/10 shadow-[inset_3px_0_0_var(--color-accent)]" : ""} ${arrived.has(r._id) ? "animate-arrive" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold">{r.worklistId}</span>
                    <ResultBadge row={r} />
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate">
                      {r.displayName} · {r.age} · {r.laterality}
                    </span>
                    <Elapsed row={r} />
                  </div>
                  <div className="mt-0.5 text-xs">
                    <ProcessingLabel row={r} paused={paused} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-surface text-sm text-muted uppercase">
              <tr className="border-b border-line">
                <th className="px-3 py-2 font-medium">Episode</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Age</th>
                <th className="px-3 py-2 font-medium">Scenario</th>
                <th className="px-3 py-2 font-medium">Side</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 text-right font-medium">Elapsed</th>
                <th className="px-3 py-2 font-medium">Coding result</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr
                  key={r._id}
                  onClick={() => onSelect(r._id)}
                  className={`cursor-pointer border-b border-line hover:bg-white/[0.03] ${arrived.has(r._id) ? "animate-arrive" : ""}`}
                >
                  <td className="px-3 py-3">
                    <button type="button" onClick={() => onSelect(r._id)} className="font-mono font-semibold text-accent hover:underline">
                      {r.worklistId}
                    </button>
                  </td>
                  <td className="max-w-[12rem] truncate px-3 py-3">{r.displayName}</td>
                  <td className="px-3 py-3 tabular-nums">{r.age}</td>
                  <td className="max-w-[22rem] truncate px-3 py-3 text-muted" title={r.summary}>
                    {r.summary}
                  </td>
                  <td className="px-3 py-3">{r.laterality}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <ProcessingLabel row={r} paused={paused} />
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Elapsed row={r} />
                  </td>
                  <td className="px-3 py-3">
                    <ResultBadge row={r} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function Elapsed({ row }: { row: Row }) {
  const live = row.firstActionableAt === null && row.processing !== "failed";
  const now = useNow(live ? 1000 : 60_000);
  const end = row.firstActionableAt ?? (live ? now : null);
  if (end === null) return <span className="font-mono text-muted">—</span>;
  const ms = end - row.submittedAt;
  return (
    <span className={`font-mono tabular-nums ${live ? "text-text" : ms > 30_000 ? "text-warning" : "text-muted"}`} title="Submission to first actionable result">
      {formatDuration(ms)}
    </span>
  );
}
