import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdminByToken, requireTeamByToken, audit } from "./lib/auth";
import { hashPassword, makeSalt, randomPassword } from "./lib/hash";

// ---------- Admin queries ----------

export const listAdmin = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdminByToken(ctx, args.token);
    const teams = await ctx.db.query("teams").withIndex("by_teamCode").collect();
    const out = [];
    for (const t of teams) {
      const members = [];
      for (const pid of t.memberIds) {
        const p = await ctx.db.get(pid);
        if (p) members.push({ _id: p._id, name: p.name, email: p.email, source: p.source });
      }
      out.push({
        _id: t._id,
        teamCode: t.teamCode,
        teamName: t.teamName,
        createdAt: t.createdAt,
        members,
      });
    }
    return { teams: out };
  },
});

// Team's own live identity (name/ID) - reflects renames immediately.
export const summary = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const team = await requireTeamByToken(ctx, args.token);
    return { teamCode: team.teamCode, teamName: team.teamName };
  },
});

// Internal: used right after login to hydrate admin UI quickly.
export const countAdmin = query({
  args: {},
  handler: async (ctx) => {
    return { teams: (await ctx.db.query("teams").collect()).length };
  },
});

// ---------- Credential generation ----------
// Input: grouped teams from client-side Excel parse.
//   [{ teamName: string | null, members: [{ name, email? }] }]
// Output: plaintext credentials ONCE. Passwords stored hashed.

export const generateCredentials = mutation({
  args: {
    token: v.string(),
    groups: v.array(
      v.object({
        teamName: v.string(),
        members: v.array(
          v.object({ name: v.string(), email: v.optional(v.string()) })
        ),
      })
    ),
    startNumber: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);

    // Determine next TM number: scan existing teams for max.
    const existing = await ctx.db.query("teams").withIndex("by_teamCode").collect();
    let maxNum = 0;
    for (const t of existing) {
      const m = /^TM-(\d+)$/.exec(t.teamCode);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    }
    let n = Math.max(maxNum + 1, args.startNumber ?? 1);

    // Verify teamName uniqueness among existing teams
    const existingNames = new Set(existing.map((t) => t.teamName.trim().toLowerCase()));
    const seenInBatch = new Set<string>();

    const credentials: {
      teamName: string;
      teamCode: string;
      password: string;
      members: string[];
    }[] = [];

    for (const g of args.groups) {
      const teamName = (g.teamName ?? "").trim();
      if (!teamName) {
        return { ok: false as const, error: "Every team needs a name - the control room must name each team" };
      }
      {
        const key = teamName.toLowerCase();
        if (existingNames.has(key) || seenInBatch.has(key)) {
          return { ok: false as const, error: `Duplicate team name in input: "${teamName}"` };
        }
        seenInBatch.add(key);
        existingNames.add(key);
      }
      if (g.members.length === 0) {
        return { ok: false as const, error: `Team "${teamName}" has no members` };
      }

      const teamCode = `TM-${String(n).padStart(3, "0")}`;
      n++;

      const password = randomPassword();
      const salt = makeSalt();
      const memberIds = [];
      const memberNames: string[] = [];
      for (const m of g.members) {
        const name = m.name.trim();
        if (!name) continue;
        const pid = await ctx.db.insert("participants", {
          name,
          email: m.email?.trim() || undefined,
          teamId: undefined,
          source: "excel",
        });
        memberIds.push(pid);
        memberNames.push(name);
      }
      if (memberIds.length === 0) {
        return { ok: false as const, error: `Team "${teamName || "(solo)"}" has no valid member names` };
      }

      const teamId = await ctx.db.insert("teams", {
        teamName,
        teamCode,
        passwordHash: hashPassword(password, salt),
        salt,
        memberIds,
        createdAt: Date.now(),
      });
      for (const pid of memberIds) {
        await ctx.db.patch(pid, { teamId });
      }
      credentials.push({
        teamName,
        teamCode,
        password,
        members: memberNames,
      });
    }

    await audit(ctx, {
      action: "teams.generateCredentials",
      adminId: admin._id,
      adminLabel: admin.email,
      details: `Generated ${credentials.length} team account(s): ${credentials.map((c) => c.teamCode).join(", ")}`,
    });

    return { ok: true as const, credentials };
  },
});

// Reset to a clean test phase: wipe every team and all round-4/5 artifacts,
// then recreate ONE known test team. Admins, round statuses, videos, clues
// and the Round-4 code config are preserved.
export const resetTestState = mutation({
  args: {
    token: v.string(),
    dummyTeamName: v.optional(v.string()),
    dummyPassword: v.optional(v.string()),
    round4Status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);

    // 1. Delete all round-4/5 artifacts
    for (const table of ["team_progress", "round4_attempts", "round4_solves", "submissions"] as const) {
      const rows = await ctx.db.query(table as "teams").collect();
      for (const r of rows) await ctx.db.delete(r._id);
    }

    // 2. Delete all teams + participants
    const teams = await ctx.db.query("teams").withIndex("by_teamCode").collect();
    for (const t of teams) {
      for (const pid of t.memberIds) await ctx.db.delete(pid);
      await ctx.db.delete(t._id);
    }

    // 3. Reset round statuses to a clean pre-event state
    const r3 = await ctx.db.query("rounds").withIndex("by_roundNumber", (q) => q.eq("roundNumber", 3)).unique();
    if (r3) await ctx.db.patch(r3._id, { status: "not_started", videosRevealed: false });
    const r4 = await ctx.db.query("rounds").withIndex("by_roundNumber", (q) => q.eq("roundNumber", 4)).unique();
    if (r4 && args.round4Status) await ctx.db.patch(r4._id, { status: args.round4Status });
    const r5 = await ctx.db.query("rounds").withIndex("by_roundNumber", (q) => q.eq("roundNumber", 5)).unique();
    if (r5) await ctx.db.patch(r5._id, { status: "not_started" });

    // 4. Recreate the known dummy team for testing
    const dummyName = args.dummyTeamName?.trim() || "Dummy Crew";
    const dummyPw = args.dummyPassword?.trim();
    let dummy: { teamCode: string; password: string } | null = null;
    if (dummyPw && dummyPw.length >= 8) {
      const salt = makeSalt();
      const pid = await ctx.db.insert("participants", { name: "Test Sleuth", source: "excel" });
      const teamId = await ctx.db.insert("teams", {
        teamName: dummyName,
        teamCode: "TM-001",
        passwordHash: hashPassword(dummyPw, salt),
        salt,
        memberIds: [pid],
        createdAt: Date.now(),
      });
      await ctx.db.patch(pid, { teamId });
      dummy = { teamCode: "TM-001", password: dummyPw };
    }

    await audit(ctx, {
      action: "teams.resetTestState",
      adminId: admin._id,
      adminLabel: admin.email,
      details: `Wiped all teams + round artifacts; dummy test team recreated: ${dummy?.teamCode ?? "none"}`,
    });

    return { ok: true as const, dummy };
  },
});
