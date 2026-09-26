import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import {
  createEpisode,
  getControl,
  loadOutputs,
  readControl,
  rerunEpisode,
  retryFailedStage,
  reviewState,
  saveFinalCoding,
  STAGE_LABELS,
} from "./pipeline";
import { applyLateralityClarification, routeResult, runChecks } from "./lib/checks";
import { allPassages, teachingPreset } from "./lib/presets";
import { REFERENCES } from "./lib/references";

// The presenter workspace is unauthenticated: production security is
// outside the approved demo scope.

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const control = await readControl(ctx);
    const sessions = await ctx.db.query("demoSessions").withIndex("by_number").order("desc").take(20);
    const active = control?.activeSessionId ? await ctx.db.get("demoSessions", control.activeSessionId) : null;
    return {
      paused: control?.paused ?? false,
      running: control?.running ?? 0,
      maxConcurrent: control?.maxConcurrent ?? 0,
      activeSessionId: active?._id ?? null,
      sessions: sessions.map((s) => ({
        _id: s._id,
        number: s.number,
        code: s.code,
        title: s.title,
        participantCount: s.participantCount,
        submissionCount: s.submissionCount,
        closed: s.closedAt !== undefined,
        createdAt: s._creationTime,
      })),
    };
  },
});

export const worklist = query({
  args: { sessionId: v.id("demoSessions") },
  handler: async (ctx, { sessionId }) => {
    const episodes = await ctx.db
      .query("episodes")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .order("desc")
      .take(200);
    return episodes.map((e) => ({
      _id: e._id,
      worklistId: e.worklistId,
      origin: e.origin,
      displayName: e.displayName,
      age: e.age,
      summary: e.summary,
      laterality: e.laterality,
      processing: e.processing,
      currentStage: e.currentStage,
      result: e.result,
      review: e.review,
      submittedAt: e.submittedAt,
      firstActionableAt: e.firstActionableAt ?? null,
    }));
  },
});

export const episodeDetail = query({
  args: { episodeId: v.id("episodes") },
  handler: async (ctx, { episodeId }) => {
    const episode = await ctx.db.get("episodes", episodeId);
    if (!episode) return null;
    const run = episode.activeRunId ? await ctx.db.get("runs", episode.activeRunId) : null;
    const document = run
      ? await ctx.db
          .query("documents")
          .withIndex("by_episode_and_version", (q) => q.eq("episodeId", episodeId).eq("version", run.documentVersion))
          .unique()
      : null;
    const outputs = run ? await loadOutputs(ctx, run._id) : {};
    const questions = run
      ? (await ctx.db.query("questions").withIndex("by_run", (q) => q.eq("runId", run._id)).take(20)).filter(
          (q) => q.status !== "withdrawn",
        )
      : [];
    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_episode", (q) => q.eq("episodeId", episodeId))
      .order("desc")
      .take(40);
    const decisions = await ctx.db
      .query("decisions")
      .withIndex("by_episode", (q) => q.eq("episodeId", episodeId))
      .order("desc")
      .take(30);
    const final = await ctx.db
      .query("finalCodings")
      .withIndex("by_episode", (q) => q.eq("episodeId", episodeId))
      .order("desc")
      .first();
    const retrieved = new Set(run?.retrievedReferenceIds ?? []);
    return {
      episode: {
        _id: episode._id,
        worklistId: episode.worklistId,
        origin: episode.origin,
        displayName: episode.displayName,
        age: episode.age,
        summary: episode.summary,
        laterality: episode.laterality,
        presetId: episode.preset.presetId,
        presetVersion: episode.presetVersion,
        processing: episode.processing,
        currentStage: episode.currentStage,
        result: episode.result,
        review: episode.review,
        submittedAt: episode.submittedAt,
        firstActionableAt: episode.firstActionableAt ?? null,
        runCount: episode.runCount,
      },
      document: document?.content ?? null,
      run: run
        ? {
            _id: run._id,
            number: run.number,
            status: run.status,
            stages: run.stages,
            failedStage: run.failedStage ?? null,
            failure: run.failure ?? null,
            referenceVersion: run.referenceVersion,
            presetVersion: run.presetVersion,
            promptVersions: run.promptVersions,
            createdAt: run.createdAt,
            completedAt: run.completedAt ?? null,
            checks: run.checks ?? [],
            result: run.result ?? null,
            reason: run.reason ?? null,
            amended: run.amended,
          }
        : null,
      annotations: outputs.annotate?.annotations ?? [],
      rejectedAnnotations: outputs.annotate?.rejected ?? [],
      facts: [...(outputs.extract?.facts ?? []), ...(run?.presenterFacts ?? [])],
      conflicts: outputs.extract?.conflicts ?? [],
      references: REFERENCES.filter((r) => retrieved.has(r.id)).map(({ keywords: _k, ...r }) => r),
      modelProposal: outputs.propose?.proposal ?? null,
      proposal: run?.effectiveProposal ?? null,
      questions: questions.map((q) => ({
        _id: q._id,
        kind: q.kind,
        basis: q.basis,
        question: q.question,
        revisited: q.revisited,
        blocks: q.blocks,
        passageIds: q.passageIds,
        factIds: q.factIds,
        options: q.options,
        answerable: q.answerable,
        status: q.status,
        answer: q.answer ?? null,
      })),
      attempts: attempts.map((a) => ({
        _id: a._id,
        runId: a.runId,
        stage: a.stage,
        round: a.round,
        attemptNumber: a.attemptNumber,
        status: a.status,
        model: a.model ?? null,
        role: a.role,
        promptVersion: a.promptVersion,
        inputHash: a.inputHash ?? null,
        queuedAt: a.queuedAt,
        startedAt: a.startedAt ?? null,
        finishedAt: a.finishedAt ?? null,
        latencyMs: a.latencyMs ?? null,
        error: a.error ?? null,
        rawOutputLength: a.rawOutput?.length ?? 0,
      })),
      decisions: decisions.map((d) => ({ _id: d._id, kind: d.kind, summary: d.summary, at: d.at })),
      finalCoding: final && run && final.runId === run._id ? final : null,
    };
  },
});

export const rawOutput = query({
  args: { attemptId: v.id("attempts") },
  handler: async (ctx, { attemptId }) => {
    const attempt = await ctx.db.get("attempts", attemptId);
    return attempt?.rawOutput ?? null;
  },
});

function sessionCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

// Starts a fresh demo: new Worklist and QR join route. Earlier sessions
// and their personal URLs remain readable.
export const newDemoSession = mutation({
  args: { title: v.optional(v.string()) },
  returns: v.id("demoSessions"),
  handler: async (ctx, args) => {
    const control = await getControl(ctx);
    const last = await ctx.db.query("demoSessions").withIndex("by_number").order("desc").first();
    const number = (last?.number ?? 0) + 1;
    if (control.activeSessionId) {
      const previous = await ctx.db.get("demoSessions", control.activeSessionId);
      if (previous && previous.closedAt === undefined) {
        await ctx.db.patch("demoSessions", previous._id, { closedAt: Date.now() });
      }
    }
    let code = sessionCode();
    while (await ctx.db.query("demoSessions").withIndex("by_code", (q) => q.eq("code", code)).unique()) {
      code = sessionCode();
    }
    const sessionId = await ctx.db.insert("demoSessions", {
      number,
      code,
      title: args.title?.trim() || `Live demo ${number}`,
      nextSequence: 1,
      participantCount: 0,
      submissionCount: 0,
    });
    await ctx.db.patch("control", control._id, { activeSessionId: sessionId });
    return sessionId;
  },
});

export const setPaused = mutation({
  args: { paused: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { paused }) => {
    const control = await getControl(ctx);
    if (paused) {
      await ctx.db.patch("control", control._id, { paused: true });
      return null;
    }
    // Self-heal the slot counter from the attempts actually running.
    const running = await ctx.db
      .query("attempts")
      .withIndex("by_status_and_notBefore", (q) => q.eq("status", "running"))
      .take(100);
    await ctx.db.patch("control", control._id, { paused: false, running: running.length });
    await ctx.scheduler.runAfter(0, internal.pipeline.pump, {});
    return null;
  },
});

export const setMaxConcurrent = mutation({
  args: { maxConcurrent: v.number() },
  returns: v.null(),
  handler: async (ctx, { maxConcurrent }) => {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 50) {
      throw new ConvexError("Concurrency must be between 1 and 50.");
    }
    const control = await getControl(ctx);
    await ctx.db.patch("control", control._id, { maxConcurrent });
    await ctx.scheduler.runAfter(0, internal.pipeline.pump, {});
    return null;
  },
});

// Presenter-only teaching fixtures (not audience builder options).
export const loadTeachingEpisode = mutation({
  args: { kind: v.union(v.literal("teaching_contradictory_laterality"), v.literal("teaching_iris_hooks")) },
  returns: v.id("episodes"),
  handler: async (ctx, { kind }) => {
    const control = await getControl(ctx);
    if (!control.activeSessionId) throw new ConvexError("Start a demo session first.");
    return await createEpisode(ctx, {
      sessionId: control.activeSessionId,
      origin: "presenter",
      preset: teachingPreset(kind),
    });
  },
});

async function activeRun(ctx: MutationCtx, episode: Doc<"episodes">): Promise<Doc<"runs">> {
  const run = episode.activeRunId ? await ctx.db.get("runs", episode.activeRunId) : null;
  if (!run) throw new ConvexError("Episode has no run.");
  return run;
}

async function logDecision(
  ctx: MutationCtx,
  episodeId: Id<"episodes">,
  runId: Id<"runs"> | undefined,
  kind: Doc<"decisions">["kind"],
  summary: string,
) {
  await ctx.db.insert("decisions", { episodeId, runId, kind, summary, at: Date.now() });
}

// Resolving an Open question records a presenter decision, applies any
// bounded verified amendment and re-runs the deterministic checks.
export const answerQuestion = mutation({
  args: { questionId: v.id("questions"), optionId: v.string() },
  returns: v.null(),
  handler: async (ctx, { questionId, optionId }) => {
    const question = await ctx.db.get("questions", questionId);
    if (!question) throw new ConvexError("Open question not found.");
    if (question.status !== "unresolved") throw new ConvexError("This Open question is already resolved.");
    if (!question.answerable) throw new ConvexError("This Open question cannot be answered in the demo.");
    const option = question.options.find((o) => o.id === optionId);
    if (!option) throw new ConvexError("Unknown answer option.");
    const episode = (await ctx.db.get("episodes", question.episodeId))!;
    const run = await activeRun(ctx, episode);
    if (run._id !== question.runId || run.status !== "completed") {
      throw new ConvexError("This question belongs to an earlier run.");
    }
    const now = Date.now();
    await ctx.db.patch("questions", questionId, {
      status: "answered",
      answer: { optionId, label: option.label, at: now },
    });

    let proposal = run.effectiveProposal!;
    let presenterFacts = run.presenterFacts;
    let retrieved = run.retrievedReferenceIds ?? [];
    let amended = run.amended;
    if (question.kind === "laterality" && optionId === "clarify_right") {
      const factId = `f${String(90 + presenterFacts.length).padStart(2, "0")}`;
      presenterFacts = [
        ...presenterFacts,
        {
          id: factId,
          kind: "laterality" as const,
          statement: "Surgeon clarification (curated demo information): the right eye was operated on. Source text unchanged.",
          passageIds: question.passageIds,
          annotationIds: [],
          laterality: "right" as const,
          source: "presenter" as const,
        },
      ];
      proposal = applyLateralityClarification(proposal, factId);
      retrieved = [...new Set([...retrieved, "opcs:Z94.2", "std:PCSZ2", "std:PRule7"])];
      amended = true;
    }

    const all = await ctx.db.query("questions").withIndex("by_run", (q) => q.eq("runId", run._id)).take(20);
    const live = all.filter((q) => q.status !== "withdrawn");
    const answers = live.filter((q) => q.status === "answered" && q.answer).map((q) => ({ key: q.key, optionId: q.answer!.optionId }));
    const outputs = await loadOutputs(ctx, run._id);
    const doc = (await ctx.db
      .query("documents")
      .withIndex("by_episode_and_version", (q) => q.eq("episodeId", episode._id).eq("version", run.documentVersion))
      .unique())!;
    const checks = runChecks({
      preset: episode.preset,
      passages: allPassages(doc.content),
      facts: [...(outputs.extract?.facts ?? []), ...presenterFacts],
      conflicts: outputs.extract?.conflicts ?? [],
      retrievedReferenceIds: retrieved,
      proposal,
      rejectedAnnotations: outputs.annotate?.rejected.length ?? 0,
      answers,
    });
    const unresolved = live.filter((q) => q.status === "unresolved");
    const routing = routeResult(checks, unresolved.map((q) => ({ question: q.question, status: "unresolved" as const })));
    await ctx.db.patch("runs", run._id, {
      effectiveProposal: proposal,
      presenterFacts,
      retrievedReferenceIds: retrieved,
      amended,
      checks,
      reason:
        unresolved.length === 0 && checks.every((c) => c.status === "passed")
          ? "Sent to review; every Open question is answered and all checks pass. Ready for presenter approval."
          : routing.reason,
    });
    await ctx.db.patch("episodes", episode._id, { review: reviewState(live, checks) });
    await logDecision(ctx, episode._id, run._id, "answer", `${question.question} → ${option.label}`);
    return null;
  },
});

export const approve = mutation({
  args: { episodeId: v.id("episodes") },
  returns: v.null(),
  handler: async (ctx, { episodeId }) => {
    const episode = await ctx.db.get("episodes", episodeId);
    if (!episode) throw new ConvexError("Episode not found.");
    const run = await activeRun(ctx, episode);
    if (run.status !== "completed" || episode.result !== "sent_to_review") {
      throw new ConvexError("Only a completed Episode sent to review can be approved.");
    }
    if (episode.review === "approved") return null;
    const questions = (await ctx.db.query("questions").withIndex("by_run", (q) => q.eq("runId", run._id)).take(20)).filter(
      (q) => q.status !== "withdrawn",
    );
    const blocking = questions.filter((q) => q.status === "unresolved");
    if (blocking.length > 0) {
      throw new ConvexError(`Approval blocked by an unresolved Open question: ${blocking[0].question}`);
    }
    const failing = (run.checks ?? []).filter((c) => c.status !== "passed");
    if (failing.length > 0) {
      throw new ConvexError(`Approval blocked: ${failing.map((c) => `${c.id} ${c.label}`).join(", ")} not passed.`);
    }
    await saveFinalCoding(ctx, episode._id, run._id, run.effectiveProposal!, "presenter");
    await ctx.db.patch("episodes", episode._id, { review: "approved" });
    await ctx.db.patch("runs", run._id, { reason: `Approved by the presenter after review. ${run.reason ?? ""}`.trim() });
    await logDecision(ctx, episode._id, run._id, "approve", "Final coding approved and saved.");
    return null;
  },
});

export const retry = mutation({
  args: { episodeId: v.id("episodes") },
  returns: v.null(),
  handler: async (ctx, { episodeId }) => {
    const episode = await ctx.db.get("episodes", episodeId);
    if (!episode) throw new ConvexError("Episode not found.");
    let stage;
    try {
      stage = await retryFailedStage(ctx, episode);
    } catch (e) {
      throw new ConvexError(e instanceof Error ? e.message : "Retry failed.");
    }
    await logDecision(ctx, episode._id, episode.activeRunId, "retry", `Retried the ${STAGE_LABELS[stage]} stage; accepted earlier stages kept.`);
    return null;
  },
});

export const rerun = mutation({
  args: { episodeId: v.id("episodes") },
  returns: v.null(),
  handler: async (ctx, { episodeId }) => {
    const episode = await ctx.db.get("episodes", episodeId);
    if (!episode) throw new ConvexError("Episode not found.");
    const runId = await rerunEpisode(ctx, episode);
    await logDecision(ctx, episode._id, runId, "rerun", `Started run ${episode.runCount + 1}; earlier runs kept as history.`);
    return null;
  },
});
