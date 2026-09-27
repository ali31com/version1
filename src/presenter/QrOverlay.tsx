import { useQuery } from "convex/react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useRef } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

// Projector overlay with the shared join QR. Focus moves in once on open;
// onClose must be stable so live count updates never reset focus.
export function QrOverlay({ code, title, sessionId, onClose }: { code: string; title: string; sessionId: Id<"demoSessions">; onClose: () => void }) {
  const overview = useQuery(api.presenter.overview, {});
  const session = overview?.sessions.find((s) => s._id === sessionId);
  const closeRef = useRef<HTMLButtonElement>(null);
  const url = `${window.location.origin}/join/${code}`;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        e.preventDefault();
        closeRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="qr-title" className="fixed inset-0 z-50 grid place-items-center bg-bg/95 p-6">
      <div className="flex max-h-full flex-col items-center gap-6 text-center">
        <h2 id="qr-title" className="text-3xl font-semibold tracking-tight md:text-4xl">
          Scan to build a cataract Episode
        </h2>
        <div className="rounded-2xl bg-white p-5 shadow-2xl">
          <QRCodeSVG value={url} size={Math.min(440, window.innerHeight - 480)} level="M" marginSize={1} title={`Join link ${url}`} />
        </div>
        <p className="font-mono text-lg break-all text-accent md:text-2xl">{url}</p>
        <p className="text-xl text-muted">
          {title} ·{" "}
          <span className="font-mono text-3xl font-semibold text-text tabular-nums">{session?.submissionCount ?? 0}</span> submitted ·{" "}
          <span className="font-mono tabular-nums">{session?.participantCount ?? 0}</span> joined
        </p>
        <button ref={closeRef} type="button" onClick={onClose} className="rounded-lg border border-line-strong px-5 py-2 text-lg hover:bg-raised">
          Close (Esc)
        </button>
      </div>
    </div>
  );
}
