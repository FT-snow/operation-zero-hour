import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdminByToken, requireTeamByToken, audit } from "./lib/auth";
import { normalizeCode, hashPassword, makeSalt } from "./lib/hash";

// ---------- Team facing ----------

export const list = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireTeamByToken(ctx, args.token);
    const rounds = await ctx.db.query("rounds").withIndex("by_roundNumber").collect();
    const out = rounds
      .sort((a, b) => a.roundNumber - b.roundNumber)
      .map((r) => ({
        roundNumber: r.roundNumber,
        status: r.status,
        videosRevealed: r.videosRevealed ?? false,
      }));
    return { rounds: out };
  },
});

// ---------- Admin facing ----------

export const listAdmin = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdminByToken(ctx, args.token);
    const rounds = await ctx.db.query("rounds").withIndex("by_roundNumber").collect();
    return {
      rounds: rounds
        .sort((a, b) => a.roundNumber - b.roundNumber)
        .map((r) => ({
          roundNumber: r.roundNumber,
          status: r.status,
          videosRevealed: r.videosRevealed ?? false,
        })),
    };
  },
});

export const setStatus = mutation({
  args: { token: v.string(), roundNumber: v.number(), status: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    if (args.roundNumber < 1 || args.roundNumber > 5) {
      return { ok: false as const, error: "Invalid round" };
    }
    const valid = ["not_started", "live", "closed"];
    if (!valid.includes(args.status)) {
      return { ok: false as const, error: "Invalid status" };
    }
    const round = await ctx.db
      .query("rounds")
      .withIndex("by_roundNumber", (q) => q.eq("roundNumber", args.roundNumber))
      .unique();
    if (!round) return { ok: false as const, error: "Round not found" };

    // Business rules per PRD:
    // Round 4 sweep: closing round 4 or setting it live is fine; but when
    // setting round 5 live we do NOT require all teams cleared (some may not).
    await ctx.db.patch(round._id, { status: args.status });
    await audit(ctx, {
      action: "rounds.setStatus",
      adminId: admin._id,
      adminLabel: admin.email,
      details: `Round ${args.roundNumber} -> ${args.status}`,
    });
    return { ok: true as const };
  },
});

export const revealVideos = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    const round = await ctx.db
      .query("rounds")
      .withIndex("by_roundNumber", (q) => q.eq("roundNumber", 3))
      .unique();
    if (!round) return { ok: false as const, error: "Round 3 not found" };
    await ctx.db.patch(round._id, { videosRevealed: true });
    await audit(ctx, {
      action: "rounds.revealVideos",
      adminId: admin._id,
      adminLabel: admin.email,
      details: "Round 3 evidence videos revealed to all teams",
    });
    return { ok: true as const };
  },
});

export const hideVideos = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    const round = await ctx.db
      .query("rounds")
      .withIndex("by_roundNumber", (q) => q.eq("roundNumber", 3))
      .unique();
    if (!round) return { ok: false as const, error: "Round 3 not found" };
    await ctx.db.patch(round._id, { videosRevealed: false });
    await audit(ctx, {
      action: "rounds.hideVideos",
      adminId: admin._id,
      adminLabel: admin.email,
      details: "Round 3 evidence videos hidden",
    });
    return { ok: true as const };
  },
});

// ---------- Videos CRUD (admin) ----------

export const videosAdmin = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdminByToken(ctx, args.token);
    const vids = await ctx.db.query("videos").withIndex("by_order").collect();
    return { videos: vids.sort((a, b) => a.order - b.order) };
  },
});

export const setVideo = mutation({
  args: {
    token: v.string(),
    order: v.number(),
    title: v.string(),
    caption: v.string(),
    embedUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    if (args.order < 1 || args.order > 5) {
      return { ok: false as const, error: "Order must be 1-5" };
    }
    const existing = await ctx.db
      .query("videos")
      .withIndex("by_order", (q) => q.eq("order", args.order))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        title: args.title.trim(),
        caption: args.caption.trim(),
        embedUrl: args.embedUrl.trim(),
      });
    } else {
      await ctx.db.insert("videos", {
        order: args.order,
        title: args.title.trim(),
        caption: args.caption.trim(),
        embedUrl: args.embedUrl.trim(),
      });
    }
    await audit(ctx, {
      action: "videos.set",
      adminId: admin._id,
      adminLabel: admin.email,
      details: `Video ${args.order} saved: ${args.title.trim().slice(0, 50)}`,
    });
    return { ok: true as const };
  },
});

// ---------- Clues CRUD (admin) ----------

export const cluesAdmin = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdminByToken(ctx, args.token);
    const cs = await ctx.db
      .query("clues")
      .withIndex("by_round", (q) => q.eq("roundNumber", 4))
      .collect();
    return { clues: cs.sort((a, b) => a.order - b.order) };
  },
});

export const setClue = mutation({
  args: {
    token: v.string(),
    order: v.number(),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    const existing = await ctx.db
      .query("clues")
      .withIndex("by_round", (q) => q.eq("roundNumber", 4))
      .collect();
    const found = existing.find((c) => c.order === args.order);
    if (found) {
      await ctx.db.patch(found._id, { title: args.title.trim(), body: args.body.trim() });
    } else {
      await ctx.db.insert("clues", {
        roundNumber: 4,
        order: args.order,
        title: args.title.trim(),
        body: args.body.trim(),
      });
    }
    await audit(ctx, {
      action: "clues.set",
      adminId: admin._id,
      adminLabel: admin.email,
      details: `Clue ${args.order} saved: ${args.title.trim().slice(0, 50)}`,
    });
    return { ok: true as const };
  },
});

// ---------- Config: round 4 code + killer + suspects ----------


export const setRound4Code = mutation({
  args: { token: v.string(), code: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    const norm = normalizeCode(args.code);
    if (!/^[A-Z0-9]{3,8}$/.test(norm)) {
      return { ok: false as const, error: "Code must be 3-8 letters/digits" };
    }
    let cfg = await ctx.db.query("config").first();
    const salt = makeSalt();
    const hash = hashPassword(norm, salt);
    if (!cfg) {
      await ctx.db.insert("config", { round4CodeHash: hash, round4CodeSalt: salt });
    } else {
      await ctx.db.patch(cfg._id, { round4CodeHash: hash, round4CodeSalt: salt });
    }
    await audit(ctx, {
      action: "config.setRound4Code",
      adminId: admin._id,
      adminLabel: admin.email,
      details: `Round 4 code set/changed (${norm.length} chars, hashed)`,
    });
    return { ok: true as const };
  },
});

export const setRealKiller = mutation({
  args: { token: v.string(), killer: v.string(), suspects: v.array(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    const killer = args.killer.trim();
    if (!killer) return { ok: false as const, error: "Killer cannot be empty" };
    const suspects = args.suspects.map((s) => s.trim()).filter(Boolean);
    if (suspects.length < 2) {
      return { ok: false as const, error: "At least 2 suspects required" };
    }
    if (!suspects.some((s) => s.toLowerCase() === killer.toLowerCase())) {
      return { ok: false as const, error: "Killer must be one of the suspects" };
    }
    let cfg = await ctx.db.query("config").first();
    if (!cfg) {
      await ctx.db.insert("config", { realKiller: killer, suspects });
    } else {
      await ctx.db.patch(cfg._id, { realKiller: killer, suspects });
    }
    await audit(ctx, {
      action: "config.setRealKiller",
      adminId: admin._id,
      adminLabel: admin.email,
      details: `Real killer set (${suspects.length} suspects)`,
    });
    return { ok: true as const };
  },
});

export const configGet = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdminByToken(ctx, args.token);
    const cfg = await ctx.db.query("config").first();
    if (!cfg) return { round4CodeSet: false as const, hasKiller: false as const, suspects: [] as string[], realKiller: undefined };
    return {
      round4CodeSet: !!cfg.round4CodeHash,
      hasKiller: !!cfg.realKiller,
      suspects: cfg.suspects ?? [],
      realKiller: cfg.realKiller,
      driveUrl: cfg.round4DriveUrl ?? "",
      driveUrl3: cfg.round3DriveUrl ?? "",
    };
  },
});

export const setRound4DriveUrl = mutation({
  args: { token: v.string(), url: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    const url = args.url.trim();
    if (url && !/^https:\/\//.test(url)) {
      return { ok: false as const, error: "URL must start with https://" };
    }
    let cfg = await ctx.db.query("config").first();
    if (!cfg) {
      if (url) await ctx.db.insert("config", { round4DriveUrl: url });
    } else {
      await ctx.db.patch(cfg._id, { round4DriveUrl: url });
    }
    await audit(ctx, {
      action: "config.setRound4DriveUrl",
      adminId: admin._id,
      adminLabel: admin.email,
      details: url ? `Round 4 drive link set: ${url.slice(0, 60)}` : "Round 4 drive link cleared",
    });
    return { ok: true as const };
  },
});

export const setRound3DriveUrl = mutation({
  args: { token: v.string(), url: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    const url = args.url.trim();
    if (url && !/^https:\/\//.test(url)) {
      return { ok: false as const, error: "URL must start with https://" };
    }
    let cfg = await ctx.db.query("config").first();
    if (!cfg) {
      if (url) await ctx.db.insert("config", { round3DriveUrl: url });
    } else {
      await ctx.db.patch(cfg._id, { round3DriveUrl: url });
    }
    await audit(ctx, {
      action: "config.setRound3DriveUrl",
      adminId: admin._id,
      adminLabel: admin.email,
      details: url ? `Round 4 drive link set: ${url.slice(0, 60)}` : "Round 4 drive link cleared",
    });
    return { ok: true as const };
  },
});
