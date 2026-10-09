import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireTeamByToken, requireAdminByToken, audit } from "./lib/auth";
import { normalizeCode, hashPassword } from "./lib/hash";

const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 5;

// ---------- Team: submit code ----------

export const submitCode = mutation({
  args: { token: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const team = await requireTeamByToken(ctx, args.token);

    // Round must be live
    const round = await ctx.db
      .query("rounds")
      .withIndex("by_roundNumber", (q) => q.eq("roundNumber", 4))
      .unique();
    if (!round) return { ok: false as const, error: "Round not available" };
    if (round.status === "not_started") return { ok: false as const, error: "Round not started" };
    if (round.status === "closed") return { ok: false as const, error: "Round is closed" };

    // Rate limit: 5 attempts per minute per team
    const now = Date.now();
    const recent = await ctx.db
      .query("round4_attempts")
      .withIndex("by_team_time", (q) => q.eq("teamId", team._id).gte("at", now - RATE_LIMIT_WINDOW))
      .collect();
    if (recent.length >= RATE_LIMIT_MAX) {
      const oldest = Math.min(...recent.map((r) => r.at));
      const wait = Math.ceil((oldest + RATE_LIMIT_WINDOW - now) / 1000);
      return { ok: false as const, error: `Too many attempts. Try again in ${wait}s`, rateLimited: true };
    }

    // Hash-compare against config
    const cfg = await ctx.db.query("config").first();
    if (!cfg || !cfg.round4CodeHash || !cfg.round4CodeSalt) {
      return { ok: false as const, error: "Code not yet configured" };
    }
    const norm = normalizeCode(args.code);
    const isCorrect = hashPassword(norm, cfg.round4CodeSalt) === cfg.round4CodeHash;

    // Log attempt (always)
    await ctx.db.insert("round4_attempts", {
      teamId: team._id,
      isCorrect,
      at: now,
    });

    if (!isCorrect) {
      const remaining = RATE_LIMIT_MAX - recent.length - 1;
      return { ok: false as const, error: "Incorrect code", remaining };
    }

    // Correct: idempotent upsert of team_progress + solve record
    const existingProgress = await ctx.db
      .query("team_progress")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .unique();
    if (!existingProgress || !existingProgress.round4Cleared) {
      if (existingProgress) {
        await ctx.db.patch(existingProgress._id, { round4Cleared: true, round4ClearedAt: now });
      } else {
        await ctx.db.insert("team_progress", { teamId: team._id, round4Cleared: true, round4ClearedAt: now });
      }
      const existingSolve = await ctx.db
        .query("round4_solves")
        .withIndex("by_team", (q) => q.eq("teamId", team._id))
        .unique();
      if (!existingSolve) {
        await ctx.db.insert("round4_solves", { teamId: team._id, solvedAt: now });
      }
    }

    return { ok: true as const };
  },
});

// ---------- Team: clues (gated) ----------

export const cluesGet = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const team = await requireTeamByToken(ctx, args.token);
    const progress = await ctx.db
      .query("team_progress")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .unique();
    const cleared = !!progress?.round4Cleared;
    if (!cleared) {
      // Return locked state - never leak clue content
      return { locked: true as const, cleared: false as const, clues: [] };
    }
    const cs = await ctx.db
      .query("clues")
      .withIndex("by_round", (q) => q.eq("roundNumber", 4))
      .collect();
    return {
      locked: false as const,
      cleared: true as const,
      clues: cs.sort((a, b) => a.order - b.order).map((c) => ({ order: c.order, title: c.title, body: c.body })),
      clearedAt: progress?.round4ClearedAt,
    };
  },
});

// ---------- Team: own round-4 status ----------

export const myStatus = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const team = await requireTeamByToken(ctx, args.token);
    const progress = await ctx.db
      .query("team_progress")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .unique();
    return { cleared: !!progress?.round4Cleared, clearedAt: progress?.round4ClearedAt };
  },
});

// ---------- Admin: solve list ----------

export const solveListAdmin = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdminByToken(ctx, args.token);
    const solves = await ctx.db.query("round4_solves").collect();
    const out = [];
    for (const s of solves) {
      const team = await ctx.db.get(s.teamId);
      if (!team) continue;
      out.push({ teamCode: team.teamCode, teamName: team.teamName, solvedAt: s.solvedAt, _id: s._id });
    }
    out.sort((a, b) => a.solvedAt - b.solvedAt);
    return { solves: out };
  },
});

// ---------- Admin: attempt log (audit of every entry) ----------

export const attemptsAdmin = query({
  args: { token: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAdminByToken(ctx, args.token);
    const lim = Math.min(args.limit ?? 200, 1000);
    const at = await ctx.db.query("round4_attempts").order("desc").take(lim);
    const out = [];
    for (const a of at) {
      const team = await ctx.db.get(a.teamId);
      out.push({
        teamCode: team?.teamCode ?? "?",
        isCorrect: a.isCorrect,
        at: a.at,
      });
    }
    return { attempts: out };
  },
});

// ---------- Admin: wipe attempt log (post-load-test hygiene / event start) ----------
export const clearAttempts = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    const rows = await ctx.db.query("round4_attempts").collect();
    for (const r of rows) await ctx.db.delete(r._id);
    await audit(ctx, {
      action: "round4.clearAttempts",
      adminId: admin._id,
      adminLabel: admin.email,
      details: `Cleared ${rows.length} attempt log row(s)`,
    });
    return { ok: true as const, cleared: rows.length };
  },
});

// ---------- Team: reward (gated drive link, replaces clue cards) ----------
export const reward = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const team = await requireTeamByToken(ctx, args.token);
    const progress = await ctx.db
      .query("team_progress")
      .withIndex("by_team", (q) => q.eq("teamId", team._id))
      .unique();
    const cleared = !!progress?.round4Cleared;
    if (!cleared) {
      // Locked: the drive link never leaves the server unearned
      return { locked: true as const, cleared: false as const, driveUrl: null };
    }
    const cfg = await ctx.db.query("config").first();
    return { locked: false as const, cleared: true as const, driveUrl: cfg?.round4DriveUrl ?? null };
  },
});
