import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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

  useEffect(() => {
    document.documentElement.classList.add("tv");
    return () => document.documentElement.classList.remove("tv");
  }, []);

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
          {selectedEpisode ? (
            <EpisodeWorkspace key={selectedEpisode} episodeId={selectedEpisode} paused={overview.paused} onClose={() => selectEpisode(null)} />
          ) : (
            <Worklist sessionId={sessionId} onSelect={selectEpisode} paused={overview.paused} />
          )}
        </div>
      ) : (
        <StartDemo />
      )}
      {qrOpen && session && <QrOverlay code={session.code} sessionId={session._id} onClose={closeQr} />}
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
  const [error, setError] = useState<string | null>(null);
  const session = overview.sessions.find((s) => s._id === sessionId);
  const viewingOld = session && session._id !== overview.activeSessionId;

  const run = (p: Promise<unknown>) =>
    p.catch((e: unknown) => setError(e instanceof ConvexError ? String(e.data) : "Action failed."));

  return (
    <header className="shrink-0 border-b border-line bg-surface">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <GemMark className="h-7 w-7" />
          <span className="text-xl font-semibold tracking-tight">CodeGem</span>
        </div>
        {viewingOld && (
          <button type="button" className="text-accent underline" onClick={() => onViewSession(null)}>
            Back to live session
          </button>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {session && (
            <div className="flex items-center gap-3 rounded-md border border-line px-3 py-1" aria-live="polite">
              <span>
                <span className="font-mono font-semibold tabular-nums">{session.submissionCount}</span> <span className="text-muted">submitted</span>
              </span>
              <span className="text-muted">·</span>
              <span>
                <span className="font-mono tabular-nums">{session.participantCount}</span> <span className="text-muted">joined</span>
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={() => void run(setPaused({ paused: !overview.paused }))}
            aria-pressed={overview.paused}
            className={`rounded-md px-3 py-1.5 font-semibold ${overview.paused ? "bg-warning text-bg" : "border border-line-strong hover:bg-raised"}`}
          >
            {overview.paused ? "▶ Resume" : "❚❚ Pause"}
          </button>
          <Menu label="Teaching cases ▾">
            {(close) =>
              (
                [
                  ["teaching_contradictory_laterality", "Contradictory laterality"],
                  ["teaching_iris_hooks", "Iris hooks with comorbidities"],
                ] as const
              ).map(([kind, title]) => (
                <button
                  key={kind}
                  role="menuitem"
                  type="button"
                  disabled={!overview.activeSessionId}
                  onClick={() => {
                    close();
                    void run(loadTeaching({ kind }).then((id) => onSelectEpisode(id)));
                  }}
                  className="block w-full rounded-md px-3 py-2 text-left hover:bg-white/5 disabled:opacity-50"
                >
                  {title}
                </button>
              ))
            }
          </Menu>
          <button type="button" onClick={onShowQr} disabled={!session || viewingOld} className="rounded-md bg-accent px-3 py-1.5 font-semibold text-bg disabled:opacity-40">
            Show QR
          </button>
          <Menu label="⋯" ariaLabel="More">
            {(close) => (
              <>
                <label className="block px-3 py-2">
                  <span className="block text-sm text-muted">Session</span>
                  <select
                    value={sessionId ?? ""}
                    onChange={(e) => {
                      close();
                      onViewSession((e.target.value || null) as Id<"demoSessions"> | null);
                    }}
                    className="mt-1 w-full rounded-md border border-line-strong bg-raised px-2 py-1 text-text"
                  >
                    {overview.sessions.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.title}
                        {s._id === overview.activeSessionId ? " (live)" : " (ended)"}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    close();
                    if (window.confirm("Start a new demo? The current session's join link closes; its results stay available.")) {
                      void run(newDemo({}).then(() => onViewSession(null)));
                    }
                  }}
                  className="block w-full rounded-md px-3 py-2 text-left hover:bg-white/5"
                >
                  New demo
                </button>
              </>
            )}
          </Menu>
        </div>
      </div>
      {error && (
        <p role="alert" className="flex items-center justify-between border-t border-danger/30 bg-danger/10 px-4 py-1.5 text-danger">
          {error}
          <button type="button" onClick={() => setError(null)} className="underline">
            Dismiss
          </button>
        </p>
      )}
    </header>
  );
}

function Menu({ label, ariaLabel, children }: { label: string; ariaLabel?: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className="rounded-md border border-line-strong px-3 py-1.5 hover:bg-raised"
      >
        {label}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-80 rounded-lg border border-line-strong bg-raised p-1 shadow-xl">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
