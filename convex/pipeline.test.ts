/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { annotateRaw, extractRaw, proposeRaw } from "./fakeModel.testkit";
import { validateStageOutput } from "./lib/contracts";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

type T = Awaited<ReturnType<typeof setup>>["t"];

async function setup() {
  const t = convexTest(schema, modules);
  const sessionId = await t.mutation(api.presenter.newDemoSession, {});
  const session = await t.run((ctx) => ctx.db.get("demoSessions", sessionId));
  return { t, sessionId, code: session!.code };
}

async function submitAudience(t: T, code: string, overrides: Record<string, unknown> = {}) {
  const { token } = await t.mutation(api.participants.join, { code });
  await t.mutation(api.participants.saveDraft, {
    token,
    step: 9,
    draft: { displayName: "Ada", age: 72, side: "left", condition: "nuclear", complication: "none", diabetes: false, hypertension: false, glaucoma: false, ...overrides },
  });
  const episodeId = await t.mutation(api.participants.submit, { token });
  return { token, episodeId };
}

async function runningAttempts(t: T) {
  return await t.run((ctx) =>
    ctx.db.query("attempts").withIndex("by_status_and_notBefore", (q) => q.eq("status", "running")).collect(),
  );
}

// Simulates the model action with the deterministic fake model.
async function completeAttempt(t: T, attemptId: Id<"attempts">, rawOverride?: string) {
  const context = await t.query(internal.pipeline.getAttemptContext, { attemptId });
  if (!context) throw new Error("attempt not running");
  const attempt = (await t.run((ctx) => ctx.db.get("attempts", attemptId)))!;
  const episode = (await t.run((ctx) => ctx.db.get("episodes", attempt.episodeId)))!;
  const raw =
    rawOverride ??
    (context.stage === "annotate"
      ? annotateRaw(context.passages)
      : context.stage === "extract"
        ? extractRaw(context.passages, context.annotations, episode.preset)
        : proposeRaw(context.facts, episode.preset));
  const validated = validateStageOutput(context.stage, raw, context);
  return await t.mutation(internal.pipeline.recordAttemptResult, {
    attemptId,
    startedAt: context.startedAt,
    outcome: validated.ok ? { ok: true, output: validated.value } : { ok: false, error: validated.error },
    prompt: "test prompt",
    rawOutput: raw,
    model: "fake-model",
    inputHash: "test",
    latencyMs: 5,
  });
}

// Drives dispatch + fake completions until no work remains.
async function drain(t: T) {
  for (let i = 0; i < 40; i++) {
    await t.mutation(internal.pipeline.pump, {});
    const running = await runningAttempts(t);
    if (running.length === 0) {
      const queued = await t.run((ctx) => ctx.db.query("attempts").withIndex("by_status_and_notBefore", (q) => q.eq("status", "queued")).collect());
      if (queued.length === 0) return;
      vi.advanceTimersByTime(6_000);
      continue;
    }
    for (const a of running) await completeAttempt(t, a._id);
  }
  throw new Error("pipeline did not drain");
}

describe("join and submit", () => {
  test("join resumes the same participant for a stored token", async () => {
    const { t, code } = await setup();
    const a = await t.mutation(api.participants.join, { code });
    const b = await t.mutation(api.participants.join, { code, token: a.token });
    const c = await t.mutation(api.participants.join, { code });
    expect(b.token).toBe(a.token);
    expect(c.token).not.toBe(a.token);
  });

  test("draft survives and submit is idempotent", async () => {
    const { t, code, sessionId } = await setup();
    const { token } = await t.mutation(api.participants.join, { code });
    await t.mutation(api.participants.saveDraft, { token, step: 2, draft: { displayName: "Ada", age: 70 } });
    await t.mutation(api.participants.saveDraft, { token, step: 3, draft: { side: "both", complication: "pcr" } });
    const view = await t.query(api.participants.view, { token });
    expect(view!.draft).toMatchObject({ displayName: "Ada", age: 70, side: "both", complication: "none" });
    expect(view!.step).toBe(3);
    await expect(t.mutation(api.participants.submit, { token })).rejects.toThrow(/cataract type/);
    await t.mutation(api.participants.saveDraft, { token, step: 9, draft: { condition: "nuclear", diabetes: true, hypertension: false, glaucoma: false } });
    const [e1, e2] = await Promise.all([t.mutation(api.participants.submit, { token }), t.mutation(api.participants.submit, { token })]);
    const e3 = await t.mutation(api.participants.submit, { token });
    expect(e1).toBe(e2);
    expect(e3).toBe(e1);
    const worklist = await t.query(api.presenter.worklist, { sessionId });
    expect(worklist).toHaveLength(1);
    expect(worklist[0]).toMatchObject({ laterality: "Bilateral", processing: "queued" });
    await expect(t.mutation(api.participants.saveDraft, { token, step: 1, draft: { age: 80 } })).rejects.toThrow(/already been submitted/);
  });
});

describe("processing", () => {
  test("routine Episode auto-codes with persisted stages, outputs and final coding", async () => {
    const { t, code } = await setup();
    const { token, episodeId } = await submitAudience(t, code);
    await drain(t);
    const detail = (await t.query(api.presenter.episodeDetail, { episodeId }))!;
    expect(detail.episode).toMatchObject({ processing: "completed", result: "auto_coded" });
    expect(detail.run!.stages.every((s) => s.status === "done")).toBe(true);
    expect(detail.annotations.length).toBeGreaterThan(0);
    expect(detail.facts.length).toBeGreaterThan(0);
    expect(detail.finalCoding!.procedures.map((p) => p.code)).toEqual(["C75.1", "C71.2", "Z94.3"]);
    expect(detail.attempts.every((a) => a.model === "fake-model" && a.status === "succeeded")).toBe(true);
    const view = (await t.query(api.participants.view, { token }))!;
    expect(view.episode!.result).toBe("auto_coded");
    expect(view.episode!.facts.length).toBeGreaterThan(0);
  });

  test("pause blocks new stages but accepts submissions and lets active attempts finish", async () => {
    const { t, code } = await setup();
    const first = await submitAudience(t, code);
    await t.mutation(internal.pipeline.pump, {});
    expect(await runningAttempts(t)).toHaveLength(1);
    await t.mutation(api.presenter.setPaused, { paused: true });
    const second = await submitAudience(t, code);
    await t.mutation(internal.pipeline.pump, {});
    const [active] = await runningAttempts(t);
    expect(active.episodeId).toBe(first.episodeId);
    expect((await completeAttempt(t, active._id)).accepted).toBe(true);
    await t.mutation(internal.pipeline.pump, {});
    expect(await runningAttempts(t)).toHaveLength(0);
    const secondView = (await t.query(api.participants.view, { token: second.token }))!;
    expect(secondView.paused).toBe(true);
    expect(secondView.episode!.processing).toBe("queued");
    await t.mutation(api.presenter.setPaused, { paused: false });
    await drain(t);
    for (const e of [first, second]) {
      const d = (await t.query(api.presenter.episodeDetail, { episodeId: e.episodeId }))!;
      expect(d.episode.result).toBe("auto_coded");
    }
  });

  test("concurrency limit is respected", async () => {
    const { t, code } = await setup();
    await t.mutation(api.presenter.setMaxConcurrent, { maxConcurrent: 2 });
    for (let i = 0; i < 4; i++) await submitAudience(t, code);
    await t.mutation(internal.pipeline.pump, {});
    expect(await runningAttempts(t)).toHaveLength(2);
  });

  test("invalid output uses the shared attempt budget, then fails visibly; retry keeps accepted work", async () => {
    const { t, code } = await setup();
    const { episodeId, token } = await submitAudience(t, code);
    await t.mutation(internal.pipeline.pump, {});
    await completeAttempt(t, (await runningAttempts(t))[0]._id);
    for (let i = 0; i < 3; i++) {
      await t.mutation(internal.pipeline.pump, {});
      let running = await runningAttempts(t);
      if (running.length === 0) {
        vi.advanceTimersByTime(6_000);
        await t.mutation(internal.pipeline.pump, {});
        running = await runningAttempts(t);
      }
      expect(running[0].stage).toBe("extract");
      await completeAttempt(t, running[0]._id, "{\"facts\": \"nope\"}");
    }
    let d = (await t.query(api.presenter.episodeDetail, { episodeId }))!;
    expect(d.episode).toMatchObject({ processing: "failed", result: "sent_to_review", review: "blocked" });
    expect(d.run!.failedStage).toBe("extract");
    expect(d.questions.map((q) => q.kind)).toEqual(["system"]);
    expect(d.attempts.filter((a) => a.stage === "extract" && a.status === "failed")).toHaveLength(3);
    expect(d.finalCoding).toBeNull();
    await expect(t.mutation(api.presenter.approve, { episodeId })).rejects.toThrow();
    expect((await t.query(api.participants.view, { token }))!.episode!.failure).toMatch(/Rejected output|facts/);

    await t.mutation(api.presenter.retry, { episodeId });
    await drain(t);
    d = (await t.query(api.presenter.episodeDetail, { episodeId }))!;
    expect(d.episode.result).toBe("auto_coded");
    expect(d.attempts.filter((a) => a.stage === "annotate")).toHaveLength(1);
    expect(d.questions).toHaveLength(0);
    expect(d.decisions.map((x) => x.kind)).toContain("retry");
  });

  test("watchdog times out a stuck attempt and fences its late result", async () => {
    const { t, code } = await setup();
    await submitAudience(t, code);
    await t.mutation(internal.pipeline.pump, {});
    const [attempt] = await runningAttempts(t);
    const context = await t.query(internal.pipeline.getAttemptContext, { attemptId: attempt._id });
    await t.mutation(internal.pipeline.watchdog, { attemptId: attempt._id, startedAt: attempt.startedAt! });
    const after = await t.run((ctx) => ctx.db.get("attempts", attempt._id));
    expect(after!.status).toBe("timed_out");
    const late = await t.mutation(internal.pipeline.recordAttemptResult, {
      attemptId: attempt._id,
      startedAt: context!.startedAt,
      outcome: { ok: false, error: "late" },
      prompt: "test prompt",
      model: "fake-model",
      inputHash: "x",
      latencyMs: 1,
    });
    expect(late.accepted).toBe(false);
    const control = await t.run((ctx) => ctx.db.query("control").first());
    expect(control!.running).toBe(0);
  });

  test("rerun supersedes the old run; its in-flight completion is stale", async () => {
    const { t, code } = await setup();
    const { episodeId } = await submitAudience(t, code);
    await t.mutation(internal.pipeline.pump, {});
    const [old] = await runningAttempts(t);
    await t.mutation(api.presenter.rerun, { episodeId });
    const res = await completeAttempt(t, old._id);
    expect(res.accepted).toBe(false);
    expect((await t.run((ctx) => ctx.db.get("attempts", old._id)))!.status).toBe("stale");
    await drain(t);
    const d = (await t.query(api.presenter.episodeDetail, { episodeId }))!;
    expect(d.run!.number).toBe(2);
    expect(d.episode.result).toBe("auto_coded");
    const runs = await t.run((ctx) => ctx.db.query("runs").collect());
    expect(runs.map((r) => r.status).sort()).toEqual(["completed", "superseded"]);
  });
});

describe("review", () => {
  test("contradictory laterality: clarification, then approval reflected for the Episode", async () => {
    const { t } = await setup();
    const episodeId = await t.mutation(api.presenter.loadTeachingEpisode, { kind: "teaching_contradictory_laterality" });
    await drain(t);
    let d = (await t.query(api.presenter.episodeDetail, { episodeId }))!;
    expect(d.episode).toMatchObject({ result: "sent_to_review", review: "open" });
    expect(d.conflicts).toHaveLength(1);
    await expect(t.mutation(api.presenter.approve, { episodeId })).rejects.toThrow(/Open question/);
    const q = d.questions.find((x) => x.kind === "laterality")!;
    await t.mutation(api.presenter.answerQuestion, { questionId: q._id, optionId: "clarify_right" });
    d = (await t.query(api.presenter.episodeDetail, { episodeId }))!;
    expect(d.episode.review).toBe("ready");
    expect(d.proposal!.procedureGroups[0].codes.map((c) => c.code)).toEqual(["C75.1", "C71.2", "Z94.2"]);
    expect(d.modelProposal!.procedureGroups[0].codes.map((c) => c.code)).toEqual(["C75.1", "C71.2"]);
    expect(d.facts.some((f) => f.source === "presenter")).toBe(true);
    await t.mutation(api.presenter.approve, { episodeId });
    d = (await t.query(api.presenter.episodeDetail, { episodeId }))!;
    expect(d.episode.review).toBe("approved");
    expect(d.finalCoding).toMatchObject({ completedBy: "presenter" });
    expect(d.decisions.map((x) => x.kind).sort()).toEqual(["answer", "approve"]);
  });

  test("mature white confirmation is approvable and reaches the personal URL", async () => {
    const { t, code } = await setup();
    const { episodeId, token } = await submitAudience(t, code, { condition: "mature" });
    await drain(t);
    const d = (await t.query(api.presenter.episodeDetail, { episodeId }))!;
    const q = d.questions[0];
    expect(q.kind).toBe("diagnosis_confirmation");
    await t.mutation(api.presenter.answerQuestion, { questionId: q._id, optionId: "confirm_h26_9" });
    await t.mutation(api.presenter.approve, { episodeId });
    const view = (await t.query(api.participants.view, { token }))!;
    expect(view.episode!.review).toBe("approved");
    expect(view.episode!.questions[0]).toMatchObject({ status: "answered" });
    expect(view.episode!.finalCoding).toMatchObject({ completedBy: "presenter" });
  });

  test("capsule rupture completeness blocks approval", async () => {
    const { t, code } = await setup();
    const { episodeId } = await submitAudience(t, code, { complication: "pcr", side: "right" });
    await drain(t);
    const d = (await t.query(api.presenter.episodeDetail, { episodeId }))!;
    expect(d.episode).toMatchObject({ result: "sent_to_review", review: "blocked" });
    const q = d.questions.find((x) => x.kind === "completeness")!;
    await expect(t.mutation(api.presenter.answerQuestion, { questionId: q._id, optionId: "x" })).rejects.toThrow(/cannot be answered/);
    await expect(t.mutation(api.presenter.approve, { episodeId })).rejects.toThrow(/Approval blocked/);
  });
});

describe("demo sessions", () => {
  test("new demo keeps earlier results and personal URLs; old join route is closed", async () => {
    const { t, code, sessionId } = await setup();
    const { token } = await submitAudience(t, code);
    const second = await t.mutation(api.presenter.newDemoSession, {});
    expect(second).not.toBe(sessionId);
    expect(await t.query(api.presenter.worklist, { sessionId })).toHaveLength(1);
    expect(await t.query(api.presenter.worklist, { sessionId: second })).toHaveLength(0);
    expect((await t.query(api.participants.view, { token }))!.episode).not.toBeNull();
    await expect(t.mutation(api.participants.join, { code })).rejects.toThrow(/finished/);
    const { token: stale } = await t.mutation(api.participants.join, { code: (await t.run((ctx) => ctx.db.get("demoSessions", second)))!.code });
    await t.mutation(api.presenter.newDemoSession, {});
    await expect(t.mutation(api.participants.saveDraft, { token: stale, step: 1, draft: { age: 70 } })).rejects.toThrow(/finished/);
    await expect(t.mutation(api.participants.submit, { token: stale })).rejects.toThrow(/finished/);
    expect((await t.mutation(api.participants.join, { code, token })).token).toBe(token);
  });
});
