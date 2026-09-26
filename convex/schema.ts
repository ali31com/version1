import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  checkV,
  draftV,
  factV,
  modelStageV,
  pipelineStageV,
  presetV,
  proposalV,
  questionOptionV,
  sourceDocumentV,
  stageOutputV,
  stageStatusV,
} from "./validators";

export default defineSchema({
  // Starter data retained from the original template.
  numbers: defineTable({
    value: v.number(),
  }),

  // Singleton processing control: pause flag and concurrency slots.
  control: defineTable({
    key: v.literal("global"),
    paused: v.boolean(),
    maxConcurrent: v.number(),
    running: v.number(),
    activeSessionId: v.optional(v.id("demoSessions")),
  }).index("by_key", ["key"]),

  demoSessions: defineTable({
    number: v.number(),
    code: v.string(),
    title: v.string(),
    nextSequence: v.number(),
    participantCount: v.number(),
    submissionCount: v.number(),
    closedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_number", ["number"]),

  participants: defineTable({
    sessionId: v.id("demoSessions"),
    token: v.string(),
    draft: draftV,
    step: v.number(),
    episodeId: v.optional(v.id("episodes")),
  })
    .index("by_token", ["token"])
    .index("by_session", ["sessionId"]),

  // Small Worklist summary; details live in child tables.
  episodes: defineTable({
    sessionId: v.id("demoSessions"),
    participantId: v.optional(v.id("participants")),
    worklistId: v.string(),
    origin: v.union(v.literal("audience"), v.literal("presenter")),
    displayName: v.string(),
    age: v.number(),
    preset: presetV,
    presetVersion: v.string(),
    summary: v.string(),
    laterality: v.string(),
    submittedAt: v.number(),
    activeRunId: v.optional(v.id("runs")),
    runCount: v.number(),
    processing: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("failed"),
      v.literal("completed"),
    ),
    currentStage: pipelineStageV,
    result: v.union(v.literal("pending"), v.literal("auto_coded"), v.literal("sent_to_review")),
    review: v.union(
      v.literal("none"),
      v.literal("open"),
      v.literal("ready"),
      v.literal("blocked"),
      v.literal("approved"),
    ),
    firstActionableAt: v.optional(v.number()),
  })
    .index("by_session", ["sessionId"])
    .index("by_worklistId", ["worklistId"]),

  documents: defineTable({
    episodeId: v.id("episodes"),
    version: v.number(),
    content: sourceDocumentV,
  }).index("by_episode_and_version", ["episodeId", "version"]),

  runs: defineTable({
    episodeId: v.id("episodes"),
    number: v.number(),
    documentVersion: v.number(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("failed"),
      v.literal("completed"),
      v.literal("superseded"),
    ),
    presetVersion: v.string(),
    referenceVersion: v.string(),
    promptVersions: v.object({ annotate: v.string(), extract: v.string(), propose: v.string() }),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    stages: v.array(
      v.object({
        stage: pipelineStageV,
        status: stageStatusV,
        startedAt: v.optional(v.number()),
        finishedAt: v.optional(v.number()),
      }),
    ),
    failedStage: v.optional(modelStageV),
    failure: v.optional(v.string()),
    retryRound: v.number(),
    retrievedReferenceIds: v.optional(v.array(v.string())),
    presenterFacts: v.array(factV),
    effectiveProposal: v.optional(proposalV),
    amended: v.boolean(),
    checks: v.optional(v.array(checkV)),
    result: v.optional(v.union(v.literal("auto_coded"), v.literal("sent_to_review"))),
    reason: v.optional(v.string()),
  }).index("by_episode", ["episodeId"]),

  // One row per model request attempt. Queued rows form the work queue.
  attempts: defineTable({
    runId: v.id("runs"),
    episodeId: v.id("episodes"),
    stage: modelStageV,
    round: v.number(),
    attemptNumber: v.number(),
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("timed_out"),
      v.literal("stale"),
      v.literal("cancelled"),
    ),
    queuedAt: v.number(),
    notBefore: v.number(),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    model: v.optional(v.string()),
    role: v.union(v.literal("MedCAT"), v.literal("MedGemma")),
    promptVersion: v.string(),
    inputHash: v.optional(v.string()),
    error: v.optional(v.string()),
    latencyMs: v.optional(v.number()),
  })
    .index("by_status_and_notBefore", ["status", "notBefore"])
    .index("by_run_and_stage", ["runId", "stage"])
    .index("by_episode", ["episodeId"]),

  // Exact stage input (prompt) and raw model response for each attempt,
  // stored for audit apart from the attempt rows.
  attemptPayloads: defineTable({
    attemptId: v.id("attempts"),
    prompt: v.string(),
    rawOutput: v.optional(v.string()),
  }).index("by_attempt", ["attemptId"]),

  // Accepted (validated) stage outputs; immutable once written.
  outputs: defineTable({
    runId: v.id("runs"),
    attemptId: v.id("attempts"),
    output: stageOutputV,
  }).index("by_run", ["runId"]),

  questions: defineTable({
    episodeId: v.id("episodes"),
    runId: v.id("runs"),
    key: v.string(),
    kind: v.union(
      v.literal("laterality"),
      v.literal("diagnosis_confirmation"),
      v.literal("completeness"),
      v.literal("conflict"),
      v.literal("system"),
    ),
    basis: v.union(
      v.literal("teaching_policy"),
      v.literal("source_conflict"),
      v.literal("reference_gate"),
      v.literal("system_failure"),
    ),
    question: v.string(),
    revisited: v.string(),
    blocks: v.string(),
    passageIds: v.array(v.string()),
    factIds: v.array(v.string()),
    options: v.array(questionOptionV),
    answerable: v.boolean(),
    status: v.union(v.literal("unresolved"), v.literal("answered"), v.literal("withdrawn")),
    answer: v.optional(v.object({ optionId: v.string(), label: v.string(), at: v.number() })),
  }).index("by_run", ["runId"]),

  decisions: defineTable({
    episodeId: v.id("episodes"),
    runId: v.optional(v.id("runs")),
    kind: v.union(
      v.literal("answer"),
      v.literal("approve"),
      v.literal("retry"),
      v.literal("rerun"),
    ),
    summary: v.string(),
    at: v.number(),
  }).index("by_episode", ["episodeId"]),

  finalCodings: defineTable({
    episodeId: v.id("episodes"),
    runId: v.id("runs"),
    diagnoses: v.array(v.object({ code: v.string(), position: v.union(v.literal("primary"), v.literal("secondary")) })),
    procedures: v.array(v.object({ code: v.string(), sequence: v.number() })),
    completedBy: v.union(v.literal("system"), v.literal("presenter")),
    completedAt: v.number(),
    referenceVersion: v.string(),
  }).index("by_episode", ["episodeId"]),
});
