import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query, type QueryCtx } from "./_generated/server";
import { createEpisode, getRunDocument, liveQuestions, loadOutputs, readControl } from "./pipeline";
import { audiencePreset, MAX_AGE, MIN_AGE, validateSelections } from "./lib/presets";
import { codeTitle } from "./lib/references";
import { draftV } from "./validators";

function newToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

// QR entry point: resumes this browser's participant for the session when
// it presents its stored token, otherwise creates a new participant.
export const join = mutation({
  args: { code: v.string(), token: v.optional(v.string()) },
  returns: v.object({ token: v.string() }),
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("demoSessions")
      .withIndex("by_code", (q) => q.eq("code", args.code.toLowerCase()))
      .unique();
    if (!session) throw new ConvexError("This demo link is not recognised.");
    if (args.token) {
      const existing = await ctx.db
        .query("participants")
        .withIndex("by_token", (q) => q.eq("token", args.token!))
        .unique();
      if (existing && existing.sessionId === session._id) return { token: existing.token };
    }
    if (session.closedAt !== undefined) throw new ConvexError("This demo has finished. Scan the current QR code to join.");
    const token = newToken();
    await ctx.db.insert("participants", { sessionId: session._id, token, draft: {}, step: 0 });
    await ctx.db.patch("demoSessions", session._id, { participantCount: session.participantCount + 1 });
    return { token };
  },
});

async function participantByToken(ctx: QueryCtx, token: string): Promise<Doc<"participants"> | null> {
  return await ctx.db
    .query("participants")
    .withIndex("by_token", (q) => q.eq("token", token))
    .unique();
}

// After "New demo", unsubmitted drafts from the earlier session stay
// viewable but cannot create Episodes in a Worklist nobody is watching.
async function assertSessionOpen(ctx: QueryCtx, participant: Doc<"participants">) {
  const session = await ctx.db.get("demoSessions", participant.sessionId);
  if (!session || session.closedAt !== undefined) {
    throw new ConvexError("This demo has finished. Scan the current QR code to join the new one.");
  }
}

export const saveDraft = mutation({
  args: { token: v.string(), draft: draftV, step: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const participant = await participantByToken(ctx, args.token);
    if (!participant) throw new ConvexError("Personal link not found.");
    if (participant.episodeId) throw new ConvexError("This Episode has already been submitted.");
    await assertSessionOpen(ctx, participant);
    const draft = { ...participant.draft, ...args.draft };
    if (draft.displayName !== undefined) draft.displayName = draft.displayName.slice(0, 40);
    if (draft.age !== undefined && (!Number.isInteger(draft.age) || draft.age < MIN_AGE || draft.age > MAX_AGE)) {
      throw new ConvexError(`Age must be a whole number from ${MIN_AGE} to ${MAX_AGE}.`);
    }
    await ctx.db.patch("participants", participant._id, { draft, step: Math.max(0, Math.min(args.step, 20)) });
    return null;
  },
});

// Submit once: the participant is the stable submission key, so double
// clicks and retries return the same Episode.
export const submit = mutation({
  args: { token: v.string() },
  returns: v.id("episodes"),
  handler: async (ctx, args) => {
    const participant = await participantByToken(ctx, args.token);
    if (!participant) throw new ConvexError("Personal link not found.");
    if (participant.episodeId) return participant.episodeId;
    await assertSessionOpen(ctx, participant);
    const { selections, errors } = validateSelections(participant.draft);
    if (!selections) throw new ConvexError(errors.map((e) => e.message).join(" "));
    const episodeId = await createEpisode(ctx, {
      sessionId: participant.sessionId,
      participantId: participant._id,
      origin: "audience",
      preset: audiencePreset(selections),
    });
    await ctx.db.patch("participants", participant._id, { episodeId, draft: selections });
    return episodeId;
  },
});

export const view = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const participant = await participantByToken(ctx, token);
    if (!participant) return null;
    const session = (await ctx.db.get("demoSessions", participant.sessionId))!;
    const control = await readControl(ctx);
    const base = {
      session: { title: session.title, code: session.code, closed: session.closedAt !== undefined },
      draft: participant.draft,
      step: participant.step,
      paused: control?.paused ?? false,
    };
    if (!participant.episodeId) return { ...base, episode: null };
    const episode = (await ctx.db.get("episodes", participant.episodeId))!;
    return { ...base, episode: await episodeResult(ctx, episode) };
  },
});

// Participant-facing result: live stages, accepted facts, codes and any
// Open question. Read-only.
async function episodeResult(ctx: QueryCtx, episode: Doc<"episodes">) {
  const run = episode.activeRunId ? await ctx.db.get("runs", episode.activeRunId) : null;
  const outputs = run ? await loadOutputs(ctx, run._id) : {};
  const questions = run ? await liveQuestions(ctx, run._id) : [];
  const final = await ctx.db
    .query("finalCodings")
    .withIndex("by_episode", (q) => q.eq("episodeId", episode._id))
    .order("desc")
    .first();
  let queueAhead: number | null = null;
  if (episode.processing === "queued" && run) {
    const queued = await ctx.db
      .query("attempts")
      .withIndex("by_status_and_notBefore", (q) => q.eq("status", "queued"))
      .take(200);
    const index = queued.findIndex((a) => a.runId === run._id);
    queueAhead = index >= 0 ? index : null;
  }
  const proposal = run?.effectiveProposal;
  const document = run ? await getRunDocument(ctx, run) : null;
  return {
    document: document?.content ?? null,
    worklistId: episode.worklistId,
    summary: episode.summary,
    laterality: episode.laterality,
    submittedAt: episode.submittedAt,
    firstActionableAt: episode.firstActionableAt ?? null,
    processing: episode.processing,
    currentStage: episode.currentStage,
    result: episode.result,
    review: episode.review,
    queueAhead,
    stages: run?.stages ?? [],
    failure: run?.failure ?? null,
    reason: run?.reason ?? null,
    facts: (outputs.extract?.facts ?? []).concat(run?.presenterFacts ?? []).map((f) => ({ id: f.id, kind: f.kind, statement: f.statement })),
    annotationCount: outputs.annotate?.annotations.length ?? 0,
    diagnoses: (proposal?.diagnoses ?? []).map((d) => ({
      code: d.code,
      title: codeTitle(d.code),
      position: d.position ?? "secondary",
      explanation: d.explanation,
    })),
    procedures: (proposal?.procedureGroups ?? []).map((g) => ({
      label: g.label,
      codes: g.codes.map((c) => ({ code: c.code, title: codeTitle(c.code), explanation: c.explanation })),
    })),
    questions: questions.map((q) => ({
      question: q.question,
      status: q.status,
      answer: q.answer?.label ?? null,
      answerable: q.answerable,
    })),
    finalCoding: final && run && final.runId === run._id ? { completedBy: final.completedBy, completedAt: final.completedAt, runId: final.runId } : null,
    activeRunId: run?._id ?? null,
  };
}
