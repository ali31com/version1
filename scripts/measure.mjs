#!/usr/bin/env node
// Demo readiness measurement against the configured Convex deployment.
//
//   node scripts/measure.mjs --report <sessionId>      report an existing session
//   node scripts/measure.mjs --submit 5                normal load: 5 sequential submissions
//   node scripts/measure.mjs --submit 50 --burst       burst: 50 concurrent submissions
//
// --submit starts a NEW demo session (the presenter's live session changes)
// and sends real Gemini requests: roughly three per Episode.
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name) => args.indexOf(name);
const value = (name) => (flag(name) >= 0 ? args[flag(name) + 1] : undefined);

const url =
  process.env.VITE_CONVEX_URL ??
  readFileSync(".env.local", "utf8").match(/^VITE_CONVEX_URL=(.+)$/m)?.[1]?.trim();
if (!url) throw new Error("Set VITE_CONVEX_URL or run from the repository root.");
const client = new ConvexHttpClient(url);
const api = anyApi;

const SIDES = ["left", "right", "both"];
function selections(i) {
  const side = SIDES[i % 3];
  return {
    displayName: `Load ${String(i + 1).padStart(2, "0")}`,
    age: 60 + (i % 35),
    side,
    condition: i % 5 === 4 ? "mature" : "nuclear",
    complication: "none",
    diabetes: i % 2 === 0,
    hypertension: i % 3 === 0,
    glaucoma: i % 4 === 0,
  };
}

async function submitOne(code, i) {
  const { token } = await client.mutation(api.participants.join, { code });
  await client.mutation(api.participants.saveDraft, { token, step: 9, draft: selections(i) });
  return await client.mutation(api.participants.submit, { token });
}

const pct = (xs, p) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};
const sec = (ms) => (ms === null || ms === undefined ? "—" : `${(ms / 1000).toFixed(1)}s`);

async function report(sessionId, { wait = false, timeoutMs = 15 * 60_000 } = {}) {
  const start = Date.now();
  let rows;
  for (;;) {
    rows = await client.query(api.metrics.sessionTiming, { sessionId });
    const pending = rows.filter((r) => r.processing === "queued" || r.processing === "running").length;
    if (!wait || pending === 0 || Date.now() - start > timeoutMs) break;
    process.stdout.write(`\r${pending} of ${rows.length} still processing…   `);
    await new Promise((r) => setTimeout(r, 3000));
  }
  process.stdout.write("\n");
  const done = rows.filter((r) => r.firstActionableMs !== null);
  const actionable = done.map((r) => r.firstActionableMs);
  const summary = {
    episodes: rows.length,
    completed: rows.filter((r) => r.processing === "completed").length,
    failed: rows.filter((r) => r.processing === "failed").length,
    stillProcessing: rows.filter((r) => r.processing === "queued" || r.processing === "running").length,
    autoCoded: rows.filter((r) => r.result === "auto_coded").length,
    sentToReview: rows.filter((r) => r.result === "sent_to_review").length,
    within30s: actionable.filter((ms) => ms <= 30_000).length,
    actionableP50: sec(pct(actionable, 50)),
    actionableP90: sec(pct(actionable, 90)),
    actionableMax: sec(pct(actionable, 100)),
    queueWaitP50: sec(pct(done.map((r) => r.queueWaitMs), 50)),
    queueWaitMax: sec(pct(done.map((r) => r.queueWaitMs), 100)),
    modelTimeP50: sec(pct(done.map((r) => r.modelMs), 50)),
    modelAttempts: rows.reduce((n, r) => n + r.attempts, 0),
    failedAttempts: rows.reduce((n, r) => n + r.failedAttempts, 0),
  };
  console.table(
    rows.map((r) => ({
      episode: r.worklistId,
      processing: r.processing,
      result: r.result,
      actionable: sec(r.firstActionableMs),
      queueWait: sec(r.queueWaitMs),
      model: sec(r.modelMs),
      attempts: r.attempts,
      failedAttempts: r.failedAttempts,
    })),
  );
  console.log(JSON.stringify(summary, null, 2));
}

if (value("--report")) {
  await report(value("--report"));
} else if (value("--submit")) {
  const n = Number(value("--submit"));
  const burst = flag("--burst") >= 0;
  const sessionId = await client.mutation(api.presenter.newDemoSession, {
    title: `${burst ? "Burst" : "Normal load"} measurement (${n})`,
  });
  const overview = await client.query(api.presenter.overview, {});
  const code = overview.sessions.find((s) => s._id === sessionId).code;
  console.log(`Session ${sessionId} (join code ${code}); submitting ${n} ${burst ? "concurrently" : "one at a time"}.`);
  if (burst) {
    await Promise.all(Array.from({ length: n }, (_, i) => submitOne(code, i)));
  } else {
    for (let i = 0; i < n; i++) {
      await submitOne(code, i);
      // Normal load: wait for this Episode before the next submission.
      await report(sessionId, { wait: true, timeoutMs: 5 * 60_000 });
    }
  }
  await report(sessionId, { wait: true });
} else {
  console.log(readFileSync(new URL(import.meta.url)).toString().split("\n").slice(1, 9).join("\n"));
}
