import { v } from "convex/values";
import { query } from "./_generated/server";

// Readiness measurements per demo session: submission to first actionable
// result, split into queue wait and model processing time.
export const sessionTiming = query({
  args: { sessionId: v.id("demoSessions") },
  handler: async (ctx, { sessionId }) => {
    const episodes = await ctx.db
      .query("episodes")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .take(200);
    const rows = [];
    for (const e of episodes) {
      const attempts = await ctx.db
        .query("attempts")
        .withIndex("by_episode", (q) => q.eq("episodeId", e._id))
        .take(60);
      let queueWaitMs = 0;
      let modelMs = 0;
      for (const a of attempts) {
        if (a.startedAt !== undefined) queueWaitMs += Math.max(0, a.startedAt - a.notBefore);
        modelMs += a.latencyMs ?? 0;
      }
      rows.push({
        worklistId: e.worklistId,
        origin: e.origin,
        processing: e.processing,
        result: e.result,
        submittedAt: e.submittedAt,
        firstActionableMs: e.firstActionableAt !== undefined ? e.firstActionableAt - e.submittedAt : null,
        queueWaitMs,
        modelMs,
        attempts: attempts.length,
        failedAttempts: attempts.filter((a) => a.status === "failed" || a.status === "timed_out").length,
      });
    }
    return rows;
  },
});
