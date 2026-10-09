// OPERATION ZERO HOUR - 400-session load simulation.
// Wave-shaped like real browsers: concurrent logins, live-read fans, a full
// field wrong-code burst, and admin dashboards watching.
// Wrong codes only - no solve state is ever mutated. Attempts cleaned after.
import { ConvexHttpClient } from "convex/browser";
import { readFileSync } from "fs";

const URL = "https://beaming-mallard-142.convex.cloud";
const c = new ConvexHttpClient(URL);
const TARGET_SESSIONS = 400;

type Team = { code: string; pw: string };

function loadTeams(): Team[] {
  const out: Team[] = [];
  for (const line of readFileSync(".credentials.local", "utf8").split("\n")) {
    const m = /^(Team \d+) \| (TM-\d{3}) \| ([A-Z0-9]{8}) \|/.exec(line.trim());
    if (m) out.push({ code: m[2], pw: m[3] });
  }
  return out;
}

async function wave<T>(items: T[], size: number, fn: (item: T) => Promise<unknown>): Promise<number> {
  let ok = 0;
  for (let i = 0; i < items.length; i += size) {
    const res = await Promise.allSettled(items.slice(i, i + size).map(fn));
    ok += res.filter((r) => r.status === "fulfilled").length;
  }
  return ok;
}

async function main() {
  const teams = loadTeams();
  console.log("== OPZH 400-SESSION LOAD SIM ==");
  console.log(`field: ${teams.length} teams -> target ${TARGET_SESSIONS} sessions`);

  // ---- Phase A: 400 concurrent-ish logins (sessions per active member)
  const t0 = Date.now();
  let loginsOk = 0;
  const tokens: string[] = [];
  const loginJobs: Team[] = [];
  for (let i = 0; i < TARGET_SESSIONS; i++) loginJobs.push(teams[i % teams.length]);
  {
    const size = 20;
    for (let i = 0; i < loginJobs.length; i += size) {
      const chunk = loginJobs.slice(i, i + size);
      const res = await Promise.allSettled(
        chunk.map((t) => c.mutation("auth:teamLogin" as never, { teamCode: t.code, password: t.pw }))
      );
      res.forEach((r) => {
        if (r.status === "fulfilled") {
          const v = r.value as { ok: boolean; token?: string };
          if (v.ok && v.token) {
            loginsOk++;
            tokens.push(v.token);
          }
        }
      });
    }
  }
  console.log(`A. logins ${loginsOk}/${TARGET_SESSIONS} in ${Date.now() - t0}ms`);
  if (tokens.length === 0) { console.log("FATAL: no sessions"); process.exit(1); }

  // gather tokens up to TARGET for reads
  const readTokens = tokens.slice(0, TARGET_SESSIONS);

  // ---- Phase B: live-subscription mimic - every session reads same 3 gated queries as teams page
  const t1 = Date.now();
  const READ_ROUNDS = 3;
  let readsOk = 0;
  let readsTotal = 0;
  {
    const size = 24;
    for (let cyc = 0; cyc < READ_ROUNDS; cyc++) {
      for (let i = 0; i < readTokens.length; i += size) {
        const chunk = readTokens.slice(i, i + size);
        readsTotal += chunk.length * 3;
        const res = await Promise.allSettled(
          chunk.map((tk) =>
            Promise.all([
              c.query("rounds:list" as never, { token: tk }),
              c.query("round4:myStatus" as never, { token: tk }),
              c.query("submissions:access" as never, { token: tk }),
            ])
          )
        );
        readsOk += res.filter((r) => r.status === "fulfilled").length * 3;
      }
    }
  }
  console.log(`B. reads ${readsOk}/${readsTotal} in ${Date.now() - t1}ms (${Math.round((Date.now() - t1) / readsTotal)}ms avg)`);

  // ---- Phase C: the R4-open burst - every team fires the code at once (wrong, safe)
  const t2 = Date.now();
  let burstOk = 0;
  {
    const size = 18;
    for (let i = 0; i < teams.length; i += size) {
      const chunk = teams.slice(i, i + size);
      const res = await Promise.allSettled(
        chunk.map((t, idx) =>
          c.mutation("round4:submitCode" as never, { token: readTokens[(i + idx) % readTokens.length], code: "BUST" + ((i + idx) % 40) })
        )
      );
      burstOk += res.filter((r) => r.status === "fulfilled" && (r.value as { ok: boolean }).ok === false).length;
    }
  }
  console.log(`C. R4-open burst: ${burstOk}/${teams.length} teams all cleanly rejected in ${Date.now() - t2}ms`);

  // ---- Phase D: 4 admin dashboards + results tabs hammering
  const adminLogin = (await c.mutation("auth:adminLogin" as never, {
    email: process.env.ADMIN_EMAIL ?? "admin1@ozh.event",
    password: process.env.ADMIN_PW!,
  })) as { token?: string };
  const at = adminLogin.token ?? "";
  const t3 = Date.now();
  let adminOk = 0;
  let adminTotal = 0;
  {
    const size = 4;
    const READS = 6;
    for (let i = 0; i < READS * 4; i += size) {
      const res = await Promise.allSettled(
        Array.from({ length: size }, () =>
          Promise.all([
            c.query("rounds:listAdmin" as never, { token: at }),
            c.query("teams:listAdmin" as never, { token: at }),
            c.query("round4:solveListAdmin" as never, { token: at }),
            c.query("submissions:listAdmin" as never, { token: at }),
            c.query("logs:listAdmin" as never, { token: at, limit: 50 }),
          ])
        )
      );
      adminTotal += size * 5;
      adminOk += res.filter((r) => r.status === "fulfilled").length * 5;
    }
  }
  console.log(`D. admin dashboards ${adminOk}/${adminTotal} reads in ${Date.now() - t3}ms`);

  // ---- Cleanup: attempt log scrub so the event starts record-clean
  const cl = (await c.mutation("round4:clearAttempts" as never, { token: at })) as { ok: boolean; cleared: number };
  console.log(`cleanup: ${cl.ok ? cl.cleared : "?"} attempt row(s) scrubbed (rate windows pristine)`);

  const allGood =
    loginsOk === TARGET_SESSIONS && readsOk === readsTotal && burstOk === teams.length && adminOk === adminTotal;
  console.log("================================");
  console.log(allGood ? "400-SESSION LOAD: ALL GREEN" : "LOAD: DEGRADED");
  process.exit(allGood ? 0 : 1);
}
main().catch((e) => {
  console.log("FATAL:", String(e).slice(0, 200));
  process.exit(1);
});
