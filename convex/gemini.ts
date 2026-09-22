"use node";

import { GoogleGenAI } from "@google/genai";
import { internalAction, env } from "./_generated/server";
import { v } from "convex/values";

export const smokeTest = internalAction({
  args: {},

  returns: v.object({
    model: v.string(),
    response: v.string(),
  }),

  handler: async () => {
    const model = "gemini-3.8-flash";

    const ai = new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY,
    });

    const result = await ai.models.generateContent({
      model,
      contents:
        'This is a connectivity test. Reply with exactly: "Gemini connected successfully."',
    });

    const response = result.text?.trim();

    if (!response) {
      throw new Error("Gemini returned an empty response.");
    }

    return {
      model,
      response,
    };
  },
});