import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    APP_ENV: v.string(),
  },
});

export default app;