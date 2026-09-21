import { query } from "./_generated/server";
import { v } from "convex/values";

export const check = query({
  args: {},
  returns: v.object({
    environment: v.string(),
  }),
  handler: () => {
    return {
      environment: process.env.APP_ENV ?? "unset",
    };
  },
});