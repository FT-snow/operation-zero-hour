// OPERATION ZERO HOUR - multi-team load simulation.
// Simulates a live moment: many teams logging in at once, polling state,
// hammering the Round-4 code field, while admins watch results live.
// IMPORTANT: deliberately uses WRONG codes only - never mutates solve state.
// Usage: npx tsx test/load.ts   (reads .credentials.local for team logins)

import { ConvexHttpClient } from "convex/browser";
import { readFileSync } from "fs";

const URL = "https://beaming-mallard-142.convex.cloud";
const c = new ConvexHttpClient(URL);

type Team = { code: string; pw: string };

function loadTeams(): Team[] {
  const lines = readFileSync(".credentials.local", "utf8").split("\n");
  const teams: Team[] = [];
  for (const line of lines) {
    const m = /^(.+) \| (TM-\d{3}) \| ([A-Z0-9]{8}) \| /.exec(line.trim());
    if (m && !line.includes("ADMIN") && !line.startsWith("#")) teams.push({ code: m[2], pw: m[3] });
  }
  return teams;
}

async function main() {
  const all = loadTeams().slice(0, 12);
  console.log("== OPZH LOAD SIM ==");
  console.log(`teams under test: ${all.length} (wrong-code attempts only)`);

  // ---- Phase A: concurrent logins
  const t0 = Date.now();
  const logins = await Promise.allSettled(
    all.map((t) =>
      c.mutation("auth:teamLogin" as never, { teamCode: t.code, password: t.pw })
    )
  );
  const loginOk = logins.filter((r) => r.status === "fulfilled" && (r.value as { ok: boolean }).ok).length;
  const tokens = logins.map(
    (r) => (r.status === "fulfilled" ? (r.value as { token?: string }).token ?? "" : "")
  );
  console.log(
    `A. ${loginOk}/${all.length} concurrent logins in ${Date.now() - t0}ms`
  );

  // ---- Phase B: polling storm  (3 queries x 5 cycles x 12 teams = 180 reads)
  // Realistic shape: every team page holds ~3 live queries (one WebSocket);
  // teams arrive in overlapping waves rather than one huge HTTP burst.
  const t1 = Date.now();
  let pollOk = 0;
  const CHUNK = 4;
  for (let cycle = 0; cycle < 5; cycle++) {
    for (let i = 0; i < tokens.length; i += CHUNK) {
      const chunk = tokens.slice(i, i + CHUNK);
      const res = await Promise.allSettled(
        chunk.map((tk) =>
          Promise.all([
            c.query("rounds:list" as never, { token: tk }),
            c.query("round4:myStatus" as never, { token: tk }),
            c.query("submissions:access" as never, { token: tk }),
          ])
        )
      );
      pollOk += res.filter((r) => r.status === "fulfilled").length * 3;
    }
  }
  console.log(
    `B. ${pollOk}/180 poll reads in ${Date.now() - t1}ms (${Math.round((Date.now() - t1) / 180)}ms avg)`
  );

  // ---- Phase C: everyone smashes the code field at once (wrong code)
  const t2 = Date.now();
  const attempts = await Promise.allSettled(
    tokens.map((tk, i) =>
      c.mutation("round4:submitCode" as never, { token: tk, code: "WR0" + i })
    )
  );
  const attemptHandled = attempts.filter(
    (r) => r.status === "fulfilled" && (r.value as { ok: boolean }).ok === false
  ).length;
  console.log(
    `C. ${attemptHandled}/${all.length} concurrent wrong-code attempts cleanly rejected in ${Date.now() - t2}ms`
  );

  // ---- Phase D: admin results live view churn
  const adminLogin = await c.mutation("auth:adminLogin" as never, {
    email: process.env.ADMIN_EMAIL ?? "admin1@ozh.event",
    password: process.env.ADMIN_PW!,
  });
  const at = (adminLogin as { token?: string }).token ?? "";
  const t3 = Date.now();
  const adminReads = await Promise.allSettled(
    Array.from({ length: 6 }, () =>
      Promise.all([
        c.query("rounds:listAdmin" as never, { token: at }),
        c.query("round4:solveListAdmin" as never, { token: at }),
        c.query("submissions:listAdmin" as never, { token: at }),
        c.query("logs:listAdmin" as never, { token: at, limit: 50 }),
      ])
    )
  );
  const adminOk = adminReads.filter((r) => r.status === "fulfilled").length;
  console.log(
    `D. ${adminOk}/6 admin dashboards (24 reads) in ${Date.now() - t3}ms`
  );

  const allGood = loginOk === all.length && pollOk === 180 && attemptHandled === all.length && adminOk === 6;
  console.log("================================");
  console.log(allGood ? "LOAD SIM: ALL GREEN" : "LOAD SIM: DEGRADED");
  process.exit(allGood ? 0 : 1);}
main().catch((e) => {
  console.log("FATAL:", String(e).slice(0, 200));
  process.exit(1);
});
