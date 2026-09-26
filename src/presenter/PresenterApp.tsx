import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { GemMark } from "../participant/ParticipantPage";
import { navigate, useLocation } from "../lib/router";
import { EpisodeWorkspace } from "./EpisodeWorkspace";
import { QrOverlay } from "./QrOverlay";
import { Worklist } from "./Worklist";

export type Overview = FunctionReturnType<typeof api.presenter.overview>;

export function PresenterApp() {
  const overview = useQuery(api.presenter.overview, {});
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const selectedEpisode = (params.get("e") as Id<"episodes"> | null) ?? null;
  const [viewedSession, setViewedSession] = useState<Id<"demoSessions"> | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const closeQr = useCallback(() => setQrOpen(false), []);
  const sessionId = viewedSession ?? overview?.activeSessionId ?? null;
  const session = overview?.sessions.find((s) => s._id === sessionId) ?? null;

  const selectEpisode = useCallback((id: Id<"episodes"> | null) => {
    navigate(id ? `/?e=${id}` : "/", { replace: false });
  }, []);

  if (overview === undefined) {
    return <div className="grid min-h-screen place-items-center text-muted">Loading workspace…</div>;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-bg text-text">
      <TopBar
        overview={overview}
        sessionId={sessionId}
        onViewSession={(id) => {
          setViewedSession(id);
          selectEpisode(null);
        }}
        onShowQr={() => setQrOpen(true)}
        onSelectEpisode={selectEpisode}
      />
      {sessionId && session ? (
        <div className="flex min-h-0 flex-1">
          <Worklist sessionId={sessionId} selected={selectedEpisode} onSelect={selectEpisode} paused={overview.paused} compact={selectedEpisode !== null} />
          {selectedEpisode ? (
            <EpisodeWorkspace key={selectedEpisode} episodeId={selectedEpisode} paused={overview.paused} onClose={() => selectEpisode(null)} />
          ) : null}
        </div>
      ) : (
        <StartDemo />
      )}
      {qrOpen && session && <QrOverlay code={session.code} title={session.title} sessionId={session._id} onClose={closeQr} />}
    </div>
  );
}

function StartDemo() {
  const create = useMutation(api.presenter.newDemoSession);
  return (
    <div className="grid flex-1 place-items-center">
      <div className="text-center">
        <p className="text-lg">No demo session yet.</p>
        <button type="button" onClick={() => void create({})} className="mt-4 rounded-lg bg-accent px-5 py-2.5 font-semibold text-bg">
          Start a demo session
        </button>
      </div>
    </div>
  );
}

function TopBar({
  overview,
  sessionId,
  onViewSession,
  onShowQr,
  onSelectEpisode,
}: {
  overview: Overview;
  sessionId: Id<"demoSessions"> | null;
  onViewSession: (id: Id<"demoSessions"> | null) => void;
  onShowQr: () => void;
  onSelectEpisode: (id: Id<"episodes">) => void;
}) {
  const setPaused = useMutation(api.presenter.setPaused);
  const newDemo = useMutation(api.presenter.newDemoSession);
  const loadTeaching = useMutation(api.presenter.loadTeachingEpisode);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const session = overview.sessions.find((s) => s._id === sessionId);
  const viewingOld = session && session._id !== overview.activeSessionId;

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const run = (p: Promise<unknown>) =>
    p.catch((e: unknown) => setError(e instanceof ConvexError ? String(e.data) : "Action failed."));

  return (
    <header className="shrink-0 border-b border-line bg-surface">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <GemMark className="h-6 w-6" />
          <span className="text-lg font-semibold tracking-tight">CodeGem</span>
          <span className="hidden text-sm text-muted xl:inline">Live cataract coding</span>
        </div>
        <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning">Synthetic demo · not for clinical use</span>

        <label className="flex items-center gap-2 text-sm text-muted">
          <span className="sr-only sm:not-sr-only">Session</span>
          <select
            value={sessionId ?? ""}
            onChange={(e) => onViewSession((e.target.value || null) as Id<"demoSessions"> | null)}
            className="rounded-md border border-line-strong bg-raised px-2 py-1 text-text"
          >
            {overview.sessions.map((s) => (
              <option key={s._id} value={s._id}>
                {s.title}
                {s._id === overview.activeSessionId ? " (live)" : " (ended)"}
              </option>
            ))}
          </select>
        </label>
        {viewingOld && (
          <button type="button" className="text-sm text-accent underline" onClick={() => onViewSession(null)}>
            Back to live session
          </button>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {session && (
            <div className="flex items-center gap-3 rounded-md border border-line px-3 py-1 text-sm" aria-live="polite">
              <span>
                <span className="font-mono text-base font-semibold tabular-nums">{session.submissionCount}</span>{" "}
                <span className="text-muted">submitted</span>
              </span>
              <span className="text-muted">·</span>
              <span>
                <span className="font-mono tabular-nums">{session.participantCount}</span> <span className="text-muted">joined</span>
              </span>
              <span className="text-muted">·</span>
              <span title="Model requests in flight / processing slots">
                <span className="font-mono tabular-nums">
                  {overview.running}/{overview.maxConcurrent}
                </span>{" "}
                <span className="text-muted">slots</span>
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => void run(setPaused({ paused: !overview.paused }))}
            aria-pressed={overview.paused}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
              overview.paused ? "bg-warning text-bg" : "border border-line-strong hover:bg-raised"
            }`}
          >
            {overview.paused ? "▶ Resume processing" : "❚❚ Pause processing"}
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              onClick={() => setMenuOpen((o) => !o)}
              className="rounded-md border border-line-strong px-3 py-1.5 text-sm hover:bg-raised"
            >
              Teaching cases ▾
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 z-30 mt-1 w-80 rounded-lg border border-line-strong bg-raised p-1 shadow-xl">
                {(
                  [
                    ["teaching_contradictory_laterality", "Contradictory laterality", "Presenter-only review demo: the note names both eyes. Resolve with the curated surgeon clarification."],
                    ["teaching_iris_hooks", "Iris hooks with comorbidities", "Glaucoma small pupil, diabetes and hypertension; expected to auto-code."],
                  ] as const
                ).map(([kind, title, detail]) => (
                  <button
                    key={kind}
                    role="menuitem"
                    type="button"
                    disabled={!overview.activeSessionId}
                    onClick={() => {
                      setMenuOpen(false);
                      void run(loadTeaching({ kind }).then((id) => onSelectEpisode(id)));
                    }}
                    className="block w-full rounded-md px-3 py-2 text-left hover:bg-white/5 disabled:opacity-50"
                  >
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="block text-xs text-muted">{detail}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={onShowQr} disabled={!session || viewingOld} className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-bg disabled:opacity-40">
            Show QR
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Start a new demo? The current session's join link closes; its results stay available.")) {
                void run(newDemo({}).then(() => onViewSession(null)));
              }
            }}
            className="rounded-md border border-line-strong px-3 py-1.5 text-sm hover:bg-raised"
          >
            New demo
          </button>
        </div>
      </div>
      {overview.paused && (
        <p className="border-t border-warning/30 bg-warning/10 px-4 py-1.5 text-sm text-warning" role="status">
          Processing paused: no new stages start. Requests already running may finish. Submissions stay open and queue until you resume.
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-center justify-between border-t border-danger/30 bg-danger/10 px-4 py-1.5 text-sm text-danger">
          {error}
          <button type="button" onClick={() => setError(null)} className="underline">
            Dismiss
          </button>
        </p>
      )}
    </header>
  );
}
