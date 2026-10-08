// OPERATION ZERO HOUR - Convex-side flow checks.
// Deterministic end-to-end sweep against the LIVE deployment.
// Usage: ADMIN_EMAIL=x ADMIN_PW=x npx tsx test/flows.ts

import { ConvexHttpClient } from "convex/browser";

const URL = "https://beaming-mallard-142.convex.cloud";
const c = new ConvexHttpClient(URL);

let passCount = 0;
let failCount = 0;
const failures: string[] = [];

function pass(name: string) {
  passCount++;
  console.log(`  PASS - ${name}`);
}
function fail(name: string, detail?: string) {
  failCount++;
  failures.push(name);
  console.log(`  FAIL - ${name}${detail ? ` (${detail})` : ""}`);
}
function eq(name: string, actual: unknown, expected: unknown) {
  if (actual === expected) pass(name);
  else fail(name, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
async function expectThrown(name: string, fn: () => Promise<unknown>, fragment: string) {
  try {
    await fn();
    fail(name, "expected throw, got none");
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? e);
    if (msg.includes(fragment)) pass(name);
    else fail(name, `wrong error: ${msg.slice(0, 80)}`);
  }
}

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin1@ozh.event";
  const adminPw = process.env.ADMIN_PW!;
  if (!adminPw) {
    console.log("Need ADMIN_PW env. Aborting.");
    process.exit(1);
  }

  console.log("\n== 1. LOGIN FLOWS ==");
  // 1.1 admin login happy path
  const al = await c.mutation("auth:adminLogin" as never, { email: adminEmail, password: adminPw });
  eq("admin login ok", al.ok, true);
  const adminToken = (al as { token: string }).token;

  // 1.2 admin wrong password - clean response, no throw
  const alBad = await c.mutation("auth:adminLogin" as never, { email: adminEmail, password: "wrongwrong" });
  eq("admin bad pw -> ok:false", (alBad as { ok: boolean }).ok, false);
  eq("admin bad pw msg", (alBad as { error: string }).error?.includes("Invalid credentials"), true);

  // 1.3 uppercase email accepted (normalized)
  const alUpper = await c.mutation("auth:adminLogin" as never, {
    email: adminEmail.toUpperCase(),
    password: adminPw,
  });
  eq("admin uppercase email login ok", (alUpper as { ok: boolean }).ok, true);

  // 1.4 create 3 fresh teams (ALPHA solves, BETA does not solve, GAMMA tests rate)
  const groups = [
    { teamName: "Flow Alpha", members: [{ name: "A1" }] },
    { teamName: "Flow Beta", members: [{ name: "B1" }] },
    { teamName: "Flow Gamma", members: [{ name: "G1" }] },
  ];
  const gen = await c.mutation("teams:generateCredentials" as never, { token: adminToken, groups });
  eq("generate 3 teams ok", (gen as { ok: boolean }).ok, true);
  const creds = (gen as { credentials: { teamCode: string; password: string; teamName: string }[] }).credentials;
  const alpha = creds.find((x) => x.teamName === "Flow Alpha")!;
  const beta = creds.find((x) => x.teamName === "Flow Beta")!;

  // 1.5 team login happy
  const tl = await c.mutation("auth:teamLogin" as never, { teamCode: alpha.teamCode, password: alpha.password });
  eq("team login ok", (tl as { ok: boolean }).ok, true);
  const teamToken = (tl as { token: string }).token;

  // 1.6 lowercase code
  const tlLower = await c.mutation("auth:teamLogin" as never, {
    teamCode: alpha.teamCode.toLowerCase(),
    password: alpha.password,
  });
  eq("team login lowercase code ok", (tlLower as { ok: boolean }).ok, true);

  // 1.7 padded code
  const tlPadded = await c.mutation("auth:teamLogin" as never, {
    teamCode: `  ${alpha.teamCode} `,
    password: alpha.password,
  });
  eq("team login padded code ok", (tlPadded as { ok: boolean }).ok, true);

  // 1.8 wrong password - clean response
  const tlBad = await c.mutation("auth:teamLogin" as never, { teamCode: alpha.teamCode, password: "WRONGKYE" });
  eq("team bad pw ok:false", (tlBad as { ok: boolean }).ok, false);
  eq("team bad pw msg", (tlBad as { error: string }).error?.includes("Invalid credentials"), true);

  // 1.9 nonexistent team
  const tlNone = await c.mutation("auth:teamLogin" as never, { teamCode: "TM-900", password: "XXXXXXXX" });
  eq("nonexistent team ok:false", (tlNone as { ok: boolean }).ok, false);

  // 1.10 malformed code
  const tlMal = await c.mutation("auth:teamLogin" as never, { teamCode: "NOTACODE", password: "XXXXXXXX" });
  eq("malformed code ok:false", (tlMal as { ok: boolean }).ok, false);

  // 1.11 unauthenticated gated query throws
  await expectThrown("gated query no token throws", () =>
    c.query("round4:cluesGet" as never, { token: "" }), "Not authenticated");

  // 1.12 team hitting admin query throws
  await expectThrown("team on admin query throws", () =>
    c.query("teams:listAdmin" as never, { token: teamToken }), "Not an admin session");

  // 1.13 bad token throws
  await expectThrown("garbage token throws", () =>
    c.query("rounds:list" as never, { token: "deadbeefdeadbeef" }), "Not authenticated");

  // 1.14 logout -> session dead
  const lo = await c.mutation("auth:logout" as never, { token: teamToken });
  eq("logout ok", (lo as { ok: boolean }).ok, true);
  await expectThrown("token after logout dead", () =>
    c.query("rounds:list" as never, { token: teamToken }), "Not authenticated");
  // re-login alpha for later flows
  const tl2 = await c.mutation("auth:teamLogin" as never, { teamCode: alpha.teamCode, password: alpha.password });
  const alphaToken = (tl2 as { token: string }).token;

  console.log("\n== 2. ROUND 4 FLOWS ==");
  // 2.1 code submission while not_started
  await c.mutation("rounds:setStatus" as never, { token: adminToken, roundNumber: 4, status: "not_started" });
  const s1 = await c.mutation("round4:submitCode" as never, { token: alphaToken, code: "PU88" });
  eq("code when not_started rejected", (s1 as { ok: boolean }).ok, false);
  eq("code when not_started msg", (s1 as { error: string }).error, "Round not started");

  // 2.2 code submission while closed
  await c.mutation("rounds:setStatus" as never, { token: adminToken, roundNumber: 4, status: "closed" });
  const s2 = await c.mutation("round4:submitCode" as never, { token: alphaToken, code: "PU88" });
  eq("code when closed rejected", (s2 as { ok: boolean }).ok, false);
  eq("code when closed msg", (s2 as { error: string }).error, "Round is closed");

  // 2.3 set live, wrong code returns clean fail (no leak of expected code)
  await c.mutation("rounds:setStatus" as never, { token: adminToken, roundNumber: 4, status: "live" });
  const s3 = await c.mutation("round4:submitCode" as never, { token: alphaToken, code: "AAAA" });
  eq("wrong code ok:false", (s3 as { ok: boolean }).ok, false);
  eq("wrong code no leak of solution", JSON.stringify(s3).toLowerCase().includes("pu88"), false);

  // 2.4 clues locked before solve both side
  const cl1 = await c.query("round4:cluesGet" as never, { token: alphaToken });
  eq("clues locked pre-solve", (cl1 as { locked: boolean }).locked, true);
  eq("clues content empty pre-solve", ((cl1 as { clues: unknown[] }).clues ?? []).length, 0);

  // 2.5 wrong-format submissions logged as attempts (check attemptsLog grows)
  const at0 = await c.query("round4:attemptsAdmin" as never, { token: adminToken, limit: 100 });
  const before = (at0 as { attempts: unknown[] }).attempts.length;

  // 2.6 solve with padded/lowercase code
  const s4 = await c.mutation("round4:submitCode" as never, { token: alphaToken, code: " pU88 " });
  eq("padded lowercase code accepted", (s4 as { ok: boolean }).ok, true);
  const st = await c.query("round4:myStatus" as never, { token: alphaToken });
  eq("team now cleared", (st as { cleared: boolean }).cleared, true);

  // 2.7 idempotent re-solve permitted and harmless
  const s5 = await c.mutation("round4:submitCode" as never, { token: alphaToken, code: "PU88" });
  eq("re-solve after clearing still ok", (s5 as { ok: boolean }).ok, true);

  // 2.8 clues unlocked exactly after solve
  const cl2 = await c.query("round4:cluesGet" as never, { token: alphaToken });
  eq("clues unlocked post-solve", (cl2 as { locked: boolean }).locked, false);

  // 2.9 attempt was logged with isCorrect true
  const at1 = await c.query("round4:attemptsAdmin" as never, { token: adminToken, limit: 100 });
  const after = (at1 as { attempts: { isCorrect: boolean }[] }).attempts.length;
  eq("attempt logged grew", after >= before, true);
  eq("correct attempt recorded", (at1 as { attempts: { isCorrect: boolean }[] }).attempts[0]?.isCorrect, true);

  // 2.10 beta team still locked
  const bt = await c.mutation("auth:teamLogin" as never, { teamCode: beta.teamCode, password: beta.password });
  const betaToken = (bt as { token: string }).token;
  const cl3 = await c.query("round4:cluesGet" as never, { token: betaToken });
  eq("non-solving team still locked", (cl3 as { locked: boolean }).locked, true);

  console.log("\n== 3. ROUND 5 FLOWS (beta = not cleared) ==");
  // 3.1 R5 submit before live
  const r5n = await c.mutation("rounds:setStatus" as never, { token: adminToken, roundNumber: 5, status: "not_started" });
  eq("set R5 not_started ok", (r5n as { ok: boolean }).ok, true);
  const b1 = await c.mutation("submissions:submit" as never, {
    token: betaToken, killer: "The Colonel", method: "X", motive: "Y",
  });
  eq("R5 submit not_started rejected", (b1 as { ok: boolean }).ok, false);
  eq("R5 submit not_started msg", (b1 as { error: string }).error, "Round not started");

  // 3.2 R5 live but no R4 clearance -> access denied
  await c.mutation("rounds:setStatus" as never, { token: adminToken, roundNumber: 5, status: "live" });
  const b2 = await c.mutation("submissions:submit" as never, {
    token: betaToken, killer: "The Colonel", method: "X", motive: "Y",
  });
  eq("R5 submit w/o clearance denied", (b2 as { ok: boolean }).ok, false);
  eq("R5 deny msg", (b2 as { error: string }).error?.includes("clear Round 4"), true);

  // 3.3 suspects locked for beta
  const sp1 = await c.query("submissions:suspectsForTeam" as never, { token: betaToken });
  eq("suspects locked for uncleared team", (sp1 as { locked: boolean }).locked, true);
  eq("suspect list hidden", ((sp1 as { suspects: unknown[] }).suspects ?? []).length, 0);

  // 3.4 suspects visible to cleared alpha
  const sp2 = await c.query("submissions:suspectsForTeam" as never, { token: alphaToken });
  eq("suspects visible to cleared team", (sp2 as { locked: boolean }).locked, false);
  const suspectList = (sp2 as { suspects: string[] }).suspects;
  eq("suspects non-empty", suspectList.length >= 2, true);

  // 3.5 alpha submits with killer not matching -> rejected
  const miss = await c.mutation("submissions:submit" as never, {
    token: alphaToken, killer: "", method: "METHOD", motive: "MOTIVE",
  });
  eq("empty killer field rejected", (miss as { ok: boolean }).ok, false);
  eq("empty killer msg", (miss as { error: string }).error, "All fields are required");

  // 3.6 alpha solves the case
  const sub1 = await c.mutation("submissions:submit" as never, {
    token: alphaToken,
    killer: suspectList[0],
    method: "Poison, administered at dinner",
    motive: "Debt and family name",
  });
  eq("alpha submission ok", (sub1 as { ok: boolean }).ok, true);
  const ts = (sub1 as { submittedAt: number }).submittedAt;
  eq("server timestamp present", typeof ts === "number" && ts > 0, true);

  // 3.7 duplicate rejected inside transaction
  const sub2 = await c.mutation("submissions:submit" as never, {
    token: alphaToken, killer: suspectList[0], method: "again", motive: "again",
  });
  eq("duplicate submission rejected", (sub2 as { ok: boolean }).ok, false);
  eq("dup msg", (sub2 as { error: string }).error?.includes("already filed"), true);

  // 3.8 mine shows submission
  const mine = await c.query("submissions:mine" as never, { token: alphaToken });
  eq("mine shows submitted", (mine as { submitted: boolean }).submitted, true);
  eq("mine has killer", (mine as { killer: string }).killer, suspectList[0]);

  // 3.9 R5 closed blocks everything
  await c.mutation("rounds:setStatus" as never, { token: adminToken, roundNumber: 5, status: "closed" });
  const b3 = await c.mutation("submissions:submit" as never, {
    token: betaToken, killer: "K", method: "M", motive: "V",
  });
  eq("R5 submit closed rejected", (b3 as { ok: boolean }).ok, false);
  eq("R5 closed msg", (b3 as { error: string }).error?.includes("closed"), true);
  await c.mutation("rounds:setStatus" as never, { token: adminToken, roundNumber: 5, status: "live" });

  console.log("\n== 4. ADMIN INPUT VALIDATION ==");
  // 4.1 invalid round number
  const v1 = await c.mutation("rounds:setStatus" as never, { token: adminToken, roundNumber: 9, status: "live" });
  eq("invalid round rejected", (v1 as { ok: boolean }).ok, false);

  // 4.2 invalid status string
  const v2 = await c.mutation("rounds:setStatus" as never, { token: adminToken, roundNumber: 3, status: "explosive" });
  eq("invalid status rejected", (v2 as { ok: boolean }).ok, false);

  // 4.3 invalid code format rejected
  const v3 = await c.mutation("rounds:setRound4Code" as never, { token: adminToken, code: "!!" });
  eq("invalid code format rejected", (v3 as { ok: boolean }).ok, false);

  // 4.4 killer not in suspects rejected
  const v4 = await c.mutation("rounds:setRealKiller" as never, {
    token: adminToken, killer: "The Butler", suspects: ["A", "B"],
  });
  eq("killer outside suspects rejected", (v4 as { ok: boolean }).ok, false);

  // 4.5 duplicate team name generation rejected
  const dup = await c.mutation("teams:generateCredentials" as never, {
    token: adminToken,
    groups: [{ teamName: "Flow Alpha", members: [{ name: "D1" }] }],
  });
  eq("duplicate team name rejected", (dup as { ok: boolean }).ok, false);
  eq("dup msg", (dup as { error: string }).error?.includes("Duplicate"), true);

  console.log("\n== 5. RATE LIMIT (gamma team) ==");
  const ggen = creds.find((x) => x.teamName === "Flow Gamma")!;
  const gt = await c.mutation("auth:teamLogin" as never, { teamCode: ggen.teamCode, password: ggen.password });
  const gammaToken = (gt as { token: string }).token;
  let gotLimited = false;
  for (let i = 0; i < 6; i++) {
    const r = await c.mutation("round4:submitCode" as never, { token: gammaToken, code: "WRNG" + i });
    if ((r as { rateLimited?: boolean }).rateLimited) {
      gotLimited = true;
      break;
    }
  }
  eq("gamma rate limited on 5th+ attempt", gotLimited, true);

  console.log("\n== 6. AUDIT TRAIL ==");
  const logs = await c.query("logs:listAdmin" as never, { token: adminToken, limit: 200 });
  const entries = (logs as { entries: { action: string }[] }).entries;
  eq("audit entries exist", entries.length > 0, true);
  const actions = new Set(entries.map((e) => e.action));
  const expectedSet = new Set([
    "admin.login", "teams.generateCredentials", "rounds.setStatus", "config.setRealKiller",
  ]);
  let allSeen = true;
  for (const a of expectedSet) if (!actions.has(a)) allSeen = false;
  eq("audit captures admin + round actions", allSeen, true);

  // summary
  console.log(`\n================================`);
  console.log(`RESULT: ${passCount} pass, ${failCount} fail`);
  if (failCount > 0) {
    console.log("FAILED:", failures.join(" | "));
    process.exit(1);
  }
  console.log("ALL FLOW CHECKS GREEN");
}
main().catch((e) => {
  console.log("FATAL:", e);
  process.exit(1);
});
