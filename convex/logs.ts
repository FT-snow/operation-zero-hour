import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAdminByToken } from "./lib/auth";

export const listAdmin = query({
  args: { token: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdminByToken(ctx, args.token);
    const lim = Math.min(args.limit ?? 200, 1000);
    const entries = await ctx.db.query("audit_log").order("desc").take(lim);
    return { entries };
  },
});
