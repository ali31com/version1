import { useQuery } from "convex/react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

// Right-hand panel with the shared join QR; sits beside the worklist so the room keeps seeing Episodes arrive.
export function QrPanel({ code, sessionId, onClose }: { code: string; sessionId: Id<"demoSessions">; onClose: () => void }) {
  const overview = useQuery(api.presenter.overview, {});
  const session = overview?.sessions.find((s) => s._id === sessionId);
  const url = `${window.location.origin}/join/${code}`;

  return (
    <aside aria-labelledby="qr-title" className="scrollbar-thin flex w-[28rem] shrink-0 flex-col items-center gap-5 overflow-y-auto border-l border-line bg-bg p-6 text-center">
      <h2 id="qr-title" className="text-2xl font-semibold tracking-tight">
        Scan to build a cataract Episode
      </h2>
      <div className="rounded-2xl bg-white p-4 shadow-2xl">
        <QRCodeSVG value={url} size={Math.max(200, Math.min(360, window.innerHeight - 400))} level="M" marginSize={1} title={`Join link ${url}`} />
      </div>
      <p className="font-mono text-lg break-all text-accent">{url}</p>
      <p className="text-lg text-muted">
        <span className="font-mono text-3xl font-semibold text-text tabular-nums">{session?.submissionCount ?? 0}</span> submitted ·{" "}
        <span className="font-mono tabular-nums">{session?.participantCount ?? 0}</span> joined
      </p>
      <button type="button" onClick={onClose} className="rounded-lg border border-line-strong px-4 py-1.5 hover:bg-raised">
        Hide QR
      </button>
    </aside>
  );
}
