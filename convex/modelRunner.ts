"use node";

import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { env, internalAction } from "./_generated/server";
import { validateStageOutput, type StageOutput } from "./lib/contracts";
import { buildPrompt, hashText, responseSchema } from "./lib/prompts";
import { REFERENCES } from "./lib/references";

// Gemini Flash models tried in order across a stage's attempts; retries
// rotate to the next model so a single model's 503 capacity spike does not
// exhaust the budget. Override with a comma-separated GEMINI_MODEL.
export const DEFAULT_MODELS = ["gemini-3.8-flash", "gemini-3.7-flash", "gemini-3.5-flash"];

function modelForAttempt(attemptNumber: number): string {
  const configured = env.GEMINI_MODEL?.split(",").map((m) => m.trim()).filter(Boolean);
  const models = configured && configured.length > 0 ? configured : DEFAULT_MODELS;
  return models[(attemptNumber - 1) % models.length];
}
// One HTTP request per attempt: the pipeline owns the retry budget.
const PROVIDER_TIMEOUT_MS = 30_000;

// Runs one model attempt (Gemini Flash emulating MedCAT or MedGemma) and
// records its validated output or failure. Never substitutes a prepared
// result.
export const runAttempt = internalAction({
  args: { attemptId: v.id("attempts") },
  returns: v.null(),
  handler: async (ctx, { attemptId }) => {
    const context = await ctx.runQuery(internal.pipeline.getAttemptContext, { attemptId });
    if (!context) return null;
    const retrieved = new Set(context.retrievedReferenceIds);
    const prompt = buildPrompt({
      stage: context.stage,
      passages: context.passages,
      annotations: context.annotations,
      facts: context.facts,
      references: REFERENCES.filter((r) => retrieved.has(r.id)),
    });
    const model = modelForAttempt(context.attemptNumber);
    const started = Date.now();
    let rawOutput: string | undefined;
    let outcome: { ok: true; output: StageOutput } | { ok: false; error: string };
    try {
      const ai = new GoogleGenAI({
        apiKey: env.GEMINI_API_KEY,
        httpOptions: { timeout: PROVIDER_TIMEOUT_MS, retryOptions: { attempts: 1 } },
      });
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: responseSchema(context.stage),
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      rawOutput = response.text ?? "";
      if (!rawOutput.trim()) {
        const reason = response.candidates?.[0]?.finishReason ?? "no candidates";
        outcome = { ok: false, error: `Empty model response (${reason}).` };
      } else {
        const validated = validateStageOutput(context.stage, rawOutput, context);
        outcome = validated.ok
          ? { ok: true, output: validated.value }
          : { ok: false, error: `Rejected output: ${validated.error}` };
      }
    } catch (e) {
      outcome = { ok: false, error: describeError(e) };
    }
    await ctx.runMutation(internal.pipeline.recordAttemptResult, {
      attemptId,
      startedAt: context.startedAt,
      outcome,
      rawOutput: rawOutput?.slice(0, 100_000),
      model,
      inputHash: hashText(prompt),
      latencyMs: Date.now() - started,
    });
    return null;
  },
});

function describeError(e: unknown): string {
  if (e instanceof Error) {
    const status = (e as { status?: number }).status;
    const message = e.message.length > 400 ? `${e.message.slice(0, 400)}…` : e.message;
    return status ? `Provider error ${status}: ${message}` : `Provider error: ${message}`;
  }
  return "Provider error: unknown failure";
}
