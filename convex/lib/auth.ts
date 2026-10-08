import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { sha256Hex } from "./hash";

export const SESSION_TTL = 14 * 24 * 60 * 60 * 1000;

export function hashToken(token: string): string {
  return sha256Hex(token);
}

// Accept both query and mutation contexts; downloads via plain db reads only.
export type AnyCtx = QueryCtx | MutationCtx;

export async function requireTeamByToken(ctx: AnyCtx, token: string): Promise<Doc<"teams">> {
  if (!token) throw new Error("Not authenticated");
  const th = hashToken(token);
  const s = await ctx.db
    .query("sessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", th))
    .unique();
  if (!s) throw new Error("Not authenticated");
  if (s.expiresAt < Date.now()) {
    await (ctx.db as MutationCtx["db"]).delete(s._id);
    throw new Error("Session expired");
  }
  if (s.role !== "team" || !s.teamId) throw new Error("Not a team session");
  const team = await ctx.db.get(s.teamId);
  if (!team) throw new Error("Team not found");
  return team;
}

export async function requireAdminByToken(ctx: AnyCtx, token: string): Promise<Doc<"admins">> {
  if (!token) throw new Error("Not authenticated");
  const th = hashToken(token);
  const s = await ctx.db
    .query("sessions")
    .withIndex("by_tokenHash", (q) => q.eq("tokenHash", th))
    .unique();
  if (!s) throw new Error("Not authenticated");
  if (s.expiresAt < Date.now()) throw new Error("Session expired");
  if (s.role !== "admin" || !s.adminId) throw new Error("Not an admin session");
  const admin = await ctx.db.get(s.adminId);
  if (!admin) throw new Error("Admin not found");
  return admin;
}

export type SessionOpts = {
  role: "team" | "admin";
  teamId?: Id<"teams">;
  adminId?: Id<"admins">;
};

export async function createSession(ctx: MutationCtx, opts: SessionOpts): Promise<string> {
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const th = hashToken(token);
  const now = Date.now();
  await ctx.db.insert("sessions", {
    tokenHash: th,
    tokenPrefix: token.slice(0, 6),
    role: opts.role,
    teamId: opts.teamId,
    adminId: opts.adminId,
    createdAt: now,
    expiresAt: now + SESSION_TTL,
  });
  return token;
}

export async function audit(
  ctx: MutationCtx,
  opts: { action: string; adminId?: Id<"admins">; adminLabel: string; details: string }
) {
  await ctx.db.insert("audit_log", {
    action: opts.action,
    adminId: opts.adminId,
    adminLabel: opts.adminLabel,
    details: opts.details,
    at: Date.now(),
  });
}
