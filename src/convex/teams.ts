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
        passwordPlain: t.passwordPlain, // admin desk lookup only
        attendance: t.attendance,
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
        passwordPlain: password,
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

export const addChatGeneratedLogins = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    const logins = [
      { teamCode: "TEAM-68420", password: "Raven#4937" },
      { teamCode: "TEAM-13795", password: "Orbit@8261" },
      { teamCode: "TEAM-90246", password: "Nexus#1754" },
      { teamCode: "TEAM-45831", password: "Pixel@6392" },
      { teamCode: "TEAM-71608", password: "Atlas#2849" },
      { teamCode: "TEAM-32974", password: "Nova@7516" },
      { teamCode: "TEAM-80513", password: "Vanta#9204" },
      { teamCode: "TEAM-24689", password: "Echo@3671" },
      { teamCode: "TEAM-57132", password: "Quartz#5480" },
      { teamCode: "TEAM-93467", password: "Lumen@1028" },
      { teamCode: "TEAM-16350", password: "Drift#7945" },
      { teamCode: "TEAM-79024", password: "Helix@4319" },
      { teamCode: "TEAM-41286", password: "Prism#6083" },
      { teamCode: "TEAM-65891", password: "Falcon@2570" },
      { teamCode: "TEAM-28743", password: "Titan#9165" },
      { teamCode: "TEAM-84619", password: "Mosaic@3827" },
      { teamCode: "TEAM-52076", password: "Nimbus#7401" },
      { teamCode: "TEAM-37508", password: "Vertex@1956" },
      { teamCode: "TEAM-69825", password: "Axion#5632" },
      { teamCode: "TEAM-04197", password: "Zenith@8794" },
    ];

    const created: { teamCode: string; password: string }[] = [];
    const skipped: string[] = [];
    for (const login of logins) {
      const existing = await ctx.db
        .query("teams")
        .withIndex("by_teamCode", (q) => q.eq("teamCode", login.teamCode))
        .unique();
      if (existing) {
        skipped.push(login.teamCode);
        continue;
      }

      const suffix = login.teamCode.slice(-5);
      const participantId = await ctx.db.insert("participants", {
        name: `Generated login ${suffix}`,
        source: "manual",
      });
      const salt = makeSalt();
      const teamId = await ctx.db.insert("teams", {
        teamName: `Generated Team ${suffix}`,
        teamCode: login.teamCode,
        passwordHash: hashPassword(login.password, salt),
        passwordPlain: login.password,
        salt,
        memberIds: [participantId],
        createdAt: Date.now(),
      });
      await ctx.db.patch(participantId, { teamId });
      created.push(login);
    }

    await audit(ctx, {
      action: "teams.addChatGeneratedLogins",
      adminId: admin._id,
      adminLabel: admin.email,
      details: `Added ${created.length} chat-generated team login(s); skipped ${skipped.length}`,
    });

    return { ok: true as const, created, skipped };
  },
});

export const addPostTm103Logins = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    const logins = [
      { teamCode: "TM-104", password: "Cinder#4827" },
      { teamCode: "TM-105", password: "Vector@9136" },
      { teamCode: "TM-106", password: "Harbor#2659" },
      { teamCode: "TM-107", password: "Signal@7402" },
      { teamCode: "TM-108", password: "Cipher#5918" },
      { teamCode: "TM-109", password: "Summit@3264" },
      { teamCode: "TM-110", password: "Ember#8071" },
      { teamCode: "TM-111", password: "Anchor@1549" },
      { teamCode: "TM-112", password: "Mirage#6380" },
      { teamCode: "TM-113", password: "Pulse@4725" },
      { teamCode: "TM-114", password: "Forge#9362" },
      { teamCode: "TM-115", password: "Vortex@2187" },
      { teamCode: "TM-116", password: "Lantern#7043" },
      { teamCode: "TM-117", password: "Radar@5896" },
      { teamCode: "TM-118", password: "Cobalt#3418" },
      { teamCode: "TM-119", password: "Sable@9704" },
      { teamCode: "TM-120", password: "Quarry#6251" },
      { teamCode: "TM-121", password: "Beacon@1836" },
      { teamCode: "TM-122", password: "Matrix#4590" },
      { teamCode: "TM-123", password: "Rift@7628" },
    ];

    const created: { teamCode: string; password: string }[] = [];
    const skipped: string[] = [];
    for (const login of logins) {
      const existing = await ctx.db
        .query("teams")
        .withIndex("by_teamCode", (q) => q.eq("teamCode", login.teamCode))
        .unique();
      if (existing) {
        skipped.push(login.teamCode);
        continue;
      }

      const number = login.teamCode.slice(3);
      const participantId = await ctx.db.insert("participants", {
        name: `Generated login ${number}`,
        source: "manual",
      });
      const salt = makeSalt();
      const teamId = await ctx.db.insert("teams", {
        teamName: `Generated Team ${number}`,
        teamCode: login.teamCode,
        passwordHash: hashPassword(login.password, salt),
        passwordPlain: login.password,
        salt,
        memberIds: [participantId],
        createdAt: Date.now(),
      });
      await ctx.db.patch(participantId, { teamId });
      created.push(login);
    }

    await audit(ctx, {
      action: "teams.addPostTm103Logins",
      adminId: admin._id,
      adminLabel: admin.email,
      details: `Added ${created.length} post-TM-103 team login(s); skipped ${skipped.length}`,
    });

    return { ok: true as const, created, skipped };
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
        passwordPlain: dummyPw,
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

// ---------- Attendance ----------
export const setAttendance = mutation({
  args: { token: v.string(), teamCode: v.string(), present: v.boolean() },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    const code = args.teamCode.trim().toUpperCase();
    const team = await ctx.db
      .query("teams")
      .withIndex("by_teamCode", (q) => q.eq("teamCode", code))
      .unique();
    if (!team) return { ok: false as const, error: "Team not found" };
    await ctx.db.patch(team._id, { attendance: args.present });
    await audit(ctx, {
      action: "teams.setAttendance",
      adminId: admin._id,
      adminLabel: admin.email,
      details: `${code} marked ${args.present ? "PRESENT" : "ABSENT"}`,
    });
    return { ok: true as const };
  },
});

export const setAttendanceBulk = mutation({
  args: { token: v.string(), present: v.boolean() },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    const teams = await ctx.db.query("teams").withIndex("by_teamCode").collect();
    for (const t of teams) {
      if (t.attendance !== args.present) await ctx.db.patch(t._id, { attendance: args.present });
    }
    await audit(ctx, {
      action: "teams.setAttendanceBulk",
      adminId: admin._id,
      adminLabel: admin.email,
      details: `All ${teams.length} team(s) marked ${args.present ? "PRESENT" : "ABSENT"}`,
    });
    return { ok: true as const, count: teams.length };
  },
});

// ---------- Backfill ----------
// Integrity-checked: only stores a plaintext whose hash matches the stored hash.
export const backfillPasswords = mutation({
  args: {
    token: v.string(),
    entries: v.array(v.object({ teamCode: v.string(), password: v.string() })),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdminByToken(ctx, args.token);
    const verified: string[] = [];
    const skipped: string[] = [];
    for (const e of args.entries) {
      const code = e.teamCode.trim().toUpperCase();
      const team = await ctx.db
        .query("teams")
        .withIndex("by_teamCode", (q) => q.eq("teamCode", code))
        .unique();
      if (!team) {
        skipped.push(code);
        continue;
      }
      if (hashPassword(e.password, team.salt) === team.passwordHash) {
        await ctx.db.patch(team._id, { passwordPlain: e.password });
        verified.push(code);
      } else {
        skipped.push(code);
      }
    }
    await audit(ctx, {
      action: "teams.backfillPasswords",
      adminId: admin._id,
      adminLabel: admin.email,
      details: `Backfilled plaintext copies: ${verified.length} verified, ${skipped.length} skipped`,
    });
    return { ok: true as const, verified: verified.length, skipped };
  },
});
