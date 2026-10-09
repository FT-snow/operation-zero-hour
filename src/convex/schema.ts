import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  teams: defineTable({
    teamName: v.string(),
    teamCode: v.string(), // "TM-001"
    passwordHash: v.string(),
    salt: v.string(),
    passwordPlain: v.optional(v.string()), // admin-desk copy; team-facing endpoints never return it
    attendance: v.optional(v.boolean()), // checked in at the desk
    memberIds: v.array(v.id("participants")),
    createdAt: v.number(),
  })
    .index("by_teamCode", ["teamCode"])
    .index("by_teamName", ["teamName"]),

  participants: defineTable({
    name: v.string(),
    email: v.optional(v.string()),
    teamId: v.optional(v.id("teams")),
    source: v.string(), // "excel" | "manual"
  }).index("by_team", ["teamId"]),

  admins: defineTable({
    email: v.string(), // admin1@ozh.event
    passwordHash: v.string(),
    salt: v.string(),
    name: v.string(),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    tokenHash: v.string(),
    tokenPrefix: v.string(), // first 6 chars for identification
    role: v.string(), // "team" | "admin"
    teamId: v.optional(v.id("teams")),
    adminId: v.optional(v.id("admins")),
    createdAt: v.number(),
    expiresAt: v.number(), // 14 days
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_team", ["teamId"])
    .index("by_admin", ["adminId"]),

  rounds: defineTable({
    roundNumber: v.number(), // 1-5
    status: v.string(), // not_started | live | closed
    videosRevealed: v.optional(v.boolean()), // Round 3 only
  }).index("by_roundNumber", ["roundNumber"]),

  videos: defineTable({
    order: v.number(), // 1-5
    title: v.string(),
    caption: v.string(),
    embedUrl: v.string(),
  }).index("by_order", ["order"]),

  clues: defineTable({
    roundNumber: v.number(),
    order: v.number(),
    title: v.string(),
    body: v.string(),
  }).index("by_round", ["roundNumber"]),

  team_progress: defineTable({
    teamId: v.id("teams"),
    round4Cleared: v.boolean(),
    round4ClearedAt: v.optional(v.number()),
  }).index("by_team", ["teamId"]),

  round4_attempts: defineTable({
    teamId: v.id("teams"),
    isCorrect: v.boolean(),
    at: v.number(),
  }).index("by_team_time", ["teamId", "at"]),

  round4_solves: defineTable({
    teamId: v.id("teams"),
    solvedAt: v.number(),
  }).index("by_team", ["teamId"]),

  submissions: defineTable({
    teamId: v.id("teams"),
    killer: v.string(),
    method: v.string(),
    motive: v.string(),
    submittedAt: v.number(),
  }).index("by_team", ["teamId"]),

  config: defineTable({
    round4CodeHash: v.optional(v.string()),
    round4CodeSalt: v.optional(v.string()),
    realKiller: v.optional(v.string()),
    suspects: v.optional(v.array(v.string())),
  }),

  audit_log: defineTable({
    action: v.string(),
    adminId: v.optional(v.id("admins")),
    adminLabel: v.string(), // email or "system"
    details: v.string(),
    at: v.number(),
  }).index("by_time", ["at"]),
});
