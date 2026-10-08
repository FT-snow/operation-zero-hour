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
        teamName: v.union(v.string(), v.null()),
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
      const solo = g.teamName === null || g.teamName.trim() === "";
      const teamName = solo ? "" : (g.teamName as string).trim();
      if (!solo) {
        const key = teamName.toLowerCase();
        if (existingNames.has(key) || seenInBatch.has(key)) {
          return { ok: false as const, error: `Duplicate team name in input: "${teamName}"` };
        }
        seenInBatch.add(key);
        existingNames.add(key);
      }
      if (g.members.length === 0) {
        return { ok: false as const, error: `Team "${teamName || "(solo)"}" has no members` };
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
        teamName: teamName || "(Solo)",
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
