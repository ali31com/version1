import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    APP_ENV: v.string(),
    GEMINI_API_KEY: v.string(),
    // Optional override of the Gemini Flash model ID (recorded per attempt).
    GEMINI_MODEL: v.optional(v.string()),
  },
});

export default app;
