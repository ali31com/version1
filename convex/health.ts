import { env, query } from "./_generated/server";
import { v } from "convex/values";

export const check = query({
  args: {},
  returns: v.object({
    environment: v.string(),
  }),
  handler: () => {
    return {
      environment: env.APP_ENV,
    };
  },
});