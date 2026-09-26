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
