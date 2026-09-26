import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useEffect, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { navigate } from "../lib/router";

const storageKey = (code: string) => `codegem:participant:${code}`;

function readToken(code: string): string | undefined {
  try {
    return window.localStorage.getItem(storageKey(code)) ?? undefined;
  } catch {
    return undefined;
  }
}

// Shared QR entry point: create or resume this browser's participant, then
// move to the personal URL.
export function JoinPage({ code }: { code: string }) {
  const join = useMutation(api.participants.join);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    join({ code, token: readToken(code) })
      .then(({ token }) => {
        try {
          window.localStorage.setItem(storageKey(code), token);
        } catch {
          // Private mode: the personal URL still works.
        }
        navigate(`/p/${token}`, { replace: true });
      })
      .catch((e: unknown) => setError(e instanceof ConvexError ? String(e.data) : "Could not join the demo. Please try again."));
  }, [code, join]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-6 text-slate-800">
      <div className="max-w-sm text-center" aria-live="polite">
        <p className="font-mono text-xs tracking-widest text-teal-700 uppercase">CodeGem live demo</p>
        {error ? (
          <p className="mt-3 text-lg">{error}</p>
        ) : (
          <p className="mt-3 text-lg">Opening your personal link…</p>
        )}
      </div>
    </main>
  );
}
