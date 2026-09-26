import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ConvexError } from "convex/values";
import { useState, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import type { Draft } from "../../convex/lib/presets";
import { MAX_AGE, MIN_AGE } from "../../convex/lib/presets";
import {
  COMORBIDITY_QUESTIONS,
  COMPLICATION_OPTIONS,
  CONDITION_OPTIONS,
  SIDE_OPTIONS,
} from "../lib/labels";
import { ParticipantResult } from "./ParticipantResult";

type View = NonNullable<FunctionReturnType<typeof api.participants.view>>;

export function ParticipantPage({ token }: { token: string }) {
  const view = useQuery(api.participants.view, { token });
  if (view === undefined) {
    return (
      <PhoneShell>
        <p className="py-16 text-center text-slate-500">Loading your Episode…</p>
      </PhoneShell>
    );
  }
  if (view === null) {
    return (
      <PhoneShell>
        <p className="py-16 text-center text-slate-600">This personal link is not recognised. Scan the QR code on screen to join.</p>
      </PhoneShell>
    );
  }
  if (view.episode) {
    return (
      <PhoneShell>
        <ParticipantResult episode={view.episode} paused={view.paused} />
      </PhoneShell>
    );
  }
  return (
    <PhoneShell>
      <Builder token={token} view={view} />
    </PhoneShell>
  );
}

function PhoneShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-5 py-3">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <GemMark /> CodeGem
          </span>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">Synthetic demo data</span>
        </div>
      </header>
      <main className="mx-auto max-w-md px-5 pt-6 pb-16">{children}</main>
    </div>
  );
}

export function GemMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 2 21 9l-9 13L3 9z" fill="#14b8a6" />
      <path d="M12 2 16 9l-4 13-4-13z" fill="#5eead4" opacity=".75" />
      <path d="M3 9h18" stroke="#0f766e" strokeWidth="1" />
    </svg>
  );
}

const STEP_COUNT = 10;

function Builder({ token, view }: { token: string; view: View }) {
  const saveDraft = useMutation(api.participants.saveDraft);
  const submit = useMutation(api.participants.submit);
  const [draft, setDraft] = useState<Draft>(view.draft);
  const [step, setStep] = useState<number>(Math.min(view.step, STEP_COUNT - 1));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nameInput, setNameInput] = useState(view.draft.displayName ?? "");
  const [ageInput, setAgeInput] = useState(view.draft.age !== undefined ? String(view.draft.age) : "");

  if (view.session.closed && step === 0) {
    return <p className="py-16 text-center text-slate-600">This demo has finished. Scan the current QR code to join the new one.</p>;
  }

  const go = (next: number, patch: Draft = {}) => {
    setError(null);
    const merged = { ...draft, ...patch };
    if (merged.side === "both") merged.complication = "none";
    setDraft(merged);
    setStep(next);
    saveDraft({ token, draft: patch, step: next }).catch((e: unknown) => {
      setError(e instanceof ConvexError ? String(e.data) : "Could not save that answer. Check your connection.");
    });
    window.scrollTo({ top: 0 });
  };
  const back = () => go(Math.max(0, step - 1));

  let body: ReactNode;
  switch (step) {
    case 0:
      body = (
        <Question
          eyebrow="Live clinical coding"
          title="Build a synthetic cataract operation"
          lead="Answer a few quick questions. Your operation note joins the presenter's coding Worklist, where Gemini Flash plays MedCAT and MedGemma to code it live."
        >
          <PrimaryButton onClick={() => go(1)}>Start</PrimaryButton>
          <p className="mt-4 text-sm text-slate-500">Use a made-up name. Nothing you enter is real patient data.</p>
        </Question>
      );
      break;
    case 1:
      body = (
        <Question eyebrow="Step 1" title="Choose a display name" lead="Shown on the projected Worklist. Use a nickname, not a real patient.">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const name = nameInput.trim();
              if (!name) return setError("Enter a display name.");
              go(2, { displayName: name.slice(0, 40) });
            }}
          >
            <label className="sr-only" htmlFor="name">Display name</label>
            <input
              id="name"
              autoFocus
              maxLength={40}
              autoComplete="off"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-lg outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/30"
              placeholder="e.g. Captain Lens"
            />
            <PrimaryButton type="submit" className="mt-4">Continue</PrimaryButton>
          </form>
        </Question>
      );
      break;
    case 2:
      body = (
        <Question eyebrow="Step 2" title="Synthetic patient age" lead={`Any whole number from ${MIN_AGE} to ${MAX_AGE}. Age is cosmetic: it never decides the diagnosis.`}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const age = Number(ageInput);
              if (!Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) return setError(`Enter a whole number from ${MIN_AGE} to ${MAX_AGE}.`);
              go(3, { age });
            }}
          >
            <label className="sr-only" htmlFor="age">Age</label>
            <input
              id="age"
              autoFocus
              inputMode="numeric"
              pattern="[0-9]*"
              value={ageInput}
              onChange={(e) => setAgeInput(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-center text-3xl font-semibold tabular-nums outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/30"
              placeholder="74"
            />
            <PrimaryButton type="submit" className="mt-4">Continue</PrimaryButton>
          </form>
        </Question>
      );
      break;
    case 3:
      body = (
        <Question eyebrow="Step 3" title="Which eye is operated on?">
          <Choices options={SIDE_OPTIONS} selected={draft.side} onChoose={(side) => go(4, { side })} />
        </Question>
      );
      break;
    case 4:
      body = (
        <Question eyebrow="Step 4" title="What type of cataract?" lead="The note documents exactly the type you choose.">
          <Choices options={CONDITION_OPTIONS} selected={draft.condition} onChoose={(condition) => go(5, { condition })} />
        </Question>
      );
      break;
    case 5:
      body =
        draft.side === "both" ? (
          <Question eyebrow="Step 5" title="Complication">
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-teal-950">
              <p className="font-medium">Both eyes uses the uncomplicated preset.</p>
              <p className="mt-1 text-sm">
                Coding a complication on only one eye of a bilateral operation is not a verified scenario in this demo, so this question is skipped.
              </p>
            </div>
            <PrimaryButton className="mt-5" onClick={() => go(6)}>Continue</PrimaryButton>
          </Question>
        ) : (
          <Question eyebrow="Step 5" title="Was there an operative complication?">
            <Choices options={COMPLICATION_OPTIONS} selected={draft.complication} onChoose={(complication) => go(6, { complication })} />
          </Question>
        );
      break;
    case 6:
    case 7:
    case 8: {
      const q = COMORBIDITY_QUESTIONS[step - 6];
      body = (
        <Question eyebrow={`Step ${step} · Medical history`} title={q.title} lead={q.description}>
          <Choices
            options={[
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
            selected={draft[q.field] === undefined ? undefined : draft[q.field] ? "yes" : "no"}
            onChoose={(answer) => go(step + 1, { [q.field]: answer === "yes" })}
            columns
          />
        </Question>
      );
      break;
    }
    default:
      body = (
        <Question eyebrow="Review" title="Check and submit" lead="You can change answers before submitting. After submission the Episode is frozen and sent for coding.">
          <Summary draft={draft} onEdit={(s) => go(s)} />
          <PrimaryButton
            className="mt-6"
            disabled={submitting}
            onClick={() => {
              setSubmitting(true);
              setError(null);
              submit({ token })
                .catch((e: unknown) => setError(e instanceof ConvexError ? String(e.data) : "Submission failed. Try again."))
                .finally(() => setSubmitting(false));
            }}
          >
            {submitting ? "Submitting…" : "Submit Episode"}
          </PrimaryButton>
        </Question>
      );
  }

  return (
    <div>
      {step > 0 && (
        <div className="mb-6 flex items-center gap-3">
          <button type="button" onClick={back} className="rounded-lg px-2 py-1 text-sm font-medium text-slate-600 hover:bg-slate-200/60">
            ← Back
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuemin={0} aria-valuemax={STEP_COUNT - 1} aria-valuenow={step}>
            <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${(step / (STEP_COUNT - 1)) * 100}%` }} />
          </div>
        </div>
      )}
      {body}
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

function Question({ eyebrow, title, lead, children }: { eyebrow: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section aria-labelledby="q-title">
      <p className="font-mono text-xs tracking-widest text-teal-700 uppercase">{eyebrow}</p>
      <h1 id="q-title" className="mt-2 text-2xl leading-tight font-semibold tracking-tight">{title}</h1>
      {lead && <p className="mt-2 text-slate-600">{lead}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Choices<V extends string>({
  options,
  selected,
  onChoose,
  columns = false,
}: {
  options: readonly { value: V; label: string; hint?: string }[];
  selected: string | undefined;
  onChoose: (value: V) => void;
  columns?: boolean;
}) {
  return (
    <div className={columns ? "grid grid-cols-2 gap-3" : "grid gap-3"}>
      {options.map((o) => {
        const active = selected === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChoose(o.value)}
            className={`min-h-16 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
              active ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-white hover:border-slate-300"
            } ${columns ? "text-center" : ""}`}
          >
            <span className="block text-lg font-medium">{o.label}</span>
            {o.hint && <span className="mt-0.5 block text-sm text-slate-500">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

function PrimaryButton({ className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`w-full rounded-xl bg-teal-700 px-5 py-3.5 text-lg font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-60 ${className}`}
    />
  );
}

function Summary({ draft, onEdit }: { draft: Draft; onEdit: (step: number) => void }) {
  const yesNo = (v: boolean | undefined) => (v === undefined ? "Not answered" : v ? "Yes" : "No");
  const rows: [string, string, number][] = [
    ["Name", draft.displayName ?? "Not answered", 1],
    ["Age", draft.age !== undefined ? String(draft.age) : "Not answered", 2],
    ["Eye", SIDE_OPTIONS.find((o) => o.value === draft.side)?.label ?? "Not answered", 3],
    ["Cataract", CONDITION_OPTIONS.find((o) => o.value === draft.condition)?.label ?? "Not answered", 4],
    [
      "Complication",
      draft.side === "both" ? "None (bilateral preset)" : (COMPLICATION_OPTIONS.find((o) => o.value === draft.complication)?.label ?? "Not answered"),
      5,
    ],
    ["Type 2 diabetes", yesNo(draft.diabetes), 6],
    ["Hypertension", yesNo(draft.hypertension), 7],
    ["Glaucoma", yesNo(draft.glaucoma), 8],
  ];
  return (
    <dl className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
      {rows.map(([label, value, s]) => (
        <div key={label} className="flex items-center justify-between gap-3 px-4 py-3">
          <dt className="text-sm text-slate-500">{label}</dt>
          <dd className="flex items-center gap-3 text-right font-medium">
            {value}
            <button type="button" onClick={() => onEdit(s)} className="text-sm font-medium text-teal-700 underline-offset-2 hover:underline" aria-label={`Change ${label}`}>
              Change
            </button>
          </dd>
        </div>
      ))}
    </dl>
  );
}
