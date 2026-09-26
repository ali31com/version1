import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { ConvexError } from "convex/values";
import { deriveQuestions, routeResult, runChecks, type Check, type QuestionSpec } from "./lib/checks";
import type { ModelStage } from "./lib/contracts";
import { allPassages, generateSourceDocument, lateralityLabel, PRESET_VERSION, scenarioSummary, type Preset } from "./lib/presets";
import { EMULATED_ROLE, PROMPT_VERSIONS } from "./lib/prompts";
import { PIPELINE_STAGES, stageLabel, type PipelineStage } from "./lib/stages";
import { REFERENCE_LIBRARY_VERSION, retrieveReferences } from "./lib/references";
import { stageOutputV } from "./validators";

// Shared budget: initial request plus retries, per stage and retry round.
export const MAX_ATTEMPTS_PER_STAGE = 3;
export const DEFAULT_MAX_CONCURRENT = 8;
export const WATCHDOG_MS = 45_000;
// Provider capacity spikes (HTTP 503) are usually short; wait longer
// between attempts rather than adding attempts.
const BACKOFF_MS = [2_000, 5_000];

type StageStatus = Doc<"runs">["stages"][number]["status"];

export async function getControl(ctx: MutationCtx): Promise<Doc<"control">> {
  const existing = await ctx.db
    .query("control")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();
  if (existing) return existing;
  const id = await ctx.db.insert("control", {
    key: "global",
    paused: false,
    maxConcurrent: DEFAULT_MAX_CONCURRENT,
    running: 0,
  });
  return (await ctx.db.get("control", id))!;
}

export async function readControl(ctx: QueryCtx): Promise<Doc<"control"> | null> {
  return await ctx.db
    .query("control")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
}

// Freezes the preset, generates the note and inserts Episode + first run
// and its first queued model stage in one transaction.
export async function createEpisode(
  ctx: MutationCtx,
  args: {
    sessionId: Id<"demoSessions">;
    participantId?: Id<"participants">;
    origin: "audience" | "presenter";
    preset: Preset;
  },
): Promise<Id<"episodes">> {
  const session = await ctx.db.get("demoSessions", args.sessionId);
  if (!session) throw new Error("Demo session not found");
  const sequence = session.nextSequence;
  await ctx.db.patch("demoSessions", session._id, {
    nextSequence: sequence + 1,
    submissionCount: session.submissionCount + (args.origin === "audience" ? 1 : 0),
  });
  const worklistId = `OPH-${session.number}${String(sequence).padStart(3, "0")}`;
  const now = Date.now();
  const content = generateSourceDocument(args.preset, worklistId, formatDate(now));
  const episodeId = await ctx.db.insert("episodes", {
    sessionId: session._id,
    participantId: args.participantId,
    worklistId,
    origin: args.origin,
    displayName: args.preset.selections.displayName,
    age: args.preset.selections.age,
    preset: args.preset,
    presetVersion: PRESET_VERSION,
    summary: scenarioSummary(args.preset),
    laterality: lateralityLabel(args.preset),
    submittedAt: now,
    runCount: 0,
    processing: "queued",
    currentStage: "annotate",
    result: "pending",
    review: "none",
  });
  await ctx.db.insert("documents", { episodeId, version: 1, content });
  await startRun(ctx, episodeId);
  return episodeId;
}

export async function startRun(ctx: MutationCtx, episodeId: Id<"episodes">): Promise<Id<"runs">> {
  const episode = (await ctx.db.get("episodes", episodeId))!;
  const now = Date.now();
  const runId = await ctx.db.insert("runs", {
    episodeId,
    number: episode.runCount + 1,
    documentVersion: 1,
    status: "queued",
    presetVersion: episode.presetVersion,
    referenceVersion: REFERENCE_LIBRARY_VERSION,
    promptVersions: PROMPT_VERSIONS,
    createdAt: now,
    stages: PIPELINE_STAGES.map(({ stage }) =>
      stage === "packet"
        ? { stage, status: "done" as const, startedAt: now, finishedAt: now }
        : { stage, status: "pending" as const },
    ),
    retryRound: 0,
    presenterFacts: [],
    amended: false,
  });
  await ctx.db.patch("episodes", episodeId, {
    activeRunId: runId,
    runCount: episode.runCount + 1,
    processing: "queued",
    currentStage: "annotate",
    result: "pending",
    review: "none",
  });
  await enqueueAttempt(ctx, { runId, episodeId, stage: "annotate", round: 0, attemptNumber: 1, delayMs: 0 });
  return runId;
}

async function enqueueAttempt(
  ctx: MutationCtx,
  args: {
    runId: Id<"runs">;
    episodeId: Id<"episodes">;
    stage: ModelStage;
    round: number;
    attemptNumber: number;
    delayMs: number;
  },
) {
  const now = Date.now();
  await ctx.db.insert("attempts", {
    runId: args.runId,
    episodeId: args.episodeId,
    stage: args.stage,
    round: args.round,
    attemptNumber: args.attemptNumber,
    status: "queued",
    queuedAt: now,
    notBefore: now + args.delayMs,
    role: EMULATED_ROLE[args.stage],
    promptVersion: PROMPT_VERSIONS[args.stage],
  });
  await setStage(ctx, args.runId, args.stage, "queued");
  await ctx.scheduler.runAfter(args.delayMs, internal.pipeline.pump, {});
}

async function setStage(
  ctx: MutationCtx,
  runId: Id<"runs">,
  stage: PipelineStage,
  status: StageStatus,
) {
  const run = (await ctx.db.get("runs", runId))!;
  const now = Date.now();
  const stages = run.stages.map((s) => {
    if (s.stage !== stage) return s;
    return {
      stage: s.stage,
      status,
      startedAt: status === "running" ? now : status === "done" ? (s.startedAt ?? now) : s.startedAt,
      finishedAt: status === "done" || status === "failed" ? now : undefined,
    };
  });
  await ctx.db.patch("runs", runId, { stages });
}

// Dispatcher: starts due queued attempts while slots are free and
// processing is not paused. Active attempts are never interrupted.
export const pump = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const control = await getControl(ctx);
    if (control.paused) return null;
    const free = control.maxConcurrent - control.running;
    if (free <= 0) return null;
    const now = Date.now();
    const due = await ctx.db
      .query("attempts")
      .withIndex("by_status_and_notBefore", (q) => q.eq("status", "queued").lte("notBefore", now))
      .take(free);
    for (const attempt of due) {
      await ctx.db.patch("attempts", attempt._id, { status: "running", startedAt: now });
      await setStage(ctx, attempt.runId, attempt.stage, "running");
      await ctx.db.patch("runs", attempt.runId, { status: "running" });
      await ctx.db.patch("episodes", attempt.episodeId, { processing: "running", currentStage: attempt.stage });
      await ctx.scheduler.runAfter(0, internal.modelRunner.runAttempt, { attemptId: attempt._id });
      await ctx.scheduler.runAfter(WATCHDOG_MS, internal.pipeline.watchdog, { attemptId: attempt._id, startedAt: now });
    }
    if (due.length > 0) await ctx.db.patch("control", control._id, { running: control.running + due.length });
    return null;
  },
});

export const getAttemptContext = internalQuery({
  args: { attemptId: v.id("attempts") },
  handler: async (ctx, { attemptId }) => {
    const attempt = await ctx.db.get("attempts", attemptId);
    if (!attempt || attempt.status !== "running" || attempt.startedAt === undefined) return null;
    const run = (await ctx.db.get("runs", attempt.runId))!;
    const doc = await getRunDocument(ctx, run);
    const outputs = await loadOutputs(ctx, run._id);
    return {
      stage: attempt.stage,
      attemptNumber: attempt.attemptNumber,
      startedAt: attempt.startedAt,
      passages: allPassages(doc.content),
      annotations: outputs.annotate?.annotations ?? [],
      facts: outputs.extract?.facts ?? [],
      retrievedReferenceIds: run.retrievedReferenceIds ?? [],
    };
  },
});

type Outputs = {
  annotate?: Extract<Doc<"outputs">["output"], { stage: "annotate" }>;
  extract?: Extract<Doc<"outputs">["output"], { stage: "extract" }>;
  propose?: Extract<Doc<"outputs">["output"], { stage: "propose" }>;
};

export async function loadOutputs(ctx: QueryCtx, runId: Id<"runs">): Promise<Outputs> {
  const rows = await ctx.db
    .query("outputs")
    .withIndex("by_run", (q) => q.eq("runId", runId))
    .take(10);
  const out: Outputs = {};
  for (const row of rows) {
    const o = row.output;
    if (o.stage === "annotate") out.annotate = o;
    else if (o.stage === "extract") out.extract = o;
    else out.propose = o;
  }
  return out;
}

export async function getRunDocument(ctx: QueryCtx, run: Doc<"runs">) {
  const doc = await ctx.db
    .query("documents")
    .withIndex("by_episode_and_version", (q) => q.eq("episodeId", run.episodeId).eq("version", run.documentVersion))
    .unique();
  if (!doc) throw new Error("Source document missing for run");
  return doc;
}

// Open questions of a run, excluding those withdrawn by a retry.
export async function liveQuestions(ctx: QueryCtx, runId: Id<"runs">) {
  const rows = await ctx.db.query("questions").withIndex("by_run", (q) => q.eq("runId", runId)).take(20);
  return rows.filter((q) => q.status !== "withdrawn");
}

// Fence: an attempt may change state only while its run is the Episode's
// active run and the attempt belongs to the current retry round.
function isCurrentAttempt(attempt: Doc<"attempts">, run: Doc<"runs">, episode: Doc<"episodes">): boolean {
  return run.status !== "superseded" && episode.activeRunId === run._id && run.retryRound === attempt.round;
}

async function releaseSlot(ctx: MutationCtx) {
  const control = await getControl(ctx);
  await ctx.db.patch("control", control._id, { running: Math.max(0, control.running - 1) });
}

export const recordAttemptResult = internalMutation({
  args: {
    attemptId: v.id("attempts"),
    startedAt: v.number(),
    outcome: v.union(
      v.object({ ok: v.literal(true), output: stageOutputV }),
      v.object({ ok: v.literal(false), error: v.string() }),
    ),
    prompt: v.string(),
    rawOutput: v.optional(v.string()),
    model: v.string(),
    inputHash: v.string(),
    latencyMs: v.number(),
  },
  returns: v.object({ accepted: v.boolean() }),
  handler: async (ctx, args) => {
    const attempt = await ctx.db.get("attempts", args.attemptId);
    // Fence: only the exact running attempt may commit. A timed-out or
    // cancelled attempt's late completion is ignored.
    if (!attempt || attempt.status !== "running" || attempt.startedAt !== args.startedAt) {
      return { accepted: false };
    }
    await releaseSlot(ctx);
    const now = Date.now();
    const base = {
      finishedAt: now,
      model: args.model,
      inputHash: args.inputHash,
      latencyMs: args.latencyMs,
    };
    // Stage input and raw output are kept for audit in their own table so
    // attempt rows stay small for Worklist, detail and metrics reads.
    await ctx.db.insert("attemptPayloads", { attemptId: attempt._id, prompt: args.prompt, rawOutput: args.rawOutput });
    const run = (await ctx.db.get("runs", attempt.runId))!;
    const episode = (await ctx.db.get("episodes", attempt.episodeId))!;
    await ctx.scheduler.runAfter(0, internal.pipeline.pump, {});
    if (!isCurrentAttempt(attempt, run, episode)) {
      await ctx.db.patch("attempts", attempt._id, { ...base, status: "stale" });
      return { accepted: false };
    }
    if (!args.outcome.ok) {
      await ctx.db.patch("attempts", attempt._id, { ...base, status: "failed", error: args.outcome.error });
      await handleFailure(ctx, attempt, run, args.outcome.error);
      return { accepted: false };
    }
    const outputs = await loadOutputs(ctx, run._id);
    if (outputs[attempt.stage] || args.outcome.output.stage !== attempt.stage) {
      // Accepted output is immutable; a duplicate completion is stale.
      await ctx.db.patch("attempts", attempt._id, { ...base, status: "stale" });
      return { accepted: false };
    }
    await ctx.db.patch("attempts", attempt._id, { ...base, status: "succeeded" });
    await ctx.db.insert("outputs", { runId: run._id, attemptId: attempt._id, output: args.outcome.output });
    await setStage(ctx, run._id, attempt.stage, "done");
    await advance(ctx, run._id, attempt.stage);
    return { accepted: true };
  },
});

export const watchdog = internalMutation({
  args: { attemptId: v.id("attempts"), startedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, { attemptId, startedAt }) => {
    const attempt = await ctx.db.get("attempts", attemptId);
    if (!attempt || attempt.status !== "running" || attempt.startedAt !== startedAt) return null;
    await releaseSlot(ctx);
    const error = `No result within ${WATCHDOG_MS / 1000} s; attempt timed out.`;
    await ctx.db.patch("attempts", attemptId, { status: "timed_out", finishedAt: Date.now(), error });
    const run = (await ctx.db.get("runs", attempt.runId))!;
    const episode = (await ctx.db.get("episodes", attempt.episodeId))!;
    if (isCurrentAttempt(attempt, run, episode)) {
      await handleFailure(ctx, attempt, run, error);
    }
    await ctx.scheduler.runAfter(0, internal.pipeline.pump, {});
    return null;
  },
});

async function handleFailure(ctx: MutationCtx, attempt: Doc<"attempts">, run: Doc<"runs">, error: string) {
  const sameRound = (
    await ctx.db
      .query("attempts")
      .withIndex("by_run_and_stage", (q) => q.eq("runId", run._id).eq("stage", attempt.stage))
      .take(50)
  ).filter((a) => a.round === attempt.round);
  if (sameRound.length < MAX_ATTEMPTS_PER_STAGE) {
    await enqueueAttempt(ctx, {
      runId: run._id,
      episodeId: run.episodeId,
      stage: attempt.stage,
      round: attempt.round,
      attemptNumber: sameRound.length + 1,
      delayMs: BACKOFF_MS[Math.min(sameRound.length, BACKOFF_MS.length) - 1],
    });
    return;
  }
  const now = Date.now();
  await setStage(ctx, run._id, attempt.stage, "failed");
  await ctx.db.patch("runs", run._id, {
    status: "failed",
    failedStage: attempt.stage,
    failure: error,
    result: "sent_to_review",
    reason: `Pipeline could not complete the ${stageLabel(attempt.stage)} stage after ${MAX_ATTEMPTS_PER_STAGE} attempts. Accepted earlier stages are kept; retry the failed stage.`,
    completedAt: now,
  });
  await ctx.db.patch("episodes", run.episodeId, {
    processing: "failed",
    currentStage: attempt.stage,
    result: "sent_to_review",
    review: "blocked",
  });
  await ctx.db.insert("questions", {
    episodeId: run.episodeId,
    runId: run._id,
    key: `system:${attempt.stage}:${attempt.round}`,
    kind: "system",
    basis: "system_failure",
    question: `Pipeline could not complete the ${stageLabel(attempt.stage)} stage.`,
    revisited: `Last error: ${error}`,
    blocks: "Coding cannot be approved. No prepared result is substituted; retry the stage or rerun the Episode.",
    passageIds: [],
    factIds: [],
    options: [],
    answerable: false,
    status: "unresolved",
  });
}

async function advance(ctx: MutationCtx, runId: Id<"runs">, stage: ModelStage) {
  const run = (await ctx.db.get("runs", runId))!;
  if (stage === "annotate") {
    await enqueueAttempt(ctx, { runId, episodeId: run.episodeId, stage: "extract", round: run.retryRound, attemptNumber: 1, delayMs: 0 });
    await ctx.db.patch("episodes", run.episodeId, { processing: "queued", currentStage: "extract" });
    return;
  }
  const outputs = await loadOutputs(ctx, runId);
  if (stage === "extract") {
    // Stage 4: deterministic retrieval from the frozen curated library.
    await setStage(ctx, runId, "retrieve", "running");
    const texts = [
      ...(outputs.extract?.facts ?? []).map((f) => `${f.kind}: ${f.statement}`),
      ...(outputs.annotate?.annotations ?? []).filter((a) => a.status === "affirmed").map((a) => a.concept),
    ];
    await ctx.db.patch("runs", runId, { retrievedReferenceIds: retrieveReferences(texts) });
    await setStage(ctx, runId, "retrieve", "done");
    await enqueueAttempt(ctx, { runId, episodeId: run.episodeId, stage: "propose", round: run.retryRound, attemptNumber: 1, delayMs: 0 });
    await ctx.db.patch("episodes", run.episodeId, { processing: "queued", currentStage: "propose" });
    return;
  }
  await finalizeRun(ctx, runId);
}

// Stages 6–7 run deterministically in the same transaction that accepts
// the proposal.
async function finalizeRun(ctx: MutationCtx, runId: Id<"runs">) {
  const run = (await ctx.db.get("runs", runId))!;
  const episode = (await ctx.db.get("episodes", run.episodeId))!;
  const doc = await getRunDocument(ctx, run);
  const outputs = await loadOutputs(ctx, runId);
  const proposal = outputs.propose!.proposal;
  const passages = allPassages(doc.content);
  const facts = outputs.extract?.facts ?? [];
  const conflicts = outputs.extract?.conflicts ?? [];
  await setStage(ctx, runId, "resolve", "running");
  const questions: QuestionSpec[] = deriveQuestions({
    preset: episode.preset,
    passages,
    facts,
    conflicts,
    retrievedReferenceIds: run.retrievedReferenceIds ?? [],
    proposal,
  });
  for (const q of questions) {
    await ctx.db.insert("questions", { ...q, episodeId: episode._id, runId, status: "unresolved" });
  }
  await setStage(ctx, runId, "resolve", "done");
  await setStage(ctx, runId, "route", "running");
  const checks = runChecks({
    preset: episode.preset,
    passages,
    facts,
    conflicts,
    retrievedReferenceIds: run.retrievedReferenceIds ?? [],
    proposal,
    rejectedAnnotations: outputs.annotate?.rejected.length ?? 0,
    answers: [],
  });
  const routing = routeResult(checks, questions.map((q) => ({ question: q.question, status: "unresolved" as const })));
  await setStage(ctx, runId, "route", "done");
  const now = Date.now();
  await ctx.db.patch("runs", runId, {
    status: "completed",
    completedAt: now,
    effectiveProposal: proposal,
    checks,
    result: routing.value,
    reason: routing.reason,
  });
  await ctx.db.patch("episodes", episode._id, {
    processing: "completed",
    currentStage: "route",
    result: routing.value,
    review: routing.value === "auto_coded" ? "none" : reviewState(questions.map((q) => ({ ...q, status: "unresolved" as const })), checks),
    firstActionableAt: episode.firstActionableAt ?? now,
  });
  if (routing.value === "auto_coded") {
    await saveFinalCoding(ctx, episode._id, runId, proposal, "system");
  }
}

export function reviewState(
  questions: { answerable: boolean; status: "unresolved" | "answered" | "withdrawn" }[],
  checks: Check[],
): "open" | "ready" | "blocked" {
  const live = questions.filter((q) => q.status !== "withdrawn");
  if (live.some((q) => q.status === "unresolved" && !q.answerable)) return "blocked";
  if (live.some((q) => q.status === "unresolved")) return "open";
  return checks.every((c) => c.status === "passed") ? "ready" : "blocked";
}

export async function saveFinalCoding(
  ctx: MutationCtx,
  episodeId: Id<"episodes">,
  runId: Id<"runs">,
  proposal: NonNullable<Doc<"runs">["effectiveProposal"]>,
  completedBy: "system" | "presenter",
) {
  await ctx.db.insert("finalCodings", {
    episodeId,
    runId,
    diagnoses: [
      ...proposal.diagnoses.filter((d) => d.position === "primary"),
      ...proposal.diagnoses.filter((d) => d.position !== "primary"),
    ].map((d) => ({ code: d.code, position: d.position === "primary" ? ("primary" as const) : ("secondary" as const) })),
    procedures: proposal.procedureGroups
      .flatMap((g) => g.codes)
      .map((c, i) => ({ code: c.code, sequence: i + 1 })),
    completedBy,
    completedAt: Date.now(),
    referenceVersion: REFERENCE_LIBRARY_VERSION,
  });
}

// Presenter retry: a new round for the failed stage, reusing accepted
// earlier outputs of the same run.
export async function retryFailedStage(ctx: MutationCtx, episode: Doc<"episodes">) {
  const run = episode.activeRunId ? await ctx.db.get("runs", episode.activeRunId) : null;
  if (!run || run.status !== "failed" || !run.failedStage) throw new ConvexError("Only a failed run can be retried.");
  const round = run.retryRound + 1;
  const stages = run.stages.map((s) => (s.stage === run.failedStage ? { stage: s.stage, status: "pending" as const } : s));
  await ctx.db.patch("runs", run._id, {
    status: "queued",
    retryRound: round,
    stages,
    failedStage: undefined,
    failure: undefined,
    result: undefined,
    reason: undefined,
    completedAt: undefined,
  });
  const questions = await ctx.db
    .query("questions")
    .withIndex("by_run", (q) => q.eq("runId", run._id))
    .take(50);
  for (const q of questions) {
    if (q.kind === "system" && q.status === "unresolved") await ctx.db.patch("questions", q._id, { status: "withdrawn" });
  }
  await ctx.db.patch("episodes", episode._id, {
    processing: "queued",
    currentStage: run.failedStage,
    result: "pending",
    review: "none",
  });
  await enqueueAttempt(ctx, { runId: run._id, episodeId: episode._id, stage: run.failedStage, round, attemptNumber: 1, delayMs: 0 });
  return run.failedStage;
}

// Full rerun: supersede the active run (history kept) and start a new one.
export async function rerunEpisode(ctx: MutationCtx, episode: Doc<"episodes">) {
  if (episode.activeRunId) {
    await ctx.db.patch("runs", episode.activeRunId, { status: "superseded" });
    const pending = await ctx.db
      .query("attempts")
      .withIndex("by_run_and_stage", (q) => q.eq("runId", episode.activeRunId!))
      .take(50);
    for (const a of pending) {
      if (a.status === "queued") await ctx.db.patch("attempts", a._id, { status: "cancelled", finishedAt: Date.now() });
    }
  }
  return await startRun(ctx, episode._id);
}

