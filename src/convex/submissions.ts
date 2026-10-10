import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireTeamByToken, requireAdminByToken, audit } from "./lib/auth";

// ---------- Team: submit final report (Round 5) ----------
// AUTO-OPEN: Round 5 unlocks for a team the moment it clears Round 4.
// Admin's only lever is CLOSE (shuts the door for everyone).

export const submit = mutation({
  args: {
    token: v.string(),
    killer: v.string(),
    method: v.string(),
    motive: v.string(),
    observation: v.string(),
  },
  handler: async (ctx, args) => {
    const team = await requireTeamByToken(ctx, args.token);

    const round = await ctx.db
      .query("rounds")
      .withIndex("by_roundNumber", (q) => q.eq("roundNumber", 5))
      .unique();
    if (!round) return { ok: false as const, error: "Round not available" };
    if (round.status === "closed") return { ok: false as const, error: "Round is closed - submissions rejected" };

    // Must have cleared Round 4
    const progress = await ctx.db
      .query("team_progress")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .unique();
    if (!progress || !progress.round4Cleared) {
      return { ok: false as const, error: "Access denied - clear Round 4 first" };
    }

    // One submission per team - enforced inside this transaction
    const existing = await ctx.db
      .query("submissions")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .unique();
    if (existing) {
      return { ok: false as const, error: "Submission already filed - edits are not permitted" };
    }

    const killer = args.killer.trim();
    const method = args.method.trim();
    const motive = args.motive.trim();
    const observation = args.observation.trim();
    const observationWords = observation ? observation.split(/\s+/).length : 0;
    if (!killer || !method || !motive) {
      return { ok: false as const, error: "All fields are required" };
    }
    if (!observation) {
      return { ok: false as const, error: "The observation field is required" };
    }
    if (observationWords > 250) {
      return { ok: false as const, error: `Observation too long (${observationWords}/250 words)` };
    }
    if (method.length > 4000 || motive.length > 4000) {
      return { ok: false as const, error: "Text too long (max 4000 chars)" };
    }

    const now = Date.now();
    await ctx.db.insert("submissions", {
      teamId: team._id,
      killer,
      method,
      motive,
      observation,
      submittedAt: now,
    });

    return { ok: true as const, submittedAt: now };
  },
});

// ---------- Team: my submission ----------

export const mine = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const team = await requireTeamByToken(ctx, args.token);
    const sub = await ctx.db
      .query("submissions")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .unique();
    if (!sub) return { submitted: false as const };
    return {
      submitted: true as const,
      killer: sub.killer,
      method: sub.method,
      motive: sub.motive,
      observation: sub.observation ?? "",
      submittedAt: sub.submittedAt,
    };
  },
});

// ---------- Team: access state (is round 5 open for me?) ----------

export const access = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const team = await requireTeamByToken(ctx, args.token);
    const round = await ctx.db
      .query("rounds")
      .withIndex("by_roundNumber", (q) => q.eq("roundNumber", 5))
      .unique();
    const progress = await ctx.db
      .query("team_progress")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .unique();
    const cleared = !!progress?.round4Cleared;
    const status = round?.status ?? "not_started";
    // AUTO-OPEN: cleared teams get access the instant they solve Round 4,
    // regardless of Round 5 status - only "closed" can shut them out.
    const open = cleared && status !== "closed";
    return {
      status,
      cleared,
      open,
    };
  },
});

// ---------- Admin: all submissions with correctness ----------

export const listAdmin = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdminByToken(ctx, args.token);
    const subs = await ctx.db.query("submissions").collect();
    const cfg = await ctx.db.query("config").first();
    const realKiller = cfg?.realKiller ?? null;
    const out = [];
    for (const s of subs) {
      const team = await ctx.db.get(s.teamId);
      if (!team) continue;
      const correct =
        !!realKiller && s.killer.trim().toLowerCase() === realKiller.trim().toLowerCase();
      out.push({
        _id: s._id,
        teamCode: team.teamCode,
        teamName: team.teamName,
        killer: s.killer,
        method: s.method,
        motive: s.motive,
        observation: s.observation ?? "",
        submittedAt: s.submittedAt,
        correct,
      });
    }
    // Ranked by submission time (server timestamps)
    out.sort((a, b) => a.submittedAt - b.submittedAt);
    const correctCount = out.filter((o) => o.correct).length;
    return { submissions: out, realKiller, correctCount, total: out.length };
  },
});

// ---------- Admin: final correct list (cleared 4 + named right killer, ranked by submit time) ----------

export const finalCorrectAdmin = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdminByToken(ctx, args.token);
    const subs = await ctx.db.query("submissions").collect();
    const cfg = await ctx.db.query("config").first();
    const realKiller = cfg?.realKiller ?? null;
    if (!realKiller) return { ranked: [], realKiller: null };
    const out = [];
    for (const s of subs) {
      if (s.killer.trim().toLowerCase() !== realKiller.trim().toLowerCase()) continue;
      const progress = await ctx.db
        .query("team_progress")
        .withIndex("by_team", (q) => q.eq("teamId", s.teamId))
        .unique();
      if (!progress || !progress.round4Cleared) continue;
      const team = await ctx.db.get(s.teamId);
      if (!team) continue;
      out.push({
        teamCode: team.teamCode,
        teamName: team.teamName,
        submittedAt: s.submittedAt,
        round4ClearedAt: progress.round4ClearedAt,
      });
    }
    out.sort((a, b) => a.submittedAt - b.submittedAt);
    return { ranked: out, realKiller };
  },
});

// Team: suspect dropdown list (only when cleared AND round 5 live/closed)
export const suspectsForTeam = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const team = await requireTeamByToken(ctx, args.token);
    const round = await ctx.db
      .query("rounds")
      .withIndex("by_roundNumber", (q) => q.eq("roundNumber", 5))
      .unique();
    const progress = await ctx.db
      .query("team_progress")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .unique();
    const cleared = !!progress?.round4Cleared;
    const visible = cleared && (round?.status ?? "not_started") !== "closed";
    if (!visible) return { locked: true as const, suspects: [] };
    const cfg = await ctx.db.query("config").first();
    return { locked: false as const, suspects: cfg?.suspects ?? [] };
  },
});
