import { stageLabel } from "../lib/labels";

type Row = {
  processing: "queued" | "running" | "failed" | "completed";
  currentStage: string;
  result: "pending" | "auto_coded" | "sent_to_review";
  review: "none" | "open" | "ready" | "blocked" | "approved";
};

// Status by colour + icon + word, never colour alone.
export function ResultBadge({ row, large = false }: { row: Row; large?: boolean }) {
  const size = large ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs";
  if (row.review === "approved") {
    return <span className={`inline-flex items-center gap-1 rounded-full bg-success/15 font-medium text-success ${size}`}>✓ Approved</span>;
  }
  if (row.result === "auto_coded") {
    return <span className={`inline-flex items-center gap-1 rounded-full bg-success/15 font-medium text-success ${size}`}>✓ Auto-coded</span>;
  }
  if (row.result === "sent_to_review") {
    const suffix = row.review === "ready" ? " · ready" : row.review === "blocked" ? " · blocked" : "";
    return <span className={`inline-flex items-center gap-1 rounded-full bg-warning/15 font-medium text-warning ${size}`}>? Sent to review{suffix}</span>;
  }
  return <span className={`inline-flex items-center gap-1 rounded-full border border-line-strong text-muted ${size}`}>… Pending</span>;
}

export function ProcessingLabel({ row, paused }: { row: Row; paused: boolean }) {
  if (row.processing === "failed") {
    return <span className="inline-flex items-center gap-1.5 text-danger">✕ Failed · {stageLabel(row.currentStage)}</span>;
  }
  if (row.processing === "completed") return <span className="text-muted">Complete</span>;
  if (row.processing === "running") {
    return (
      <span className="inline-flex items-center gap-1.5 text-accent">
        <span className="animate-pulse-dot inline-block h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
        {stageLabel(row.currentStage)}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-muted">
      <span className="inline-block h-2 w-2 rounded-full border border-muted" aria-hidden="true" />
      {paused ? "Paused" : "Queued"} · {stageLabel(row.currentStage)}
    </span>
  );
}
