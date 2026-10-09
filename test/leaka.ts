import { ConvexHttpClient } from "convex/browser";
import { readFileSync } from "fs";

// Secrets that must NEVER appear in any team-visible payload:
const SECRETS = [
  "nasa", "aayan", "adarsh", "kratika", "abhilasha", "snehil", "shailey",
  "passwordplain", "passwordhash", "round4codehash", "round4codesalt",
  "drivetechs", "drive-folder", "drive.google", "admin@", "ozh.event",
  "neha", "bathroom", "scandal", "sister", "bathtub", "drowned",
];

const teamRoster = readFileSync(".credentials.local", "utf8");

async function main() {
  // login a real team (read creds right from the sheet)
  let code = "TM-001", pw = "";
  for (const line of teamRoster.split("\n")) {
    const m = /^Team 1 \| (TM-\d{3}) \| ([A-Z0-9]{8}) \|/.exec(line.trim());
    if (m) { code = m[1]; pw = m[2]; }
  }
  const c = new ConvexHttpClient("https://beaming-mallard-142.convex.cloud");
  const login = (await c.mutation("auth:teamLogin" as never, { teamCode: code, password: pw })) as { ok: boolean; token?: string; error?: string };
  if (!login.ok) { console.log("LOGIN FAILED", login.error); process.exit(1); }
  const tk = login.token!;

  const fns: [string, Record<string, unknown>][] = [
    ["rounds:list", { token: tk }],
    ["round4:myStatus", { token: tk }],
    ["round4:cluesGet", { token: tk }],
    ["submissions:access", { token: tk }],
    ["submissions:mine", { token: tk }],
    ["teams:summary", { token: tk }],
    ["videos:listVideos", { token: tk }],
    ["submissions:suspectsForTeam", { token: tk }],
  ];

  let violations = 0;
  for (const [fn, args] of fns) {
    let payload = "";
    try { payload = JSON.stringify(await c.query(fn as never, args as never)).toLowerCase(); }
    catch (e) { payload = JSON.stringify(e).toLowerCase(); }
    for (const s of SECRETS) {
      if (payload.includes(s)) { violate(); console.log(`LEAK ${fn}: contains "${s}"`); }
    }
  }
  // unauthenticated baseline
  for (const [fn] of fns) {
    let payload = "";
    try { payload = JSON.stringify(await c.query(fn as never, { token: "" } as never)).toLowerCase(); }
    catch (e) { payload = JSON.stringify(e).toLowerCase(); }
    for (const s of SECRETS) {
      if (payload.includes(s) && !payload.includes("not authenticated") && !payload.includes("error")) { violate(); console.log(`LEAK unauth ${fn}: contains "${s}"`); }
    }
  }
  console.log(violations === 0 ? "TEAM-SIDE AUDIT: ZERO SECRETS EXPOSED" : `FAIL: ${violations} secret(s) exposed`);

  function violate() { violations++; }
}
main();
