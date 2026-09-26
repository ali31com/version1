import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    APP_ENV: v.string(),
    GEMINI_API_KEY: v.string(),
    // Optional comma-separated Gemini Flash model IDs, tried in order across
    // attempts (each attempt records the exact model used).
    GEMINI_MODEL: v.optional(v.string()),
  },
});

export default app;
