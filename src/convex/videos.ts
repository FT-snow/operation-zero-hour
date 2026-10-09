import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireTeamByToken, requireAdminByToken } from "./lib/auth";

// Team-facing: videos gated on round 3 state.
export const listVideos = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireTeamByToken(ctx, args.token);
    const round = await ctx.db
      .query("rounds")
      .withIndex("by_roundNumber", (q) => q.eq("roundNumber", 3))
      .unique();
    const status = round?.status ?? "not_started";
    const revealed = round?.videosRevealed ?? false;
    const visible = (status === "live" || status === "closed") && revealed;
    if (!visible) {
      // Locked state - never leak video list or drive link
      return { locked: true as const, status, revealed, videos: [], driveUrl: null };
    }
    const vids = await ctx.db.query("videos").withIndex("by_order").collect();
    const cfg = await ctx.db.query("config").first();
    return {
      locked: false as const,
      status,
      revealed,
      videos: vids
        .sort((a, b) => a.order - b.order)
        .map((v) => ({ order: v.order, title: v.title, caption: v.caption, embedUrl: v.embedUrl })),
      driveUrl: cfg?.round3DriveUrl ?? null,
    };
  },
});

// Public (no-auth-needed) story intro content bits that are safe:
// - just the event blurb and suspect-count placeholder, served statically instead.
