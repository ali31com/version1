"use node";

import { GoogleGenAI } from "@google/genai";
import { v } from "convex/values";
import { env, internalAction } from "./_generated/server";

// Lists Gemini Flash model IDs available to this API key (no generation).
export const listFlashModels = internalAction({
  args: {},
  returns: v.array(v.string()),
  handler: async () => {
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const names: string[] = [];
    const pager = await ai.models.list();
    for await (const m of pager) {
      if (m.name && /flash/i.test(m.name)) names.push(m.name);
    }
    return names;
  },
});

// One tiny request per model to check current availability.
export const probe = internalAction({
  args: { models: v.array(v.string()) },
  returns: v.array(v.object({ model: v.string(), ok: v.boolean(), ms: v.number(), detail: v.string() })),
  handler: async (_ctx, { models }) => {
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, httpOptions: { timeout: 20_000, retryOptions: { attempts: 1 } } });
    return await Promise.all(
      models.map(async (model) => {
        const start = Date.now();
        try {
          const r = await ai.models.generateContent({ model, contents: "Reply with OK." });
          return { model, ok: true, ms: Date.now() - start, detail: (r.text ?? "").slice(0, 20) };
        } catch (e) {
          return { model, ok: false, ms: Date.now() - start, detail: e instanceof Error ? e.message.slice(0, 80) : "error" };
        }
      }),
    );
  },
});

// Compares availability of the pipeline request shape with and without
// the thinking configuration (diagnostic).
export const probeConfig = internalAction({
  args: { model: v.string() },
  returns: v.array(v.object({ variant: v.string(), ok: v.boolean(), ms: v.number(), detail: v.string() })),
  handler: async (_ctx, { model }) => {
    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY, httpOptions: { timeout: 30_000, retryOptions: { attempts: 1 } } });
    const schema = { type: "object", properties: { words: { type: "array", items: { type: "string" } } }, required: ["words"] };
    const variants: [string, Record<string, unknown>][] = [
      ["json+thinkingLow", { responseMimeType: "application/json", responseJsonSchema: schema, thinkingConfig: { thinkingLevel: "LOW" } }],
      ["json only", { responseMimeType: "application/json", responseJsonSchema: schema }],
    ];
    const out = [];
    for (const [variant, config] of variants) {
      const start = Date.now();
      try {
        const r = await ai.models.generateContent({ model, contents: "List three eye structures.", config });
        out.push({ variant, ok: true, ms: Date.now() - start, detail: (r.text ?? "").slice(0, 60) });
      } catch (e) {
        out.push({ variant, ok: false, ms: Date.now() - start, detail: e instanceof Error ? e.message.slice(0, 80) : "error" });
      }
    }
    return out;
  },
});
