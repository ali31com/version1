import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

export default function App() {
  const health = useQuery(api.health.check, {});

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900">
      <div className="mx-auto max-w-xl">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">
            Version1
          </h1>

          <p className="mt-2 text-slate-600">
            Vite + React + Convex
          </p>
        </header>

        <section
          aria-labelledby="backend-heading"
          className="rounded-xl border border-slate-200 bg-white p-6"
        >
          <h2 id="backend-heading" className="text-lg font-medium">
            Backend check
          </h2>

          <dl className="mt-4 space-y-4" aria-live="polite">
            <div>
              <dt className="text-sm text-slate-500">Convex query</dt>
              <dd className="mt-1 font-medium">
                {health === undefined ? "Loading…" : "Successful"}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-slate-500">
                Backend environment
              </dt>
              <dd className="mt-1 font-mono">
                {health?.environment ?? "Loading…"}
              </dd>
            </div>
          </dl>
        </section>

        <p className="mt-6 text-sm text-slate-500">
          Hackathon prototype. Synthetic data only.
        </p>
      </div>
    </main>
  );
}