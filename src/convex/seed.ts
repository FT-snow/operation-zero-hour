import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAdminByToken } from "./lib/auth";
import { hashPassword, makeSalt, randomPassword, sha256Hex, makeSalt as _ms } from "./lib/hash";
import { Id } from "./_generated/dataModel";

// wipe everything (except seed-created config rows) then reseed fresh state.
// SAFE: only run during setup at event admin request.
export const wipeAndSeed = mutation({
  args: {
    admin1Password: v.string(),
    admin2Password: v.string(),
    round4Code: v.string(), // default PU88
  },
  handler: async (ctx, args) => {
    // 1. Wipe all tables
    const tables = [
      "teams", "participants", "admins", "sessions", "rounds", "videos",
      "clues", "team_progress", "round4_attempts", "round4_solves",
      "submissions", "config", "audit_log",
    ] as const;
    for (const t of tables) {
      const rows = await ctx.db.query(t as "teams").collect();
      for (const r of rows) await ctx.db.delete(r._id);
    }

    // 2. Create two admins
    const adminsToCreate = [
      { email: "admin1@ozh.event", name: "Admin One", password: args.admin1Password },
      { email: "admin2@ozh.event", name: "Admin Two", password: args.admin2Password },
    ];
    for (const a of adminsToCreate) {
      if (a.password.length < 8) {
        return { ok: false as const, error: `Admin ${a.email} password must be >= 8 chars` };
      }
      const salt = makeSalt();
      await ctx.db.insert("admins", {
        email: a.email,
        name: a.name,
        passwordHash: hashPassword(a.password, salt),
        salt,
        createdAt: Date.now(),
      });
    }

    // 3. Seed 5 rounds
    for (let i = 1; i <= 5; i++) {
      await ctx.db.insert("rounds", { roundNumber: i, status: "not_started" });
    }

    // 4. Seed 5 placeholder videos
    for (let i = 1; i <= 5; i++) {
      await ctx.db.insert("videos", {
        order: i,
        title: `Evidence ${i}`,
        caption: "Awaiting admin upload",
        embedUrl: "",
      });
    }

    // 5. Config: round 4 code PU88 (hashed)
    const norm = args.round4Code.trim().toUpperCase().replace(/\s+/g, "");
    if (!/^[A-Z0-9]{3,8}$/.test(norm)) {
      return { ok: false as const, error: "Invalid round 4 code format" };
    }
    const cfgSalt = makeSalt();
    await ctx.db.insert("config", {
      round4CodeHash: hashPassword(norm, cfgSalt),
      round4CodeSalt: cfgSalt,
    });

    // 6. Audit -- dynamic imports unsupported in Convex; inline logic instead
    await ctx.db.insert("audit_log", {
      action: "seed.wipeAndSeed",
      adminLabel: "system",
      details: "Wiped database and seeded fresh: 2 admins, 5 rounds, 5 videos, round-4 code set",
      at: Date.now(),
    });

    return {
      ok: true as const,
      admins: adminsToCreate.map((a) => ({ email: a.email, password: a.password })),
    };
  },
});
